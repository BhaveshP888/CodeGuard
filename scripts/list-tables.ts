import { neon } from '@neondatabase/serverless';

async function listNeonTables() {
  const sql = neon(process.env.DATABASE_URL!);
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('Tables created in Neon database:');
  for (const row of tables) {
    console.log(` - ${row.table_name}`);
  }
}

listNeonTables().catch(console.error);
