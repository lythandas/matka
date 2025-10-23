import Fastify, { FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FastifyRequest } from 'fastify';
import path from 'path'; // Import path module
import fs from 'fs/promises'; // Import fs/promises for async file operations
import fastifyStatic from '@fastify/static'; // Import the static plugin

const fastify = Fastify({
  logger: true,
  bodyLimit: 12 * 1024 * 1024, // Set body limit to 12MB
});

// Register CORS plugin
fastify.register(cors, {
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', '*'], // Explicitly allow frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Register @fastify/static to serve uploaded files from the 'uploads' directory
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../uploads'), // Path to your uploads directory
  prefix: '/uploads/', // URL prefix for serving static files (e.g., http://localhost:3001/uploads/image.jpg)
  decorateReply: false // Do not decorate reply with .sendFile, we'll handle URLs manually
});

// --- In-memory Data Stores (for demonstration purposes) ---
interface User {
  id: string;
  username: string;
  password_hash: string;
  isAdmin: boolean; // Simplified: first user is admin, others are not
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
  is_public: boolean; // New: Indicates if the journey is publicly viewable
}

interface JourneyCollaborator {
  id: string; // ID of the journey_user_permissions entry
  journey_id: string;
  user_id: string;
  username: string;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  can_read_posts: boolean; // New: Can read posts in this journey
  can_publish_posts: boolean; // Can create posts in this journey
  can_modify_post: boolean; // New: Can modify (edit) existing posts in this journey
  can_delete_posts: boolean; // New: Can delete posts in this journey
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
    user?: Omit<User, 'password_hash'>;
  }
}

let users: User[] = [];
let journeys: Journey[] = [];
let journeyUserPermissions: JourneyCollaborator[] = [];
let posts: Post[] = [];

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined. Please set it in your environment variables.');
  process.exit(1);
}
const BACKEND_EXTERNAL_URL = process.env.BACKEND_EXTERNAL_URL || 'http://localhost:3001';
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// --- Utility Functions ---
const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

const generateToken = (user: Omit<User, 'password_hash'>): string => {
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
    const decoded = jwt.verify(token, JWT_SECRET) as Omit<User, 'password_hash'>;
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
  return { exists: users.length > 0 };
});

// Register a new user (first user is admin)
fastify.post('/register', async (request, reply) => {
  const { username, password } = request.body as { username?: string; password?: string };

  if (!username || !password) {
    return reply.code(400).send({ message: 'Username and password are required' });
  }

  if (users.some(u => u.username === username)) {
    return reply.code(409).send({ message: 'Username already exists' });
  }

  const password_hash = await hashPassword(password);
  const isFirstUser = users.length === 0;

  const newUser: User = {
    id: uuidv4(),
    username,
    password_hash,
    isAdmin: isFirstUser, // First user is admin
    created_at: new Date().toISOString(),
  };
  users.push(newUser);

  const userWithoutHash: Omit<User, 'password_hash'> = { ...newUser };

  const token = generateToken(userWithoutHash);
  return { user: userWithoutHash, token };
});

