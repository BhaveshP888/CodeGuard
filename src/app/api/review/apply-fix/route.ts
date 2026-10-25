import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { repositories } from '@/lib/db/schema';
import { getUserOctokit } from '@/lib/github/octokit';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const ApplyFixSchema = z.object({
  repositoryId: z.string().uuid(),
  prNumber: z.number().int().positive(),
  filePath: z.string().min(1),
  replacementContent: z.string().min(1),
  commitMessage: z.string().optional().default('fix(security): apply CodeGuard AI remediation'),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = ApplyFixSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const { repositoryId, prNumber, filePath, replacementContent, commitMessage } = parsed.data;

    // Verify repository ownership
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

    // Fetch PR head branch details
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
    });

    const branch = pr.head.ref;

    // Fetch existing file SHA on head branch
    let fileSha: string | undefined;
    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path: filePath,
        ref: branch,
      });

      if (!Array.isArray(fileData) && 'sha' in fileData) {
        fileSha = fileData.sha;
      }
    } catch {
      // New file creation if not found
    }

    // Commit file update to the PR branch
    const { data: commitResult } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(replacementContent, 'utf-8').toString('base64'),
      branch,
      sha: fileSha,
    });

    return NextResponse.json({
      success: true,
      commitSha: commitResult.commit.sha,
      commitUrl: commitResult.commit.html_url,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to apply fix to PR';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
