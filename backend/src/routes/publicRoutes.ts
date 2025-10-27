// backend/src/routes/publicRoutes.ts
import { FastifyInstance } from 'fastify';
// Removed dbClient, isDbConnected, hashPassword, generateToken, mapDbUserToApiUser, User, Journey, uuidv4, comparePassword imports as they are no longer needed here.

export default async function publicRoutes(fastify: FastifyInstance) {

  // Health check endpoint for Docker
  fastify.get('/health', async (request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  // Redirect old public journey path to new one at the root level
  fastify.get('/public-journey/:ownerUsername/:journeyName', async (request, reply) => {
    const { ownerUsername, journeyName } = request.params as { ownerUsername: string; journeyName: string };
    const newPath = `/public/journeys/by-name/${ownerUsername}/${journeyName}`;
    reply.redirect(301, newPath); // 301 Permanent Redirect
  });

  // Public journey API routes are now in publicJourneyApiRoutes.ts and prefixed with /api
}