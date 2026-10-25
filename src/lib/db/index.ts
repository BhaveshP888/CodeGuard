import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var _postgresClient: postgres.Sql | undefined;
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/codeguard_db';

// Reuse connection pool during hot-reloading in development
const client =
  global._postgresClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 2,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false, // Required for transaction connection poolers like Supabase Transaction Mode / PgBouncer
  });

if (process.env.NODE_ENV !== 'production') {
  global._postgresClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
export type Database = typeof db;
