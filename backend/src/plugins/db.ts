import { FastifyPluginAsync } from 'fastify';
import { Client as PgClient } from 'pg';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    pg: PgClient;
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const pgClient = new PgClient({
    connectionString: process.env.DATABASE_URL,
  });

  // Function to connect to PostgreSQL with retries
  async function connectWithRetry(client: PgClient, maxRetries = 10, delay = 5000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await client.connect();
        fastify.log.info('Connected to PostgreSQL database.');
        return;
      } catch (error) {
        fastify.log.warn(`Failed to connect to PostgreSQL (attempt ${i + 1}/${maxRetries}). Retrying in ${delay / 1000}s...`);
        if (i < maxRetries - 1) {
          await new Promise(res => setTimeout(res, delay));
        } else {
          throw error; // Re-throw if max retries reached
        }
      }
    }
  }

  // Ensure database tables exist and set up default roles
  async function ensureDbTable() {
    // Drop tables in correct order to avoid foreign key constraints issues
    await pgClient.query('DROP TABLE IF EXISTS journey_user_permissions CASCADE;'); // New: Drop journey_user_permissions first
    await pgClient.query('DROP TABLE IF EXISTS posts CASCADE;');
    await pgClient.query('DROP TABLE IF EXISTS journeys CASCADE;');
    await pgClient.query('DROP TABLE IF EXISTS users CASCADE;');
    await pgClient.query('DROP TABLE IF EXISTS roles CASCADE;');
    fastify.log.info('Existing posts, journeys, users, roles, and journey_user_permissions tables dropped (if any).');

    // Create roles table
    await pgClient.query(`
      CREATE TABLE roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        permissions JSONB DEFAULT '[]', -- e.g., ['create_post', 'delete_post']
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    fastify.log.info('Roles table created.');

    // Create users table with foreign key to roles
    await pgClient.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT, -- Link to role
        name TEXT,
        surname TEXT,
        profile_image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    fastify.log.info('Users table created.');

    // Create journeys table with foreign key to users
    await pgClient.query(`
      CREATE TABLE journeys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to user
        name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    fastify.log.info('Journeys table created.');

    // Create posts table with foreign key to journeys and users
    await pgClient.query(`
      CREATE TABLE posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to user
        title TEXT,
        message TEXT NOT NULL,
        image_urls JSONB,
        spotify_embed_url TEXT,
        coordinates JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    fastify.log.info('Posts table created.');

    // New: Create journey_user_permissions table
    await pgClient.query(`
      CREATE TABLE journey_user_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
        permissions JSONB DEFAULT '[]', -- e.g., ['create_post', 'delete_post']
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, journey_id)
      );
    `);
    fastify.log.info('Journey_user_permissions table created.');

    // Insert default roles if they don't exist
    const adminPermissions = ['create_post', 'delete_post', 'create_journey', 'delete_journey', 'manage_users', 'edit_any_journey', 'delete_any_journey', 'delete_any_post', 'manage_roles', 'edit_any_post', 'manage_journey_access']; // Added manage_journey_access
    await pgClient.query(
      "INSERT INTO roles (name, permissions) VALUES ('admin', $1) ON CONFLICT (name) DO NOTHING",
      [JSON.stringify(adminPermissions)]
    );
    fastify.log.info('Default admin role ensured.');

    const userPermissions = ['create_post', 'delete_post', 'create_journey', 'delete_journey'];
    await pgClient.query(
      "INSERT INTO roles (name, permissions) VALUES ('user', $1) ON CONFLICT (name) DO NOTHING",
      [JSON.stringify(userPermissions)]
    );
    fastify.log.info('Default user role ensured.');
  }

  await connectWithRetry(pgClient);
  await ensureDbTable();

  fastify.decorate('pg', pgClient);
};

export default fp(dbPlugin);