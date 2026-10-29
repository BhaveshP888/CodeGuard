import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { architectureRules, ruleEmbeddings, repositories } from '@/lib/db/schema';
import { splitMarkdownDocument } from '@/lib/ingestion/splitter';
import { generateBatchEmbeddings } from '@/lib/ingestion/embedder';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const repositoryId = searchParams.get('repositoryId');

  if (!repositoryId) {
    return NextResponse.json({ error: 'Missing repositoryId parameter' }, { status: 400 });
  }

  try {
    // Verify repository ownership
    const repo = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(
        and(
          eq(repositories.id, repositoryId),
          eq(repositories.userId, session.user.id)
        )
      )
      .limit(1);

    if (!repo[0]) {
      return NextResponse.json({ error: 'Repository not found or access denied' }, { status: 404 });
    }

    const rules = await db
      .select()
      .from(architectureRules)
      .where(eq(architectureRules.repositoryId, repositoryId))
      .orderBy(desc(architectureRules.createdAt));

    // Combine rules content if multiple, or return the primary custom spec
    const customSpec = rules.find((r) => r.title === 'Custom Security Spec') || rules[0];

    return NextResponse.json({
      markdownContent: customSpec?.content || '',
      lastUpdated: customSpec?.createdAt || null,
      rulesCount: rules.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch rules';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const SaveSpecSchema = z.object({
  repositoryId: z.string().uuid(),
  markdownContent: z.string().min(1, 'Security instructions cannot be empty'),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = SaveSpecSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const { repositoryId, markdownContent } = parsed.data;

    // Verify repository ownership
    const repo = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(
        and(
          eq(repositories.id, repositoryId),
          eq(repositories.userId, session.user.id)
        )
      )
      .limit(1);

    if (!repo[0]) {
      return NextResponse.json({ error: 'Repository not found or access denied' }, { status: 404 });
    }

    // 1. Delete previous custom spec for this repository to avoid duplicate embeddings
    await db
      .delete(architectureRules)
      .where(eq(architectureRules.repositoryId, repositoryId));

    // 2. Insert new custom security spec
    const [insertedRule] = await db
      .insert(architectureRules)
      .values({
        repositoryId,
        title: 'Custom Security Spec',
        category: 'security',
        severity: 'critical',
        content: markdownContent,
        sourceType: 'manual',
        scopePattern: '**/*',
      })
      .returning();

    // 3. Split markdown into semantic chunks
    const chunks = await splitMarkdownDocument(markdownContent, 800, 100);

    // 4. Generate batch embeddings via Gemini and index in pgvector
    if (chunks.length > 0) {
      const embeddings = await generateBatchEmbeddings(chunks);

      const embeddingRows = chunks.map((chunk, i) => ({
        ruleId: insertedRule.id,
        repositoryId,
        chunkContent: chunk,
        embedding: embeddings[i],
        metadata: {
          category: 'security',
          severity: 'critical',
          scopePattern: '**/*',
          ruleTitle: 'Custom Security Spec',
        },
      }));

      await db.insert(ruleEmbeddings).values(embeddingRows);
    }

    return NextResponse.json({
      success: true,
      ruleId: insertedRule.id,
      chunksIndexed: chunks.length,
      lastUpdated: insertedRule.createdAt,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to save security spec';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
