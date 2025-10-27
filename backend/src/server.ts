import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs/promises'; // Import fs.promises for readFile

import { connectDbAndCreateTables } from './db';
import { UPLOADS_DIR } from './config';
import publicRoutes from './routes/publicRoutes';
import userRoutes from './routes/userRoutes';
import journeyRoutes from './routes/journeyRoutes';
import postRoutes from './routes/postRoutes';
import mediaRoutes from './routes/mediaRoutes';

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

// Register @fastify/static to serve uploaded files (e.g., /uploads/image.jpg)
fastify.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
  decorateReply: false,
});

// Register @fastify/static to serve frontend static files (e.g., index.html, JS, CSS)
// This should be registered before API routes to serve static assets directly.
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../frontend-dist'), // Path to the frontend build output
  prefix: '/', // Serve from the root URL
  decorateReply: false,
  index: false, // Do not automatically serve index.html for subpaths
});

// Register API routes with a prefix
fastify.register(publicRoutes, { prefix: '/api' });
fastify.register(userRoutes, { prefix: '/api' });
fastify.register(journeyRoutes, { prefix: '/api' });
fastify.register(postRoutes, { prefix: '/api' });
fastify.register(mediaRoutes, { prefix: '/api' });

// Catch-all route for client-side routing (must be after all API and static asset routes)
// This ensures that any route not matched by static files or API endpoints
// will serve the frontend's index.html, allowing client-side routing to take over.
fastify.get('/*', async (request, reply) => {
  try {
    const filePath = path.join(__dirname, '../../frontend-dist/index.html');
    const fileContent = await fs.readFile(filePath, 'utf8'); // Corrected line
    reply.type('text/html').send(fileContent);
  } catch (error) {
    fastify.log.error(error, 'Error serving index.html for client-side routing');
    reply.code(404).send({ message: 'Not Found' });
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