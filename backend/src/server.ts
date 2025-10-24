import Fastify, { FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FastifyRequest } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import fastifyStatic from '@fastify/static';
import { Client } from 'pg'; // Import the PostgreSQL client

const fastify = Fastify({
  logger: true,
  bodyLimit: 12 * 1024 * 1024, // Set body limit to 12MB
});

// Register CORS plugin
fastify.register(cors, {
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', '*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Register @fastify/static to serve uploaded files from the 'uploads' directory
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../uploads'),
  prefix: '/uploads/',
  decorateReply: false
});

// --- Data Interfaces ---
interface User {
  id: string;
  username: string;
  password_hash: string;
  is_admin: boolean; // Renamed to is_admin for DB consistency
  name?: string;
  surname?: string;
  profile_image_url?: string;
  created_at: string;
}

interface Journey {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  owner_username: string;
  owner_name?: string;
  owner_surname?: string;
  owner_profile_image_url?: string;
  is_public: boolean;
}

interface JourneyCollaborator {
  id: string;
  journey_id: string;
  user_id: string;
  username: string;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  can_read_posts: boolean;
  can_publish_posts: boolean;
  can_modify_post: boolean;
  can_delete_posts: boolean;
}

type MediaInfo =
  | { type: 'image'; urls: { small?: string; medium?: string; large?: string; original?: string } }
  | { type: 'video'; url: string };

interface Post {
  id: string;
  journey_id: string;
  user_id: string;
  author_username: string;
  author_name?: string;
  author_surname?: string;
  author_profile_image_url?: string;
  title?: string;
  message: string;
  media_items?: MediaInfo[];
  coordinates?: { lat: number; lng: number };
  created_at: string;
}

// Declare module 'fastify' to add 'user' property to FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    user?: Omit<User, 'password_hash'> & { isAdmin: boolean }; // Add isAdmin to request.user
  }
}

// --- Database Client ---
let dbClient: Client;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined. Please set it in your environment variables.');
  process.exit(1);
}
const BACKEND_EXTERNAL_URL = process.env.BACKEND_EXTERNAL_URL || 'http://localhost:3001';
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// --- Database Connection and Schema Creation ---
const connectDb = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined. Please set it in your environment variables.');
    process.exit(1);
  }

  dbClient = new Client({
    connectionString: databaseUrl,
  });

  try {
    await dbClient.connect();
    fastify.log.info('Connected to PostgreSQL database');
    await createTables();
  } catch (err: unknown) {
    fastify.log.error(err as Error, 'Failed to connect to PostgreSQL'); // Corrected logger call
    process.exit(1);
  }
};

