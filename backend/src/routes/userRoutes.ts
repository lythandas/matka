// backend/src/routes/userRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient, isDbConnected } from '../db';
import { generateToken, hashPassword, comparePassword } from '../auth';
import { mapDbUserToApiUser } from '../utils';
import { User } from '../types';
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
}