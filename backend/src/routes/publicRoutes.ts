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

  // Removed the conflicting root route:
  // fastify.get('/', async (request, reply) => {
  //   if (isDbConnected) {
  //     return { message: 'Fastify backend is running and connected to database.' };
  //   } else {
  //     return reply.code(503).send({ message: 'Fastify backend is running but not connected to database.' });
  //   }
  // });

  // Removed /users/exists from here. It will be moved to userRoutes.ts.

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