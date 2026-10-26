import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load .env.local followed by .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Neon best practice: Use unpooled connection for schema migrations/push
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '',
  },
});
