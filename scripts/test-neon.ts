import { neon } from '@neondatabase/serverless';

async function testNeon() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not found in .env.local');
  }

  console.log('Connecting to Neon database...');
  const sql = neon(connectionString);

  // 1. Check PostgreSQL version and database name
  const [versionRes] = await sql`SELECT version(), current_database(), current_user;`;
  console.log('✓ Connected to Neon Postgres:');
  console.log(`  Database: ${versionRes.current_database}`);
  console.log(`  User: ${versionRes.current_user}`);
  console.log(`  Postgres Version: ${versionRes.version.split(' ')[0]} ${versionRes.version.split(' ')[1]}`);

  // 2. Enable pgvector extension
  console.log('\nEnabling pgvector extension on Neon...');
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
  console.log('✓ pgvector extension is enabled!');

  // 3. Test vector operations
  const [vectorRes] = await sql`SELECT ('[1,2,3]'::vector <=> '[1,2,4]'::vector) as distance;`;
  console.log(`✓ Vector cosine distance test succeeded: distance = ${vectorRes.distance}`);

  // 4. Test connection pooling
  if (process.env.DATABASE_URL) {
    console.log('\nTesting Neon Connection Pooler (DATABASE_URL)...');
    const sqlPooled = neon(process.env.DATABASE_URL);
    const [pooledRes] = await sqlPooled`SELECT 1 as connected;`;
    console.log(`✓ Neon Connection Pooler connected: ${pooledRes.connected === 1}`);
  }

  console.log('\nALL NEON END-TO-END TESTS PASSED SUCCESSFULLY! 🚀');
}

testNeon().catch((err) => {
  console.error('Neon test failed:', err);
  process.exit(1);
});
