import Fastify, { FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FastifyRequest } from 'fastify';

const fastify = Fastify({
  logger: true
});

// Register CORS plugin
fastify.register(cors, {
  origin: '*', // Allow all origins for now, refine in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// --- In-memory Data Stores (for demonstration purposes) ---
interface User {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  permissions: string[];
  name?: string;
  surname?: string;
  profile_image_url?: string;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
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
}

interface JourneyCollaborator {
  id: string; // ID of the journey_user_permissions entry
  journey_id: string;
  user_id: string;
  username: string;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  permissions: string[]; // Permissions specific to this journey
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
  media_items?: MediaInfo[]; // Changed to an array of MediaInfo
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
let roles: Role[] = [
  { id: uuidv4(), name: 'admin', permissions: ['manage_users', 'manage_roles', 'edit_any_journey', 'delete_any_journey', 'edit_any_post', 'delete_any_post', 'manage_journey_access', 'publish_post_on_journey'], created_at: new Date().toISOString() },
  { id: uuidv4(), name: 'user', permissions: ['publish_post_on_journey'], created_at: new Date().toISOString() },
];
let journeys: Journey[] = [];
let journeyUserPermissions: JourneyCollaborator[] = [];
let posts: Post[] = [];

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_dev';
const BACKEND_EXTERNAL_URL = process.env.BACKEND_EXTERNAL_URL || 'http://localhost:3001';

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

// --- Public Routes ---

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
  const roleName = isFirstUser ? 'admin' : 'user';
  const userRole = roles.find(r => r.name === roleName);

  if (!userRole) {
    return reply.code(500).send({ message: `Default role '${roleName}' not found.` });
  }

  const newUser: User = {
    id: uuidv4(),
    username,
    password_hash,
    role: userRole.name,
    permissions: userRole.permissions,
    created_at: new Date().toISOString(),
  };
  users.push(newUser);

  const userWithoutHash: Omit<User, 'password_hash'> = { ...newUser };
  delete (userWithoutHash as any).password_hash; // Remove hash for token

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
  delete (userWithoutHash as any).password_hash;

  const token = generateToken(userWithoutHash);
  return { user: userWithoutHash, token };
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
    delete (userWithoutHash as any).password_hash;
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
    delete (userWithoutHash as any).password_hash;

    const newToken = generateToken(userWithoutHash); // Generate new token with updated user info
    return { user: userWithoutHash, token: newToken };
  });

  // Simulate media upload
  authenticatedFastify.post('/upload-media', async (request: FastifyRequest, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { fileBase64, fileType, isProfileImage } = request.body as { fileBase64: string; fileType: string; isProfileImage: boolean };

    if (!fileBase64 || !fileType) {
      return reply.code(400).send({ message: 'File data and type are required' });
    }

    // In a real app, you'd save the file and get actual URLs.
    // Here, we'll just generate mock URLs.
    const mediaId = uuidv4();
    const mockBaseUrl = `${BACKEND_EXTERNAL_URL}/uploads`; // Use external URL for frontend access

    let mediaInfo: MediaInfo;
    if (fileType.startsWith('image/')) {
      mediaInfo = {
        type: 'image',
        urls: {
          small: `${mockBaseUrl}/${mediaId}-small.jpeg`,
          medium: `${mockBaseUrl}/${mediaId}-medium.jpeg`,
          large: `${mockBaseUrl}/${mediaId}-large.jpeg`,
          original: `${mockBaseUrl}/${mediaId}-original.jpeg`,
        }
      };
    } else if (fileType.startsWith('video/')) {
      mediaInfo = {
        type: 'video',
        url: `${mockBaseUrl}/${mediaId}.mp4`,
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

  // --- Admin/User Management Routes ---

  // Get all users (Admin only)
  authenticatedFastify.get('/users', async (request: FastifyRequest, reply) => {
    if (request.user?.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
    }
    return users.map(u => {
      const userWithoutHash: Omit<User, 'password_hash'> = { ...u };
      delete (userWithoutHash as any).password_hash;
      return userWithoutHash;
    });
  });

  // Create a new user (Admin only)
  authenticatedFastify.post('/users', async (request: FastifyRequest, reply) => {
    const { username, password, role_id, name, surname } = request.body as { username?: string; password?: string; role_id?: string; name?: string; surname?: string };

    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
    }
    if (!username || !password || !role_id) {
      return reply.code(400).send({ message: 'Username, password, and role are required' });
    }

    if (users.some(u => u.username === username)) {
      return reply.code(409).send({ message: 'Username already exists' });
    }

    const userRole = roles.find(r => r.id === role_id);
    if (!userRole) {
      return reply.code(400).send({ message: 'Invalid role ID' });
    }

    const password_hash = await hashPassword(password);
    const newUser: User = {
      id: uuidv4(),
      username,
      password_hash,
      role: userRole.name,
      permissions: userRole.permissions,
      name: name || undefined,
      surname: surname || undefined,
      created_at: new Date().toISOString(),
    };
    users.push(newUser);

    const userWithoutHash: Omit<User, 'password_hash'> = { ...newUser };
    delete (userWithoutHash as any).password_hash;
    return userWithoutHash;
  });

  // Update a user (Admin only)
  authenticatedFastify.put('/users/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { username, role_id, name, surname, profile_image_url } = request.body as { username?: string; role_id?: string; name?: string; surname?: string; profile_image_url?: string };

    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const existingUser = users[userIndex];

    if (username && username !== existingUser.username && users.some(u => u.username === username && u.id !== id)) {
      return reply.code(409).send({ message: 'Username already exists' });
    }

    let updatedRole = existingUser.role;
    let updatedPermissions = existingUser.permissions;
    if (role_id) {
      const newRole = roles.find(r => r.id === role_id);
      if (!newRole) {
        return reply.code(400).send({ message: 'Invalid role ID' });
      }
      updatedRole = newRole.name;
      updatedPermissions = newRole.permissions;
    }

    users[userIndex] = {
      ...existingUser,
      username: username || existingUser.username,
      role: updatedRole,
      permissions: updatedPermissions,
      name: name === null ? undefined : (name || existingUser.name),
      surname: surname === null ? undefined : (surname || existingUser.surname),
      profile_image_url: profile_image_url === null ? undefined : (profile_image_url || existingUser.profile_image_url),
    };

    const updatedUser = users[userIndex];
    const userWithoutHash: Omit<User, 'password_hash'> = { ...updatedUser };
    delete (userWithoutHash as any).password_hash;
    return userWithoutHash;
  });

  // Delete a user (Admin only)
  authenticatedFastify.delete('/users/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
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

  // Search users (Admin only)
  authenticatedFastify.get('/users/search', async (request: FastifyRequest, reply) => {
    const { query } = request.query as { query: string };

    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
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
      delete (userWithoutHash as any).password_hash;
      return userWithoutHash;
    });
    return results;
  });

  // --- Role Management Routes ---

  // Get all roles (Admin only)
  authenticatedFastify.get('/roles', async (request: FastifyRequest, reply) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
    }
    return roles;
  });

  // Create a new role (Admin only)
  authenticatedFastify.post('/roles', async (request: FastifyRequest, reply) => {
    const { name, permissions } = request.body as { name?: string; permissions?: string[] };

    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
    }
    if (!name || !permissions) {
      return reply.code(400).send({ message: 'Role name and permissions are required' });
    }
    if (roles.some(r => r.name === name)) {
      return reply.code(409).send({ message: 'Role name already exists' });
    }

    const newRole: Role = {
      id: uuidv4(),
      name,
      permissions,
      created_at: new Date().toISOString(),
    };
    roles.push(newRole);
    return newRole;
  });

  // Update a role (Admin only)
  authenticatedFastify.put('/roles/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { name, permissions } = request.body as { name?: string; permissions?: string[] };

    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    const roleIndex = roles.findIndex(r => r.id === id);
    if (roleIndex === -1) {
      return reply.code(404).send({ message: 'Role not found' });
    }

    const existingRole = roles[roleIndex];
    if (existingRole.name === 'admin' || existingRole.name === 'user') {
      return reply.code(403).send({ message: 'Cannot edit default roles' });
    }

    if (name && name !== existingRole.name && roles.some(r => r.name === name && r.id !== id)) {
      return reply.code(409).send({ message: 'Role name already exists' });
    }

    roles[roleIndex] = {
      ...existingRole,
      name: name || existingRole.name,
      permissions: permissions || existingRole.permissions,
    };

    // Update permissions for all users assigned to this role
    users = users.map(u => {
      if (u.role === existingRole.name) {
        return { ...u, permissions: roles[roleIndex].permissions };
      }
      return u;
    });

    return roles[roleIndex];
  });

  // Delete a role (Admin only)
  authenticatedFastify.delete('/roles/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    const roleToDelete = roles.find(r => r.id === id);
    if (!roleToDelete) {
      return reply.code(404).send({ message: 'Role not found' });
    }
    if (roleToDelete.name === 'admin' || roleToDelete.name === 'user') {
      return reply.code(403).send({ message: 'Cannot delete default roles' });
    }
    if (users.some(u => u.role === roleToDelete.name)) {
      return reply.code(409).send({ message: 'Cannot delete role with assigned users' });
    }

    const initialLength = roles.length;
    roles = roles.filter(r => r.id !== id);
    if (roles.length === initialLength) {
      return reply.code(404).send({ message: 'Role not found' });
    }
    return reply.code(204).send();
  });

  // --- Journey Management Routes ---

  // Get all journeys for the authenticated user
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
    };
    journeys.push(newJourney);
    return newJourney;
  });

  // Update a journey
  authenticatedFastify.put('/journeys/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyIndex = journeys.findIndex(j => j.id === id);
    if (journeyIndex === -1) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const existingJourney = journeys[journeyIndex];

    // Check if user is owner or has 'edit_any_journey' permission
    const isOwner = existingJourney.user_id === request.user.id;
    const canEditAny = request.user.role === 'admin' && request.user.permissions.includes('edit_any_journey');

    if (!isOwner && !canEditAny) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to edit this journey.' });
    }

    journeys[journeyIndex] = {
      ...existingJourney,
      name: name || existingJourney.name,
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

    // Check if user is owner or has 'delete_any_journey' permission
    const isOwner = existingJourney.user_id === request.user.id;
    const canDeleteAny = request.user.role === 'admin' && request.user.permissions.includes('delete_any_journey');

    if (!isOwner && !canDeleteAny) {
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

    // Only owner or admin with 'manage_journey_access' can view collaborators
    const isOwner = journey.user_id === request.user.id;
    const canManageAccess = request.user.role === 'admin' || journeyUserPermissions.some(jup => jup.journey_id === journeyId && jup.user_id === request.user?.id && jup.permissions.includes('manage_journey_access'));

    if (!isOwner && !canManageAccess) {
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
            permissions: jup.permissions,
          } as JourneyCollaborator; // Explicitly cast to JourneyCollaborator
        }
        return null;
      })
      .filter((c): c is JourneyCollaborator => c !== null);

    return collaboratorsForJourney;
  });

  // Add a collaborator to a journey
  authenticatedFastify.post('/journeys/:id/collaborators', async (request: FastifyRequest, reply) => {
    const { id: journeyId } = request.params as { id: string };
    const { username, permissions } = request.body as { username: string; permissions: string[] };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Only owner or admin with 'manage_journey_access' can add collaborators
    const isOwner = journey.user_id === request.user.id;
    const canManageAccess = request.user.role === 'admin' || journeyUserPermissions.some(jup => jup.journey_id === journeyId && jup.user_id === request.user?.id && jup.permissions.includes('manage_journey_access'));

    if (!isOwner && !canManageAccess) {
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
      permissions: permissions || [],
    };
    journeyUserPermissions.push(newCollaborator);
    return newCollaborator;
  });

  // Update collaborator permissions
  authenticatedFastify.put('/journeys/:journeyId/collaborators/:userId', async (request: FastifyRequest, reply) => {
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };
    const { permissions } = request.body as { permissions: string[] };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Only owner or admin with 'manage_journey_access' can update collaborators
    const isOwner = journey.user_id === request.user.id;
    const canManageAccess = request.user.role === 'admin' || journeyUserPermissions.some(jup => jup.journey_id === journeyId && jup.user_id === request.user?.id && jup.permissions.includes('manage_journey_access'));

    if (!isOwner && !canManageAccess) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const collabIndex = journeyUserPermissions.findIndex(jup => jup.journey_id === journeyId && jup.user_id === userId);
    if (collabIndex === -1) {
      return reply.code(404).send({ message: 'Collaborator not found for this journey' });
    }

    journeyUserPermissions[collabIndex].permissions = permissions;
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

    // Only owner or admin with 'manage_journey_access' can remove collaborators
    const isOwner = journey.user_id === request.user.id;
    const canManageAccess = request.user.role === 'admin' || journeyUserPermissions.some(jup => jup.journey_id === journeyId && jup.user_id === request.user?.id && jup.permissions.includes('manage_journey_access'));

    if (!isOwner && !canManageAccess) {
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

    // Check if user is owner or collaborator with 'publish_post_on_journey' or admin
    const isOwner = journey.user_id === request.user.id;
    const isCollaborator = journeyUserPermissions.some(jup => jup.journey_id === journeyId && jup.user_id === request.user?.id);
    const isAdmin = request.user.role === 'admin';

    if (!isOwner && !isCollaborator && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have access to this journey.' });
    }

    return posts.filter(p => p.journey_id === journeyId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

  // Create a new post
  authenticatedFastify.post('/posts', async (request: FastifyRequest, reply) => {
    const { journeyId, title, message, media_items, coordinates } = request.body as { // Changed from mediaInfo to media_items, removed spotifyEmbedUrl
      journeyId?: string;
      title?: string;
      message?: string;
      media_items?: MediaInfo[]; // Changed to MediaInfo[]
      coordinates?: { lat: number; lng: number };
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    if (!journeyId) {
      return reply.code(400).send({ message: 'journeyId is required' });
    }
    if (!title && !message && (!media_items || media_items.length === 0) && !coordinates) { // Updated check
      return reply.code(400).send({ message: 'At least a title, message, media, or coordinates are required' });
    }

    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    // Check if user is owner or collaborator with 'publish_post_on_journey' or admin
    const isOwner = journey.user_id === request.user.id;
    const canPublish = journeyUserPermissions.some(jup => jup.journey_id === journeyId && jup.user_id === request.user?.id && jup.permissions.includes('publish_post_on_journey'));
    const isAdmin = request.user.role === 'admin';

    if (!isOwner && !canPublish && !isAdmin) {
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
      media_items: media_items && media_items.length > 0 ? media_items : undefined, // Changed to media_items
      coordinates: coordinates || undefined,
      created_at: new Date().toISOString(),
    };
    posts.unshift(newPost); // Add to the beginning for newest first
    return newPost;
  });

  // Update a post
  authenticatedFastify.put('/posts/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { title, message, media_items, coordinates } = request.body as { // Changed from mediaInfo to media_items, removed spotifyEmbedUrl
      title?: string;
      message?: string;
      media_items?: MediaInfo[]; // Changed to MediaInfo[]
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

    // Check if user is owner of the post, owner of the journey, collaborator with 'publish_post_on_journey', or admin with 'edit_any_post'
    const isPostAuthor = existingPost.user_id === request.user.id;
    const isJourneyOwner = journey.user_id === request.user.id;
    const canPublish = journeyUserPermissions.some(jup => jup.journey_id === journey.id && jup.user_id === request.user?.id && jup.permissions.includes('publish_post_on_journey'));
    const canEditAny = request.user.role === 'admin' && request.user.permissions.includes('edit_any_post');

    if (!isPostAuthor && !isJourneyOwner && !canPublish && !canEditAny) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to edit this post.' });
    }

    posts[postIndex] = {
      ...existingPost,
      title: title === null ? undefined : (title || existingPost.title),
      message: message || existingPost.message,
      media_items: media_items === null ? undefined : (media_items && media_items.length > 0 ? media_items : undefined), // Changed to media_items
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

    // Check if user is owner of the post, owner of the journey, or admin with 'delete_any_post'
    const isPostAuthor = existingPost.user_id === request.user.id;
    const isJourneyOwner = journey.user_id === request.user.id;
    const canDeleteAny = request.user.role === 'admin' && request.user.permissions.includes('delete_any_post');

    if (!isPostAuthor && !isJourneyOwner && !canDeleteAny) {
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