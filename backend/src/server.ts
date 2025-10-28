import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { FastifyStaticOptions } from '@fastify/static';
import path from 'path';
import fs from 'fs/promises';

import { connectDbAndCreateTables } from './db';
import { UPLOADS_DIR } from './config';
import userRoutes from './routes/userRoutes'; // Public user routes
import protectedUserRoutes from './routes/protectedUserRoutes'; // Protected user routes
import journeyRoutes from './routes/journeyRoutes';
import postRoutes from './routes/postRoutes';
import mediaRoutes from './routes/mediaRoutes';
import publicJourneyApiRoutes from './routes/publicJourneyApiRoutes'; // Import the new public journey API routes
import { authenticate } from './auth'; // Import authenticate hook

const fastify = Fastify({
  logger: {
    level: 'debug',
  },
  bodyLimit: 12 * 1024 * 1024,
});

// Register CORS plugin
fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Health check endpoint for Docker (moved from publicRoutes)
fastify.get('/health', async (request, reply) => {
  return reply.code(200).send({ status: 'ok' });
});

// 1. Register all API routes (both public and protected) with the /api prefix.
fastify.register(userRoutes, { prefix: '/api' }); // Public user routes (login, register, users/exists)
fastify.register(publicJourneyApiRoutes, { prefix: '/api' }); // Public journey API routes

// Register protected API routes with a prefix and apply authentication hook
fastify.register(async (authenticatedInstance) => {
  authenticatedInstance.addHook('preHandler', authenticate);
  authenticatedInstance.register(protectedUserRoutes, { prefix: '/users' }); // Protected user routes (profile, admin user management)
  authenticatedInstance.register(journeyRoutes, { prefix: '/journeys' }); // Protected journey routes
  authenticatedInstance.register(postRoutes, { prefix: '/posts' }); // Protected post routes
  authenticatedInstance.register(mediaRoutes, { prefix: '/media' }); // Protected media upload route
}, { prefix: '/api' }); // All these routes will be under /api and authenticated

// 2. Register @fastify/static to serve uploaded files (e.g., /uploads/image.jpg)
fastify.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
  decorateReply: false,
});

// 3. SPA fallback: Serve index.html for any unmatched route
// This MUST be the ABSOLUTE LAST route registered to act as a catch-all for frontend routes.
fastify.get('/*', async (request, reply) => {
  // If the request is for a known API or uploads path, let Fastify's default 404 handler take over
  // (though ideally, these should be matched by earlier routes)
  if (request.url.startsWith('/api') || request.url.startsWith('/uploads')) {
    return reply.callNotFound();
  }

  // Otherwise, serve the frontend's index.html
  const indexPath = path.join(__dirname, '../../frontend-dist', 'index.html');
  try {
    const fileContent = await fs.readFile(indexPath, 'utf8');
    reply.type('text/html').send(fileContent);
  } catch (err) {
    fastify.log.error(err, 'Error serving index.html for SPA fallback');
    reply.code(500).send('Internal Server Error');
  }
});


// Run the server
const start = async () => {
  try {
    await connectDbAndCreateTables(fastify.log);
    await fastify.listen({ port: 8080, host: '0.0.0.0' }); // Listen on 8080
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err: unknown) {
    fastify.log.error(err as Error, 'Failed to start Fastify server or connect to database');
    process.exit(1);
  }
};

start();