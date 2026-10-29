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
  lineNumber: z.number().int().positive().optional(),
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

    const { repositoryId, prNumber, filePath, replacementContent, lineNumber, commitMessage } = parsed.data;

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

    // Fetch PR details to obtain the target head branch
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
    });

    const branch = pr.head.ref;

    // 1. Resolve latest HEAD commit SHA directly to bypass GitHub CDN caching
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
    });
    const latestCommitSha = refData.object.sha;

    // 2. Fetch current file content and blob SHA at the exact HEAD commit
    let fileSha: string | undefined;
    let existingContent = '';

    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path: filePath,
        ref: latestCommitSha,
        headers: {
          'if-none-match': '', // Prevent 304 cached response
        },
      });

      if (!Array.isArray(fileData) && 'content' in fileData && 'sha' in fileData) {
        fileSha = fileData.sha;
        existingContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
      }
    } catch {
      // File does not exist yet (creating new file)
    }

    // 3. Patch the line rather than overwriting the entire file
    const patchFileContent = (content: string, targetLineNum?: number): string => {
      if (!content || !targetLineNum) {
        return content ? `${content}\n${replacementContent}` : replacementContent;
      }

      const lines = content.split('\n');
      const targetIdx = targetLineNum - 1;

      if (targetIdx >= 0 && targetIdx < lines.length) {
        const originalLine = lines[targetIdx];
        const leadingWhitespace = originalLine.match(/^\s*/)?.[0] || '';

        // Preserve indentation of the replaced line
        const patchLines = replacementContent.split('\n').map((line, idx) => {
          if (idx === 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
            return leadingWhitespace + line;
          }
          return line;
        });

        lines.splice(targetIdx, 1, ...patchLines);
        return lines.join('\n');
      }

      return content;
    };

    let finalContent = existingContent
      ? patchFileContent(existingContent, lineNumber)
      : replacementContent;

    // 4. Commit updated file with automated retry on SHA conflict
    const commitFile = async (currentSha: string | undefined, contentToCommit: string) => {
      return await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(contentToCommit, 'utf-8').toString('base64'),
        branch,
        sha: currentSha,
      });
    };

    let commitResult;
    try {
      const res = await commitFile(fileSha, finalContent);
      commitResult = res.data;
    } catch (commitErr: unknown) {
      const errMsg = commitErr instanceof Error ? commitErr.message : '';
      const shaMatch = errMsg.match(/is at ([0-9a-f]{40})/i);

      if (shaMatch && shaMatch[1]) {
        // GitHub reported the actual current blob SHA. Fetch and apply patch on the fresh blob.
        const actualSha = shaMatch[1];
        try {
          const { data: latestData } = await octokit.rest.git.getBlob({
            owner,
            repo: repoName,
            file_sha: actualSha,
          });
          const freshContent = Buffer.from(latestData.content, 'base64').toString('utf-8');
          finalContent = patchFileContent(freshContent, lineNumber);
        } catch {
          // Fall back to existing finalContent
        }

        const retryRes = await commitFile(actualSha, finalContent);
        commitResult = retryRes.data;
      } else {
        throw commitErr;
      }
    }

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
