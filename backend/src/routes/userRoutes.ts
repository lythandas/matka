// backend/src/routes/userRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient, isDbConnected } from '../db';
import { authenticate, generateToken, hashPassword, comparePassword } from '../auth';
import { mapDbUserToApiUser } from '../utils';
import { User, ApiUser } from '../types';
import { v4 as uuidv4 } from 'uuid';

export default async function userRoutes(fastify: FastifyInstance) {
  // Public routes for user authentication and existence check
  fastify.get('/users/exists', async (request, reply) => {
    if (!isDbConnected) {
      return reply.code(500).type('application/json').send({ message: 'Database not connected. Please try again later.' });
    }
    try {
      const result = await dbClient!.query('SELECT COUNT(*) FROM users');
      return reply.send({ exists: parseInt(result.rows[0].count) > 0 });
    } catch (error) {
      fastify.log.error(error, 'Error checking if users exist in database');
      return reply.status(500).type('application/json').send({ message: 'Internal server error: Could not check user existence.' });
    }
  });

  fastify.post('/register', async (request, reply) => {
    fastify.log.debug('[/api/register] Received registration request.');
    if (!isDbConnected) {
      fastify.log.error('[/api/register] Database not connected.');
      return reply.code(500).send({ message: 'Database not connected. Please try again later.' });
    }
    const { username, password } = request.body as { username?: string; password?: string };

    if (!username || !password) {
      fastify.log.warn('[/api/register] Missing username or password.');
      return reply.code(400).send({ message: 'Username and password are required' });
    }

    try {
      fastify.log.debug(`[/api/register] Checking for existing user: ${username}`);
      const existingUser = await dbClient!.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existingUser.rows.length > 0) {
        fastify.log.warn(`[/api/register] Username already exists: ${username}`);
        return reply.code(409).send({ message: 'Username already exists' });
      }

      fastify.log.debug('[/api/register] Hashing password and checking user count.');
      const password_hash = await hashPassword(password);
      const usersCount = await dbClient!.query('SELECT COUNT(*) FROM users');
      const isFirstUser = parseInt(usersCount.rows[0].count) === 0;

      const newUser: User = {
        id: uuidv4(),
        username,
        password_hash,
        is_admin: isFirstUser,
        language: 'en',
        created_at: new Date().toISOString(),
      };

      fastify.log.debug(`[/api/register] Inserting new user: ${username}, isAdmin: ${isFirstUser}`);
      const result = await dbClient!.query(
        'INSERT INTO users (id, username, password_hash, is_admin, language, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, is_admin, name, surname, profile_image_url, language, created_at',
        [newUser.id, newUser.username, newUser.password_hash, newUser.is_admin, newUser.language, newUser.created_at]
      );
      fastify.log.debug('[/api/register] User inserted into database.');

      const userForApi = mapDbUserToApiUser(result.rows[0]);
      fastify.log.info(`User ${userForApi.username} registered. isAdmin: ${userForApi.isAdmin}`);
      const token = generateToken(userForApi);
      fastify.log.debug('[/api/register] Generated token and preparing response.');
      return { user: userForApi, token };
    } catch (error) {
      fastify.log.error(error, '[/api/register] Error during user registration');
      if (!reply.sent) {
        return reply.code(500).send({ message: 'Internal server error during registration.' });
      }
      return;
    }
  });

  fastify.post('/login', async (request, reply) => {
    if (!isDbConnected) {
      return reply.code(500).send({ message: 'Database not connected. Please try again later.' });
    }
    const { username, password } = request.body as { username?: string; password?: string };

    if (!username || !password) {
      return reply.code(400).send({ message: 'Username and password are required' });
    }

    try {
      const result = await dbClient!.query('SELECT * FROM users WHERE username = $1', [username]);
      const user: User = result.rows[0];

      if (!user) {
        return reply.code(401).send({ message: 'Invalid credentials' });
      }

      const isPasswordValid = await comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        return reply.code(401).send({ message: 'Invalid credentials' });
      }

      const userForApi = mapDbUserToApiUser(user);
      fastify.log.info(`User ${userForApi.username} logged in. isAdmin: ${userForApi.isAdmin}`);
      const token = generateToken(userForApi);
      return { user: userForApi, token };
    } catch (error) {
      fastify.log.error(error, '[/api/login] Error during user login');
      if (!reply.sent) {
        return reply.code(500).send({ message: 'Internal server error during login.' });
      }
      return;
    }
  });

  // All routes below this line require authentication
  fastify.addHook('preHandler', authenticate);

  // Get current user profile
  fastify.get('/users/profile', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const result = await dbClient!.query(
      'SELECT id, username, is_admin, name, surname, profile_image_url, language, created_at FROM users WHERE id = $1',
      [request.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }
    return mapDbUserToApiUser(user);
  });

  // Update current user profile
  fastify.put('/users/profile', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { name, surname, profile_image_url, language } = request.body as { name?: string; surname?: string; profile_image_url?: string; language?: string };

    const result = await dbClient!.query(
      'UPDATE users SET name = $1, surname = $2, profile_image_url = $3, language = $4 WHERE id = $5 RETURNING id, username, is_admin, name, surname, profile_image_url, language, created_at',
      [name === null ? null : name, surname === null ? null : surname, profile_image_url === null ? null : profile_image_url, language, request.user.id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const updatedUser = mapDbUserToApiUser(result.rows[0]);

    // If profile_image_url was updated, also update all posts by this user
    if (profile_image_url !== undefined) { // Check if the profile_image_url was part of the update request
      await dbClient!.query(
        'UPDATE posts SET author_profile_image_url = $1 WHERE user_id = $2',
        [profile_image_url === null ? null : profile_image_url, request.user.id]
      );
    }

    const newToken = generateToken(updatedUser);
    return { user: updatedUser, token: newToken };
  });

  // --- Admin-only User Management Routes ---

  fastify.get('/users', async (request, reply) => {
    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can view all users.' });
    }
    const result = await dbClient!.query(
      'SELECT id, username, is_admin, name, surname, profile_image_url, language, created_at FROM users ORDER BY created_at DESC'
    );
    return result.rows.map(mapDbUserToApiUser);
  });

  fastify.post('/users', async (request, reply) => {
    const { username, password, name, surname } = request.body as { username?: string; password?: string; name?: string; surname?: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can create users.' });
    }
    if (!username || !password) {
      return reply.code(400).send({ message: 'Username and password are required' });
    }

    const existingUser = await dbClient!.query('SELECT id FROM users WHERE username = $1', [username]);
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
      language: 'en',
      created_at: new Date().toISOString(),
    };

    const result = await dbClient!.query(
      'INSERT INTO users (id, username, password_hash, is_admin, name, surname, language, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, is_admin, name, surname, profile_image_url, language, created_at',
      [newUser.id, newUser.username, newUser.password_hash, newUser.is_admin, newUser.name, newUser.surname, newUser.language, newUser.created_at]
    );
    return mapDbUserToApiUser(result.rows[0]);
  });

  fastify.put('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { username, name, surname, profile_image_url, is_admin, language } = request.body as { username?: string; name?: string; surname?: string; profile_image_url?: string; is_admin?: boolean; language?: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can update other users.' });
    }

    const existingUserResult = await dbClient!.query('SELECT username FROM users WHERE id = $1', [id]);
    if (existingUserResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }
    const existingUsername = existingUserResult.rows[0].username;

    if (username && username !== existingUsername) {
      const conflictCheck = await dbClient!.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
      if (conflictCheck.rows.length > 0) {
        return reply.code(409).send({ message: 'Username already exists' });
      }
    }

    const result = await dbClient!.query(
      `UPDATE users SET
        username = COALESCE($1, username),
        name = $2,
        surname = $3,
        profile_image_url = $4,
        is_admin = COALESCE($5, is_admin),
        language = COALESCE($6, language)
       WHERE id = $7
       RETURNING id, username, is_admin, name, surname, profile_image_url, language, created_at`,
      [username, name === null ? null : name, surname === null ? null : surname, profile_image_url === null ? null : profile_image_url, is_admin, language, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    // If profile_image_url was updated, also update all posts by this user
    if (profile_image_url !== undefined) { // Check if the profile_image_url was part of the update request
      await dbClient!.query(
        'UPDATE posts SET author_profile_image_url = $1 WHERE user_id = $2',
        [profile_image_url === null ? null : profile_image_url, id]
      );
    }

    return mapDbUserToApiUser(result.rows[0]);
  });

  fastify.put('/users/:id/reset-password', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newPassword } = request.body as { newPassword?: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can reset user passwords.' });
    }
    if (!newPassword) {
      return reply.code(400).send({ message: 'New password is required' });
    }

    const userResult = await dbClient!.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const password_hash = await hashPassword(newPassword);
    await dbClient!.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id]);
    return reply.code(200).send({ message: 'Password reset successfully' });
  });

  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can delete users.' });
    }
    if (request.user.id === id) {
      return reply.code(403).send({ message: 'Forbidden: An administrator cannot delete their own account.' });
    }

    const deleteResult = await dbClient!.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    return reply.code(204).send();
  });

  // Search users (Accessible to all authenticated users)
  fastify.get('/users/search', async (request, reply) => {
    const { query } = request.query as { query: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Authentication required to search users.' });
    }
    if (!query) {
      return reply.code(400).send({ message: 'Search query is required' });
    }

    const searchLower = `%${query.toLowerCase()}%`;
    const result = await dbClient!.query(
      `SELECT id, username, is_admin, name, surname, profile_image_url, language, created_at
       FROM users
       WHERE username ILIKE $1 OR name ILIKE $2 OR surname ILIKE $3`,
      [searchLower, searchLower, searchLower]
    );
    return result.rows.map(mapDbUserToApiUser);
  });
}