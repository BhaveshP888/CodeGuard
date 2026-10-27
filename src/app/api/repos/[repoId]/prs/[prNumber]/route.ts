import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { repositories, pullRequestReviews, reviewComments } from '@/lib/db/schema';
import { getUserOctokit } from '@/lib/github/octokit';
import { parseUnifiedDiff } from '@/lib/github/diff-parser';
import { scanDiffForVulnerabilities } from '@/lib/security/sast-scanner';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string; prNumber: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId, prNumber: rawPrNumber } = await params;
  const prNumber = parseInt(rawPrNumber, 10);

  if (isNaN(prNumber)) {
    return NextResponse.json({ error: 'Invalid PR number' }, { status: 400 });
  }

  try {
    const repoList = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.id, repoId),
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

    // Fetch PR metadata from GitHub
    const { data: prData } = await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
    });

    // Fetch raw unified diff from GitHub
    const { data: rawDiff } = (await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
      mediaType: {
        format: 'diff',
      },
    })) as unknown as { data: string };

    const parsedFiles = parseUnifiedDiff(typeof rawDiff === 'string' ? rawDiff : '');

    // Check if we have an existing review in the database
    const existingReviews = await db
      .select()
      .from(pullRequestReviews)
      .where(
        and(
          eq(pullRequestReviews.repositoryId, repoId),
          eq(pullRequestReviews.prNumber, prNumber)
        )
      )
      .orderBy(desc(pullRequestReviews.createdAt))
      .limit(1);

    const latestReview = existingReviews[0];
    let findings: Array<{
      id: string;
      filePath: string;
      lineNumber: number;
      category: string;
      severity: string;
      title: string;
      message: string;
      ruleCited?: string | null;
      suggestedPatch?: string | null;
      isResolved: boolean;
    }> = [];

    let riskScore = 0;

    if (latestReview) {
      const dbComments = await db
        .select()
        .from(reviewComments)
        .where(eq(reviewComments.reviewId, latestReview.id));

      findings = dbComments.map((c) => ({
        id: c.id,
        filePath: c.filePath,
        lineNumber: c.lineNumber,
        category: c.category,
        severity: c.severity,
        title: c.title,
        message: c.message,
        ruleCited: c.ruleCited,
        suggestedPatch: c.suggestedPatch,
        isResolved: c.isResolved,
      }));
      riskScore = latestReview.riskScore ?? (findings.length > 0 ? 75 : 0);
    } else {
      // Run immediate SAST scanner on diff
      const sastFindings = scanDiffForVulnerabilities(parsedFiles);
      findings = sastFindings.map((s, idx) => ({
        id: `sast-${idx + 1}`,
        filePath: s.filePath,
        lineNumber: s.lineNumber,
        category: s.category,
        severity: s.severity,
        title: s.title,
        message: s.message,
        ruleCited: 'Hardcoded Secret / SAST Detection Rule',
        suggestedPatch: s.suggestedPatch,
        isResolved: false,
      }));
      riskScore = findings.some((f) => f.severity === 'critical') ? 85 : findings.length * 15;
    }

    return NextResponse.json({
      pr: {
        number: prData.number,
        title: prData.title,
        author: prData.user?.login || 'unknown',
        authorAvatar: prData.user?.avatar_url || null,
        baseBranch: prData.base.ref,
        headBranch: prData.head.ref,
        state: prData.state,
        htmlUrl: prData.html_url,
        createdAt: prData.created_at,
      },
      files: parsedFiles,
      findings,
      riskScore,
      summary: latestReview?.summary || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch PR details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
