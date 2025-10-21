import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Client as PgClient } from 'pg';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs/promises'; // Use promise-based fs
import fastifyStatic from '@fastify/static'; // Import fastify-static

const fastify = Fastify({
  logger: true,
  bodyLimit: 8 * 1024 * 1024, // Set body limit to 8MB for image uploads
});

// Register CORS plugin
fastify.register(cors, {
  origin: '*', // Allow all origins for now, refine in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Database Client
const pgClient = new PgClient({
  connectionString: process.env.DATABASE_URL,
});

const UPLOADS_DIR = path.join(process.cwd(), 'uploads'); // Directory for storing images
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Secret for JWTs

// Define image sizes for optimization
const IMAGE_SIZES = {
  small: { width: 300, height: 225 },
  medium: { width: 600, height: 450 },
  large: { width: 1200, height: 900 },
};

// Register fastify-static to serve uploaded images
fastify.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: '/uploads/', // Serve files under /uploads/ route
});

// Ensure database tables exist (without creating default users/journeys/posts)
async function ensureDbTable() {
  // Drop tables if they exist to ensure schema is always up-to-date in dev
  await pgClient.query('DROP TABLE IF EXISTS posts;');
  await pgClient.query('DROP TABLE IF EXISTS journeys;');
  await pgClient.query('DROP TABLE IF EXISTS users;');
  fastify.log.info('Existing posts, journeys, and users tables dropped (if any).');

  // Create users table
  await pgClient.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
      permissions JSONB DEFAULT '[]', -- e.g., ['create_post', 'delete_post', 'create_journey', 'delete_journey']
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  fastify.log.info('Users table ensured.');

  // Create journeys table with foreign key to users
  await pgClient.query(`
    CREATE TABLE journeys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to user
      name TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  fastify.log.info('Journeys table ensured.');

  // Create posts table with foreign key to journeys and users
  await pgClient.query(`
    CREATE TABLE posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to user
      title TEXT,
      message TEXT NOT NULL,
      image_urls JSONB,
      spotify_embed_url TEXT,
      coordinates JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  fastify.log.info('Posts table ensured.');
}

// Authentication middleware
fastify.decorateRequest('user', null); // Add user property to request

fastify.addHook('preHandler', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7, authHeader.length);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string; permissions: string[] };
      request.user = decoded;
    } catch (error) {
      fastify.log.warn('Invalid or expired JWT provided.');
      // Optionally, clear the token from the client if it's expired/invalid
      // reply.status(401).send({ message: 'Unauthorized: Invalid or expired token.' });
    }
  }
  // If no token or invalid token, request.user remains null
});


// Routes
fastify.get('/', async (request, reply) => {
  return { hello: 'world from Fastify backend!' };
});

// Check if any users exist
fastify.get('/users/exists', async (request, reply) => {
  try {
    const result = await pgClient.query('SELECT 1 FROM users LIMIT 1');
    const exists = (result.rowCount ?? 0) > 0; // Safely access rowCount
    return { exists };
  } catch (error) {
    fastify.log.error({ error }, 'Error checking for existing users');
    reply.status(500).send({ message: 'Failed to check user existence' });
  }
});

