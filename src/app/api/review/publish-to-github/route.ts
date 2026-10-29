import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { repositories, pullRequestReviews, reviewComments } from '@/lib/db/schema';
import { getUserOctokit } from '@/lib/github/octokit';
import { postGitHubPRReview } from '@/lib/github/comment-poster';
import { parseUnifiedDiff } from '@/lib/github/diff-parser';
import { scanDiffForVulnerabilities } from '@/lib/security/sast-scanner';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const { repositoryId, prNumber } = parsed.data;

    // Verify repository access
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

    // Fetch PR details from GitHub
    const { data: prData } = await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
    });

    const commitSha = prData.head.sha;

    // Fetch existing review and comments from DB
    const existingReviews = await db
      .select()
      .from(pullRequestReviews)
      .where(
        and(
          eq(pullRequestReviews.repositoryId, repositoryId),
          eq(pullRequestReviews.prNumber, prNumber)
        )
      )
      .orderBy(desc(pullRequestReviews.createdAt))
      .limit(1);

    const latestReview = existingReviews[0];
    let findings: Array<{
      filePath: string;
      lineNumber: number;
      category: 'security' | 'architecture' | 'performance' | 'style';
      severity: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      message: string;
      ruleCited?: string;
      suggestedPatch?: string;
    }> = [];

    let summary = latestReview?.summary || 'Automated code review completed by CodeGuard AI.';
    let riskScore = latestReview?.riskScore ?? 0;

    if (latestReview) {
      const dbComments = await db
        .select()
        .from(reviewComments)
        .where(eq(reviewComments.reviewId, latestReview.id));

      findings = dbComments.map((c) => ({
        filePath: c.filePath,
        lineNumber: c.lineNumber,
        category: (c.category as any) || 'security',
        severity: (c.severity as any) || 'medium',
        title: c.title,
        message: c.message,
        ruleCited: c.ruleCited || undefined,
        suggestedPatch: c.suggestedPatch || undefined,
      }));
    } else {
      // If no stored review exists yet, run SAST on diff
      const { data: rawDiff } = (await octokit.rest.pulls.get({
        owner,
        repo: repoName,
        pull_number: prNumber,
        mediaType: { format: 'diff' },
      })) as unknown as { data: string };

      const parsedFiles = parseUnifiedDiff(typeof rawDiff === 'string' ? rawDiff : '');
      const sastFindings = scanDiffForVulnerabilities(parsedFiles);

      findings = sastFindings.map((s) => ({
        filePath: s.filePath,
        lineNumber: s.lineNumber,
        category: s.category,
        severity: s.severity,
        title: s.title,
        message: s.message,
        ruleCited: 'Hardcoded Secret / SAST Detection Rule',
        suggestedPatch: s.suggestedPatch,
      }));

      riskScore = findings.some((f) => f.severity === 'critical') ? 85 : findings.length * 15;
      summary = findings.length > 0
        ? `Pre-scan detected ${findings.length} vulnerabilities in the modified diff.`
        : `Pre-scan detected zero critical vulnerabilities. Codebase is clean.`;
    }

    // Publish to GitHub PR
    const result = await postGitHubPRReview({
      octokit,
      owner,
      repo: repoName,
      pullNumber: prNumber,
      commitSha,
      summary,
      riskScore,
      sequenceDiagram: latestReview?.sequenceDiagram || null,
      findings,
    });

    return NextResponse.json({
      success: true,
      reviewId: result.reviewId,
      htmlUrl: result.htmlUrl || prData.html_url,
      commentsPostedCount: result.commentsPostedCount,
      statusCreated: result.statusCreated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to publish review to GitHub';
    console.error('Error publishing review to GitHub:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
