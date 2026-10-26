import { drizzle } from 'drizzle-orm/neon-http';
import { neon, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleWs } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import { users, repositories, ruleEmbeddings } from '../src/lib/db/schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not defined in environment');
}

console.log('Connecting via drizzle-orm/neon-http to:', url.replace(/:[^:@]+@/, ':****@'));
const sqlClient = neon(url);
const db = drizzle(sqlClient, { schema: { users, repositories, ruleEmbeddings } });

async function run() {
  const result = await db.execute(sql`SELECT 1 as num, 'hello' as str`);
  console.log('neon-http Query result:', result);
  console.log('Is array:', Array.isArray(result));

  const pool = new Pool({ connectionString: url });
  const dbPool = drizzleWs(pool);
  const poolRes = await dbPool.execute(sql`SELECT 1 as num, 'hello' as str`);
  console.log('neon-serverless (Pool) Query result:', poolRes);
  console.log('Pool Is array:', Array.isArray(poolRes));
  await pool.end();
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