// Login user
fastify.post('/login', async (request, reply) => {
  const { username, password } = request.body as { username?: string; password?: string };

  if (!username || !password) {
    return reply.code(400).send({ message: 'Username and password are required' });
  }

  const user = users.find(u => u.username === username);
  if (!user) {
    return reply.code(401).send({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    return reply.code(401).send({ message: 'Invalid credentials' });
  }

  const userWithoutHash: Omit<User, 'password_hash'> = { ...user };

  const token = generateToken(userWithoutHash);
  return { user: userWithoutHash, token };
});

// Get a public journey by ID
fastify.get('/public/journeys/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const journey = journeys.find(j => j.id === id);

  if (!journey || !journey.is_public) {
    return reply.code(404).send({ message: 'Public journey not found or not accessible' });
  }
  return journey;
});

// Get a public journey by owner username and journey name
fastify.get('/public/journeys/by-name/:ownerUsername/:journeyName', async (request, reply) => {
  const { ownerUsername, journeyName } = request.params as { ownerUsername: string; journeyName: string };

  const owner = users.find(u => u.username.toLowerCase() === ownerUsername.toLowerCase());
  if (!owner) {
    return reply.code(404).send({ message: 'Journey owner not found' });
  }

  const journey = journeys.find(j =>
    j.user_id === owner.id &&
    j.name.toLowerCase() === decodeURIComponent(journeyName).toLowerCase() &&
    j.is_public
  );

  if (!journey) {
    return reply.code(404).send({ message: 'Public journey not found or not accessible' });
  }
  return journey;
});

// Get posts for a public journey by ID
fastify.get('/public/journeys/:id/posts', async (request, reply) => {
  const { id: journeyId } = request.params as { id: string };
  const journey = journeys.find(j => j.id === journeyId);

  if (!journey || !journey.is_public) {
    return reply.code(404).send({ message: 'Public journey not found or not accessible' });
  }

  return posts.filter(p => p.journey_id === journeyId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
    const user = users.find(u => u.id === request.user?.id);
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }
    const userWithoutHash: Omit<User, 'password_hash'> = { ...user };
    return userWithoutHash;
  });

  // Update current user profile
  authenticatedFastify.put('/users/profile', async (request: FastifyRequest, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { name, surname, profile_image_url } = request.body as { name?: string; surname?: string; profile_image_url?: string };

    const userIndex = users.findIndex(u => u.id === request.user?.id);
    if (userIndex === -1) {
      return reply.code(404).send({ message: 'User not found' });
    }

    users[userIndex] = {
      ...users[userIndex],
      name: name === null ? undefined : name,
      surname: surname === null ? undefined : surname,
      profile_image_url: profile_image_url === null ? undefined : profile_image_url,
    };

    const updatedUser = users[userIndex];
    const userWithoutHash: Omit<User, 'password_hash'> = { ...updatedUser };

    const newToken = generateToken(userWithoutHash); // Generate new token with updated user info
    return { user: userWithoutHash, token: newToken };
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
    const fileExtension = fileType.split('/')[1] || 'bin'; // e.g., 'jpeg', 'png', 'mp4'
    const fileName = `${mediaId}-original.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    try {
      // Ensure the uploads directory exists
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      // Decode base64 and save the file
      const buffer = Buffer.from(fileBase64, 'base64');
      await fs.writeFile(filePath, buffer);
    } catch (error) {
      console.error('Error saving uploaded file:', error);
      return reply.code(500).send({ message: 'Failed to save uploaded file' });
    }

    const mockBaseUrl = `${BACKEND_EXTERNAL_URL}/uploads`; // Use external URL for frontend access

    let mediaInfo: MediaInfo;
    if (fileType.startsWith('image/')) {
      // For images, we can simulate different sizes by just returning the original URL for all
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

    // If it's a profile image, update the user's profile_image_url directly
    if (isProfileImage) {
      const userIndex = users.findIndex(u => u.id === request.user?.id);
      if (userIndex !== -1 && mediaInfo.type === 'image') {
        users[userIndex].profile_image_url = mediaInfo.urls.medium;
        // Update the user object in the request context for the new token
        if (request.user) {
          request.user.profile_image_url = mediaInfo.urls.medium;
        }
      }
    }

    return { mediaInfo };
  });

  // --- Admin-only User Management Routes ---

  // Get all users (Admin only)
  authenticatedFastify.get('/users', async (request: FastifyRequest, reply) => {
    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can view all users.' });
    }
    return users.map(u => {
      const userWithoutHash: Omit<User, 'password_hash'> = { ...u };
      return userWithoutHash;
    });
  });

  // Create a new user (Admin only)
  authenticatedFastify.post('/users', async (request: FastifyRequest, reply) => {
    const { username, password, name, surname } = request.body as { username?: string; password?: string; name?: string; surname?: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can create users.' });
    }
    if (!username || !password) {
      return reply.code(400).send({ message: 'Username and password are required' });
    }

    if (users.some(u => u.username === username)) {
      return reply.code(409).send({ message: 'Username already exists' });
    }

    const password_hash = await hashPassword(password);

    const newUser: User = {
      id: uuidv4(),
      username,
      password_hash,
      isAdmin: false, // New users created by admin are not admins by default
      name: name || undefined,
      surname: surname || undefined,
      created_at: new Date().toISOString(),
    };
    users.push(newUser);

    const userWithoutHash: Omit<User, 'password_hash'> = { ...newUser };
    return userWithoutHash;
  });

  // Update a user (Admin only)
  authenticatedFastify.put('/users/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { username, name, surname, profile_image_url, isAdmin } = request.body as { username?: string; name?: string; surname?: string; profile_image_url?: string; isAdmin?: boolean };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can update other users.' });
    }

    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const existingUser = users[userIndex];

    if (username && username !== existingUser.username && users.some(u => u.username === username && u.id !== id)) {
      return reply.code(409).send({ message: 'Username already exists' });
    }

    users[userIndex] = {
      ...existingUser,
      username: username || existingUser.username,
      name: name === null ? undefined : (name || existingUser.name),
      surname: surname === null ? undefined : (surname || existingUser.surname),
      profile_image_url: profile_image_url === null ? undefined : (profile_image_url || existingUser.profile_image_url),
      isAdmin: isAdmin !== undefined ? isAdmin : existingUser.isAdmin, // Admin can change isAdmin status
    };

    const updatedUser = users[userIndex];
    const userWithoutHash: Omit<User, 'password_hash'> = { ...updatedUser };
    return userWithoutHash;
  });

  // Reset user password (Admin only)
  authenticatedFastify.put('/users/:id/reset-password', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { newPassword } = request.body as { newPassword?: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can reset user passwords.' });
    }
    if (!newPassword) {
      return reply.code(400).send({ message: 'New password is required' });
    }

    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return reply.code(404).send({ message: 'User not found' });
    }

    users[userIndex].password_hash = await hashPassword(newPassword);
    return reply.code(200).send({ message: 'Password reset successfully' });
  });

  // Delete a user (Admin only)
  authenticatedFastify.delete('/users/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can delete users.' });
    }
    if (request.user.id === id) {
      return reply.code(403).send({ message: 'Forbidden: An administrator cannot delete their own account.' });
    }

    const initialLength = users.length;
    users = users.filter(u => u.id !== id);
    if (users.length === initialLength) {
      return reply.code(404).send({ message: 'User not found' });
    }

    // Also delete their journeys, posts, and journey permissions
    journeys = journeys.filter(j => j.user_id !== id);
    posts = posts.filter(p => p.user_id !== id);
    journeyUserPermissions = journeyUserPermissions.filter(jup => jup.user_id !== id);

    return reply.code(204).send();
  });

  // Search users (Accessible to all authenticated users)
  authenticatedFastify.get('/users/search', async (request: FastifyRequest, reply) => {
    const { query } = request.query as { query: string };

    if (!request.user) { // Only check for authentication, not isAdmin
      return reply.code(401).send({ message: 'Authentication required to search users.' });
    }
    if (!query) {
      return reply.code(400).send({ message: 'Search query is required' });
    }

    const searchLower = query.toLowerCase();
    const results = users.filter(u =>
      u.username.toLowerCase().includes(searchLower) ||
      u.name?.toLowerCase().includes(searchLower) ||
      u.surname?.toLowerCase().includes(searchLower)
    ).map(u => {
      const userWithoutHash: Omit<User, 'password_hash'> = { ...u };
      return userWithoutHash;
    });
    return results;
  });

  // --- Journey Management Routes ---

  // Get all journeys for the authenticated user (owned or collaborated)
  authenticatedFastify.get('/journeys', async (request: FastifyRequest, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const userJourneys = journeys.filter(j => j.user_id === request.user?.id);
    const collaboratorJourneys = journeyUserPermissions
      .filter(jup => jup.user_id === request.user?.id)
      .map(jup => journeys.find(j => j.id === jup.journey_id))
      .filter((j): j is Journey => j !== undefined);

    const allRelevantJourneys = [...userJourneys, ...collaboratorJourneys];
    const uniqueJourneys = Array.from(new Map(allRelevantJourneys.map(j => [j.id, j])).values());

    return uniqueJourneys;
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
      is_public: false, // New journeys are private by default
    };
    journeys.push(newJourney);
    return newJourney;
  });

  // Update a journey
  authenticatedFastify.put('/journeys/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { name, is_public } = request.body as { name?: string; is_public?: boolean };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyIndex = journeys.findIndex(j => j.id === id);
    if (journeyIndex === -1) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const existingJourney = journeys[journeyIndex];

    // Only owner or admin can edit
    const isOwner = existingJourney.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to edit this journey.' });
    }

    journeys[journeyIndex] = {
      ...existingJourney,
      name: name || existingJourney.name,
      is_public: is_public !== undefined ? is_public : existingJourney.is_public,
    };
    return journeys[journeyIndex];
  });

  // Delete a journey
  authenticatedFastify.delete('/journeys/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyIndex = journeys.findIndex(j => j.id === id);
    if (journeyIndex === -1) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const existingJourney = journeys[journeyIndex];

    // Only owner or admin can delete
    const isOwner = existingJourney.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to delete this journey.' });
    }

    journeys = journeys.filter(j => j.id !== id);
    posts = posts.filter(p => p.journey_id !== id); // Delete associated posts
    journeyUserPermissions = journeyUserPermissions.filter(jup => jup.journey_id !== id); // Delete associated permissions

    return reply.code(204).send();
  });

  // Get journey collaborators
  authenticatedFastify.get('/journeys/:id/collaborators', async (request: FastifyRequest, reply) => {
    const { id: journeyId } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Only owner or admin can view collaborators
    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to view collaborators for this journey.' });
    }

    const collaboratorsForJourney = journeyUserPermissions
      .filter(jup => jup.journey_id === journeyId)
      .map(jup => {
        const user = users.find(u => u.id === jup.user_id);
        if (user) {
          return {
            id: jup.id,
            journey_id: jup.journey_id,
            user_id: user.id,
            username: user.username,
            name: user.name,
            surname: user.surname,
            profile_image_url: user.profile_image_url,
            can_read_posts: jup.can_read_posts,
            can_publish_posts: jup.can_publish_posts,
            can_modify_post: jup.can_modify_post, // Include new permission
            can_delete_posts: jup.can_delete_posts,
          } as JourneyCollaborator;
        }
        return null;
      })
      .filter((c): c is JourneyCollaborator => c !== null);

    return collaboratorsForJourney;
  });

  // Add a collaborator to a journey
  authenticatedFastify.post('/journeys/:id/collaborators', async (request: FastifyRequest, reply) => {
    const { id: journeyId } = request.params as { id: string };
    const { username } = request.body as { username: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Only owner or admin can add collaborators
    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const targetUser = users.find(u => u.username === username);
    if (!targetUser) {
      return reply.code(404).send({ message: 'User to add not found' });
    }
    if (targetUser.id === journey.user_id) {
      return reply.code(400).send({ message: 'Cannot add journey owner as collaborator' });
    }
    if (journeyUserPermissions.some(jup => jup.journey_id === journeyId && jup.user_id === targetUser.id)) {
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
      can_read_posts: true, // Default permission
      can_publish_posts: true, // Default permission
      can_modify_post: true, // Default permission for new collaborators
      can_delete_posts: false, // Default permission
    };
    journeyUserPermissions.push(newCollaborator);
    return newCollaborator;
  });

  // Update collaborator permissions
  authenticatedFastify.put('/journeys/:journeyId/collaborators/:userId', async (request: FastifyRequest, reply) => {
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };
    const { can_read_posts, can_publish_posts, can_modify_post, can_delete_posts } = request.body as {
      can_read_posts?: boolean;
      can_publish_posts?: boolean;
      can_modify_post?: boolean; // Include new permission
      can_delete_posts?: boolean;
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Only owner or admin can update collaborators
    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const collabIndex = journeyUserPermissions.findIndex(jup => jup.journey_id === journeyId && jup.user_id === userId);
    if (collabIndex === -1) {
      return reply.code(404).send({ message: 'Collaborator not found for this journey' });
    }

    const existingCollab = journeyUserPermissions[collabIndex];
    journeyUserPermissions[collabIndex] = {
      ...existingCollab,
      can_read_posts: can_read_posts !== undefined ? can_read_posts : existingCollab.can_read_posts,
      can_publish_posts: can_publish_posts !== undefined ? can_publish_posts : existingCollab.can_publish_posts,
      can_modify_post: can_modify_post !== undefined ? can_modify_post : existingCollab.can_modify_post, // Update new permission
      can_delete_posts: can_delete_posts !== undefined ? can_delete_posts : existingCollab.can_delete_posts,
    };
    return journeyUserPermissions[collabIndex];
  });

  // Remove a collaborator from a journey
  authenticatedFastify.delete('/journeys/:journeyId/collaborators/:userId', async (request: FastifyRequest, reply) => {
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Only owner or admin can remove collaborators
    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const initialLength = journeyUserPermissions.length;
    journeyUserPermissions = journeyUserPermissions.filter(jup => !(jup.journey_id === journeyId && jup.user_id === userId));
    if (journeyUserPermissions.length === initialLength) {
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

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Check if user is owner, admin, or a collaborator with can_read_posts
    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;
    const collaboratorPerms = journeyUserPermissions.find(jup => jup.journey_id === journeyId && jup.user_id === request.user?.id);
    const canRead = collaboratorPerms?.can_read_posts;

    if (!isOwner && !isAdmin && !canRead) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to read posts in this journey.' });
    }

    return posts.filter(p => p.journey_id === journeyId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

  // Create a new post
  authenticatedFastify.post('/posts', async (request: FastifyRequest, reply) => {
    const { journeyId, title, message, media_items, coordinates } = request.body as {
      journeyId?: string;
      title?: string;
      message?: string;
      media_items?: MediaInfo[];
      coordinates?: { lat: number; lng: number };
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

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Check if user is owner, admin, or a collaborator with can_publish_posts
    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;
    const collaboratorPerms = journeyUserPermissions.find(jup => jup.journey_id === journey.id && jup.user_id === request.user?.id);
    const canPublish = collaboratorPerms?.can_publish_posts;

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
      created_at: new Date().toISOString(),
    };
    posts.unshift(newPost); // Add to the beginning for newest first
    return newPost;
  });

  // Update a post
  authenticatedFastify.put('/posts/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { title, message, media_items, coordinates } = request.body as {
      title?: string;
      message?: string;
      media_items?: MediaInfo[];
      coordinates?: { lat: number; lng: number };
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const postIndex = posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return reply.code(404).send({ message: 'Post not found' });
    }

    const existingPost = posts[postIndex];
    const journey = journeys.find(j => j.id === existingPost.journey_id);
    if (!journey) {
      return reply.code(404).send({ message: 'Associated journey not found' });
    }

    // Check if user is author of the post, owner of the journey, or admin, or collaborator with can_modify_post
    const isPostAuthor = existingPost.user_id === request.user.id;
    const isJourneyOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;
    const collaboratorPerms = journeyUserPermissions.find(jup => jup.journey_id === journey.id && jup.user_id === request.user?.id);
    const canModify = collaboratorPerms?.can_modify_post; // Use new can_modify_post permission

    if (!isPostAuthor && !isJourneyOwner && !isAdmin && !canModify) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to edit this post.' });
    }

    posts[postIndex] = {
      ...existingPost,
      title: title === null ? undefined : (title || existingPost.title),
      message: message || existingPost.message,
      media_items: media_items === null ? undefined : (media_items && media_items.length > 0 ? media_items : undefined),
      coordinates: coordinates === null ? undefined : (coordinates || existingPost.coordinates),
    };
    return posts[postIndex];
  });

  // Delete a post
  authenticatedFastify.delete('/posts/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const postIndex = posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return reply.code(404).send({ message: 'Post not found' });
    }

    const existingPost = posts[postIndex];
    const journey = journeys.find(j => j.id === existingPost.journey_id);
    if (!journey) {
      return reply.code(404).send({ message: 'Associated journey not found' });
    }

    // Check if user is author of the post, owner of the journey, or admin, or collaborator with can_delete_posts
    const isPostAuthor = existingPost.user_id === request.user.id;
    const isJourneyOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;
    const collaboratorPerms = journeyUserPermissions.find(jup => jup.journey_id === journey.id && jup.user_id === request.user?.id);
    const canDelete = collaboratorPerms?.can_delete_posts;

    if (!isPostAuthor && !isJourneyOwner && !isAdmin && !canDelete) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to delete this post.' });
    }

    const initialLength = posts.length;
    posts = posts.filter(p => p.id !== id);
    if (posts.length === initialLength) {
      return reply.code(404).send({ message: 'Post not found' });
    }
    return reply.code(204).send();
  });

});


// Run the server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();