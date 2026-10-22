// backend/src/routes/protectedUserRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient } from '../db';
import { generateToken, hashPassword } from '../auth';
import { mapDbUserToApiUser } from '../utils';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { validatePassword } from '../config';

export default async function protectedUserRoutes(fastify: FastifyInstance) {
  // Get current user profile
  fastify.get('/profile', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const result = await dbClient!.query(
      'SELECT id, username, is_admin, name, surname, profile_image_url, language, color_scheme, created_at FROM users WHERE id = $1',
      [request.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }
    return mapDbUserToApiUser(user);
  });

  // Update current user profile
  fastify.put('/profile', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'] },
          surname: { type: ['string', 'null'] },
          profile_image_url: { type: ['string', 'null'] },
          language: { type: 'string' },
          color_scheme: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const body = request.body as { name?: string | null; surname?: string | null; profile_image_url?: string | null; language?: string; color_scheme?: string };

    // Build SET clause dynamically — only update fields that were actually sent
    const sets: string[] = [];
    const values: (string | null)[] = [];
    let paramIdx = 1;

    if (body.name !== undefined) {
      sets.push(`name = $${paramIdx++}`);
      values.push(body.name);
    }
    if (body.surname !== undefined) {
      sets.push(`surname = $${paramIdx++}`);
      values.push(body.surname);
    }
    if (body.profile_image_url !== undefined) {
      sets.push(`profile_image_url = $${paramIdx++}`);
      values.push(body.profile_image_url);
    }
    if (body.language !== undefined) {
      sets.push(`language = $${paramIdx++}`);
      values.push(body.language);
    }
    if (body.color_scheme !== undefined) {
      sets.push(`color_scheme = $${paramIdx++}`);
      values.push(body.color_scheme);
    }

    if (sets.length === 0) {
      // Nothing to update — just return current user
      const result = await dbClient!.query(
        'SELECT id, username, is_admin, name, surname, profile_image_url, language, color_scheme, created_at FROM users WHERE id = $1',
        [request.user.id]
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ message: 'User not found' });
      }
      return mapDbUserToApiUser(result.rows[0]);
    }

    values.push(request.user.id);
    const result = await dbClient!.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING id, username, is_admin, name, surname, profile_image_url, language, color_scheme, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const updatedUser = mapDbUserToApiUser(result.rows[0]);

    // If profile_image_url was updated, also update all posts by this user
    if (body.profile_image_url !== undefined) {
      await dbClient!.query(
        'UPDATE posts SET author_profile_image_url = $1 WHERE user_id = $2',
        [body.profile_image_url === null ? null : body.profile_image_url, request.user.id]
      );
    }

    // If name or surname were updated, also update all posts and journeys by this user
    if (body.name !== undefined || body.surname !== undefined) {
      await dbClient!.query(
        'UPDATE posts SET author_name = $1, author_surname = $2 WHERE user_id = $3',
        [body.name === null ? null : body.name, body.surname === null ? null : body.surname, request.user.id]
      );
      await dbClient!.query(
        'UPDATE journeys SET owner_name = $1, owner_surname = $2 WHERE user_id = $3',
        [body.name === null ? null : body.name, body.surname === null ? null : body.surname, request.user.id]
      );
    }

    const newToken = generateToken(updatedUser);
    return { user: updatedUser, token: newToken };
  });

  // --- Admin-only User Management Routes ---

  fastify.get('/', async (request, reply) => {
    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can view all users.' });
    }
    const result = await dbClient!.query(
      'SELECT id, username, is_admin, name, surname, profile_image_url, language, color_scheme, created_at FROM users ORDER BY created_at DESC'
    );
    return result.rows.map(mapDbUserToApiUser);
  });

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1, maxLength: 255 },
          password: { type: 'string', minLength: 1 },
          name: { type: 'string' },
          surname: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password, name, surname } = request.body as { username: string; password: string; name?: string; surname?: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can create users.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return reply.code(400).send({ message: passwordError });
    }

    const existingUser = await dbClient!.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return reply.code(409).send({ message: 'Username already exists' });
    }

    const password_hash = await hashPassword(password);

    const newUser: User = {
      id: uuidv4(),
      username,
      password_hash,
      is_admin: false,
      name: name || undefined,
      surname: surname || undefined,
      language: 'en',
      created_at: new Date().toISOString(),
    };

    const result = await dbClient!.query(
      'INSERT INTO users (id, username, password_hash, is_admin, name, surname, language, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, is_admin, name, surname, profile_image_url, language, color_scheme, created_at',
      [newUser.id, newUser.username, newUser.password_hash, newUser.is_admin, newUser.name, newUser.surname, newUser.language, newUser.created_at]
    );
    return mapDbUserToApiUser(result.rows[0]);
  });

  fastify.put('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          name: { type: ['string', 'null'] },
          surname: { type: ['string', 'null'] },
          profile_image_url: { type: ['string', 'null'] },
          is_admin: { type: 'boolean' },
          language: { type: 'string' },
          color_scheme: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { username, name, surname, profile_image_url, is_admin, language, color_scheme } = request.body as { username?: string; name?: string | null; surname?: string | null; profile_image_url?: string | null; is_admin?: boolean; language?: string; color_scheme?: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can update other users.' });
    }

    const existingUserResult = await dbClient!.query('SELECT username FROM users WHERE id = $1', [id]);
    if (existingUserResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }
    const existingUsername = existingUserResult.rows[0].username;

    if (username && username !== existingUsername) {
      const conflictCheck = await dbClient!.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
      if (conflictCheck.rows.length > 0) {
        return reply.code(409).send({ message: 'Username already exists' });
      }
    }

    const result = await dbClient!.query(
      `UPDATE users SET
        username = COALESCE($1, username),
        name = $2,
        surname = $3,
        profile_image_url = $4,
        is_admin = COALESCE($5, is_admin),
        language = COALESCE($6, language),
        color_scheme = COALESCE($7, color_scheme)
       WHERE id = $8
       RETURNING id, username, is_admin, name, surname, profile_image_url, language, color_scheme, created_at`,
      [username, name === null ? null : name, surname === null ? null : surname, profile_image_url === null ? null : profile_image_url, is_admin, language, color_scheme, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    if (profile_image_url !== undefined) {
      await dbClient!.query(
        'UPDATE posts SET author_profile_image_url = $1 WHERE user_id = $2',
        [profile_image_url === null ? null : profile_image_url, id]
      );
    }

    if (name !== undefined || surname !== undefined) {
      await dbClient!.query(
        'UPDATE posts SET author_name = $1, author_surname = $2 WHERE user_id = $3',
        [name === null ? null : name, surname === null ? null : surname, id]
      );
    }

    return mapDbUserToApiUser(result.rows[0]);
  });

  fastify.put('/:id/reset-password', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newPassword } = request.body as { newPassword: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can reset user passwords.' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return reply.code(400).send({ message: passwordError });
    }

    const userResult = await dbClient!.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const password_hash = await hashPassword(newPassword);
    await dbClient!.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id]);
    return reply.code(200).send({ message: 'Password reset successfully' });
  });

  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can delete users.' });
    }
    if (request.user.id === id) {
      return reply.code(403).send({ message: 'Forbidden: An administrator cannot delete their own account.' });
    }

    const deleteResult = await dbClient!.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'User not found' });
    }

    return reply.code(204).send();
  });

  // Search users (Accessible to all authenticated users)
  fastify.get('/search', {
    schema: {
      querystring: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { query } = request.query as { query: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Authentication required to search users.' });
    }

    const searchLower = `%${query.toLowerCase()}%`;
    const result = await dbClient!.query(
      `SELECT id, username, is_admin, name, surname, profile_image_url, language, color_scheme, created_at
       FROM users
       WHERE username ILIKE $1 OR name ILIKE $2 OR surname ILIKE $3
       LIMIT 50`,
      [searchLower, searchLower, searchLower]
    );
    return result.rows.map(mapDbUserToApiUser);
  });
}
