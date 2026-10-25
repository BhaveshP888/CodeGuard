import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { architectureRules, ruleEmbeddings, repositories } from '@/lib/db/schema';
import { splitMarkdownDocument } from '@/lib/ingestion/splitter';
import { generateBatchEmbeddings } from '@/lib/ingestion/embedder';
import { uploadToStorage } from '@/lib/storage/s3-client';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const UploadRuleSchema = z.object({
  repositoryId: z.string().uuid(),
  title: z.string().min(1),
  category: z.enum(['security', 'architecture', 'performance', 'style']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  content: z.string().min(10),
  scopePattern: z.string().optional().default('**/*'),
  sourceType: z.enum(['markdown', 'pdf', 'manual']).default('markdown'),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let payload: z.infer<typeof UploadRuleSchema>;
    let fileBuffer: Buffer | null = null;
    let fileName: string | null = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const repositoryId = formData.get('repositoryId') as string;
      const title = formData.get('title') as string;
      const category = formData.get('category') as 'security' | 'architecture' | 'performance' | 'style';
      const severity = formData.get('severity') as 'critical' | 'high' | 'medium' | 'low';
      const scopePattern = (formData.get('scopePattern') as string) || '**/*';
      const file = formData.get('file') as File | null;
      let content = (formData.get('content') as string) || '';

      if (file) {
        fileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        content = fileBuffer.toString('utf-8');
      }

      const parsed = UploadRuleSchema.safeParse({
        repositoryId,
        title: title || fileName || 'Uploaded Rule',
        category: category || 'security',
        severity: severity || 'high',
        content,
        scopePattern,
        sourceType: fileName?.endsWith('.pdf') ? 'pdf' : 'markdown',
      });

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.format() },
          { status: 400 }
        );
      }
      payload = parsed.data;
    } else {
      const body = await req.json();
      const parsed = UploadRuleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.format() },
          { status: 400 }
        );
      }
      payload = parsed.data;
    }

    // Verify repository ownership
    const repo = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(
        and(
          eq(repositories.id, payload.repositoryId),
          eq(repositories.userId, session.user.id)
        )
      )
      .limit(1);

    if (!repo[0]) {
      return NextResponse.json(
        { error: 'Repository not found or access denied' },
        { status: 404 }
      );
    }

    // Archive to R2 / S3 if storage is configured
    let storageKey: string | null = null;
    if (fileBuffer) {
      try {
        const key = `rules/${payload.repositoryId}/${Date.now()}-${fileName || 'rule.md'}`;
        storageKey = await uploadToStorage(key, fileBuffer, 'text/markdown');
      } catch (storageErr) {
        console.warn('Storage upload skipped/failed (optional):', storageErr);
      }
    }

    // Insert rule header
    const [insertedRule] = await db
      .insert(architectureRules)
      .values({
        repositoryId: payload.repositoryId,
        title: payload.title,
        category: payload.category,
        severity: payload.severity,
        content: payload.content,
        sourceType: payload.sourceType,
        storageKey,
        scopePattern: payload.scopePattern,
      })
      .returning();

    // Split rule content into semantic chunks
    const chunks = await splitMarkdownDocument(payload.content, 800, 100);

    if (chunks.length > 0) {
      // Generate embeddings via Google Gemini text-embedding-004
      const embeddings = await generateBatchEmbeddings(chunks);

      const embeddingRows = chunks.map((chunk, i) => ({
        ruleId: insertedRule.id,
        repositoryId: payload.repositoryId,
        chunkContent: chunk,
        embedding: embeddings[i],
        metadata: {
          category: payload.category,
          severity: payload.severity,
          scopePattern: payload.scopePattern,
          ruleTitle: payload.title,
        },
      }));

      await db.insert(ruleEmbeddings).values(embeddingRows);
    }

    return NextResponse.json(
      {
        rule: insertedRule,
        chunksIndexed: chunks.length,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to upload rule';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
