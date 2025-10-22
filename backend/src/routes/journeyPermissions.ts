import { FastifyPluginAsync } from 'fastify';

const journeyPermissionsRoutes: FastifyPluginAsync = async (fastify) => {
  const pgClient = fastify.pg;

  // Helper to check if user has global admin or specific journey access permission
  const checkJourneyManagementPermission = async (request: any, reply: any, journeyId: string) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return false;
    }

    // 1. Global Admin Override: Admins with 'manage_roles' implicitly have all permissions
    if (request.user.role === 'admin' && request.user.permissions.includes('manage_roles')) {
      return true;
    }

    // 2. Check if user is the owner of the journey
    const journeyOwnerResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyOwnerResult.rows[0];
    if (!journey) {
      reply.status(404).send({ message: 'Journey not found.' });
      return false;
    }
    if (journey.user_id === request.user.id) {
      return true; // Journey owner has full control
    }

    // 3. Check if user has 'manage_journey_access' permission for this specific journey
    const journeyPermsResult = await pgClient.query(
      'SELECT permissions FROM journey_user_permissions WHERE user_id = $1 AND journey_id = $2',
      [request.user.id, journeyId]
    );
    const journeyPerms = journeyPermsResult.rows[0]?.permissions || [];
    if (journeyPerms.includes('manage_journey_access')) {
      return true;
    }

    reply.status(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    return false;
  };

  // Get all collaborators for a specific journey
  fastify.get('/journeys/:journeyId/collaborators', async (request, reply) => {
    const { journeyId } = request.params as { journeyId: string };
    if (!(await checkJourneyManagementPermission(request, reply, journeyId))) return;

    try {
      const result = await pgClient.query(
        `SELECT jup.id, jup.user_id, u.username, u.name, u.surname, u.profile_image_url, jup.permissions
         FROM journey_user_permissions jup
         JOIN users u ON jup.user_id = u.id
         WHERE jup.journey_id = $1
         ORDER BY u.username ASC`,
        [journeyId]
      );
      return result.rows;
    } catch (error) {
      fastify.log.error({ error }, 'Error fetching journey collaborators');
      reply.status(500).send({ message: 'Failed to fetch journey collaborators' });
    }
  });

  // Add a user as a collaborator to a journey with specific permissions
  fastify.post('/journeys/:journeyId/collaborators', async (request, reply) => {
    const { journeyId } = request.params as { journeyId: string };
    if (!(await checkJourneyManagementPermission(request, reply, journeyId))) return;

    try {
      const { username, permissions = [] } = request.body as { username: string; permissions?: string[] };

      if (!username) {
        reply.status(400).send({ message: 'Username is required.' });
        return;
      }

      // Find the user by username
      const userResult = await pgClient.query('SELECT id FROM users WHERE username = $1', [username]);
      const targetUser = userResult.rows[0];

      if (!targetUser) {
        reply.status(404).send({ message: 'User not found.' });
        return;
      }

      // Prevent adding the journey owner as a collaborator (they already have full access)
      const journeyOwnerResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
      if (journeyOwnerResult.rows[0]?.user_id === targetUser.id) {
        reply.status(400).send({ message: 'Journey owner cannot be added as a collaborator.' });
        return;
      }

      const result = await pgClient.query(
        'INSERT INTO journey_user_permissions (user_id, journey_id, permissions) VALUES ($1, $2, $3) RETURNING id, user_id, journey_id, permissions',
        [targetUser.id, journeyId, JSON.stringify(permissions)]
      );
      reply.status(201).send(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        reply.status(409).send({ message: 'User is already a collaborator for this journey.' });
      } else {
        fastify.log.error({ error }, 'Error adding journey collaborator');
        reply.status(500).send({ message: 'Failed to add journey collaborator' });
      }
    }
  });

  // Update a user's permissions for a specific journey
  fastify.put('/journeys/:journeyId/collaborators/:userId', async (request, reply) => {
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };
    if (!(await checkJourneyManagementPermission(request, reply, journeyId))) return;

    try {
      const { permissions } = request.body as { permissions: string[] };

      if (!permissions) {
        reply.status(400).send({ message: 'Permissions array is required.' });
        return;
      }

      const result = await pgClient.query(
        'UPDATE journey_user_permissions SET permissions = $1 WHERE user_id = $2 AND journey_id = $3 RETURNING id, user_id, journey_id, permissions',
        [JSON.stringify(permissions), userId, journeyId]
      );

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'Collaborator not found for this journey.' });
        return;
      }
      reply.status(200).send(result.rows[0]);
    } catch (error) {
      fastify.log.error({ error }, 'Error updating journey collaborator permissions');
      reply.status(500).send({ message: 'Failed to update journey collaborator permissions' });
    }
  });

  // Remove a user from a journey's collaborators
  fastify.delete('/journeys/:journeyId/collaborators/:userId', async (request, reply) => {
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };
    if (!(await checkJourneyManagementPermission(request, reply, journeyId))) return;

    try {
      const result = await pgClient.query(
        'DELETE FROM journey_user_permissions WHERE user_id = $1 AND journey_id = $2 RETURNING id',
        [userId, journeyId]
      );

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'Collaborator not found for this journey.' });
        return;
      }
      reply.status(200).send({ message: 'Collaborator removed successfully', id: result.rows[0].id });
    } catch (error) {
      fastify.log.error({ error }, 'Error removing journey collaborator');
      reply.status(500).send({ message: 'Failed to remove journey collaborator' });
    }
  });
};

export default journeyPermissionsRoutes;