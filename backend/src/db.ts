// backend/src/db.ts
import { Pool } from 'pg';
import fs from 'fs/promises';
import { UPLOADS_PATH } from './config';
import { FastifyBaseLogger } from 'fastify';

export let dbClient: Pool | null = null;
export let isDbConnected = false;

export const connectDbAndCreateTables = async (logger: FastifyBaseLogger) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('DATABASE_URL is not defined. Please set it in your environment variables.');
    throw new Error('DATABASE_URL is not defined.');
  }

  isDbConnected = false;

  const MAX_RETRIES = 10;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test the connection
      await pool.query('SELECT 1');
      logger.info('Connected to PostgreSQL database (connection pool)');
      dbClient = pool;
      await createTables(logger);
      isDbConnected = true;
      return;
    } catch (err: unknown) {
      retries++;
      logger.warn(`Failed to connect to PostgreSQL (attempt ${retries}/${MAX_RETRIES}): ${(err as Error).message}`);

      // Close the pool if it was partially created
      if (dbClient) {
        try {
          await dbClient.end();
          dbClient = null;
        } catch (endErr) {
          logger.error(endErr, 'Error closing pool after failed connection attempt.');
        }
      }

      if (retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        logger.error(err as Error, 'Failed to connect to PostgreSQL after multiple retries');
        isDbConnected = false;
        dbClient = null;
        throw new Error('Failed to connect to PostgreSQL after multiple retries');
      }
    }
  }
};

export const closeDb = async () => {
  if (dbClient) {
    await dbClient.end();
    dbClient = null;
    isDbConnected = false;
  }
};

const createTables = async (logger: FastifyBaseLogger) => {
  try {
    await fs.mkdir(UPLOADS_PATH, { recursive: true });
    await dbClient!.query(`
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

      DO $$ BEGIN
          ALTER TABLE users ADD COLUMN color_scheme VARCHAR(20) DEFAULT 'vanilla';
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
        is_public BOOLEAN DEFAULT FALSE,
        public_link_id VARCHAR(255) UNIQUE,
        passphrase_hash VARCHAR(255)
      );

      DO $$ BEGIN
          ALTER TABLE journeys ADD COLUMN public_link_id VARCHAR(255) UNIQUE;
      EXCEPTION
          WHEN duplicate_column THEN NULL;
      END $$;

      DO $$ BEGIN
          ALTER TABLE journeys ADD COLUMN passphrase_hash VARCHAR(255);
      EXCEPTION
          WHEN duplicate_column THEN NULL;
      END $$;

      DO $$ BEGIN
          ALTER TABLE journeys ADD COLUMN color_scheme VARCHAR(20) DEFAULT NULL;
      EXCEPTION
          WHEN duplicate_column THEN NULL;
      END $$;

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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_draft BOOLEAN DEFAULT FALSE
      );

      DO $$ BEGIN
          ALTER TABLE posts ADD COLUMN is_draft BOOLEAN DEFAULT FALSE;
      EXCEPTION
          WHEN duplicate_column THEN NULL;
      END $$;

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
    logger.info('Database tables checked/created successfully');
  } catch (err: unknown) {
    logger.error(err as Error, 'Error creating database tables');
    throw err;
  }
};