const createTables = async () => {
  try {
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        name VARCHAR(255),
        surname VARCHAR(255),
        profile_image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS journeys (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        owner_username VARCHAR(255) NOT NULL,
        owner_name VARCHAR(255),
        owner_surname VARCHAR(255),
        owner_profile_image_url TEXT,
        is_public BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(255) PRIMARY KEY,
        journey_id VARCHAR(255) REFERENCES journeys(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        author_username VARCHAR(255) NOT NULL,
        author_name VARCHAR(255),
        author_surname VARCHAR(255),
        author_profile_image_url TEXT,
        title VARCHAR(255),
        message TEXT NOT NULL,
        media_items JSONB,
        coordinates JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS journey_user_permissions (
        id VARCHAR(255) PRIMARY KEY,
        journey_id VARCHAR(255) REFERENCES journeys(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        can_read_posts BOOLEAN DEFAULT TRUE,
        can_publish_posts BOOLEAN DEFAULT TRUE,
        can_modify_post BOOLEAN DEFAULT TRUE,
        can_delete_posts BOOLEAN DEFAULT FALSE,
        UNIQUE (journey_id, user_id)
      );
    `);
    fastify.log.info('Database tables checked/created successfully');
  } catch (err: unknown) {
    fastify.log.error(err as Error, 'Error creating database tables'); // Corrected logger call
    process.exit(1);
  }
};

// --- Utility Functions ---
const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Helper to transform DB user object to API user object
const mapDbUserToApiUser = (dbUser: User): Omit<User, 'password_hash'> & { isAdmin: boolean } => ({
  id: dbUser.id,
  username: dbUser.username,
  isAdmin: dbUser.is_admin, // Map is_admin to isAdmin
  name: dbUser.name,
  surname: dbUser.surname,
  profile_image_url: dbUser.profile_image_url,
  created_at: dbUser.created_at,
});

const generateToken = (user: Omit<User, 'password_hash' | 'is_admin'> & { isAdmin: boolean }): string => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
};

const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ message: 'Authentication token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Omit<User, 'password_hash'> & { isAdmin: boolean };
    request.user = decoded;
  } catch (err) {
    reply.code(401).send({ message: 'Invalid or expired token' });
  }
};

// --- Public Routes (No Authentication Required) ---

// Root route
fastify.get('/', async (request, reply) => {
  return { message: 'Hello from Fastify backend!' };
});

// Check if any users exist (for initial admin registration)
fastify.get('/users/exists', async (request, reply) => {
  const result = await dbClient.query('SELECT COUNT(*) FROM users');
  return { exists: parseInt(result.rows[0].count) > 0 };
});

// Register a new user (first user is admin)
fastify.post('/register', async (request, reply) => {
  const { username, password } = request.body as { username?: string; password?: string };

  if (!username || !password) {
    return reply.code(400).send({ message: 'Username and password are required' });
  }

  const existingUser = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existingUser.rows.length > 0) {
    return reply.code(409).send({ message: 'Username already exists' });
  }

  const password_hash = await hashPassword(password);
  const usersCount = await dbClient.query('SELECT COUNT(*) FROM users');
  const isFirstUser = parseInt(usersCount.rows[0].count) === 0;

  const newUser: User = {
    id: uuidv4(),
    username,
    password_hash,
    is_admin: isFirstUser,
    created_at: new Date().toISOString(),
  };

  const result = await dbClient.query(
    'INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, is_admin, name, surname, profile_image_url, created_at',
    [newUser.id, newUser.username, newUser.password_hash, newUser.is_admin, newUser.created_at]
  );

  const userForApi = mapDbUserToApiUser(result.rows[0]);
  fastify.log.info(`Backend /register: User ${userForApi.username} registered. isAdmin: ${userForApi.isAdmin}`);
  const token = generateToken(userForApi);
  return { user: userForApi, token };
});

// Login user
fastify.post('/login', async (request, reply) => {
  const { username, password } = request.body as { username?: string; password?: string };

  if (!username || !password) {
    return reply.code(400).send({ message: 'Username and password are required' });
  }

  const result = await dbClient.query('SELECT * FROM users WHERE username = $1', [username]);
  const user: User = result.rows[0];

  if (!user) {
    return reply.code(401).send({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    return reply.code(401).send({ message: 'Invalid credentials' });
  }

  const userForApi = mapDbUserToApiUser(user);
  fastify.log.info(`Backend /login: User ${userForApi.username} logged in. isAdmin: ${userForApi.isAdmin}`);
  const token = generateToken(userForApi);
  return { user: userForApi, token };
});

// Get a public journey by ID
fastify.get('/public/journeys/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = await dbClient.query('SELECT * FROM journeys WHERE id = $1 AND is_public = TRUE', [id]);
  const journey: Journey = result.rows[0];

  if (!journey) {
    return reply.code(404).send({ message: 'Public journey not found or not accessible' });
  }
  return journey;
});

// Get a public journey by owner username and journey name
fastify.get('/public/journeys/by-name/:ownerUsername/:journeyName', async (request, reply) => {
  const { ownerUsername, journeyName } = request.params as { ownerUsername: string; journeyName: string };

  const result = await dbClient.query(
    `SELECT j.* FROM journeys j
     JOIN users u ON j.user_id = u.id
     WHERE u.username ILIKE $1 AND j.name ILIKE $2 AND j.is_public = TRUE`,
    [ownerUsername, decodeURIComponent(journeyName)]
  );
  const journey: Journey = result.rows[0];

  if (!journey) {
    return reply.code(404).send({ message: 'Public journey not found or not accessible' });
  }
  return journey;
});

// Get posts for a public journey by ID
fastify.get('/public/journeys/:id/posts', async (request, reply) => {
  const { id: journeyId } = request.params as { id: string };
  const journeyResult = await dbClient.query('SELECT id FROM journeys WHERE id = $1 AND is_public = TRUE', [journeyId]);

  if (journeyResult.rows.length === 0) {
    return reply.code(404).send({ message: 'Public journey not found or not accessible' });
  }

  const postsResult = await dbClient.query('SELECT * FROM posts WHERE journey_id = $1 ORDER BY created_at DESC', [journeyId]);
  return postsResult.rows;
});


// --- Authenticated Routes Plugin ---
fastify.register(async (authenticatedFastify) => {
  authenticatedFastify.addHook('preHandler', authenticate);

  // All routes defined within this plugin will be authenticated

  // Get current user profile
  authenticatedFastify.get('/users/profile', async (request: FastifyRequest, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const result = await dbClient.query(
      'SELECT id, username, is_admin, name, surname, profile_image_url, created_at FROM users WHERE id = $1',
      [request.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }
    return mapDbUserToApiUser(user);
  });

  // Update current user profile
  authenticatedFastify.put('/users/profile', async (request: FastifyRequest, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { name, surname, profile_image_url } = request.body as { name?: string; surname?: string; profile_image_url?: string };

    const result = await dbClient.query(
      'UPDATE users SET name = $1, surname = $2, profile_image_url = $3 WHERE id = $4 RETURNING id, username, is_admin, name, surname, profile_image_url, created_at',
      [name === null ? null : name, surname === null ? null : surname, profile_image_url === null ? null : profile_image_url, request.user.id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const updatedUser = mapDbUserToApiUser(result.rows[0]);
    const newToken = generateToken(updatedUser);
    return { user: updatedUser, token: newToken };
  });

  // Handle media upload
  authenticatedFastify.post('/upload-media', async (request: FastifyRequest, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { fileBase64, fileType, isProfileImage } = request.body as { fileBase64: string; fileType: string; isProfileImage: boolean };

    if (!fileBase64 || !fileType) {
      return reply.code(400).send({ message: 'File data and type are required' });
    }

    const mediaId = uuidv4();
    const fileExtension = fileType.split('/')[1] || 'bin';
    const fileName = `${mediaId}-original.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      const buffer = Buffer.from(fileBase64, 'base64');
      await fs.writeFile(filePath, buffer);
    } catch (error: unknown) {
      console.error('Error saving uploaded file:', error);
      return reply.code(500).send({ message: 'Failed to save uploaded file' });
    }

    const mockBaseUrl = `${BACKEND_EXTERNAL_URL}/uploads`;
    fastify.log.info(`Generated media URL base: ${mockBaseUrl}`);
    fastify.log.info(`Generated file name: ${fileName}`);
    fastify.log.info(`Full image URL: ${mockBaseUrl}/${fileName}`);


    let mediaInfo: MediaInfo;
    if (fileType.startsWith('image/')) {
      mediaInfo = {
        type: 'image',
        urls: {
          small: `${mockBaseUrl}/${fileName}`,
          medium: `${mockBaseUrl}/${fileName}`,
          large: `${mockBaseUrl}/${fileName}`,
          original: `${mockBaseUrl}/${fileName}`,
        }
      };
    } else if (fileType.startsWith('video/')) {
      mediaInfo = {
        type: 'video',
        url: `${mockBaseUrl}/${fileName}`,
      };
    } else {
      return reply.code(400).send({ message: 'Unsupported media type' });
    }

    if (isProfileImage && mediaInfo.type === 'image') {
      const updateResult = await dbClient.query(
        'UPDATE users SET profile_image_url = $1 WHERE id = $2 RETURNING id, username, is_admin, name, surname, profile_image_url, created_at',
        [mediaInfo.urls.medium, request.user.id]
      );
      if (updateResult.rows.length > 0) {
        request.user = mapDbUserToApiUser(updateResult.rows[0]); // Update request.user for new token generation
      }
    }

    return { mediaInfo };
  });

  // --- Admin-only User Management Routes ---

  // Get all users (Admin only)
  authenticatedFastify.get('/users', async (request: FastifyRequest, reply) => {
    if (!request.user || !request.user.isAdmin) { // Check isAdmin
      return reply.code(403).send({ message: 'Forbidden: Only administrators can view all users.' });
    }
    const result = await dbClient.query(
      'SELECT id, username, is_admin, name, surname, profile_image_url, created_at FROM users ORDER BY created_at DESC'
    );
    return result.rows.map(mapDbUserToApiUser); // Map all users
  });

  // Create a new user (Admin only)
  authenticatedFastify.post('/users', async (request: FastifyRequest, reply) => {
    const { username, password, name, surname } = request.body as { username?: string; password?: string; name?: string; surname?: string };

    if (!request.user || !request.user.isAdmin) { // Check isAdmin
      return reply.code(403).send({ message: 'Forbidden: Only administrators can create users.' });
    }
    if (!username || !password) {
      return reply.code(400).send({ message: 'Username and password are required' });
    }

    const existingUser = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return reply.code(409).send({ message: 'Username already exists' });
    }

    const password_hash = await hashPassword(password);

    const newUser: User = {
      id: uuidv4(),
      username,
      password_hash,
      is_admin: false,
      name: name || undefined,
      surname: surname || undefined,
      created_at: new Date().toISOString(),
    };

    const result = await dbClient.query(
      'INSERT INTO users (id, username, password_hash, is_admin, name, surname, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, is_admin, name, surname, profile_image_url, created_at',
      [newUser.id, newUser.username, newUser.password_hash, newUser.is_admin, newUser.name, newUser.surname, newUser.created_at]
    );
    return mapDbUserToApiUser(result.rows[0]); // Map the created user
  });

  // Update a user (Admin only)
  authenticatedFastify.put('/users/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { username, name, surname, profile_image_url, is_admin } = request.body as { username?: string; name?: string; surname?: string; profile_image_url?: string; is_admin?: boolean };

    if (!request.user || !request.user.isAdmin) { // Check isAdmin
      return reply.code(403).send({ message: 'Forbidden: Only administrators can update other users.' });
    }

    const existingUserResult = await dbClient.query('SELECT username FROM users WHERE id = $1', [id]);
    if (existingUserResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }
    const existingUsername = existingUserResult.rows[0].username;

    if (username && username !== existingUsername) {
      const conflictCheck = await dbClient.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
      if (conflictCheck.rows.length > 0) {
        return reply.code(409).send({ message: 'Username already exists' });
      }
    }

    const result = await dbClient.query(
      `UPDATE users SET
        username = COALESCE($1, username),
        name = $2,
        surname = $3,
        profile_image_url = $4,
        is_admin = COALESCE($5, is_admin)
       WHERE id = $6
       RETURNING id, username, is_admin, name, surname, profile_image_url, created_at`,
      [username, name === null ? null : name, surname === null ? null : surname, profile_image_url === null ? null : profile_image_url, is_admin, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }
    return mapDbUserToApiUser(result.rows[0]); // Map the updated user
  });

  // Reset user password (Admin only)
  authenticatedFastify.put('/users/:id/reset-password', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { newPassword } = request.body as { newPassword?: string };

    if (!request.user || !request.user.isAdmin) { // Check isAdmin
      return reply.code(403).send({ message: 'Forbidden: Only administrators can reset user passwords.' });
    }
    if (!newPassword) {
      return reply.code(400).send({ message: 'New password is required' });
    }

    const userResult = await dbClient.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const password_hash = await hashPassword(newPassword);
    await dbClient.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id]);
    return reply.code(200).send({ message: 'Password reset successfully' });
  });

  // Delete a user (Admin only)
  authenticatedFastify.delete('/users/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user || !request.user.isAdmin) { // Check isAdmin
      return reply.code(403).send({ message: 'Forbidden: Only administrators can delete users.' });
    }
    if (request.user.id === id) {
      return reply.code(403).send({ message: 'Forbidden: An administrator cannot delete their own account.' });
    }

    const deleteResult = await dbClient.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    // CASCADE DELETE should handle journeys, posts, and permissions automatically due to foreign key constraints
    return reply.code(204).send();
  });

  // Search users (Accessible to all authenticated users)
  authenticatedFastify.get('/users/search', async (request: FastifyRequest, reply) => {
    const { query } = request.query as { query: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Authentication required to search users.' });
    }
    if (!query) {
      return reply.code(400).send({ message: 'Search query is required' });
    }

    const searchLower = `%${query.toLowerCase()}%`;
    const result = await dbClient.query(
      `SELECT id, username, is_admin, name, surname, profile_image_url, created_at
       FROM users
       WHERE username ILIKE $1 OR name ILIKE $2 OR surname ILIKE $3`,
      [searchLower, searchLower, searchLower]
    );
    return result.rows.map(mapDbUserToApiUser); // Map search results
  });

  // --- Journey Management Routes ---

  // Get all journeys for the authenticated user (owned or collaborated)
  authenticatedFastify.get('/journeys', async (request: FastifyRequest, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const result = await dbClient.query(
      `SELECT DISTINCT ON (j.id) j.*
       FROM journeys j
       LEFT JOIN journey_user_permissions jup ON j.id = jup.journey_id
       WHERE j.user_id = $1 OR jup.user_id = $1
       ORDER BY j.id, j.created_at DESC`,
      [request.user.id]
    );
    return result.rows;
  });

  // Create a new journey
  authenticatedFastify.post('/journeys', async (request: FastifyRequest, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { name } = request.body as { name?: string };

    if (!name) {
      return reply.code(400).send({ message: 'Journey name is required' });
    }

    const newJourney: Journey = {
      id: uuidv4(),
      name,
      created_at: new Date().toISOString(),
      user_id: request.user.id,
      owner_username: request.user.username,
      owner_name: request.user.name,
      owner_surname: request.user.surname,
      owner_profile_image_url: request.user.profile_image_url,
      is_public: false,
    };

    const result = await dbClient.query(
      `INSERT INTO journeys (id, name, created_at, user_id, owner_username, owner_name, owner_surname, owner_profile_image_url, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [newJourney.id, newJourney.name, newJourney.created_at, newJourney.user_id, newJourney.owner_username, newJourney.owner_name, newJourney.owner_surname, newJourney.owner_profile_image_url, newJourney.is_public]
    );
    return result.rows[0];
  });

  // Update a journey
  authenticatedFastify.put('/journeys/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { name, is_public } = request.body as { name?: string; is_public?: boolean };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
    const existingJourney = journeyResult.rows[0];

    if (!existingJourney) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = existingJourney.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to edit this journey.' });
    }

    const result = await dbClient.query(
      `UPDATE journeys SET
        name = COALESCE($1, name),
        is_public = COALESCE($2, is_public)
       WHERE id = $3
       RETURNING *`,
      [name, is_public, id]
    );
    return result.rows[0];
  });

  // Delete a journey
  authenticatedFastify.delete('/journeys/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
    const existingJourney = journeyResult.rows[0];

    if (!existingJourney) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = existingJourney.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to delete this journey.' });
    }

    const deleteResult = await dbClient.query('DELETE FROM journeys WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // CASCADE DELETE should handle posts and permissions automatically
    return reply.code(204).send();
  });

  // Get journey collaborators
  authenticatedFastify.get('/journeys/:id/collaborators', async (request: FastifyRequest, reply) => {
    const { id: journeyId } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to view collaborators for this journey.' });
    }

    const result = await dbClient.query(
      `SELECT jup.id, jup.journey_id, jup.user_id, jup.can_read_posts, jup.can_publish_posts, jup.can_modify_post, jup.can_delete_posts,
              u.username, u.name, u.surname, u.profile_image_url
       FROM journey_user_permissions jup
       JOIN users u ON jup.user_id = u.id
       WHERE jup.journey_id = $1`,
      [journeyId]
    );
    return result.rows;
  });

  // Add a collaborator to a journey
  authenticatedFastify.post('/journeys/:id/collaborators', async (request: FastifyRequest, reply) => {
    const { id: journeyId } = request.params as { id: string };
    const { username } = request.body as { username: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const targetUserResult = await dbClient.query('SELECT id, username, name, surname, profile_image_url FROM users WHERE username = $1', [username]);
    const targetUser = targetUserResult.rows[0];
    if (!targetUser) {
      return reply.code(404).send({ message: 'User to add not found' });
    }
    if (targetUser.id === journey.user_id) {
      return reply.code(400).send({ message: 'Cannot add journey owner as collaborator' });
    }

    const existingCollab = await dbClient.query('SELECT id FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2', [journeyId, targetUser.id]);
    if (existingCollab.rows.length > 0) {
      return reply.code(409).send({ message: 'User is already a collaborator' });
    }

    const newCollaborator: JourneyCollaborator = {
      id: uuidv4(),
      journey_id: journeyId,
      user_id: targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      surname: targetUser.surname,
      profile_image_url: targetUser.profile_image_url,
      can_read_posts: true,
      can_publish_posts: true,
      can_modify_post: true,
      can_delete_posts: false,
    };

    const result = await dbClient.query(
      `INSERT INTO journey_user_permissions (id, journey_id, user_id, can_read_posts, can_publish_posts, can_modify_post, can_delete_posts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [newCollaborator.id, newCollaborator.journey_id, newCollaborator.user_id, newCollaborator.can_read_posts, newCollaborator.can_publish_posts, newCollaborator.can_modify_post, newCollaborator.can_delete_posts]
    );
    return result.rows[0];
  });

  // Update collaborator permissions
  authenticatedFastify.put('/journeys/:journeyId/collaborators/:userId', async (request: FastifyRequest, reply) => {
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };
    const { can_read_posts, can_publish_posts, can_modify_post, can_delete_posts } = request.body as {
      can_read_posts?: boolean;
      can_publish_posts?: boolean;
      can_modify_post?: boolean;
      can_delete_posts?: boolean;
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const collabResult = await dbClient.query('SELECT id FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2', [journeyId, userId]);
    if (collabResult.rows.length === 0) {
      return reply.code(404).send({ message: 'Collaborator not found for this journey' });
    }

    const result = await dbClient.query(
      `UPDATE journey_user_permissions SET
        can_read_posts = COALESCE($1, can_read_posts),
        can_publish_posts = COALESCE($2, can_publish_posts),
        can_modify_post = COALESCE($3, can_modify_post),
        can_delete_posts = COALESCE($4, can_delete_posts)
       WHERE journey_id = $5 AND user_id = $6
       RETURNING *`,
      [can_read_posts, can_publish_posts, can_modify_post, can_delete_posts, journeyId, userId]
    );
    return result.rows[0];
  });

  // Remove a collaborator from a journey
  authenticatedFastify.delete('/journeys/:journeyId/collaborators/:userId', async (request: FastifyRequest, reply) => {
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const deleteResult = await dbClient.query('DELETE FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2 RETURNING id', [journeyId, userId]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'Collaborator not found for this journey' });
    }
    return reply.code(204).send();
  });


  // --- Post Management Routes ---

  // Get posts for a specific journey
  authenticatedFastify.get('/posts', async (request: FastifyRequest, reply) => {
    const { journeyId } = request.query as { journeyId: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    if (!journeyId) {
      return reply.code(400).send({ message: 'journeyId is required' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin
    const collaboratorPermsResult = await dbClient.query(
      'SELECT can_read_posts FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [journeyId, request.user.id]
    );
    const canRead = collaboratorPermsResult.rows.length > 0 ? collaboratorPermsResult.rows[0].can_read_posts : false;

    if (!isOwner && !isAdmin && !canRead) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to read posts in this journey.' });
    }

    const postsResult = await dbClient.query('SELECT * FROM posts WHERE journey_id = $1 ORDER BY created_at DESC', [journeyId]);
    return postsResult.rows;
  });

  // Create a new post
  authenticatedFastify.post('/posts', async (request: FastifyRequest, reply) => {
    const { journeyId, title, message, media_items, coordinates, created_at } = request.body as {
      journeyId?: string;
      title?: string;
      message?: string;
      media_items?: MediaInfo[];
      coordinates?: { lat: number; lng: number };
      created_at?: string;
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    if (!journeyId) {
      return reply.code(400).send({ message: 'journeyId is required' });
    }
    if (!title && !message && (!media_items || media_items.length === 0) && !coordinates) {
      return reply.code(400).send({ message: 'At least a title, message, media, or coordinates are required' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin
    const collaboratorPermsResult = await dbClient.query(
      'SELECT can_publish_posts FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [journeyId, request.user.id]
    );
    const canPublish = collaboratorPermsResult.rows.length > 0 ? collaboratorPermsResult.rows[0].can_publish_posts : false;

    if (!isOwner && !isAdmin && !canPublish) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to create posts in this journey.' });
    }

    const newPost: Post = {
      id: uuidv4(),
      journey_id: journeyId,
      user_id: request.user.id,
      author_username: request.user.username,
      author_name: request.user.name,
      author_surname: request.user.surname,
      author_profile_image_url: request.user.profile_image_url,
      title: title || undefined,
      message: message || '',
      media_items: media_items && media_items.length > 0 ? media_items : undefined,
      coordinates: coordinates || undefined,
      created_at: created_at || new Date().toISOString(),
    };

    const result = await dbClient.query(
      `INSERT INTO posts (id, journey_id, user_id, author_username, author_name, author_surname, author_profile_image_url, title, message, media_items, coordinates, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        newPost.id, newPost.journey_id, newPost.user_id, newPost.author_username, newPost.author_name, newPost.author_surname,
        newPost.author_profile_image_url, newPost.title, newPost.message,
        newPost.media_items ? JSON.stringify(newPost.media_items) : null, // Explicitly stringify or set to null
        newPost.coordinates, newPost.created_at
      ]
    );
    return result.rows[0];
  });

  // Update a post
  authenticatedFastify.put('/posts/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { title, message, media_items, coordinates, created_at } = request.body as {
      title?: string;
      message?: string;
      media_items?: MediaInfo[];
      coordinates?: { lat: number; lng: number };
      created_at?: string;
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const postResult = await dbClient.query('SELECT user_id, journey_id FROM posts WHERE id = $1', [id]);
    const existingPost = postResult.rows[0];
    if (!existingPost) {
      return reply.code(404).send({ message: 'Post not found' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [existingPost.journey_id]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Associated journey not found' });
    }

    const isPostAuthor = existingPost.user_id === request.user.id;
    const isJourneyOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin
    const collaboratorPermsResult = await dbClient.query(
      'SELECT can_modify_post FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [existingPost.journey_id, request.user.id]
    );
    const canModify = collaboratorPermsResult.rows.length > 0 ? collaboratorPermsResult.rows[0].can_modify_post : false;

    if (!isPostAuthor && !isJourneyOwner && !isAdmin && !canModify) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to edit this post.' });
    }

    const result = await dbClient.query(
      `UPDATE posts SET
        title = $1,
        message = COALESCE($2, message),
        media_items = $3,
        coordinates = $4,
        created_at = COALESCE($5, created_at)
       WHERE id = $6
       RETURNING *`,
      [
        title === null ? null : title,
        message,
        media_items && media_items.length > 0 ? JSON.stringify(media_items) : null, // Explicitly stringify or set to null
        coordinates === null ? null : coordinates,
        created_at,
        id
      ]
    );
    return result.rows[0];
  });

  // Delete a post
  authenticatedFastify.delete('/posts/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const postResult = await dbClient.query('SELECT user_id, journey_id FROM posts WHERE id = $1', [id]);
    const existingPost = postResult.rows[0];
    if (!existingPost) {
      return reply.code(404).send({ message: 'Post not found' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [existingPost.journey_id]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Associated journey not found' });
    }

    const isPostAuthor = existingPost.user_id === request.user.id;
    const isJourneyOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin; // Check isAdmin
    const collaboratorPermsResult = await dbClient.query(
      'SELECT can_delete_posts FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [existingPost.journey_id, request.user.id]
    );
    const canDelete = collaboratorPermsResult.rows.length > 0 ? collaboratorPermsResult.rows[0].can_delete_posts : false;

    if (!isPostAuthor && !isJourneyOwner && !isAdmin && !canDelete) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to delete this post.' });
    }

    const deleteResult = await dbClient.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'Post not found' });
    }
    return reply.code(204).send();
  });

});


// Run the server
const start = async () => {
  try {
    await connectDb(); // Connect to DB before starting server
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err: unknown) {
    fastify.log.error(err as Error, 'Failed to start server'); // Corrected logger call
    process.exit(1);
  }
};

start();