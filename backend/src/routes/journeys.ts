import { FastifyPluginAsync } from 'fastify';

const journeysRoutes: FastifyPluginAsync = async (fastify) => {
  const pgClient = fastify.pg;

  // Get all journeys (now filtered by user_id or all for admin)
  fastify.get('/journeys', async (request, reply) => {
    if (!request.user) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }
    try {
      let query = `
        SELECT j.*, u.username AS owner_username, u.name AS owner_name, u.surname AS owner_surname, u.profile_image_url AS owner_profile_image_url
        FROM journeys j
        JOIN users u ON j.user_id = u.id
      `;
      const params: string[] = [];
      let paramIndex = 1;

      if (request.user.role !== 'admin' && !request.user.permissions.includes('edit_any_journey')) {
        query += ` WHERE j.user_id = $${paramIndex++}`;
        params.push(request.user.id);
      }
      query += ' ORDER BY j.created_at ASC';
      const result = await pgClient.query(query, params);
      return result.rows;
    } catch (error) {
      fastify.log.error({ error }, 'Error fetching journeys');
      reply.status(500).send({ message: 'Failed to fetch journeys' });
    }
  });

  // Create a new journey
  fastify.post('/journeys', async (request, reply) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }
    if (!request.user.permissions.includes('create_journey')) {
      reply.status(403).send({ message: 'Forbidden: You do not have permission to create journeys.' });
      return;
    }

    try {
      const { name } = request.body as { name: string };
      if (!name || name.trim() === '') {
        reply.status(400).send({ message: 'Journey name is required.' });
        return;
      }
      const result = await pgClient.query(
        'INSERT INTO journeys (name, user_id) VALUES ($1, $2) RETURNING *',
        [name.trim(), request.user.id]
      );
      reply.status(201).send(result.rows[0]);
    } catch (error) {
      fastify.log.error({ error }, 'Error creating journey');
      reply.status(500).send({ message: 'Failed to create journey' });
    }
  });

  // Update a journey
  fastify.put('/journeys/:id', async (request, reply) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }

    try {
      const { id } = request.params as { id: string };
      const { name } = request.body as { name: string };

      if (!name || name.trim() === '') {
        reply.status(400).send({ message: 'Journey name is required.' });
        return;
      }

      const journeyResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
      const journey = journeyResult.rows[0];

      if (!journey) {
        reply.status(404).send({ message: 'Journey not found.' });
        return;
      }

      const isOwner = journey.user_id === request.user.id;
      const canEditAnyJourney = request.user.permissions.includes('edit_any_journey');

      if (!isOwner && !canEditAnyJourney) {
        reply.status(403).send({ message: 'Forbidden: You do not have permission to edit this journey.' });
        return;
      }

      const result = await pgClient.query(
        'UPDATE journeys SET name = $1 WHERE id = $2 RETURNING *',
        [name.trim(), id]
      );

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'Journey not found.' });
        return;
      }
      reply.status(200).send(result.rows[0]);
    } catch (error) {
      fastify.log.error({ error }, 'Error updating journey');
      reply.status(500).send({ message: 'Failed to update journey' });
    }
  });

  // Delete a journey
  fastify.delete('/journeys/:id', async (request, reply) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }

    try {
      const { id } = request.params as { id: string };

      const journeyResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
      const journey = journeyResult.rows[0];

      if (!journey) {
        reply.status(404).send({ message: 'Journey not found.' });
        return;
      }

      const isOwner = journey.user_id === request.user.id;
      const canDeleteAnyJourney = request.user.permissions.includes('delete_any_journey');

      if (!isOwner && !canDeleteAnyJourney) {
        reply.status(403).send({ message: 'Forbidden: You do not have permission to delete this journey.' });
        return;
      }

      const result = await pgClient.query('DELETE FROM journeys WHERE id = $1 RETURNING id', [id]);

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'Journey not found.' });
        return;
      }
      reply.status(200).send({ message: 'Journey deleted successfully', id: result.rows[0].id });
    } catch (error) {
      fastify.log.error({ error }, 'Error deleting journey');
      reply.status(500).send({ message: 'Failed to delete journey' });
    }
  });
};

export default journeysRoutes;