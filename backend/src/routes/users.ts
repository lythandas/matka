import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const pgClient = fastify.pg;

  // Check if any users exist
  fastify.get('/users/exists', async (request, reply) => {
    try {
      const result = await pgClient.query('SELECT 1 FROM users LIMIT 1');
      const exists = (result.rowCount ?? 0) > 0;
      return { exists };
    } catch (error) {
      fastify.log.error({ error }, 'Error checking for existing users');
      reply.status(500).send({ message: 'Failed to check user existence' });
    }
  });

  // Register the first user (admin)
  fastify.post('/register', async (request, reply) => {
    try {
      const { username, password, name, surname } = request.body as { username: string; password: string; name?: string; surname?: string };

      if (!username || !password) {
        reply.status(400).send({ message: 'Username and password are required.' });
        return;
      }

      const userCountResult = await pgClient.query('SELECT 1 FROM users LIMIT 1');
      const userCount = userCountResult.rowCount ?? 0;
      if (userCount > 0) {
        reply.status(403).send({ message: 'Registration is closed. An admin user already exists.' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const adminRoleResult = await pgClient.query("SELECT id, name, permissions FROM roles WHERE name = 'admin'");
      const adminRole = adminRoleResult.rows[0];

      if (!adminRole) {
        reply.status(500).send({ message: 'Admin role not found. Database initialization error.' });
        return;
      }

      const result = await pgClient.query(
        'INSERT INTO users (username, password_hash, role_id, name, surname) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role_id, name, surname, profile_image_url',
        [username, hashedPassword, adminRole.id, name || null, surname || null]
      );
      const newUser = result.rows[0];

      const token = jwt.sign(
        { 
          id: newUser.id, 
          username: newUser.username, 
          role: adminRole.name, 
          permissions: adminRole.permissions,
          name: newUser.name,
          surname: newUser.surname,
          profile_image_url: newUser.profile_image_url,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      reply.status(201).send({ 
        token, 
        user: { 
          id: newUser.id, 
          username: newUser.username, 
          role: adminRole.name, 
          permissions: adminRole.permissions,
          name: newUser.name,
          surname: newUser.surname,
          profile_image_url: newUser.profile_image_url,
        } 
      });
    } catch (error: any) {
      if (error.code === '23505') {
        reply.status(409).send({ message: 'Username already exists.' });
      } else {
        fastify.log.error({ error }, 'Error during first user registration');
        reply.status(500).send({ message: 'Failed to register user' });
      }
    }
  });

  // User login route
  fastify.post('/login', async (request, reply) => {
    try {
      const { username, password } = request.body as { username: string; password: string };
      const result = await pgClient.query(
        'SELECT u.id, u.username, u.password_hash, r.name AS role_name, r.permissions, u.name, u.surname, u.profile_image_url FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = $1',
        [username]
      );
      const user = result.rows[0];

      if (!user) {
        reply.status(401).send({ message: 'Invalid credentials' });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        reply.status(401).send({ message: 'Invalid credentials' });
        return;
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role_name, 
          permissions: user.permissions,
          name: user.name,
          surname: user.surname,
          profile_image_url: user.profile_image_url,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      reply.status(200).send({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role_name, 
          permissions: user.permissions,
          name: user.name,
          surname: user.surname,
          profile_image_url: user.profile_image_url,
        } 
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error during login');
      reply.status(500).send({ message: 'Failed to login' });
    }
  });

  // Admin route to create a new user
  fastify.post('/users', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_users')) {
      reply.status(403).send({ message: 'Forbidden: Only administrators with manage_users permission can create users.' });
      return;
    }

    try {
      const { username, password, role_id, name, surname, profile_image_url } = request.body as {
        username: string;
        password: string;
        role_id?: string;
        name?: string;
        surname?: string;
        profile_image_url?: string;
      };

      if (!username || !password) {
        reply.status(400).send({ message: 'Username and password are required.' });
        return;
      }

      let finalRoleId = role_id;
      if (!finalRoleId) {
        const defaultRoleResult = await pgClient.query("SELECT id FROM roles WHERE name = 'user'");
        if (defaultRoleResult.rowCount === 0) {
          reply.status(500).send({ message: 'Default user role not found. Database initialization error.' });
          return;
        }
        finalRoleId = defaultRoleResult.rows[0].id;
      } else {
        const roleCheck = await pgClient.query('SELECT id FROM roles WHERE id = $1', [finalRoleId]);
        if (roleCheck.rowCount === 0) {
          reply.status(400).send({ message: 'Invalid role_id provided.' });
          return;
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pgClient.query(
        'INSERT INTO users (username, password_hash, role_id, name, surname, profile_image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, role_id, name, surname, profile_image_url',
        [username, hashedPassword, finalRoleId, name || null, surname || null, profile_image_url || null]
      );
      const newUser = result.rows[0];

      const roleInfoResult = await pgClient.query('SELECT name, permissions FROM roles WHERE id = $1', [newUser.role_id]);
      const roleInfo = roleInfoResult.rows[0];

      reply.status(201).send({
        id: newUser.id,
        username: newUser.username,
        role: roleInfo.name,
        permissions: roleInfo.permissions,
        name: newUser.name,
        surname: newUser.surname,
        profile_image_url: newUser.profile_image_url,
      });
    } catch (error: any) {
      if (error.code === '23505') {
        reply.status(409).send({ message: 'Username already exists.' });
      } else {
        fastify.log.error({ error }, 'Error creating user');
        reply.status(500).send({ message: 'Failed to create user' });
      }
    }
  });

  // Get all users (Admin only)
  fastify.get('/users', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_users')) {
      reply.status(403).send({ message: 'Forbidden: Only administrators with manage_users permission can view users.' });
      return;
    }
    try {
      const result = await pgClient.query(
        'SELECT u.id, u.username, r.name AS role, r.permissions, u.name, u.surname, u.profile_image_url, u.created_at FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at ASC'
      );
      return result.rows;
    } catch (error) {
      fastify.log.error({ error }, 'Error fetching users');
      reply.status(500).send({ message: 'Failed to fetch users' });
    }
  });

  // Update a user (Admin only)
  fastify.put('/users/:id', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_users')) {
      reply.status(403).send({ message: 'Forbidden: Only administrators with manage_users permission can update users.' });
      return;
    }

    try {
      const { id } = request.params as { id: string };
      const { username, role_id, name, surname, profile_image_url } = request.body as {
        username?: string;
        role_id?: string;
        name?: string;
        surname?: string;
        profile_image_url?: string;
      };

      const fieldsToUpdate: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (username !== undefined) {
        fieldsToUpdate.push(`username = $${paramIndex++}`);
        params.push(username);
      }
      if (role_id !== undefined) {
        const roleCheck = await pgClient.query('SELECT id FROM roles WHERE id = $1', [role_id]);
        if (roleCheck.rowCount === 0) {
          reply.status(400).send({ message: 'Invalid role_id provided.' });
          return;
        }
        fieldsToUpdate.push(`role_id = $${paramIndex++}`);
        params.push(role_id);
      }
      if (name !== undefined) {
        fieldsToUpdate.push(`name = $${paramIndex++}`);
        params.push(name || null);
      }
      if (surname !== undefined) {
        fieldsToUpdate.push(`surname = $${paramIndex++}`);
        params.push(surname || null);
      }
      if (profile_image_url !== undefined) {
        fieldsToUpdate.push(`profile_image_url = $${paramIndex++}`);
        params.push(profile_image_url || null);
      }

      if (fieldsToUpdate.length === 0) {
        reply.status(400).send({ message: 'No fields provided for update.' });
        return;
      }

      params.push(id);

      const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, role_id, name, surname, profile_image_url`;
      const result = await pgClient.query(query, params);

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'User not found.' });
        return;
      }
      const updatedUser = result.rows[0];

      const roleInfoResult = await pgClient.query('SELECT name, permissions FROM roles WHERE id = $1', [updatedUser.role_id]);
      const roleInfo = roleInfoResult.rows[0];

      reply.status(200).send({
        id: updatedUser.id,
        username: updatedUser.username,
        role: roleInfo.name,
        permissions: roleInfo.permissions,
        name: updatedUser.name,
        surname: updatedUser.surname,
        profile_image_url: updatedUser.profile_image_url,
      });
    } catch (error: any) {
      if (error.code === '23505') {
        reply.status(409).send({ message: 'Username already exists.' });
      } else {
        fastify.log.error({ error }, 'Error updating user');
        reply.status(500).send({ message: 'Failed to update user' });
      }
    }
  });

  // User route to update their own profile
  fastify.put('/users/profile', async (request, reply) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }

    try {
      const { name, surname, profile_image_url } = request.body as {
        name?: string;
        surname?: string;
        profile_image_url?: string;
      };

      const fieldsToUpdate: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        fieldsToUpdate.push(`name = $${paramIndex++}`);
        params.push(name || null);
      }
      if (surname !== undefined) {
        fieldsToUpdate.push(`surname = $${paramIndex++}`);
        params.push(surname || null);
      }
      if (profile_image_url !== undefined) {
        fieldsToUpdate.push(`profile_image_url = $${paramIndex++}`);
        params.push(profile_image_url || null);
      }

      if (fieldsToUpdate.length === 0) {
        reply.status(400).send({ message: 'No fields provided for update.' });
        return;
      }

      params.push(request.user.id); // User ID from token

      const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, role_id, name, surname, profile_image_url`;
      const result = await pgClient.query(query, params);

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'User not found.' });
        return;
      }
      const updatedUser = result.rows[0];

      const roleInfoResult = await pgClient.query('SELECT name, permissions FROM roles WHERE id = $1', [updatedUser.role_id]);
      const roleInfo = roleInfoResult.rows[0];

      // Update the JWT in the response so the frontend can update its context
      const newToken = jwt.sign(
        { 
          id: updatedUser.id, 
          username: updatedUser.username, 
          role: roleInfo.name, 
          permissions: roleInfo.permissions,
          name: updatedUser.name,
          surname: updatedUser.surname,
          profile_image_url: updatedUser.profile_image_url,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      reply.status(200).send({
        token: newToken, // Send new token with updated user info
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: roleInfo.name,
          permissions: roleInfo.permissions,
          name: updatedUser.name,
          surname: updatedUser.surname,
          profile_image_url: updatedUser.profile_image_url,
        },
      });
    } catch (error: any) {
      fastify.log.error({ error }, 'Error updating user profile');
      reply.status(500).send({ message: 'Failed to update user profile' });
    }
  });

  // Delete a user (Admin only)
  fastify.delete('/users/:id', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin' || !request.user.permissions.includes('manage_users')) {
      reply.status(403).send({ message: 'Forbidden: Only administrators with manage_users permission can delete users.' });
      return;
    }

    try {
      const { id } = request.params as { id: string };
      if (request.user.id === id) {
        reply.status(403).send({ message: 'Forbidden: You cannot delete your own admin account.' });
        return;
      }

      const result = await pgClient.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'User not found.' });
        return;
      }
      reply.status(200).send({ message: 'User deleted successfully', id: result.rows[0].id });
    } catch (error) {
      fastify.log.error({ error }, 'Error deleting user');
      reply.status(500).send({ message: 'Failed to delete user' });
    }
  });
};

export default usersRoutes;