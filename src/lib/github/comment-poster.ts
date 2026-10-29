import type { Octokit } from '@octokit/rest';
import type { ReviewFinding } from '../ai/gemini';

export interface PostReviewParams {
  octokit: Octokit;
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  summary: string;
  riskScore: number;
  sequenceDiagram?: string | null;
  findings: ReviewFinding[];
}

export interface PostReviewResult {
  reviewId?: number;
  htmlUrl?: string;
  commentsPostedCount: number;
  statusCreated: boolean;
}

/**
 * Formats a single finding into GitHub Flavored Markdown with optional suggestion hunk.
 */
function formatFindingBody(finding: ReviewFinding): string {
  const badgeMap: Record<string, string> = {
    critical: '🔴 **CRITICAL**',
    high: '🟠 **HIGH**',
    medium: '🟡 **MEDIUM**',
    low: '🔵 **LOW**',
  };

  const badge = badgeMap[finding.severity] || badgeMap.medium;

  let body = `${badge} — **${finding.title}**\n\n`;
  body += `${finding.message}\n\n`;

  if (finding.ruleCited) {
    body += `> 📋 **Team Guideline Violated:** *${finding.ruleCited}*\n\n`;
  }

  if (finding.suggestedPatch) {
    body += `**Suggested Replacement:**\n`;
    body += `\`\`\`suggestion\n${finding.suggestedPatch.trim()}\n\`\`\`\n`;
  }

  body += `\n*Audited by [CodeGuard AI](https://github.com/apps/codeguard-ai)*`;
  return body;
}

/**
 * Posts an inline review to a GitHub Pull Request with line-level findings and suggestions.
 * Also registers a GitHub Commit Status Check.
 */
export async function postGitHubPRReview(params: PostReviewParams): Promise<PostReviewResult> {
  const { octokit, owner, repo, pullNumber, commitSha, summary, riskScore, findings } = params;

  // Format line-level comments for valid file findings
  const comments = findings
    .filter((f) => f.filePath && f.lineNumber > 0)
    .map((finding) => ({
      path: finding.filePath,
      line: finding.lineNumber,
      side: 'RIGHT' as const,
      body: formatFindingBody(finding),
    }));

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const hasCriticalOrHigh = criticalCount > 0 || highCount > 0;

  const reviewEvent = hasCriticalOrHigh ? 'REQUEST_CHANGES' : 'COMMENT';

  const riskBadge =
    riskScore >= 70
      ? '🔴 High Risk'
      : riskScore >= 40
      ? '🟡 Moderate Risk'
      : '🟢 Low Risk';

  let overallSummary = `## 🛡️ CodeGuard AI Architectural & Security Audit\n\n` +
    `**Overall Risk Assessment:** ${riskBadge} (\`${riskScore}/100\`)\n\n` +
    `${summary}\n\n`;

  if (params.sequenceDiagram && params.sequenceDiagram.trim().startsWith('sequenceDiagram')) {
    overallSummary += `### 🔄 Architectural Flow Diagram\n\n\`\`\`mermaid\n${params.sequenceDiagram.trim()}\n\`\`\`\n\n`;
  }

  overallSummary += `### Findings Breakdown:\n` +
    `- **Critical:** ${criticalCount}\n` +
    `- **High:** ${highCount}\n` +
    `- **Medium:** ${findings.filter((f) => f.severity === 'medium').length}\n` +
    `- **Low:** ${findings.filter((f) => f.severity === 'low').length}\n\n`;

  if (findings.length > 0) {
    overallSummary += `| Severity | File | Line | Finding |\n| :--- | :--- | :--- | :--- |\n`;
    for (const f of findings.slice(0, 15)) {
      overallSummary += `| \`${f.severity.toUpperCase()}\` | \`${f.filePath}\` | \`${f.lineNumber}\` | ${f.title} |\n`;
    }
    if (findings.length > 15) {
      overallSummary += `\n*... and ${findings.length - 15} more findings.*\n`;
    }
  }

  overallSummary += `\nReview each inline comment below to inspect rule citations and apply automated fix suggestions directly.`;

  let reviewId: number | undefined;
  let htmlUrl: string | undefined;
  let commentsPostedCount = 0;

  // 1. Try batch review with inline comments
  try {
    const response = await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitSha,
      body: overallSummary,
      event: reviewEvent,
      comments: comments.slice(0, 30), // GitHub cap per review batch
    });
    reviewId = response.data.id;
    htmlUrl = response.data.html_url;
    commentsPostedCount = comments.slice(0, 30).length;
  } catch (reviewErr: unknown) {
    console.warn('Batch review with inline comments failed (likely lines outside diff hunk), falling back to summary review:', reviewErr);

    // Fallback: Post review without inline comments array (ensures review is never lost)
    try {
      const fallbackResponse = await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitSha,
        body: overallSummary,
        event: reviewEvent,
      });
      reviewId = fallbackResponse.data.id;
      htmlUrl = fallbackResponse.data.html_url;
    } catch (fallbackErr: unknown) {
      console.error('Fallback PR review also failed:', fallbackErr);
      // Last resort: post as PR issue comment
      const commentRes = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: overallSummary,
      });
      htmlUrl = commentRes.data.html_url;
    }
  }

  // 2. Set GitHub Commit Status Check on PR commit SHA
  let statusCreated = false;
  try {
    await octokit.rest.repos.createCommitStatus({
      owner,
      repo,
      sha: commitSha,
      state: hasCriticalOrHigh ? 'failure' : 'success',
      context: 'CodeGuard AI / Security Audit',
      description: hasCriticalOrHigh
        ? `${criticalCount} critical, ${highCount} high violations found`
        : 'All security & architecture checks passed',
      target_url: htmlUrl,
    });
    statusCreated = true;
  } catch (statusErr: unknown) {
    console.warn('Could not post commit status (may lack statuses:write scope):', statusErr);
  }

  return {
    reviewId,
    htmlUrl,
    commentsPostedCount,
    statusCreated,
  };
}
