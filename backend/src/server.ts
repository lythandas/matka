import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';

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
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      fastify.log.warn(`CORS: Blocking request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Register @fastify/static to serve uploaded files
fastify.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
  decorateReply: false
});

// Register routes
fastify.register(publicRoutes);
fastify.register(userRoutes);
fastify.register(journeyRoutes);
fastify.register(postRoutes);
fastify.register(mediaRoutes);


// Run the server
const start = async () => {
  try {
    await connectDbAndCreateTables(fastify.log); // Pass the main fastify.log instance
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err: unknown) {
    fastify.log.error(err as Error, 'Failed to start Fastify server or connect to database');
    process.exit(1);
  }
};

start();