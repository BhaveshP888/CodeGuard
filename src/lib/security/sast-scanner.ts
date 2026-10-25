import type { ParsedFileDiff } from '../github/diff-parser';

export interface SASTFinding {
  filePath: string;
  lineNumber: number;
  category: 'security' | 'architecture' | 'performance' | 'style';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  matchedPattern: string;
  suggestedPatch?: string;
}

interface SecretPattern {
  name: string;
  regex: RegExp;
  category: 'security';
  severity: 'critical' | 'high';
  message: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'Hardcoded AWS Access Key',
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    category: 'security',
    severity: 'critical',
    message: 'Hardcoded AWS Access Key ID detected. Move AWS credentials to environment variables or IAM roles immediately.',
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,255}|github_pat_[a-zA-Z0-9_]{82})\b/,
    category: 'security',
    severity: 'critical',
    message: 'Hardcoded GitHub Personal Access Token detected. Revoke and rotate this token immediately.',
  },
  {
    name: 'Private RSA / SSH Key Block',
    regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    category: 'security',
    severity: 'critical',
    message: 'Private cryptographic key detected in source code. Private keys must never be committed to source control.',
  },
  {
    name: 'Hardcoded Stripe Live Secret Key',
    regex: /\b(sk_live_[0-9a-zA-Z]{24,32})\b/,
    category: 'security',
    severity: 'critical',
    message: 'Live Stripe Secret API key detected. Move Stripe secret keys to secure server-side environment variables.',
  },
  {
    name: 'Slack Bot / User Token',
    regex: /\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*)\b/,
    category: 'security',
    severity: 'critical',
    message: 'Slack OAuth/Bot token detected. Ingest via environment variables.',
  },
  {
    name: 'Dangerous eval() Invocation',
    regex: /\beval\s*\([^)]*\)/,
    category: 'security',
    severity: 'high',
    message: 'Direct invocation of eval() allows arbitrary code execution. Refactor to use safe parser alternatives.',
  },
  {
    name: 'Unsafe SQL String Concatenation',
    regex: /(?:query|execute)\s*\(\s*[`'"].*?(?:SELECT|INSERT|UPDATE|DELETE).*?\$\{.*?\}/i,
    category: 'security',
    severity: 'critical',
    message: 'Direct template literal interpolation into SQL statement detected. Use parameterized queries ($1, ?) to prevent SQL injection.',
  },
];

/**
 * Runs fast heuristic SAST & secrets scanning on parsed diff hunks with 0 AI cost.
 */
export function scanDiffForVulnerabilities(files: ParsedFileDiff[]): SASTFinding[] {
  const findings: SASTFinding[] = [];

  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        // Only inspect newly added or modified lines
        if (line.type !== 'add') continue;
        const lineNum = line.newLineNumber || hunk.newStart;

        for (const pattern of SECRET_PATTERNS) {
          if (pattern.regex.test(line.content)) {
            findings.push({
              filePath: file.newPath,
              lineNumber: lineNum,
              category: pattern.category,
              severity: pattern.severity,
              title: pattern.name,
              message: pattern.message,
              matchedPattern: pattern.name,
              suggestedPatch: `// [SECURITY FIX]: Load value from process.env instead of hardcoding`,
            });
          }
        }
      }
    }
  }

  return findings;
}
