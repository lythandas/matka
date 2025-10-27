// backend/src/routes/postRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient, isDbConnected } from '../db';
import { authenticate } from '../auth';
import { Post, MediaInfo } from '../types';
import { v4 as uuidv4 } from 'uuid';

export default async function postRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/posts', async (request, reply) => {
    const { journeyId } = request.query as { journeyId: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    if (!journeyId) {
      return reply.code(400).send({ message: 'journeyId is required' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;
    const collaboratorPermsResult = await dbClient.query(
      'SELECT can_read_posts FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [journeyId, request.user.id]
    );
    const canRead = collaboratorPermsResult.rows.length > 0 ? collaboratorPermsResult.rows[0].can_read_posts : false;

    if (!isOwner && !isAdmin && !canRead) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to read posts in this journey.' });
    }

    const postsResult = await dbClient.query('SELECT *, to_jsonb(coordinates) as coordinates, to_jsonb(media_items) as media_items FROM posts WHERE journey_id = $1 ORDER BY created_at DESC', [journeyId]);
    return postsResult.rows;
  });

  fastify.post('/posts', async (request, reply) => {
    const { journeyId, title, message, media_items, coordinates, created_at } = request.body as {
      journeyId?: string;
      title?: string;
      message?: string;
      media_items?: MediaInfo[];
      coordinates?: { lat: number; lng: number };
      created_at?: string;
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    if (!journeyId) {
      return reply.code(400).send({ message: 'journeyId is required' });
    }
    if (!title && !message && (!media_items || media_items.length === 0) && !coordinates) {
      return reply.code(400).send({ message: 'At least a title, message, media, or coordinates are required' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Journey not found' });
    }

    const isOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;
    const collaboratorPermsResult = await dbClient.query(
      'SELECT can_publish_posts FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [journeyId, request.user.id]
    );
    const canPublish = collaboratorPermsResult.rows.length > 0 ? collaboratorPermsResult.rows[0].can_publish_posts : false;

    if (!isOwner && !isAdmin && !canPublish) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to create posts in this journey.' });
    }

    const newPostData: Post = {
      id: uuidv4(),
      journey_id: journeyId,
      user_id: request.user.id,
      author_username: request.user.username,
      author_name: request.user.name,
      author_surname: request.user.surname,
      author_profile_image_url: request.user.profile_image_url,
      title: title || undefined,
      message: message || '',
      media_items: media_items && media_items.length > 0 ? media_items : undefined,
      coordinates: coordinates || undefined,
      created_at: created_at || new Date().toISOString(),
    };

    const result = await dbClient.query(
      `INSERT INTO posts (id, journey_id, user_id, author_username, author_name, author_surname, author_profile_image_url, title, message, media_items, coordinates, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *, to_jsonb(coordinates) as coordinates, to_jsonb(media_items) as media_items`,
      [
        newPostData.id, newPostData.journey_id, newPostData.user_id, newPostData.author_username, newPostData.author_name,
        newPostData.author_profile_image_url, newPostData.title, newPostData.message,
        newPostData.media_items ? JSON.stringify(newPostData.media_items) : null,
        newPostData.coordinates ? JSON.stringify(newPostData.coordinates) : null,
        newPostData.created_at
      ]
    );
    return result.rows[0];
  });

  fastify.put('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, message, media_items, coordinates, created_at } = request.body as {
      title?: string;
      message?: string;
      media_items?: MediaInfo[];
      coordinates?: { lat: number; lng: number };
      created_at?: string;
    };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const postResult = await dbClient.query('SELECT user_id, journey_id FROM posts WHERE id = $1', [id]);
    const existingPost = postResult.rows[0];
    if (!existingPost) {
      return reply.code(404).send({ message: 'Post not found' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [existingPost.journey_id]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Associated journey not found' });
    }

    const isPostAuthor = existingPost.user_id === request.user.id;
    const isJourneyOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;
    const collaboratorPermsResult = await dbClient.query(
      'SELECT can_modify_post FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [existingPost.journey_id, request.user.id]
    );
    const canModify = collaboratorPermsResult.rows.length > 0 ? collaboratorPermsResult.rows[0].can_modify_post : false;

    if (!isPostAuthor && !isJourneyOwner && !isAdmin && !canModify) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to edit this post.' });
    }

    const result = await dbClient.query(
      `UPDATE posts SET
        title = $1,
        message = COALESCE($2, message),
        media_items = $3,
        coordinates = $4,
        created_at = COALESCE($5, created_at)
       WHERE id = $6
       RETURNING *, to_jsonb(coordinates) as coordinates, to_jsonb(media_items) as media_items`,
      [
        title === null ? null : title,
        message,
        media_items && media_items.length > 0 ? JSON.stringify(media_items) : null,
        coordinates ? JSON.stringify(coordinates) : null,
        created_at,
        id
      ]
    );
    return result.rows[0];
  });

  fastify.delete('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const postResult = await dbClient.query('SELECT user_id, journey_id FROM posts WHERE id = $1', [id]);
    const existingPost = postResult.rows[0];
    if (!existingPost) {
      return reply.code(404).send({ message: 'Post not found' });
    }

    const journeyResult = await dbClient.query('SELECT user_id FROM journeys WHERE id = $1', [existingPost.journey_id]);
    const journey = journeyResult.rows[0];
    if (!journey) {
      return reply.code(404).send({ message: 'Associated journey not found' });
    }

    const isPostAuthor = existingPost.user_id === request.user.id;
    const isJourneyOwner = journey.user_id === request.user.id;
    const isAdmin = request.user.isAdmin;
    const collaboratorPermsResult = await dbClient.query(
      'SELECT can_delete_posts FROM journey_user_permissions WHERE journey_id = $1 AND user_id = $2',
      [existingPost.journey_id, request.user.id]
    );
    const canDelete = collaboratorPermsResult.rows.length > 0 ? collaboratorPermsResult.rows[0].can_delete_posts : false;

    if (!isPostAuthor && !isJourneyOwner && !isAdmin && !canDelete) {
      return reply.code(403).send({ message: 'Forbidden: You do not have permission to delete this post.' });
    }

    const deleteResult = await dbClient.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return reply.code(404).send({ message: 'Post not found' });
    }
    return reply.code(204).send();
  });
}