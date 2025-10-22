import { FastifyPluginAsync } from 'fastify';
import { deleteMediaFiles } from '../utils/mediaProcessor';

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  const pgClient = fastify.pg;

  // Helper function to check combined permissions
  const checkCombinedPermissions = async (userId: string, journeyId: string, requiredPermission: string): Promise<boolean> => {
    // 1. Check global role permissions
    const userRoleResult = await pgClient.query(
      'SELECT r.permissions FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [userId]
    );
    const globalPermissions: string[] = userRoleResult.rows[0]?.permissions || [];
    if (globalPermissions.includes(requiredPermission)) {
      return true;
    }

    // 2. Check if user is the owner of the journey
    const journeyOwnerResult = await pgClient.query('SELECT user_id FROM journeys WHERE id = $1', [journeyId]);
    const journeyOwnerId = journeyOwnerResult.rows[0]?.user_id;
    if (journeyOwnerId === userId) {
      // Owners implicitly have all permissions for their own journey
      return true;
    }

    // 3. Check journey-specific permissions
    const journeyPermsResult = await pgClient.query(
      'SELECT permissions FROM journey_user_permissions WHERE user_id = $1 AND journey_id = $2',
      [userId, journeyId]
    );
    const journeyPermissions: string[] = journeyPermsResult.rows[0]?.permissions || [];
    if (journeyPermissions.includes(requiredPermission)) {
      return true;
    }

    return false;
  };

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

      // Admins or users with 'edit_any_journey' can see all posts in any journey
      if (request.user.role !== 'admin' && !request.user.permissions.includes('edit_any_journey')) {
        // Non-admins/non-super-editors can only see posts in journeys they own or collaborate on
        const userJourneysResult = await pgClient.query(
          `SELECT id FROM journeys WHERE user_id = $1
           UNION
           SELECT journey_id FROM journey_user_permissions WHERE user_id = $1`,
          [request.user.id]
        );
        const accessibleJourneyIds = userJourneysResult.rows.map(row => row.id);

        if (accessibleJourneyIds.length === 0) {
          reply.status(200).send([]); // No accessible journeys, no posts
          return;
        }

        const journeyIdPlaceholders = accessibleJourneyIds.map((_, i) => `$${paramIndex + i}`).join(',');
        query += `${params.length > 0 ? ' AND' : ' WHERE'} p.journey_id IN (${journeyIdPlaceholders})`;
        params.push(...accessibleJourneyIds);
        paramIndex += accessibleJourneyIds.length;
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

    try {
      const { title, message, mediaInfo, spotifyEmbedUrl, coordinates, journeyId } = request.body as { 
        title?: string; 
        message: string; 
        mediaInfo?: { type: 'image'; urls: { [key: string]: string } } | { type: 'video'; url: string };
        spotifyEmbedUrl?: string; 
        coordinates?: { lat: number; lng: number };
        journeyId: string;
      };

      if (!journeyId) {
        reply.status(400).send({ message: 'Journey ID is required to create a post.' });
        return;
      }

      if (!message.trim() && !mediaInfo && !spotifyEmbedUrl && !coordinates) {
        reply.status(400).send({ message: 'At least a message, media, Spotify URL, or coordinates are required.' });
        return;
      }
      
      // Check if user has permission to create posts in this specific journey
      const canCreatePost = await checkCombinedPermissions(request.user.id, journeyId, 'create_post');
      if (!canCreatePost) {
        reply.status(403).send({ message: 'Forbidden: You do not have permission to create posts in this journey.' });
        return;
      }

      fastify.log.info('Inserting post into database.');
      const result = await pgClient.query(
        'INSERT INTO posts (journey_id, user_id, title, message, image_urls, spotify_embed_url, coordinates) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [journeyId, request.user.id, title || null, message, mediaInfo ? JSON.stringify(mediaInfo) : null, spotifyEmbedUrl || null, coordinates || null]
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
      const { title, message, mediaInfo, spotifyEmbedUrl, coordinates } = request.body as {
        title?: string;
        message?: string;
        mediaInfo?: { type: 'image'; urls: { [key: string]: string } } | { type: 'video'; url: string } | null;
        spotifyEmbedUrl?: string | null;
        coordinates?: { lat: number; lng: number } | null;
      };

      const getPostResult = await pgClient.query('SELECT user_id, journey_id, image_urls FROM posts WHERE id = $1', [id]);
      const post = getPostResult.rows[0];

      if (!post) {
        reply.status(404).send({ message: 'Post not found.' });
        return;
      }

      const isOwner = post.user_id === request.user.id;
      const canEditAnyPostGlobally = request.user.permissions.includes('edit_any_post');
      const canEditOwnPostGlobally = request.user.permissions.includes('edit_post'); // Assuming 'edit_post' means own posts globally

      // Check journey-specific permissions
      const canEditAnyPostInJourney = await checkCombinedPermissions(request.user.id, post.journey_id, 'edit_any_post');
      const canEditOwnPostInJourney = await checkCombinedPermissions(request.user.id, post.journey_id, 'edit_post');

      // Determine if the user has permission to edit this post
      let hasPermission = false;
      if (canEditAnyPostGlobally || canEditAnyPostInJourney) {
        hasPermission = true; // Can edit any post
      } else if (isOwner && (canEditOwnPostGlobally || canEditOwnPostInJourney)) {
        hasPermission = true; // Can edit own post
      }

      if (!hasPermission) {
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
      if (mediaInfo !== undefined) {
        // If new mediaInfo is provided, delete old media files first
        if (post.image_urls) {
          await deleteMediaFiles(post.image_urls, fastify.log);
        }
        fieldsToUpdate.push(`image_urls = $${paramIndex++}`);
        params.push(mediaInfo ? JSON.stringify(mediaInfo) : null);
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

      const getPostResult = await pgClient.query('SELECT image_urls, user_id, journey_id FROM posts WHERE id = $1', [id]);
      const post = getPostResult.rows[0];

      if (!post) {
        fastify.log.warn(`Post with ID ${id} not found for deletion.`);
        reply.status(404).send({ message: 'Post not found' });
        return;
      }

      const isOwner = post.user_id === request.user.id;
      const canDeleteAnyPostGlobally = request.user.permissions.includes('delete_any_post');
      const canDeleteOwnPostGlobally = request.user.permissions.includes('delete_post'); // Assuming 'delete_post' means own posts globally

      // Check journey-specific permissions
      const canDeleteAnyPostInJourney = await checkCombinedPermissions(request.user.id, post.journey_id, 'delete_any_post');
      const canDeleteOwnPostInJourney = await checkCombinedPermissions(request.user.id, post.journey_id, 'delete_post');

      // Determine if the user has permission to delete this post
      let hasPermission = false;
      if (canDeleteAnyPostGlobally || canDeleteAnyPostInJourney) {
        hasPermission = true; // Can delete any post
      } else if (isOwner && (canDeleteOwnPostGlobally || canDeleteOwnPostInJourney)) {
        hasPermission = true; // Can delete own post
      }

      if (!hasPermission) {
        reply.status(403).send({ message: 'Forbidden: You do not have permission to delete this post.' });
        return;
      }

      if (post.image_urls) {
        await deleteMediaFiles(post.image_urls, fastify.log);
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