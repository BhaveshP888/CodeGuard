import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || '';

// Neon Serverless HTTP driver: optimized for Next.js serverless/edge runtimes
// Queries run over HTTP with 0 connection setup latency and zero connection pool exhaustion.
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export { schema };
export type Database = typeof db;

