import { FastifyPluginAsync } from 'fastify';

const journeysRoutes: FastifyPluginAsync = async (fastify) => {
  const pgClient = fastify.pg;

  // Helper function to check combined permissions
  const checkCombinedPermissions = async (userId: string, globalPermissions: string[], journeyId: string, requiredPermission: string): Promise<boolean> => {
    // 1. Global Admin Override: Admins with 'manage_roles' implicitly have all permissions
    if (globalPermissions.includes('manage_roles')) {
      return true;
    }

    // 2. Global 'any' permissions (e.g., edit_any_journey, delete_any_journey)
    if (globalPermissions.includes(requiredPermission) && requiredPermission.includes('any')) {
      return true;
    }

    // 3. Journey Owner Override: Owner has full control over their own journey
    const journeyOwnerResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journeyOwnerId = journeyOwnerResult.rows[0]?.user_id;
    if (journeyOwnerId === userId) {
      // Owner can create/edit/delete their own journey
      if (['create_journey', 'edit_journey', 'delete_journey'].includes(requiredPermission)) return true;
      // Owner can create/edit/delete posts in their own journey
      if (['create_post', 'edit_post', 'delete_post'].includes(requiredPermission)) return true;
      // Owner can manage collaborators for their own journey
      if (requiredPermission === 'manage_journey_access') return true;
    }

    // 4. Journey-specific permissions for collaborators
    const journeyPermsResult = await pgClient.query(
      'SELECT permissions FROM journey_user_permissions WHERE user_id = $1 AND journey_id = $2',
      [userId, journeyId]
    );
    const journeyPermissions: string[] = journeyPermsResult.rows[0]?.permissions || [];
    if (journeyPermissions.includes(requiredPermission)) {
      return true;
    }

    // 5. Implicit 'own' permissions for non-owners/non-admins
    // All authenticated users can create their own journeys
    if (requiredPermission === 'create_journey') {
      return true;
    }
    // Users can edit their own posts (this check is more relevant in posts.ts)
    // Users can delete their own posts (this check is more relevant in posts.ts)

    return false;
  };

  // Get all journeys (now filtered by user_id or all for admin/edit_any_journey)
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

      // Admins or users with 'edit_any_journey' can see all journeys
      if (!request.user.permissions.includes('edit_any_journey')) { // Use request.user.permissions directly
        // Non-admins/non-super-editors can only see their own journeys or journeys they are collaborators on
        query += ` WHERE j.user_id = $${paramIndex++} OR j.id IN (SELECT journey_id FROM journey_user_permissions WHERE user_id = $${paramIndex++})`;
        params.push(request.user.id, request.user.id);
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
    // All authenticated users can create their own journeys (implicit permission)
    const canCreateJourney = await checkCombinedPermissions(request.user.id, request.user.permissions, '', 'create_journey'); // Pass globalPermissions
    if (!canCreateJourney) {
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

      // Check if user has permission to edit this specific journey
      const canEdit = await checkCombinedPermissions(request.user.id, request.user.permissions, id, 'edit_journey'); // Pass globalPermissions
      if (!canEdit && !request.user.permissions.includes('edit_any_journey')) { // Use request.user.permissions directly
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

      // Check if user has permission to delete this specific journey
      // Only owner or global admin with 'delete_any_journey' can delete
      const canDelete = await checkCombinedPermissions(request.user.id, request.user.permissions, id, 'delete_journey'); // Pass globalPermissions
      if (!canDelete && !request.user.permissions.includes('delete_any_journey')) { // Use request.user.permissions directly
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