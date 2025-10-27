// backend/src/db.ts
import { Client } from 'pg';
import Fastify from 'fastify'; // Import Fastify for logging
import fs from 'fs/promises';
import { UPLOADS_DIR } from './config';

const fastifyLogger = Fastify().log; // Create a logger instance for this module

export let dbClient: Client;
export let isDbConnected = false;

export const connectDbAndCreateTables = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fastifyLogger.error('DATABASE_URL is not defined. Please set it in your environment variables.');
    throw new Error('DATABASE_URL is not defined.');
  }

  dbClient = new Client({
    connectionString: databaseUrl,
  });

  const MAX_RETRIES = 10;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await dbClient.connect();
      fastifyLogger.info('Connected to PostgreSQL database');
      await createTables();
      isDbConnected = true;
      return;
    } catch (err: unknown) {
      retries++;
      fastifyLogger.warn(`Failed to connect to PostgreSQL (attempt ${retries}/${MAX_RETRIES}): ${(err as Error).message}`);
      if (retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        fastifyLogger.error(err as Error, 'Failed to connect to PostgreSQL after multiple retries');
        isDbConnected = false;
        throw new Error('Failed to connect to PostgreSQL after multiple retries');
      }
    }
  }
};

const createTables = async () => {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        name VARCHAR(255),
        surname VARCHAR(255),
        profile_image_url TEXT,
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      DO $$ BEGIN
          ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'en';
      EXCEPTION
          WHEN duplicate_column THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS journeys (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        owner_username VARCHAR(255) NOT NULL,
        owner_name VARCHAR(255),
        owner_surname VARCHAR(255),
        owner_profile_image_url TEXT,
        is_public BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(255) PRIMARY KEY,
        journey_id VARCHAR(255) REFERENCES journeys(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        author_username VARCHAR(255) NOT NULL,
        author_name VARCHAR(255),
        author_surname VARCHAR(255),
        author_profile_image_url TEXT,
        title VARCHAR(255),
        message TEXT NOT NULL,
        media_items JSONB,
        coordinates JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS journey_user_permissions (
        id VARCHAR(255) PRIMARY KEY,
        journey_id VARCHAR(255) REFERENCES journeys(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        can_read_posts BOOLEAN DEFAULT TRUE,
        can_publish_posts BOOLEAN DEFAULT TRUE,
        can_modify_post BOOLEAN DEFAULT TRUE,
        can_delete_posts BOOLEAN DEFAULT FALSE,
        UNIQUE (journey_id, user_id)
      );
    `);
    fastifyLogger.info('Database tables checked/created successfully');
  } catch (err: unknown) {
    fastifyLogger.error(err as Error, 'Error creating database tables');
    throw err;
  }
};