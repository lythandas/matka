// backend/src/routes/publicRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient, isDbConnected } from '../db';
import { hashPassword, generateToken } from '../auth';
import { mapDbUserToApiUser } from '../utils';
import { User, Journey } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { comparePassword } from '../auth'; // Import comparePassword

export default async function publicRoutes(fastify: FastifyInstance) {

  // Health check endpoint for Docker
  fastify.get('/health', async (request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  fastify.get('/', async (request, reply) => {
    if (isDbConnected) {
      return { message: 'Fastify backend is running and connected to database.' };
    } else {
      return reply.code(503).send({ message: 'Fastify backend is running but not connected to database.' });
    }
  });

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
    fastify.log.debug('[/register] Received registration request.');
    if (!isDbConnected) {
      fastify.log.error('[/register] Database not connected.');
      return reply.code(500).send({ message: 'Database not connected. Please try again later.' });
    }
    const { username, password } = request.body as { username?: string; password?: string };

    if (!username || !password) {
      fastify.log.warn('[/register] Missing username or password.');
      return reply.code(400).send({ message: 'Username and password are required' });
    }

    try {
      fastify.log.debug(`[/register] Checking for existing user: ${username}`);
      const existingUser = await dbClient!.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existingUser.rows.length > 0) {
        fastify.log.warn(`[/register] Username already exists: ${username}`);
        return reply.code(409).send({ message: 'Username already exists' });
      }

      fastify.log.debug('[/register] Hashing password and checking user count.');
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

      fastify.log.debug(`[/register] Inserting new user: ${username}, isAdmin: ${isFirstUser}`);
      const result = await dbClient!.query(
        'INSERT INTO users (id, username, password_hash, is_admin, language, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, is_admin, name, surname, profile_image_url, language, created_at',
        [newUser.id, newUser.username, newUser.password_hash, newUser.is_admin, newUser.language, newUser.created_at]
      );
      fastify.log.debug('[/register] User inserted into database.');

      const userForApi = mapDbUserToApiUser(result.rows[0]);
      fastify.log.info(`User ${userForApi.username} registered. isAdmin: ${userForApi.isAdmin}`);
      const token = generateToken(userForApi);
      fastify.log.debug('[/register] Generated token and preparing response.');
      return { user: userForApi, token };
    } catch (error) {
      fastify.log.error(error, '[/register] Error during user registration');
      // Ensure a JSON response is always sent if one hasn't been initiated yet.
      if (!reply.sent) {
        return reply.code(500).send({ message: 'Internal server error during registration.' });
      }
      // If reply.sent is true, it means a response was already initiated.
      // We should not attempt to send another one, but ensure the function exits.
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
      fastify.log.error(error, 'Error during user login');
      if (!reply.sent) {
        return reply.code(500).send({ message: 'Internal server error during login.' });
      }
      return;
    }
  });

  // Helper function to check passphrase
  const checkJourneyPassphrase = async (journeyId: string, providedPassphrase?: string): Promise<boolean> => {
    const journeyResult = await dbClient!.query('SELECT passphrase_hash FROM journeys WHERE id = $1 AND is_public = TRUE', [journeyId]);
    const journey = journeyResult.rows[0];

    if (!journey) {
      return false; // Journey not found or not public
    }

    if (journey.passphrase_hash) {
      if (!providedPassphrase) {
        return false; // Passphrase required but not provided
      }
      return await comparePassword(providedPassphrase, journey.passphrase_hash);
    }
    return true; // No passphrase set, so access is granted
  };

  fastify.get('/public/journeys/:id', async (request, reply) => {
    if (!isDbConnected) {
      return reply.code(500).send({ message: 'Database not connected. Please try again later.' });
    }
    const { id } = request.params as { id: string };
    const providedPassphrase = request.headers['x-journey-passphrase'] as string | undefined;

    const journeyResult = await dbClient!.query(
      `SELECT j.*, u.language as owner_language
       FROM journeys j
       JOIN users u ON j.user_id = u.id
       WHERE j.id = $1 AND j.is_public = TRUE`,
      [id]
    );
    const journey: Journey = journeyResult.rows[0];

    if (!journey) {
      return reply.code(404).send({ message: 'Public journey not found or not accessible' });
    }

    if (journey.passphrase_hash && !(await comparePassword(providedPassphrase || '', journey.passphrase_hash))) {
      return reply.code(401).send({ message: 'Unauthorized: Invalid passphrase' });
    }

    return journey;
  });

  fastify.get('/public/journeys/by-name/:ownerUsername/:journeyName', async (request, reply) => {
    if (!isDbConnected) {
      return reply.code(500).send({ message: 'Database not connected. Please try again later.' });
    }
    const { ownerUsername, journeyName } = request.params as { ownerUsername: string; journeyName: string };
    const providedPassphrase = request.headers['x-journey-passphrase'] as string | undefined;
    const decodedJourneyName = decodeURIComponent(journeyName);
    fastify.log.info(`Public Journey Request: ownerUsername=${ownerUsername}, decodedJourneyName=${decodedJourneyName}`);

    const result = await dbClient!.query(
      `SELECT j.*, u.language as owner_language
       FROM journeys j
       JOIN users u ON j.user_id = u.id
       WHERE u.username ILIKE $1 AND j.name ILIKE $2 AND j.is_public = TRUE`,
      [ownerUsername, decodedJourneyName]
    );
    const journey: Journey = result.rows[0];

    if (!journey) {
      return reply.code(404).send({ message: 'Public journey not found or not accessible' });
    }

    if (journey.passphrase_hash && !(await comparePassword(providedPassphrase || '', journey.passphrase_hash))) {
      return reply.code(401).send({ message: 'Unauthorized: Invalid passphrase' });
    }

    return journey;
  });

  fastify.get('/public/journeys/:id/posts', async (request, reply) => {
    if (!isDbConnected) {
      return reply.code(500).send({ message: 'Database not connected. Please try again later.' });
    }
    const { id: journeyId } = request.params as { id: string };
    const providedPassphrase = request.headers['x-journey-passphrase'] as string | undefined;

    const journeyCheckResult = await dbClient!.query('SELECT id, passphrase_hash FROM journeys WHERE id = $1 AND is_public = TRUE', [journeyId]);
    const journey = journeyCheckResult.rows[0];

    if (!journey) {
      return reply.code(404).send({ message: 'Public journey not found or not accessible' });
    }

    if (journey.passphrase_hash && !(await comparePassword(providedPassphrase || '', journey.passphrase_hash))) {
      return reply.code(401).send({ message: 'Unauthorized: Invalid passphrase' });
    }

    const postsResult = await dbClient!.query('SELECT *, to_jsonb(coordinates) as coordinates, to_jsonb(media_items) as media_items FROM posts WHERE journey_id = $1 ORDER BY created_at DESC', [journeyId]);
    return postsResult.rows;
  });
}