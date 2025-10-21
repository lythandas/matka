import { FastifyPluginAsync } from 'fastify';
import { deleteImageFiles } from '../utils/imageProcessor'; // Import deleteImageFiles

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  const pgClient = fastify.pg;

  // Get all posts for a specific journey (or all if no journeyId provided)
  fastify.get('/posts', async (request, reply) => {
    if (!request.user) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }
    try {
      const { journeyId } = request.query as { journeyId?: string };
      let query = `
        SELECT p.*, u.username AS author_username, u.name AS author_name, u.surname AS author_surname, u.profile_image_url AS author_profile_image_url
        FROM posts p
        JOIN users u ON p.user_id = u.id
      `;
      const params: string[] = [];
      let paramIndex = 1;

      if (journeyId) {
        query += ` WHERE p.journey_id = $${paramIndex++}`;
        params.push(journeyId);
      }

      if (!request.user.permissions.includes('edit_any_journey')) {
        query += `${params.length > 0 ? ' AND' : ' WHERE'} p.user_id = $${paramIndex++}`;
        params.push(request.user.id);
      }
      
      query += ' ORDER BY p.created_at DESC';
      const result = await pgClient.query(query, params);
      return result.rows;
    } catch (error) {
      fastify.log.error({ error }, 'Error fetching posts');
      reply.status(500).send({ message: 'Failed to fetch posts' });
    }
  });

  // Create a new post with an optional image URL, title, Spotify embed, and coordinates
  fastify.post('/posts', async (request, reply) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }
    if (!request.user.permissions.includes('create_post')) {
      reply.status(403).send({ message: 'Forbidden: You do not have permission to create posts.' });
      return;
    }

    try {
      const { title, message, imageUrls, spotifyEmbedUrl, coordinates, journeyId } = request.body as { 
        title?: string; 
        message: string; 
        imageUrls?: { small?: string; medium?: string; large?: string; original?: string };
        spotifyEmbedUrl?: string; 
        coordinates?: { lat: number; lng: number };
        journeyId: string;
      };

      if (!journeyId) {
        reply.status(400).send({ message: 'Journey ID is required to create a post.' });
        return;
      }

      if (!message.trim() && !imageUrls && !spotifyEmbedUrl && !coordinates) {
        reply.status(400).send({ message: 'At least a message, image, Spotify URL, or coordinates are required.' });
        return;
      }
      
      const journeyResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
      const journey = journeyResult.rows[0];

      if (!journey) {
        reply.status(404).send({ message: 'Journey not found.' });
        return;
      }

      const isOwner = journey.user_id === request.user.id;
      const canEditAnyJourney = request.user.permissions.includes('edit_any_journey');

      if (!isOwner && !canEditAnyJourney) {
        reply.status(403).send({ message: 'Forbidden: You do not have permission to post to this journey.' });
        return;
      }

      fastify.log.info('Inserting post into database.');
      const result = await pgClient.query(
        'INSERT INTO posts (journey_id, user_id, title, message, image_urls, spotify_embed_url, coordinates) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [journeyId, request.user.id, title || null, message, imageUrls || null, spotifyEmbedUrl || null, coordinates || null]
      );
      fastify.log.info(`Post inserted successfully. New post ID: ${result.rows[0].id}`);
      reply.status(201).send(result.rows[0]);
    } catch (error) {
      fastify.log.error({ error }, 'Error creating post');
      reply.status(500).send({ message: 'Failed to create post' });
    }
  });

  // Update a post by ID
  fastify.put('/posts/:id', async (request, reply) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }

    try {
      const { id } = request.params as { id: string };
      const { title, message, imageUrls, spotifyEmbedUrl, coordinates } = request.body as {
        title?: string;
        message?: string;
        imageUrls?: { small?: string; medium?: string; large?: string; original?: string } | null;
        spotifyEmbedUrl?: string | null;
        coordinates?: { lat: number; lng: number } | null;
      };

      const getPostResult = await pgClient.query('SELECT user_id FROM posts WHERE id = $1', [id]);
      const post = getPostResult.rows[0];

      if (!post) {
        reply.status(404).send({ message: 'Post not found.' });
        return;
      }

      const isOwner = post.user_id === request.user.id;
      const canEditAnyPost = request.user.permissions.includes('edit_any_post');

      if (!isOwner && !canEditAnyPost) {
        reply.status(403).send({ message: 'Forbidden: You do not have permission to edit this post.' });
        return;
      }

      const fieldsToUpdate: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (title !== undefined) {
        fieldsToUpdate.push(`title = $${paramIndex++}`);
        params.push(title || null);
      }
      if (message !== undefined) {
        fieldsToUpdate.push(`message = $${paramIndex++}`);
        params.push(message);
      }
      if (imageUrls !== undefined) {
        fieldsToUpdate.push(`image_urls = $${paramIndex++}`);
        params.push(imageUrls ? JSON.stringify(imageUrls) : null);
      }
      if (spotifyEmbedUrl !== undefined) {
        fieldsToUpdate.push(`spotify_embed_url = $${paramIndex++}`);
        params.push(spotifyEmbedUrl || null);
      }
      if (coordinates !== undefined) {
        fieldsToUpdate.push(`coordinates = $${paramIndex++}`);
        params.push(coordinates ? JSON.stringify(coordinates) : null);
      }

      if (fieldsToUpdate.length === 0) {
        reply.status(400).send({ message: 'No fields provided for update.' });
        return;
      }

      params.push(id);

      const query = `UPDATE posts SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await pgClient.query(query, params);

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'Post not found.' });
        return;
      }
      reply.status(200).send(result.rows[0]);
    } catch (error) {
      fastify.log.error({ error }, 'Error updating post');
      reply.status(500).send({ message: 'Failed to update post' });
    }
  });

  // Delete a post by ID
  fastify.delete('/posts/:id', async (request, reply) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }

    try {
      const { id } = request.params as { id: string };
      fastify.log.info(`Attempting to delete post with ID: ${id}`);

      const getPostResult = await pgClient.query('SELECT image_urls, user_id FROM posts WHERE id = $1', [id]);
      const post = getPostResult.rows[0];

      if (!post) {
        fastify.log.warn(`Post with ID ${id} not found for deletion.`);
        reply.status(404).send({ message: 'Post not found' });
        return;
      }

      const isOwner = post.user_id === request.user.id;
      const canDeleteAnyPost = request.user.permissions.includes('delete_any_post');

      if (!isOwner && !canDeleteAnyPost) {
        reply.status(403).send({ message: 'Forbidden: You do not have permission to delete this post.' });
        return;
      }

      if (post.image_urls) {
        await deleteImageFiles(post.image_urls, fastify.log.warn); // Use the utility function
      }

      const result = await pgClient.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);

      if (result.rowCount === 0) {
        reply.status(404).send({ message: 'Post not found after initial check (race condition or similar).' });
      } else {
        fastify.log.info(`Post with ID ${id} deleted successfully.`);
        reply.status(200).send({ message: 'Post deleted successfully', id: result.rows[0].id });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Error deleting post');
      reply.status(500).send({ message: 'Failed to delete post' });
    }
  });
};

export default postsRoutes;