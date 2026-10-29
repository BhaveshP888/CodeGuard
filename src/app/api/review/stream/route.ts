import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { repositories, pullRequestReviews, reviewComments } from '@/lib/db/schema';
import { getUserOctokit } from '@/lib/github/octokit';
import { parseUnifiedDiff } from '@/lib/github/diff-parser';
import { scanDiffForVulnerabilities } from '@/lib/security/sast-scanner';
import { buildPRRAGContext } from '@/lib/rag/context-builder';
import { reviewModel, ReviewReportSchema, type ReviewFinding } from '@/lib/ai/gemini';
import { streamObject } from 'ai';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const RequestSchema = z.object({
  repositoryId: z.string().uuid(),
  prNumber: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { repositoryId, prNumber } = parsed.data;

    // Fetch repository
    const repoList = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.id, repositoryId),
          eq(repositories.userId, session.user.id)
        )
      )
      .limit(1);

    const repo = repoList[0];
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const [owner, repoName] = repo.fullName.split('/');
    const octokit = await getUserOctokit(session.user.id);

    // Fetch PR metadata
    const { data: prData } = await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
    });

    // Fetch raw unified diff
    const { data: rawDiff } = (await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
      mediaType: {
        format: 'diff',
      },
    })) as unknown as { data: string };

    const parsedDiff = parseUnifiedDiff(rawDiff);

    // 1. Run zero-latency SAST pre-scanner (catches hardcoded credentials & critical flaws)
    const sastFindings = scanDiffForVulnerabilities(parsedDiff);

    // 2. Query pgvector for semantic RAG context (team architecture guidelines & codebase definitions)
    const ragContext = await buildPRRAGContext(repositoryId, parsedDiff);

    // 3. Create initial review tracking entry in DB
    const [reviewRecord] = await db
      .insert(pullRequestReviews)
      .values({
        repositoryId,
        prNumber,
        prTitle: prData.title,
        authorUsername: prData.user?.login || 'unknown',
        baseSha: prData.base.sha,
        headSha: prData.head.sha,
        status: 'analyzing',
      })
      .returning();

    // 4. Construct prompt for Vercel AI SDK
    const prompt = `
You are CodeGuard AI, an autonomous Principal Security Engineer and Software Architect.
Perform an inline, file-by-file architectural and security review of the following Pull Request.

PULL REQUEST TITLE: ${prData.title}
PULL REQUEST DESCRIPTION: ${prData.body || 'No description provided.'}
AFFECTED FILES: ${parsedDiff.map((f) => f.newPath).join(', ')}

${ragContext.assembledPromptContext}

${
  sastFindings.length > 0
    ? `PRE-SCANNED SAST FINDINGS (Incorporate these critical true-positives):\n${JSON.stringify(
        sastFindings,
        null,
        2
      )}`
    : ''
}

RAW UNIFIED DIFF TO AUDIT:
\`\`\`diff
${rawDiff.slice(0, 30000)}
\`\`\`

INSTRUCTIONS:
1. Cross-reference every changed line against the provided Team Architectural & Security Guidelines. If a rule is violated, cite the rule's title explicitly.
2. Flag potential security vulnerabilities: injection, broken authentication, IDOR, sensitive data leaks, SSRF, insecure direct object references, prototype pollution, improper error handling.
3. For every issue, specify the exact filePath, the exact lineNumber in the new code, category, severity, clear message, and provide a concrete suggestedPatch.
4. Calculate an aggregate riskScore from 0 (pristine/safe) to 100 (critical security flaw).
5. Generate a clean, valid Mermaid.js sequenceDiagram (starting with "sequenceDiagram\\nautonumber") illustrating the architectural call flow of the PR (e.g., Client ->> Handler ->> Service ->> DB).
    `.trim();

    // 5. Stream structured object using Gemini Flash
    const result = streamObject({
      model: reviewModel,
      maxRetries: 1,
      schema: ReviewReportSchema,
      prompt,
      onFinish: async ({ object }) => {
        if (!object) return;

        try {
          // Update review summary & risk score & sequence diagram
          await db
            .update(pullRequestReviews)
            .set({
              status: 'completed',
              summary: object.summary,
              riskScore: object.riskScore,
              sequenceDiagram: object.sequenceDiagram || null,
            })
            .where(eq(pullRequestReviews.id, reviewRecord.id));

          // Combine SAST findings + AI findings
          const allFindings: ReviewFinding[] = [
            ...sastFindings.map((s) => ({
              filePath: s.filePath,
              lineNumber: s.lineNumber,
              category: s.category,
              severity: s.severity,
              title: s.title,
              message: s.message,
              ruleCited: 'Hardcoded Secret / SAST Detection Rule',
              suggestedPatch: s.suggestedPatch,
            })),
            ...(object.findings || []),
          ];

          if (allFindings.length > 0) {
            await db.insert(reviewComments).values(
              allFindings.map((f) => ({
                reviewId: reviewRecord.id,
                filePath: f.filePath,
                lineNumber: f.lineNumber,
                category: f.category,
                severity: f.severity,
                title: f.title,
                message: f.message,
                ruleCited: f.ruleCited || null,
                suggestedPatch: f.suggestedPatch || null,
                isResolved: false,
              }))
            );
          }
        } catch (dbErr) {
          console.error('Failed to persist completed review to DB:', dbErr);
        }
      },
    });

    return result.toTextStreamResponse({
      headers: {
        'x-review-id': reviewRecord.id,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Review generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
