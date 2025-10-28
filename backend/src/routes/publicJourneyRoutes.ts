// backend/src/routes/publicJourneyRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient } from '../db';
import { comparePassword } from '../auth'; // Import comparePassword

export default async function publicJourneyRoutes(fastify: FastifyInstance) {
  // Get a public journey by its public_link_id, now accepting a passphrase in the body
  fastify.post('/public-journeys/:publicLinkId', async (request, reply) => { // Changed to POST
    const { publicLinkId } = request.params as { publicLinkId: string };
    const { passphrase } = request.body as { passphrase?: string }; // Accept passphrase in body

    const journeyResult = await dbClient!.query(
      `SELECT j.id, j.name, j.created_at, j.user_id, j.is_public, j.public_link_id, j.passphrase_hash,
              u.username as owner_username, u.name as owner_name, u.surname as owner_surname, u.profile_image_url as owner_profile_image_url
       FROM journeys j
       JOIN users u ON j.user_id = u.id
       WHERE j.public_link_id = $1 AND j.is_public = TRUE`,
      [publicLinkId]
    );
    const journey = journeyResult.rows[0];

    if (!journey) {
      return reply.code(404).send({ message: 'Public journey not found or not published.' });
    }

    // Check for passphrase if one is set for the journey
    if (journey.passphrase_hash) {
      if (!passphrase) {
        return reply.code(401).send({ message: 'Passphrase required to access this journey.' });
      }
      const isPassphraseValid = await comparePassword(passphrase, journey.passphrase_hash);
      if (!isPassphraseValid) {
        return reply.code(403).send({ message: 'Incorrect passphrase.' });
      }
    }

    // Fetch only published posts for this public journey
    const postsResult = await dbClient!.query(
      'SELECT *, to_jsonb(coordinates) as coordinates, to_jsonb(media_items) as media_items FROM posts WHERE journey_id = $1 AND is_draft = FALSE ORDER BY created_at DESC',
      [journey.id]
    );

    // Remove passphrase_hash from the returned journey object for security
    const { passphrase_hash, ...safeJourney } = journey;

    return { journey: safeJourney, posts: postsResult.rows };
  });
}