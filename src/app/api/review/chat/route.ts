import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { repositories, pullRequestReviews, reviewComments } from '@/lib/db/schema';
import { getUserOctokit } from '@/lib/github/octokit';
import { parseUnifiedDiff } from '@/lib/github/diff-parser';
import { reviewModel } from '@/lib/ai/gemini';
import { streamText } from 'ai';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ChatRequestSchema = z.object({
  repositoryId: z.string(),
  prNumber: z.number().int().positive(),
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const { repositoryId, prNumber, message, history = [] } = parsed.data;

    const session = await auth();
    if (!session?.user?.id && repositoryId !== 'demo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let diffContext = '';
    let repoName = 'repository';

    if (repositoryId !== 'demo' && session?.user?.id) {
      const userId = session.user.id;
      const repoList = await db
        .select()
        .from(repositories)
        .where(
          and(
            eq(repositories.id, repositoryId),
            eq(repositories.userId, userId)
          )
        )
        .limit(1);

      const repo = repoList[0];
      if (repo) {
        repoName = repo.fullName;
        const [owner, name] = repo.fullName.split('/');
        const octokit = await getUserOctokit(userId);

        try {
          const { data: rawDiff } = (await octokit.rest.pulls.get({
            owner,
            repo: name,
            pull_number: prNumber,
            mediaType: { format: 'diff' },
          })) as unknown as { data: string };

          diffContext = typeof rawDiff === 'string' ? rawDiff.slice(0, 20000) : '';
        } catch {
          diffContext = 'Could not fetch live diff.';
        }
      }
    } else {
      diffContext = `
diff --git a/src/lib/auth/session.ts b/src/lib/auth/session.ts
+ const legacySecret = "AKIAIOSFODNN7EXAMPLE";
+ token: eval("generateSecureToken()"),
diff --git a/src/app/api/users/route.ts b/src/app/api/users/route.ts
+ const query = \`SELECT * FROM users WHERE id = \${id}\`;
      `.trim();
    }

    // System prompt explaining role
    const system = `
You are CodeGuard AI, an expert Principal Security Engineer and Software Architect reviewing PR #${prNumber} on ${repoName}.
You help engineers understand security vulnerabilities, architecture guidelines, write test cases, or refactor code.

PULL REQUEST DIFF CONTEXT:
\`\`\`diff
${diffContext}
\`\`\`

INSTRUCTIONS:
- Answer the user's question directly, concisely, and with high technical accuracy.
- When suggesting code fixes or tests, provide copyable code blocks with language identifiers.
- If asked about security, explain the impact and the cleanest idiomatic remediation.
    `.trim();

    // Stream text back using Gemini 3.8 Flash
    const result = streamText({
      model: reviewModel,
      system,
      messages: [
        ...history.map((h) => ({
          role: h.role,
          content: h.content,
        })),
        { role: 'user', content: message },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Chat error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
