// backend/src/routes/journeyRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient, isDbConnected } from '../db';
import { hashPassword } from '../auth'; // Import hashPassword
import { Journey, JourneyCollaborator } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { comparePassword } from '../auth'; // Import comparePassword

export default async function journeyRoutes(fastify: FastifyInstance) {
  // The authentication hook is applied in server.ts for this plugin, no need to add it here again.

  // Get journeys for the authenticated user (owner or collaborator)
  fastify.get('/', async (request, reply) => { // Changed from /journeys to /
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const result = await dbClient!.query(
      `SELECT DISTINCT ON (j.id) j.id, j.name, j.created_at, j.user_id, j.is_public, j.public_link_id,
              u.username as owner_username, u.name as owner_name, u.surname as owner_surname, u.profile_image_url as owner_profile_image_url
       FROM journeys j
       LEFT JOIN journey_user_permissions jup ON j.id = jup.journey_id
       JOIN users u ON j.user_id = u.id
       WHERE j.user_id = $1 OR jup.user_id = $1
       ORDER BY j.id, j.created_at DESC`,
      [request.user.id]
    );
    return result.rows;
  });

  // Admin-only: Get all journeys in the system
  fastify.get('/admin', async (request, reply) => { // Changed from /admin/journeys to /admin
    if (!request.user || !request.user.isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: Only administrators can view all journeys.' });
    }

    const result = await dbClient!.query(
      `SELECT j.id, j.name, j.created_at, j.user_id, j.is_public, j.public_link_id,
              u.username as owner_username, u.name as owner_name, u.surname as owner_surname, u.profile_image_url as owner_profile_image_url
       FROM journeys j
       JOIN users u ON j.user_id = u.id
       ORDER BY j.created_at DESC`
    );
    return result.rows;
  });

  fastify.post('/', async (request, reply) => { // Changed from /journeys to /
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { name } = request.body as { name?: string };

    if (!name) {
      return reply.code(400).send({ message: 'Journey name is required' });
    }

    const newJourney: Journey = {
      id: uuidv4(),
      name,
      created_at: new Date().toISOString(),
      user_id: request.user.id,
      owner_username: request.user.username,
      owner_name: request.user.name,
      owner_surname: request.user.surname,
      owner_profile_image_url: request.user.profile_image_url,
      is_public: false, // New journeys are always private by default
      public_link_id: undefined, // No public link initially
    };

    const result = await dbClient!.query(
      `INSERT INTO journeys (id, name, created_at, user_id, owner_username, owner_name, owner_surname, owner_profile_image_url, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, created_at, user_id, is_public, public_link_id,
                 owner_username, owner_name, owner_surname, owner_profile_image_url`,
      [newJourney.id, newJourney.name, newJourney.created_at, newJourney.user_id, newJourney.owner_username, newJourney.owner_name, newJourney.owner_surname, newJourney.owner_profile_image_url, newJourney.is_public]
    );
    return result.rows[0];
  });

  fastify.put('/:id', async (request, reply) => { // Changed from /journeys/:id to /:id
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string }; // Removed is_public and passphrase

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient!.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
    const existingJourney = journeyResult.rows[0];

    if (!existingJourney) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = existingJourney.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to edit this journey.' });
    }

    const result = await dbClient!.query(
      `UPDATE journeys SET
        name = COALESCE($1, name)
       WHERE id = $2
       RETURNING id, name, created_at, user_id, is_public, public_link_id,
                 owner_username, owner_name, owner_surname, owner_profile_image_url`,
      [name, id]
    );
    return result.rows[0];
  });

  // New endpoint to publish a journey
  fastify.post('/:id/publish', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient!.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
    const existingJourney = journeyResult.rows[0];

    if (!existingJourney) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = existingJourney.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to publish this journey.' });
    }

    const newPublicLinkId = uuidv4();
    const result = await dbClient!.query(
      `UPDATE journeys SET
        is_public = TRUE,
        public_link_id = $1
       WHERE id = $2
       RETURNING id, name, created_at, user_id, is_public, public_link_id,
                 owner_username, owner_name, owner_surname, owner_profile_image_url`,
      [newPublicLinkId, id]
    );
    return result.rows[0];
  });

  // New endpoint to unpublish a journey
  fastify.post('/:id/unpublish', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient!.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
    const existingJourney = journeyResult.rows[0];

    if (!existingJourney) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = existingJourney.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to unpublish this journey.' });
    }

    const result = await dbClient!.query(
      `UPDATE journeys SET
        is_public = FALSE,
        public_link_id = NULL
       WHERE id = $1
       RETURNING id, name, created_at, user_id, is_public, public_link_id,
                 owner_username, owner_name, owner_surname, owner_profile_image_url`,
      [id]
    );
    return result.rows[0];
  });

  fastify.delete('/:id', async (request, reply) => { // Changed from /journeys/:id to /:id
    const { id } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient!.query('SELECT user_id FROM journeys WHERE id = $1', [id]);
    const existingJourney = journeyResult.rows[0];

    if (!existingJourney) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = existingJourney.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to delete this journey.' });
    }

    const deleteResult = await dbClient!.query('DELETE FROM journeys WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    return reply.code(204).send();
  });

  fastify.get('/:id/collaborators', async (request, reply) => { // Changed from /journeys/:id/collaborators to /:id/collaborators
    const { id: journeyId } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient!.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    const isCollaborator = await dbClient!.query(
      'SELECT 1 FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [journeyId, request.user.id]
    );

    if (!isOwner && !isAdmin && isCollaborator.rows.length === 0) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to view collaborators for this journey.' });
    }

    const result = await dbClient!.query(
      `SELECT jup.id, jup.journey_id, jup.user_id, jup.can_read_posts, jup.can_publish_posts, jup.can_modify_post, jup.can_delete_posts,
              u.username, u.name, u.surname, u.profile_image_url
       FROM journey_user_permissions jup
       JOIN users u ON jup.user_id = u.id
       WHERE jup.journey_id = $1`,
      [journeyId]
    );
    return result.rows;
  });

  fastify.post('/:id/collaborators', async (request, reply) => { // Changed from /journeys/:id/collaborators to /:id/collaborators
    const { id: journeyId } = request.params as { id: string };
    const { username } = request.body as { username: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient!.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const targetUserResult = await dbClient!.query('SELECT id, username, name, surname, profile_image_url FROM users WHERE username = $1', [username]);
    const targetUser = targetUserResult.rows[0];
    if (!targetUser) {
      return reply.code(404).send({ message: 'User to add not found' });
    }
    if (targetUser.id === journey.user_id) {
      return reply.code(400).send({ message: 'Cannot add journey owner as collaborator' });
    }

    const existingCollab = await dbClient!.query('SELECT id FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2', [journeyId, targetUser.id]);
    if (existingCollab.rows.length > 0) {
      return reply.code(409).send({ message: 'User is already a collaborator' });
    }

    const newCollaborator: JourneyCollaborator = {
      id: uuidv4(),
      journey_id: journeyId,
      user_id: targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      surname: targetUser.surname,
      profile_image_url: targetUser.profile_image_url,
      can_read_posts: true,
      can_publish_posts: true,
      can_modify_post: true,
      can_delete_posts: false,
    };

    const result = await dbClient!.query(
      `INSERT INTO journey_user_permissions (id, journey_id, user_id, can_read_posts, can_publish_posts, can_modify_post, can_delete_posts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [newCollaborator.id, newCollaborator.journey_id, newCollaborator.user_id, newCollaborator.can_read_posts, newCollaborator.can_publish_posts, newCollaborator.can_modify_post, newCollaborator.can_delete_posts]
    );
    return result.rows[0];
  });

  fastify.put('/:journeyId/collaborators/:userId', async (request, reply) => { // Changed from /journeys/:journeyId/collaborators/:userId to /:journeyId/collaborators/:userId
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };
    const { can_publish_posts, can_modify_post, can_delete_posts } = request.body as {
      can_publish_posts?: boolean;
      can_modify_post?: boolean;
      can_delete_posts?: boolean;
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient!.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const collabResult = await dbClient!.query('SELECT id FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2', [journeyId, userId]);
    if (collabResult.rows.length === 0) {
      return reply.code(404).send({ message: 'Collaborator not found for this journey' });
    }

    const result = await dbClient!.query(
      `UPDATE journey_user_permissions SET
        can_publish_posts = COALESCE($1, can_publish_posts),
        can_modify_post = COALESCE($2, can_modify_post),
        can_delete_posts = COALESCE($3, can_delete_posts)
       WHERE journey_id = $4 AND user_id = $5
       RETURNING *`,
      [can_publish_posts, can_modify_post, can_delete_posts, journeyId, userId]
    );
    return result.rows[0];
  });

  fastify.delete('/:journeyId/collaborators/:userId', async (request, reply) => { // Changed from /journeys/:journeyId/collaborators/:userId to /:journeyId/collaborators/:userId
    const { journeyId, userId } = request.params as { journeyId: string; userId: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const journeyResult = await dbClient!.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to manage collaborators for this journey.' });
    }

    const deleteResult = await dbClient!.query('DELETE FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2 RETURNING id', [journeyId, userId]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'Collaborator not found for this journey' });
    }
    return reply.code(204).send();
  });
}