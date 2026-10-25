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
  findings: ReviewFinding[];
}

/**
 * Formats a single finding into GitHub Flavored Markdown with optional suggestion hunk.
 */
function formatFindingBody(finding: ReviewFinding): string {
  const badgeMap = {
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
 */
export async function postGitHubPRReview(params: PostReviewParams): Promise<number | undefined> {
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

  const hasCriticalOrHigh = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  const reviewEvent = hasCriticalOrHigh ? 'REQUEST_CHANGES' : 'COMMENT';

  const riskBadge =
    riskScore >= 70
      ? '🔴 High Risk'
      : riskScore >= 40
      ? '🟡 Moderate Risk'
      : '🟢 Low Risk';

  const overallSummary = `## 🛡️ CodeGuard AI Architectural & Security Audit\n\n` +
    `**Overall Risk Assessment:** ${riskBadge} (\`${riskScore}/100\`)\n\n` +
    `${summary}\n\n` +
    `### Findings Breakdown:\n` +
    `- **Critical:** ${findings.filter((f) => f.severity === 'critical').length}\n` +
    `- **High:** ${findings.filter((f) => f.severity === 'high').length}\n` +
    `- **Medium:** ${findings.filter((f) => f.severity === 'medium').length}\n` +
    `- **Low:** ${findings.filter((f) => f.severity === 'low').length}\n\n` +
    `Review each inline comment below to inspect rule citations and apply automated fix suggestions.`;

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

    return response.data.id;
  } catch (error: unknown) {
    console.error('Failed to post PR review to GitHub:', error);
    throw error;
  }
}
