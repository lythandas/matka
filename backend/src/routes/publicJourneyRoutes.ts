// backend/src/routes/publicJourneyRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient } from '../db';

export default async function publicJourneyRoutes(fastify: FastifyInstance) {
  // Get a public journey by its public_link_id
  fastify.get('/public-journeys/:publicLinkId', {
    // Removed schema: { body: false } as GET requests do not have a body,
    // and this was causing a FastifyWarning.
  }, async (request, reply) => {
    const { publicLinkId } = request.params as { publicLinkId: string };

    const journeyResult = await dbClient!.query(
      `SELECT j.id, j.name, j.created_at, j.user_id, j.is_public, j.public_link_id,
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

    // Fetch only published posts for this public journey
    const postsResult = await dbClient!.query(
      'SELECT *, to_jsonb(coordinates) as coordinates, to_jsonb(media_items) as media_items FROM posts WHERE journey_id = $1 AND is_draft = FALSE ORDER BY created_at DESC',
      [journey.id]
    );

    return { journey, posts: postsResult.rows };
  });
}