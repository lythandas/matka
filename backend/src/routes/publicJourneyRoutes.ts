// backend/src/routes/publicJourneyRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient } from '../db';
import { comparePassword } from '../auth';

export default async function publicJourneyRoutes(fastify: FastifyInstance) {
  fastify.post('/public-journeys/:publicLinkId', {
    schema: {
      params: {
        type: 'object',
        required: ['publicLinkId'],
        properties: {
          publicLinkId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          passphrase: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { publicLinkId } = request.params as { publicLinkId: string };
    const { passphrase } = request.body as { passphrase?: string };

    const journeyResult = await dbClient!.query(
      `SELECT j.id, j.name, j.created_at, j.user_id, j.is_public, j.public_link_id, j.passphrase_hash, j.color_scheme,
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

    if (journey.passphrase_hash) {
      if (!passphrase) {
        return reply.code(401).send({ message: 'Passphrase required to access this journey.' });
      }
      const isPassphraseValid = await comparePassword(passphrase, journey.passphrase_hash);
      if (!isPassphraseValid) {
        return reply.code(403).send({ message: 'Incorrect passphrase.' });
      }
    }

    const postsResult = await dbClient!.query(
      'SELECT *, to_jsonb(coordinates) as coordinates, to_jsonb(media_items) as media_items FROM posts WHERE journey_id = $1 AND is_draft = FALSE ORDER BY created_at DESC',
      [journey.id]
    );

    const { passphrase_hash, ...safeJourney } = journey;

    return { journey: safeJourney, posts: postsResult.rows };
  });
}
