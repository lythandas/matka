import { FastifyPluginAsync } from 'fastify';

const rolesRoutes: FastifyPluginAsync = async (fastify) => {
  const pgClient = fastify.pg;

  // Get all roles (Admin only)
  fastify.get('/roles', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_roles')) {
      reply.status(403).send({ message: 'Forbidden: Only administrators with manage_roles permission can view roles.' });
      return;
    }
    try {
      const result = await pgClient.query('SELECT id, name, permissions, created_at FROM roles ORDER BY created_at ASC');
      return result.rows;
    } catch (error) {
      fastify.log.error({ error }, 'Error fetching roles');
      reply.status(500).send({ message: 'Failed to fetch roles' });
    }
  });

  // Create a new role (Admin only)
  fastify.post('/roles', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_roles')) {
      reply.status(403).send({ message: 'Forbidden: Only administrators with manage_roles permission can create roles.' });
      return;
    }

    try {
      const { name, permissions = [] } = request.body as { name: string; permissions?: string[] };

      if (!name || name.trim() === '') {
        reply.status(400).send({ message: 'Role name is required.' });
        return;
      }

      const result = await pgClient.query(
        'INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING id, name, permissions',
        [name.trim(), JSON.stringify(permissions)]
      );
      reply.status(201).send(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        reply.status(409).send({ message: 'Role name already exists.' });
      } else {
        fastify.log.error({ error }, 'Error creating role');
        reply.status(500).send({ message: 'Failed to create role' });
      }
    }
  });

  // Update a role (Admin only)
  fastify.put('/roles/:id', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_roles')) {
      reply.status(403).send({ message: 'Forbidden: Only administrators with manage_roles permission can update roles.' });
      return;
    }

    try {
      const { id } = request.params as { id: string };
      const { name, permissions } = request.body as { name?: string; permissions?: string[] };

      const fieldsToUpdate: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        fieldsToUpdate.push(`name = $${paramIndex++}`);
        params.push(name.trim());
      }
      if (permissions !== undefined) {
        fieldsToUpdate.push(`permissions = $${paramIndex++}`);
        params.push(JSON.stringify(permissions));
      }

      if (fieldsToUpdate.length === 0) {
        reply.status(400).send({ message: 'No fields provided for update.' });
        return;
      }

      params.push(id);

      const query = `UPDATE roles SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, permissions`;
      const result = await pgClient.query(query, params);

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'Role not found.' });
        return;
      }
      reply.status(200).send(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        reply.status(409).send({ message: 'Role name already exists.' });
      } else {
        fastify.log.error({ error }, 'Error updating role');
        reply.status(500).send({ message: 'Failed to update role' });
      }
    }
  });

  // Delete a role (Admin only)
  fastify.delete('/roles/:id', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_roles')) {
      reply.status(403).send({ message: 'Forbidden: Only administrators with manage_roles permission can delete roles.' });
      return;
    }

    try {
      const { id } = request.params as { id: string };

      const roleCheck = await pgClient.query('SELECT name FROM roles WHERE id = $1', [id]);
      const roleName = roleCheck.rows[0]?.name;

      if (!roleName) {
        reply.status(404).send({ message: 'Role not found.' });
        return;
      }

      if (roleName === 'admin' || roleName === 'user') {
        reply.status(403).send({ message: `Forbidden: Cannot delete default role '${roleName}'.` });
        return;
      }

      const userCountResult = await pgClient.query('SELECT COUNT(*) FROM users WHERE role_id = $1', [id]);
      if (parseInt(userCountResult.rows[0].count) > 0) {
        reply.status(409).send({ message: 'Cannot delete role: Users are currently assigned to this role. Please reassign them first.' });
        return;
      }

      const result = await pgClient.query('DELETE FROM roles WHERE id = $1 RETURNING id', [id]);

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'Role not found.' });
        return;
      }
      reply.status(200).send({ message: 'Role deleted successfully', id: result.rows[0].id });
    } catch (error: any) {
      if (error.code === '23503') {
        reply.status(409).send({ message: 'Cannot delete role: Users are currently assigned to this role. Please reassign them first.' });
      } else {
        fastify.log.error({ error }, 'Error deleting role');
        reply.status(500).send({ message: 'Failed to delete role' });
      }
    }
  });
};

export default rolesRoutes;