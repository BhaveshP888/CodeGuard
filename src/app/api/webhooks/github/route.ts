import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { repositories, pullRequestReviews, reviewComments } from '@/lib/db/schema';
import { getUserOctokit } from '@/lib/github/octokit';
import { parseUnifiedDiff } from '@/lib/github/diff-parser';
import { scanDiffForVulnerabilities } from '@/lib/security/sast-scanner';
import { buildPRRAGContext } from '@/lib/rag/context-builder';
import { reviewModel, chatModel, ReviewReportSchema, type ReviewFinding } from '@/lib/ai/gemini';
import { postGitHubPRReview } from '@/lib/github/comment-poster';
import { generateObject, generateText } from 'ai';
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

  const payload = JSON.parse(rawBody);

  // =========================================================================
  // Feature C: Interactive PR Chat via GitHub Comments (@codeguard or @codeguard-ai)
  // Powered by Gemini 3.5 Flash for high-speed conversational responses
  // =========================================================================
  if (event === 'issue_comment' || event === 'pull_request_review_comment') {
    const commentBody = payload.comment?.body || '';
    const isBotMentioned = /@codeguard(-ai)?\b/i.test(commentBody);

    if (payload.action === 'created' && isBotMentioned) {
      const githubRepoId = payload.repository.id;
      const repoList = await db
        .select()
        .from(repositories)
        .where(eq(repositories.githubRepoId, githubRepoId))
        .limit(1);

      const repo = repoList[0];
      if (!repo) {
        return NextResponse.json({ message: 'Repository not connected' }, { status: 200 });
      }

      const [owner, repoName] = repo.fullName.split('/');
      const octokit = await getUserOctokit(repo.userId);
      const prNumber = payload.issue ? payload.issue.number : payload.pull_request?.number;

      if (!prNumber) {
        return NextResponse.json({ message: 'No PR number found' }, { status: 200 });
      }

      // Fetch PR diff for context
      let rawDiff = '';
      try {
        const diffRes = (await octokit.rest.pulls.get({
          owner,
          repo: repoName,
          pull_number: prNumber,
          mediaType: { format: 'diff' },
        })) as unknown as { data: string };
        rawDiff = typeof diffRes.data === 'string' ? diffRes.data.slice(0, 15000) : '';
      } catch {
        rawDiff = 'Diff not available.';
      }

      // Strip mention from prompt
      const userPrompt = commentBody.replace(/@codeguard(-ai)?/gi, '').trim();

      const aiResponse = await generateText({
        model: chatModel,
        maxRetries: 1,
        system: `You are CodeGuard AI, an expert Principal Security Engineer and Software Architect.
A developer mentioned you in a GitHub PR comment thread on PR #${prNumber} of ${repo.fullName}.
Answer their question directly, helpfully, and concisely. If they ask for code, provide clear, copyable markdown code blocks.

PULL REQUEST DIFF CONTEXT:
\`\`\`diff
${rawDiff}
\`\`\``,
        prompt: userPrompt,
      });

      const replyBody = `${aiResponse.text}\n\n*— Answered by [CodeGuard AI](https://github.com/apps/codeguard-ai)*`;

      // Reply in the appropriate thread
      if (event === 'pull_request_review_comment') {
        await octokit.rest.pulls.createReplyForReviewComment({
          owner,
          repo: repoName,
          pull_number: prNumber,
          comment_id: payload.comment.id,
          body: replyBody,
        });
      } else {
        await octokit.rest.issues.createComment({
          owner,
          repo: repoName,
          issue_number: prNumber,
          body: replyBody,
        });
      }

      return NextResponse.json({ message: 'Replied to GitHub comment mention' });
    }

    return NextResponse.json({ message: 'Ignored comment without mention' }, { status: 200 });
  }

  // =========================================================================
  // Standard PR Review Event
  // Powered by Gemini 3.8 Flash (mainstay model for code reasoning and SAST audit)
  // =========================================================================
  if (event !== 'pull_request') {
    return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 });
  }

  try {
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

    const [owner, repoName] = repo.fullName.split('/');
    const octokit = await getUserOctokit(repo.userId);

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

    // Fetch PR diff
    const { data: rawDiff } = (await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    })) as unknown as { data: string };

    const parsedDiff = parseUnifiedDiff(typeof rawDiff === 'string' ? rawDiff : '');

    // 1. Run SAST trap
    const sastFindings = scanDiffForVulnerabilities(parsedDiff);

    // 2. Query pgvector RAG context
    const ragContext = await buildPRRAGContext(repo.id, parsedDiff);

    // 3. Run Gemini 3.8 Flash analysis with Mermaid diagram generation
    const prompt = `
You are CodeGuard AI, an autonomous Principal Security Engineer and Software Architect.
Perform an inline, file-by-file architectural and security review of the following Pull Request.

PULL REQUEST TITLE: ${prTitle}
AFFECTED FILES: ${parsedDiff.map((f) => f.newPath).join(', ')}

${ragContext.assembledPromptContext}

RAW UNIFIED DIFF TO AUDIT:
\`\`\`diff
${(typeof rawDiff === 'string' ? rawDiff : '').slice(0, 30000)}
\`\`\`

INSTRUCTIONS:
1. Cross-reference every changed line against the provided Team Architectural & Security Guidelines.
2. Flag potential security vulnerabilities: injection, broken authentication, IDOR, sensitive data leaks, SSRF, prototype pollution.
3. For every issue, specify exact filePath, exact lineNumber, category, severity, clear message, and provide a concrete suggestedPatch.
4. Calculate an aggregate riskScore from 0 to 100.
5. Generate a clean, valid Mermaid.js sequenceDiagram (starting with "sequenceDiagram\\nautonumber") that visualizes the component and API interaction flow touched by this PR.
    `.trim();

    let aiFindings: ReviewFinding[] = [];
    let summary = 'CodeGuard AI automated review completed.';
    let riskScore = 0;
    let sequenceDiagram: string | null = null;

    try {
      const { object } = await generateObject({
        model: reviewModel,
        maxRetries: 1,
        schema: ReviewReportSchema,
        prompt,
      });

      if (object) {
        aiFindings = object.findings || [];
        summary = object.summary || summary;
        riskScore = object.riskScore ?? 0;
        sequenceDiagram = object.sequenceDiagram || null;
      }
    } catch (aiErr: unknown) {
      console.warn('AI review generation fallback in webhook:', aiErr);
    }

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
      ...aiFindings,
    ];

    if (allFindings.some((f) => f.severity === 'critical')) {
      riskScore = Math.max(riskScore, 85);
    }

    // Update review record
    await db
      .update(pullRequestReviews)
      .set({
        status: 'completed',
        summary,
        riskScore,
        sequenceDiagram,
      })
      .where(eq(pullRequestReviews.id, review.id));

    // Save comments to DB
    if (allFindings.length > 0) {
      await db.insert(reviewComments).values(
        allFindings.map((f) => ({
          reviewId: review.id,
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

    // 4. Post review, Mermaid sequence diagram, and commit status to GitHub PR
    const postResult = await postGitHubPRReview({
      octokit,
      owner,
      repo: repoName,
      pullNumber: prNumber,
      commitSha: headSha,
      summary,
      riskScore,
      sequenceDiagram,
      findings: allFindings,
    });

    return NextResponse.json(
      {
        message: 'Pull request review executed and posted to GitHub',
        reviewId: review.id,
        githubReviewId: postResult.reviewId,
        commentsPosted: postResult.commentsPostedCount,
        statusCreated: postResult.statusCreated,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Webhook error';
    console.error('Webhook processing failure:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