// Register the first user (admin)
fastify.post('/register', async (request, reply) => {
  try {
    const { username, password } = request.body as { username: string; password: string };

    if (!username || !password) {
      reply.status(400).send({ message: 'Username and password are required.' });
      return;
    }

    const userCountResult = await pgClient.query('SELECT 1 FROM users LIMIT 1');
    const userCount = userCountResult.rowCount ?? 0; // Safely access rowCount
    if (userCount > 0) {
      reply.status(403).send({ message: 'Registration is closed. An admin user already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminPermissions = ['create_post', 'delete_post', 'create_journey', 'delete_journey', 'manage_users', 'edit_any_journey', 'delete_any_journey', 'delete_any_post'];
    const result = await pgClient.query(
      'INSERT INTO users (username, password_hash, role, permissions) VALUES ($1, $2, $3, $4) RETURNING id, username, role, permissions',
      [username, hashedPassword, 'admin', JSON.stringify(adminPermissions)]
    );
    const newUser = result.rows[0];

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role, permissions: newUser.permissions },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    reply.status(201).send({ token, user: { id: newUser.id, username: newUser.username, role: newUser.role, permissions: newUser.permissions } });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation error code
      reply.status(409).send({ message: 'Username already exists.' });
    } else {
      fastify.log.error({ error }, 'Error during first user registration');
      reply.status(500).send({ message: 'Failed to register user' });
    }
  }
});


// User login route
fastify.post('/login', async (request, reply) => {
  try {
    const { username, password } = request.body as { username: string; password: string };
    const result = await pgClient.query('SELECT id, username, password_hash, role, permissions FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      reply.status(401).send({ message: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      reply.status(401).send({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, permissions: user.permissions },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    reply.status(200).send({ token, user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions } });
  } catch (error) {
    fastify.log.error({ error }, 'Error during login');
    reply.status(500).send({ message: 'Failed to login' });
  }
});

// Admin route to create a new user
fastify.post('/users', async (request, reply) => {
  if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_users')) {
    reply.status(403).send({ message: 'Forbidden: Only administrators with manage_users permission can create users.' });
    return;
  }

  try {
    const { username, password, role = 'user', permissions = [] } = request.body as {
      username: string;
      password: string;
      role?: string;
      permissions?: string[];
    };

    if (!username || !password) {
      reply.status(400).send({ message: 'Username and password are required.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pgClient.query(
      'INSERT INTO users (username, password_hash, role, permissions) VALUES ($1, $2, $3, $4) RETURNING id, username, role, permissions',
      [username, hashedPassword, role, JSON.stringify(permissions)]
    );
    reply.status(201).send(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation error code
      reply.status(409).send({ message: 'Username already exists.' });
    } else {
      fastify.log.error({ error }, 'Error creating user');
      reply.status(500).send({ message: 'Failed to create user' });
    }
  }
});

// Get all users (Admin only)
fastify.get('/users', async (request, reply) => {
  if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_users')) {
    reply.status(403).send({ message: 'Forbidden: Only administrators with manage_users permission can view users.' });
    return;
  }
  try {
    const result = await pgClient.query('SELECT id, username, role, permissions, created_at FROM users ORDER BY created_at ASC');
    return result.rows;
  } catch (error) {
    fastify.log.error({ error }, 'Error fetching users');
    reply.status(500).send({ message: 'Failed to fetch users' });
  }
});

// Update a user (Admin only)
fastify.put('/users/:id', async (request, reply) => {
  if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_users')) {
    reply.status(403).send({ message: 'Forbidden: Only administrators with manage_users permission can update users.' });
    return;
  }

  try {
    const { id } = request.params as { id: string };
    const { username, role, permissions } = request.body as {
      username?: string;
      role?: string;
      permissions?: string[];
    };

    const fieldsToUpdate: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (username !== undefined) {
      fieldsToUpdate.push(`username = $${paramIndex++}`);
      params.push(username);
    }
    if (role !== undefined) {
      fieldsToUpdate.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    if (permissions !== undefined) {
      fieldsToUpdate.push(`permissions = $${paramIndex++}`);
      params.push(JSON.stringify(permissions));
    }

    if (fieldsToUpdate.length === 0) {
      reply.status(400).send({ message: 'No fields provided for update.' });
      return;
    }

    params.push(id); // Add ID as the last parameter

    const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, role, permissions`;
    const result = await pgClient.query(query, params);

    if (result.rowCount === 0) {
      reply.status(404).send({ message: 'User not found.' });
      return;
    }
    reply.status(200).send(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation error code
      reply.status(409).send({ message: 'Username already exists.' });
    } else {
      fastify.log.error({ error }, 'Error updating user');
      reply.status(500).send({ message: 'Failed to update user' });
    }
  }
});

// Delete a user (Admin only)
fastify.delete('/users/:id', async (request, reply) => {
  if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_users')) {
    reply.status(403).send({ message: 'Forbidden: Only administrators with manage_users permission can delete users.' });
    return;
  }

  try {
    const { id } = request.params as { id: string };
    // Prevent admin from deleting themselves
    if (request.user.id === id) {
      reply.status(403).send({ message: 'Forbidden: You cannot delete your own admin account.' });
      return;
    }

    const result = await pgClient.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      reply.status(404).send({ message: 'User not found.' });
      return;
    }
    reply.status(200).send({ message: 'User deleted successfully', id: result.rows[0].id });
  } catch (error) {
    fastify.log.error({ error }, 'Error deleting user');
    reply.status(500).send({ message: 'Failed to delete user' });
  }
});


// Get all journeys (now filtered by user_id or all for admin)
fastify.get('/journeys', async (request, reply) => {
  if (!request.user) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }
  try {
    let query = 'SELECT * FROM journeys';
    const params: string[] = [];

    if (request.user.role !== 'admin' && !request.user.permissions.includes('edit_any_journey')) {
      query += ' WHERE user_id = $1';
      params.push(request.user.id);
    }
    query += ' ORDER BY created_at ASC';
    const result = await pgClient.query(query, params);
    return result.rows;
  } catch (error) {
    fastify.log.error({ error }, 'Error fetching journeys');
    reply.status(500).send({ message: 'Failed to fetch journeys' });
  }
});

// Create a new journey
fastify.post('/journeys', async (request, reply) => {
  if (!request.user || !request.user.id) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }
  // Check if user has permission to create journey
  if (request.user.role !== 'admin' && !request.user.permissions.includes('create_journey')) {
    reply.status(403).send({ message: 'Forbidden: You do not have permission to create journeys.' });
    return;
  }

  try {
    const { name } = request.body as { name: string };
    if (!name || name.trim() === '') {
      reply.status(400).send({ message: 'Journey name is required.' });
      return;
    }
    const result = await pgClient.query(
      'INSERT INTO journeys (name, user_id) VALUES ($1, $2) RETURNING *',
      [name.trim(), request.user.id]
    );
    reply.status(201).send(result.rows[0]);
  } catch (error) {
    fastify.log.error({ error }, 'Error creating journey');
    reply.status(500).send({ message: 'Failed to create journey' });
  }
});

// Update a journey
fastify.put('/journeys/:id', async (request, reply) => {
  if (!request.user || !request.user.id) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }

  try {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };

    if (!name || name.trim() === '') {
      reply.status(400).send({ message: 'Journey name is required.' });
      return;
    }

    // Check if the user owns the journey or has admin/edit_any_journey permissions
    const journeyResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
    const journey = journeyResult.rows[0];

    if (!journey) {
      reply.status(404).send({ message: 'Journey not found.' });
      return;
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.role === 'admin';
    const canEditAnyJourney = request.user.permissions.includes('edit_any_journey');

    if (!isOwner && !isAdmin && !canEditAnyJourney) {
      reply.status(403).send({ message: 'Forbidden: You do not have permission to edit this journey.' });
      return;
    }

    const result = await pgClient.query(
      'UPDATE journeys SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );

    if (result.rowCount === 0) {
      reply.status(404).send({ message: 'Journey not found.' });
      return;
    }
    reply.status(200).send(result.rows[0]);
  } catch (error) {
    fastify.log.error({ error }, 'Error updating journey');
    reply.status(500).send({ message: 'Failed to update journey' });
  }
});

// Delete a journey
fastify.delete('/journeys/:id', async (request, reply) => {
  if (!request.user || !request.user.id) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }

  try {
    const { id } = request.params as { id: string };

    // Check if the user owns the journey or has admin/delete_any_journey permissions
    const journeyResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
    const journey = journeyResult.rows[0];

    if (!journey) {
      reply.status(404).send({ message: 'Journey not found.' });
      return;
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.role === 'admin';
    const canDeleteAnyJourney = request.user.permissions.includes('delete_any_journey');

    if (!isOwner && !isAdmin && !canDeleteAnyJourney) {
      reply.status(403).send({ message: 'Forbidden: You do not have permission to delete this journey.' });
      return;
    }

    const result = await pgClient.query('DELETE FROM journeys WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      reply.status(404).send({ message: 'Journey not found.' });
      return;
    }
    reply.status(200).send({ message: 'Journey deleted successfully', id: result.rows[0].id });
  } catch (error) {
    fastify.log.error({ error }, 'Error deleting journey');
    reply.status(500).send({ message: 'Failed to delete journey' });
  }
});


// Get all posts for a specific journey (or all if no journeyId provided)
fastify.get('/posts', async (request, reply) => {
  if (!request.user) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }
  try {
    const { journeyId } = request.query as { journeyId?: string };
    let query = 'SELECT * FROM posts';
    const params: string[] = [];
    let paramIndex = 1;

    if (journeyId) {
      query += ` WHERE journey_id = $${paramIndex++}`;
      params.push(journeyId);
    }

    if (request.user.role !== 'admin' && !request.user.permissions.includes('edit_any_journey')) {
      query += `${params.length > 0 ? ' AND' : ' WHERE'} user_id = $${paramIndex++}`;
      params.push(request.user.id);
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await pgClient.query(query, params);
    return result.rows;
  } catch (error) {
    fastify.log.error({ error }, 'Error fetching posts');
    reply.status(500).send({ message: 'Failed to fetch posts' });
  }
});

// New endpoint for uploading images
fastify.post('/upload-image', async (request, reply) => {
  if (!request.user || !request.user.id) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }

  try {
    const { imageBase64, imageType } = request.body as { imageBase64: string; imageType: string };

    if (!imageBase64 || !imageType) {
      reply.status(400).send({ message: 'Missing imageBase64 or imageType' });
      return;
    }

    const buffer = Buffer.from(imageBase64, 'base64');

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      fastify.log.warn(`Image size (${buffer.length} bytes) exceeds limit (${MAX_IMAGE_SIZE_BYTES} bytes).`);
      reply.status(400).send({ message: 'Image size exceeds 8MB limit.' });
      return;
    }

    if (!imageType.startsWith('image/')) {
      fastify.log.warn(`Invalid image type received: ${imageType}`);
      reply.status(400).send({ message: 'Invalid image type.' });
      return;
    }
    const fileExtension = imageType.split('/')[1];
    if (!['jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(fileExtension)) {
      fastify.log.warn(`Unsupported image file extension: ${fileExtension}`);
      reply.status(400).send({ message: 'Unsupported image file format.' });
      return;
    }

    // Ensure the uploads directory exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const imageUrls: { [key: string]: string } = {};
    const baseFileName = randomUUID();
    const backendBaseUrl = `http://localhost:3001`; // Assuming backend is accessible at this URL

    // Process and save images locally
    for (const sizeKey of [...Object.keys(IMAGE_SIZES), 'original'] as Array<keyof typeof IMAGE_SIZES | 'original'>) {
      const objectName = `${baseFileName}-${sizeKey}.${fileExtension}`;
      const filePath = path.join(UPLOADS_DIR, objectName);
      const publicUrl = `${backendBaseUrl}/uploads/${objectName}`;

      let processedBuffer: Buffer = buffer; // Explicitly type as Buffer
      if (sizeKey !== 'original') {
        const { width, height } = IMAGE_SIZES[sizeKey];
        fastify.log.info(`Resizing image to ${width}x${height} for file: ${objectName}`);
        try {
          processedBuffer = await sharp(buffer)
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
          fastify.log.info(`Image resized to ${sizeKey}. New buffer size: ${processedBuffer.length}`);
        } catch (sharpError) {
          fastify.log.error({ sharpError }, `Error during image resizing to ${sizeKey} with sharp.`);
          continue; 
        }
      }

      await fs.writeFile(filePath, processedBuffer);
      fastify.log.info(`Image '${objectName}' saved locally at '${filePath}'.`);
      imageUrls[sizeKey] = publicUrl;
    }
    
    reply.status(200).send({ imageUrls });
  } catch (error) {
    fastify.log.error({ error }, 'Error uploading image to local storage');
    reply.status(500).send({ message: 'Failed to upload image' });
  }
});


// Create a new post with an optional image URL, title, Spotify embed, and coordinates
fastify.post('/posts', async (request, reply) => {
  if (!request.user || !request.user.id) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }
  // Check if user has permission to create post
  if (request.user.role !== 'admin' && !request.user.permissions.includes('create_post')) {
    reply.status(403).send({ message: 'Forbidden: You do not have permission to create posts.' });
    return;
  }

  try {
    const { title, message, imageUrls, spotifyEmbedUrl, coordinates, journeyId } = request.body as { 
      title?: string; 
      message: string; 
      imageUrls?: { small?: string; medium?: string; large?: string; original?: string };
      spotifyEmbedUrl?: string; 
      coordinates?: { lat: number; lng: number };
      journeyId: string;
    };

    if (!journeyId) {
      reply.status(400).send({ message: 'Journey ID is required to create a post.' });
      return;
    }

    if (!message.trim() && !imageUrls && !spotifyEmbedUrl && !coordinates) {
      reply.status(400).send({ message: 'At least a message, image, Spotify URL, or coordinates are required.' });
      return;
    }
    
    // Check if the user owns the journey or has admin/edit_any_journey permissions
    const journeyResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];

    if (!journey) {
      reply.status(404).send({ message: 'Journey not found.' });
      return;
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.role === 'admin';
    const canEditAnyJourney = request.user.permissions.includes('edit_any_journey');

    if (!isOwner && !isAdmin && !canEditAnyJourney) {
      reply.status(403).send({ message: 'Forbidden: You do not have permission to post to this journey.' });
      return;
    }


    fastify.log.info('Inserting post into database.');
    const result = await pgClient.query(
      'INSERT INTO posts (journey_id, user_id, title, message, image_urls, spotify_embed_url, coordinates) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [journeyId, request.user.id, title || null, message, imageUrls || null, spotifyEmbedUrl || null, coordinates || null]
    );
    fastify.log.info(`Post inserted successfully. New post ID: ${result.rows[0].id}`);
    reply.status(201).send(result.rows[0]);
  } catch (error) {
    fastify.log.error({ error }, 'Error creating post');
    reply.status(500).send({ message: 'Failed to create post' });
  }
});

// Update a post by ID
fastify.put('/posts/:id', async (request, reply) => {
  if (!request.user || !request.user.id) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }

  try {
    const { id } = request.params as { id: string };
    const { title, message, imageUrls, spotifyEmbedUrl, coordinates } = request.body as {
      title?: string;
      message?: string;
      imageUrls?: { small?: string; medium?: string; large?: string; original?: string } | null;
      spotifyEmbedUrl?: string | null;
      coordinates?: { lat: number; lng: number } | null;
    };

    // First, get the post to check ownership
    const getPostResult = await pgClient.query('SELECT user_id FROM posts WHERE id = $1', [id]);
    const post = getPostResult.rows[0];

    if (!post) {
      reply.status(404).send({ message: 'Post not found.' });
      return;
    }

    // Check ownership or admin permission
    const isOwner = post.user_id === request.user.id;
    const isAdmin = request.user.role === 'admin';
    const canEditAnyPost = request.user.permissions.includes('edit_any_post');

    if (!isOwner && !isAdmin && !canEditAnyPost) {
      reply.status(403).send({ message: 'Forbidden: You do not have permission to edit this post.' });
      return;
    }

    const fieldsToUpdate: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      fieldsToUpdate.push(`title = $${paramIndex++}`);
      params.push(title || null);
    }
    if (message !== undefined) {
      fieldsToUpdate.push(`message = $${paramIndex++}`);
      params.push(message);
    }
    if (imageUrls !== undefined) {
      fieldsToUpdate.push(`image_urls = $${paramIndex++}`);
      params.push(imageUrls ? JSON.stringify(imageUrls) : null);
    }
    if (spotifyEmbedUrl !== undefined) {
      fieldsToUpdate.push(`spotify_embed_url = $${paramIndex++}`);
      params.push(spotifyEmbedUrl || null);
    }
    if (coordinates !== undefined) {
      fieldsToUpdate.push(`coordinates = $${paramIndex++}`);
      params.push(coordinates ? JSON.stringify(coordinates) : null);
    }

    if (fieldsToUpdate.length === 0) {
      reply.status(400).send({ message: 'No fields provided for update.' });
      return;
    }

    params.push(id); // Add ID as the last parameter

    const query = `UPDATE posts SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pgClient.query(query, params);

    if (result.rowCount === 0) {
      reply.status(404).send({ message: 'Post not found.' });
      return;
    }
    reply.status(200).send(result.rows[0]);
  } catch (error) {
    fastify.log.error({ error }, 'Error updating post');
    reply.status(500).send({ message: 'Failed to update post' });
  }
});


// Delete a post by ID
fastify.delete('/posts/:id', async (request, reply) => {
  if (!request.user || !request.user.id) {
    reply.status(401).send({ message: 'Authentication required.' });
    return;
  }

  try {
    const { id } = request.params as { id: string };
    fastify.log.info(`Attempting to delete post with ID: ${id}`);

    // First, get the post to check ownership and image URLs
    const getPostResult = await pgClient.query('SELECT image_urls, user_id FROM posts WHERE id = $1', [id]);
    const post = getPostResult.rows[0];

    if (!post) {
      fastify.log.warn(`Post with ID ${id} not found for deletion.`);
      reply.status(404).send({ message: 'Post not found' });
      return;
    }

    // Check ownership or admin permission
    const isOwner = post.user_id === request.user.id;
    const isAdmin = request.user.role === 'admin';
    const canDeleteAnyPost = request.user.permissions.includes('delete_any_post');

    if (!isOwner && !isAdmin && !canDeleteAnyPost) {
      reply.status(403).send({ message: 'Forbidden: You do not have permission to delete this post.' });
      return;
    }

    if (post.image_urls) {
      // Delete all associated image sizes from local storage
      for (const sizeKey of Object.keys(post.image_urls)) {
        const imageUrl = (post.image_urls as any)[sizeKey]; // Cast to any to access dynamically
        if (imageUrl) {
          try {
            const url = new URL(imageUrl);
            const fileName = path.basename(url.pathname);
            const filePath = path.join(UPLOADS_DIR, fileName);
            await fs.unlink(filePath);
            fastify.log.info(`Image file '${fileName}' deleted from local storage.`);
          } catch (fileError) {
            fastify.log.warn({ fileError }, `Could not delete local image file for URL: ${imageUrl}. It might not exist.`);
          }
        }
      }
    }

    // Then, delete the post from the database
    const result = await pgClient.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      // This case should ideally be caught by the initial post check, but as a safeguard
      reply.status(404).send({ message: 'Post not found after initial check (race condition or similar).' });
    } else {
      fastify.log.info(`Post with ID ${id} deleted successfully.`);
      reply.status(200).send({ message: 'Post deleted successfully', id: result.rows[0].id });
    }
  } catch (error) {
    fastify.log.error({ error }, 'Error deleting post');
    reply.status(500).send({ message: 'Failed to delete post' });
  }
});

// Function to connect to PostgreSQL with retries
async function connectWithRetry(client: PgClient, maxRetries = 10, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.connect();
      fastify.log.info('Connected to PostgreSQL database.');
      return;
    } catch (error) {
      fastify.log.warn(`Failed to connect to PostgreSQL (attempt ${i + 1}/${maxRetries}). Retrying in ${delay / 1000}s...`);
      if (i < maxRetries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw error; // Re-throw if max retries reached
      }
    }
  }
}

// Run the server
const start = async () => {
  try {
    await connectWithRetry(pgClient);
    await ensureDbTable(); // This will drop and recreate tables, so it should be after connections

    // Ensure the uploads directory exists on startup
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    fastify.log.info(`Ensured uploads directory exists at: ${UPLOADS_DIR}`);

    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Extend FastifyRequest with a user property
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      username: string;
      role: string;
      permissions: string[];
    } | null; // user can be null if not authenticated
  }
}