import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Client as MinioClient } from 'minio';
import { Client as PgClient } from 'pg';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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

// MinIO Client
const minioClient = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'journey-images';
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Secret for JWTs

// Define image sizes for optimization
const IMAGE_SIZES = {
  small: { width: 300, height: 225 },
  medium: { width: 600, height: 450 },
  large: { width: 1200, height: 900 },
};

// Ensure bucket exists and set public read policy
async function ensureMinioBucket() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET_NAME, 'us-east-1');
    fastify.log.info(`Bucket '${MINIO_BUCKET_NAME}' created.`);
  } else {
    fastify.log.info(`Bucket '${MINIO_BUCKET_NAME}' already exists.`);
  }

  // Set public read policy for the bucket
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          AWS: ['*'],
        },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${MINIO_BUCKET_NAME}/*`],
      },
    ],
  };

  try {
    await minioClient.setBucketPolicy(MINIO_BUCKET_NAME, JSON.stringify(policy));
    fastify.log.info(`Public read policy set for bucket '${MINIO_BUCKET_NAME}'.`);
  } catch (error) {
    fastify.log.error({ error }, `Error setting public read policy for bucket '${MINIO_BUCKET_NAME}'.`);
  }
}

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
  // For now, all authenticated users can upload images. Permissions can be added later.

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

    const imageUrls: { [key: string]: string } = {};
    const baseObjectName = randomUUID();
    const minioPublicUrlBase = process.env.MINIO_PUBLIC_URL_BASE || `http://localhost:${process.env.MINIO_PORT || '9000'}`;

    // Upload original image
    const originalObjectName = `${baseObjectName}-original.${fileExtension}`;
    const originalStream = new Readable();
    originalStream.push(buffer);
    originalStream.push(null);
    await minioClient.putObject(MINIO_BUCKET_NAME, originalObjectName, originalStream, buffer.length, {
      'Content-Type': imageType,
    });
    imageUrls.original = `${minioPublicUrlBase}/${MINIO_BUCKET_NAME}/${originalObjectName}`;
    fastify.log.info(`Original image '${originalObjectName}' uploaded successfully.`);


    for (const sizeKey of Object.keys(IMAGE_SIZES) as Array<keyof typeof IMAGE_SIZES>) {
      const { width, height } = IMAGE_SIZES[sizeKey];
      const objectName = `${baseObjectName}-${sizeKey}.${fileExtension}`;
      
      fastify.log.info(`Resizing image to ${width}x${height} for object: ${objectName}`);
      let resizedBuffer;
      try {
        resizedBuffer = await sharp(buffer)
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        fastify.log.info(`Image resized to ${sizeKey}. New buffer size: ${resizedBuffer.length}`);
      } catch (sharpError) {
        fastify.log.error({ sharpError }, `Error during image resizing to ${sizeKey} with sharp.`);
        // Continue to next size or handle error as appropriate
        continue; 
      }

      const stream = new Readable();
      stream.push(resizedBuffer);
      stream.push(null);

      fastify.log.info(`Uploading object '${objectName}' to MinIO bucket '${MINIO_BUCKET_NAME}'`);
      await minioClient.putObject(MINIO_BUCKET_NAME, objectName, stream, resizedBuffer.length, {
        'Content-Type': imageType,
      });
      fastify.log.info(`Object '${objectName}' uploaded successfully.`);
      
      imageUrls[sizeKey] = `${minioPublicUrlBase}/${MINIO_BUCKET_NAME}/${objectName}`;
    }
    
    reply.status(200).send({ imageUrls });
  } catch (error) {
    fastify.log.error({ error }, 'Error uploading image');
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
      // Delete all associated image sizes from MinIO, including original
      for (const sizeKey of Object.keys(post.image_urls)) {
        const imageUrl = (post.image_urls as any)[sizeKey]; // Cast to any to access dynamically
        if (imageUrl) {
          const url = new URL(imageUrl);
          const objectName = url.pathname.split('/').pop();
          if (objectName) {
            fastify.log.info(`Deleting image '${objectName}' from MinIO.`);
            await minioClient.removeObject(MINIO_BUCKET_NAME, objectName);
            fastify.log.info(`Image '${objectName}' deleted from MinIO.`);
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

// Run the server
const start = async () => {
  try {
    await pgClient.connect();
    fastify.log.info('Connected to PostgreSQL database.');

    await ensureMinioBucket();
    await ensureDbTable();

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