import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from '../github/diff-parser';
import { scanDiffForVulnerabilities } from './sast-scanner';

describe('SAST & Secrets Pre-Scanner', () => {
  const sampleDiff = `
diff --git a/src/auth.ts b/src/auth.ts
index 1234567..89abcdef 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,3 +10,6 @@ export function init() {
+  const awsKey = "AKIA1234567890ABCDEF";
+  const githubToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
+  eval("console.log('insecure')");
   return true;
 }
  `.trim();

  it('should parse unified diff and identify added lines correctly', () => {
    const parsed = parseUnifiedDiff(sampleDiff);
    expect(parsed.length).toBe(1);
    expect(parsed[0].newPath).toBe('src/auth.ts');
    expect(parsed[0].addedLinesCount).toBe(3);
    expect(parsed[0].hunks[0].lines.length).toBe(5);
  });

  it('should flag hardcoded AWS keys, GitHub tokens, and eval() with 0ms latency', () => {
    const parsed = parseUnifiedDiff(sampleDiff);
    const findings = scanDiffForVulnerabilities(parsed);

    expect(findings.length).toBe(3);
    expect(findings.some((f) => f.title === 'Hardcoded AWS Access Key')).toBe(true);
    expect(findings.some((f) => f.title === 'GitHub Personal Access Token')).toBe(true);
    expect(findings.some((f) => f.title === 'Dangerous eval() Invocation')).toBe(true);

    const awsFinding = findings.find((f) => f.title === 'Hardcoded AWS Access Key');
    expect(awsFinding?.severity).toBe('critical');
    expect(awsFinding?.lineNumber).toBe(10);
  });
});
