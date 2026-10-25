import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { repositories, pullRequestReviews } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function verifySignature(payload: string, signatureHeader: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const hmac = createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;

  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event');

  // Verify HMAC signature if secret configured
  if (process.env.GITHUB_WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (event === 'ping') {
    return NextResponse.json({ message: 'PONG' }, { status: 200 });
  }

  if (event !== 'pull_request') {
    return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const action = payload.action;

    // We only review on opened, synchronize (new commits pushed), or reopened
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return NextResponse.json({ message: `Ignored PR action: ${action}` });
    }

    const githubRepoId = payload.repository.id;
    const prNumber = payload.pull_request.number;
    const prTitle = payload.pull_request.title;
    const authorUsername = payload.pull_request.user.login;
    const baseSha = payload.pull_request.base.sha;
    const headSha = payload.pull_request.head.sha;

    // Check if this repository is connected to CodeGuard AI
    const repoList = await db
      .select()
      .from(repositories)
      .where(eq(repositories.githubRepoId, githubRepoId))
      .limit(1);

    const repo = repoList[0];
    if (!repo) {
      return NextResponse.json({ message: 'Repository not connected' }, { status: 200 });
    }

    // Create review job record in DB
    const [review] = await db
      .insert(pullRequestReviews)
      .values({
        repositoryId: repo.id,
        prNumber,
        prTitle,
        authorUsername,
        baseSha,
        headSha,
        status: 'analyzing',
      })
      .returning();

    // In a production queue, this would dispatch to a background worker or serverless workflow.
    // In serverless, we return 202 Accepted with reviewId.
    return NextResponse.json(
      {
        message: 'Pull request review queued',
        reviewId: review.id,
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Webhook error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
