import { db } from '../src/lib/db';
import { users, repositories, architectureRules, ruleEmbeddings } from '../src/lib/db/schema';
import { findRelevantRules } from '../src/lib/db/vector-search';
import { eq, like } from 'drizzle-orm';

async function main() {
  console.log('--- 1. Testing Neon HTTP Connection & Tables ---');
  // First clean up any previous test residues
  const testUsers = await db.select().from(users).where(like(users.username, 'neon-tester%'));
  for (const u of testUsers) {
    await db.delete(users).where(eq(users.id, u.id));
  }

  const userList = await db.select().from(users).limit(1);
  console.log('Successfully connected to Neon! Users count:', userList.length);

  const testGithubId = `test-neon-${Date.now()}`;
  let createdUserId: string | null = null;
  let createdRepoId: string | null = null;

  try {
    console.log('\n--- 2. Testing Insert User ---');
    const [createdUser] = await db
      .insert(users)
      .values({
        githubId: testGithubId,
        username: 'neon-tester',
        email: 'neon-tester@example.com',
        encryptedAccessToken: 'dummy-encrypted-token',
        accessTokenIv: 'dummy-iv',
        accessTokenTag: 'dummy-tag',
      })
      .returning();
    createdUserId = createdUser.id;
    console.log('Created user:', createdUser.id, createdUser.username);

    console.log('\n--- 3. Testing Insert Repository ---');
    const [createdRepo] = await db
      .insert(repositories)
      .values({
        userId: createdUser.id,
        githubRepoId: Math.floor(Date.now() / 1000),
        fullName: 'neon-tester/test-repo',
        defaultBranch: 'main',
        isIndexed: true,
        indexingStatus: 'completed',
      })
      .returning();
    createdRepoId = createdRepo.id;
    console.log('Created repo:', createdRepo.id, createdRepo.fullName);

    console.log('\n--- 4. Testing Architecture Rule & pgvector 768d Vector Insertion ---');
    const [createdRule] = await db
      .insert(architectureRules)
      .values({
        repositoryId: createdRepo.id,
        title: 'Neon Best Practices Rule',
        category: 'database',
        severity: 'warning',
        content: 'Always use @neondatabase/serverless and drizzle-orm/neon-http for serverless Next.js.',
        sourceType: 'manual',
      })
      .returning();

    // Create a 768-dimensional test vector (normalized vector with 1 at pos 0)
    const dummyEmbedding = new Array(768).fill(0);
    dummyEmbedding[0] = 1.0;

    const [createdEmbedding] = await db
      .insert(ruleEmbeddings)
      .values({
        ruleId: createdRule.id,
        repositoryId: createdRepo.id,
        chunkContent: 'Neon best practices rule content chunk',
        embedding: dummyEmbedding,
        metadata: { category: 'database', ruleTitle: createdRule.title },
      })
      .returning();
    console.log('Created rule embedding ID:', createdEmbedding.id);

    console.log('\n--- 5. Testing pgvector Search via findRelevantRules ---');
    const searchResults = await findRelevantRules(createdRepo.id, dummyEmbedding, 5, 0.5);
    console.log(`Found ${searchResults.length} matching rules.`);
    for (const match of searchResults) {
      console.log(`- Match: "${match.chunkContent}", Similarity: ${match.similarity.toFixed(4)}`);
    }

    if (searchResults.length === 0 || searchResults[0].similarity < 0.99) {
      throw new Error('pgvector similarity search did not return expected match');
    }

    console.log('\nAll Neon PostgreSQL & pgvector end-to-end tests PASSED!');
  } finally {
    console.log('\n--- 6. Clean Up Test Data ---');
    if (createdRepoId) {
      await db.delete(repositories).where(eq(repositories.id, createdRepoId));
    }
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId));
    }
    console.log('Test clean-up complete.');
  }
}

main().catch((err) => {
  console.error('Neon E2E test failed:', err);
  process.exit(1);
});
