// backend/src/routes/publicJourneyApiRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient, isDbConnected } from '../db';
import { Journey } from '../types';
import { comparePassword } from '../auth';

export default async function publicJourneyApiRoutes(fastify: FastifyInstance) {

  // Helper function to check passphrase (moved here for encapsulation)
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

  // Routes are now defined without the '/journeys' prefix here.
  // The full prefix '/api/public/journeys' will be applied in server.ts
  fastify.get('/:id', async (request, reply) => {
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

    fastify.log.debug(`[GET /public/journeys/:id] Journey ID: ${id}, Passphrase Hash: ${journey.passphrase_hash ? 'SET' : 'NOT SET'}`);

    if (journey.passphrase_hash && !(await comparePassword(providedPassphrase || '', journey.passphrase_hash))) {
      return reply.code(401).send({ message: 'Unauthorized: Invalid passphrase' });
    }

    return journey;
  });

  fastify.get('/by-name/:ownerUsername/:journeyName', async (request, reply) => {
    if (!isDbConnected) {
      return reply.code(500).send({ message: 'Database not connected. Please try again later.' });
    }
    const { ownerUsername, journeyName } = request.params as { ownerUsername: string; journeyName: string };
    const providedPassphrase = request.headers['x-journey-passphrase'] as string | undefined;
    const decodedJourneyName = decodeURIComponent(journeyName);
    fastify.log.info(`Public Journey API Request: ownerUsername=${ownerUsername}, decodedJourneyName=${decodedJourneyName}`);

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

    fastify.log.debug(`[GET /public/journeys/by-name] Journey Name: ${journey.name}, Passphrase Hash: ${journey.passphrase_hash ? 'SET' : 'NOT SET'}`);

    if (journey.passphrase_hash && !(await comparePassword(providedPassphrase || '', journey.passphrase_hash))) {
      return reply.code(401).send({ message: 'Unauthorized: Invalid passphrase' });
    }

    return journey;
  });

  fastify.get('/:id/posts', async (request, reply) => {
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

    fastify.log.debug(`[GET /public/journeys/:id/posts] Journey ID: ${journeyId}, Passphrase Hash: ${journey.passphrase_hash ? 'SET' : 'NOT SET'}`);

    if (journey.passphrase_hash && !(await comparePassword(providedPassphrase || '', journey.passphrase_hash))) {
      return reply.code(401).send({ message: 'Unauthorized: Invalid passphrase' });
    }

    const postsResult = await dbClient!.query('SELECT *, to_jsonb(coordinates) as coordinates, to_jsonb(media_items) as media_items FROM posts WHERE journey_id = $1 AND is_draft = FALSE ORDER BY created_at DESC', [journeyId]);
    return postsResult.rows;
  });
}