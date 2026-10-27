import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { repositories } from '@/lib/db/schema';
import { getUserOctokit } from '@/lib/github/octokit';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params;

  if (repoId === 'demo') {
    return NextResponse.json({
      pullRequests: [
        {
          number: 1,
          title: 'Refactor session lifetime & user query handler',
          author: 'octocat',
          authorAvatar: 'https://avatars.githubusercontent.com/u/583231',
          baseBranch: 'main',
          headBranch: 'feature/auth-hardening',
          state: 'open',
          createdAt: new Date().toISOString(),
          htmlUrl: 'https://github.com/octocat/Hello-World/pull/1',
        },
      ],
    });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Fetch open pull requests from GitHub (works for both public and private repos)
    const { data: pulls } = await octokit.rest.pulls.list({
      owner,
      repo: repoName,
      state: 'open',
      sort: 'updated',
      direction: 'desc',
      per_page: 30,
    });

    const pullRequests = pulls.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.user?.login || 'unknown',
      authorAvatar: pr.user?.avatar_url || null,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      state: pr.state,
      createdAt: pr.created_at,
      htmlUrl: pr.html_url,
    }));

    return NextResponse.json({ pullRequests });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pull requests';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
