'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  ChevronLeft,
  Sparkles,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  GitBranch,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { DiffViewer } from '@/components/diff-viewer/diff-viewer';
import type { ParsedFileDiff } from '@/lib/github/diff-parser';
import type { InlineFinding } from '@/components/diff-viewer/inline-finding-card';

// Realistic multi-file pull request diff
const REALISTIC_DIFF_FILES: ParsedFileDiff[] = [
  {
    oldPath: 'src/lib/auth/session.ts',
    newPath: 'src/lib/auth/session.ts',
    isNew: false,
    isDeleted: false,
    isModified: true,
    addedLinesCount: 8,
    deletedLinesCount: 2,
    touchedSymbols: ['verifySessionToken', 'createSession'],
    hunks: [
      {
        header: '@@ -14,7 +14,13 @@ export async function createSession(userId: string) {',
        oldStart: 14,
        oldLines: 7,
        newStart: 14,
        newLines: 13,
        lines: [
          { type: 'normal', content: '  const sessionExpiresAt = new Date();', oldLineNumber: 14, newLineNumber: 14 },
          { type: 'delete', content: '  sessionExpiresAt.setHours(sessionExpiresAt.getHours() + 24);', oldLineNumber: 15 },
          { type: 'add', content: '  // 30 days session lifetime without re-authentication', newLineNumber: 15 },
          { type: 'add', content: '  sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 30);', newLineNumber: 16 },
          { type: 'add', content: '  const legacySecret = "AKIAIOSFODNN7EXAMPLE"; // AWS test key for sync', newLineNumber: 17 },
          { type: 'normal', content: '  return {', oldLineNumber: 16, newLineNumber: 18 },
          { type: 'normal', content: '    userId,', oldLineNumber: 17, newLineNumber: 19 },
          { type: 'delete', content: '    token: generateSecureToken(),', oldLineNumber: 18 },
          { type: 'add', content: '    token: eval("generateSecureToken()"),', newLineNumber: 20 },
          { type: 'normal', content: '    expiresAt: sessionExpiresAt,', oldLineNumber: 19, newLineNumber: 21 },
          { type: 'normal', content: '  };', oldLineNumber: 20, newLineNumber: 22 },
        ],
      },
    ],
  },
  {
    oldPath: 'src/app/api/users/route.ts',
    newPath: 'src/app/api/users/route.ts',
    isNew: true,
    isDeleted: false,
    isModified: false,
    addedLinesCount: 6,
    deletedLinesCount: 0,
    touchedSymbols: ['GET'],
    hunks: [
      {
        header: '@@ -0,0 +1,6 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 6,
        lines: [
          { type: 'add', content: 'export async function GET(req: Request) {', newLineNumber: 1 },
          { type: 'add', content: '  const { searchParams } = new URL(req.url);', newLineNumber: 2 },
          { type: 'add', content: '  const id = searchParams.get("id");', newLineNumber: 3 },
          { type: 'add', content: '  const query = `SELECT * FROM users WHERE id = ${id}`;', newLineNumber: 4 },
          { type: 'add', content: '  return Response.json(await db.execute(query));', newLineNumber: 5 },
          { type: 'add', content: '}', newLineNumber: 6 },
        ],
      },
    ],
  },
];

const INITIAL_FINDINGS: InlineFinding[] = [
  {
    id: 'finding-1',
    filePath: 'src/lib/auth/session.ts',
    lineNumber: 17,
    category: 'security',
    severity: 'critical',
    title: 'Hardcoded AWS Access Key',
    message: 'Hardcoded AWS Access Key ID detected. Credentials must be loaded from environment variables or IAM roles.',
    ruleCited: 'RFC-104: Zero-Secret Ingestion & IAM Mandate',
    suggestedPatch: 'const legacySecret = process.env.AWS_ACCESS_KEY_ID;',
    isResolved: false,
  },
  {
    id: 'finding-2',
    filePath: 'src/lib/auth/session.ts',
    lineNumber: 20,
    category: 'security',
    severity: 'high',
    title: 'Arbitrary Code Execution via eval()',
    message: 'Direct invocation of eval() is strictly forbidden. Call the cryptographic token generator directly.',
    ruleCited: 'Zero-Arbitrary Code Execution Policy',
    suggestedPatch: 'token: generateSecureToken(),',
    isResolved: false,
  },
  {
    id: 'finding-3',
    filePath: 'src/app/api/users/route.ts',
    lineNumber: 4,
    category: 'security',
    severity: 'critical',
    title: 'Unsafe SQL String Concatenation',
    message: 'Direct template literal interpolation into SQL statement detected. Parameterized queries are mandatory to prevent SQL injection.',
    ruleCited: 'SEC-202: Mandatory Parameterized SQL Queries',
    suggestedPatch: 'const result = await db.execute(sql`SELECT * FROM users WHERE id = ${id}`);',
    isResolved: false,
  },
];

export default function PRReviewPage() {
  const params = useParams();
  const repoId = params.repoId as string;
  const prNumber = parseInt((params.prNumber as string) || '1', 10);

  const [findings, setFindings] = useState<InlineFinding[]>(INITIAL_FINDINGS);
  const [isAuditing, setIsAuditing] = useState(false);
  const [riskScore, setRiskScore] = useState<number>(85);

  const criticalCount = findings.filter((f) => f.severity === 'critical' && !f.isResolved).length;
  const resolvedCount = findings.filter((f) => f.isResolved).length;

  // Trigger streaming audit
  const runLiveAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('/api/review/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: repoId,
          prNumber,
        }),
      });

      if (!res.ok) {
        console.warn('Live API response status:', res.status);
      }
    } catch (err) {
      console.error('Audit streaming error:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  // Optimistic resolve comment handler
  const handleResolve = async (findingId: string, resolved: boolean) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, isResolved: resolved } : f))
    );

    try {
      await fetch(`/api/review/comments/${findingId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: resolved }),
      });
    } catch (err) {
      console.warn('Could not persist resolve to DB (demo mode)');
    }
  };

  // One-click apply fix to PR branch
  const handleApplyFix = async (finding: InlineFinding) => {
    if (!finding.suggestedPatch) return;

    try {
      await fetch('/api/review/apply-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: repoId,
          prNumber,
          filePath: finding.filePath,
          replacementContent: finding.suggestedPatch,
          commitMessage: `fix(security): resolve ${finding.title}`,
        }),
      });
    } catch (err) {
      console.warn('Apply fix dispatched');
    }

    handleResolve(finding.id || '', true);
  };

  return (
    <div className="h-screen bg-[#070a10] text-[#f0f4fc] flex flex-col overflow-hidden font-sans">
      {/* Top PR Header Bar */}
      <header className="border-b border-[#182335] bg-[#0c121d] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg border border-[#182335] bg-[#070a10] text-[#94a7c6] hover:text-[#f0f4fc] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs text-blue-400 font-bold">PR #{prNumber}</span>
              <span className="text-xs font-bold text-[#f0f4fc]">Refactor session lifetime & user query handler</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                OPEN
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-[#5e7394] mt-1">
              <span className="flex items-center gap-1 text-[#94a7c6]">
                <GitBranch className="w-3 h-3" />
                main ← feature/auth-hardening
              </span>
              <span>•</span>
              <span>pgvector RAG active</span>
              <span>•</span>
              <span>Gemini 3.8 Flash</span>
            </div>
          </div>
        </div>

        {/* Risk Assessment & Primary Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#070a10] px-3 py-1.5 rounded-lg border border-[#182335] text-xs">
            <span className="text-[11px] font-mono text-[#5e7394]">Threat Level:</span>
            <span
              className={`font-mono font-bold ${
                criticalCount > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {criticalCount > 0 ? 'HIGH RISK' : 'CLEAN'} ({riskScore}/100)
            </span>
          </div>

          <button
            onClick={runLiveAudit}
            disabled={isAuditing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {isAuditing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isAuditing ? 'Streaming Audit...' : 'Re-Run AI Audit'}
          </button>
        </div>
      </header>

      {/* Critical Alert Bar */}
      {criticalCount > 0 && (
        <div className="px-6 py-2 bg-[#2b0b0e] border-b border-red-900/40 flex items-center justify-between text-xs text-red-200 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>{criticalCount} unresolved critical violations</strong> block merge per team security mandate.
            </span>
          </div>
          <span className="text-[11px] font-mono text-red-300">
            {resolvedCount} of {findings.length} findings resolved
          </span>
        </div>
      )}

      {/* Main Split-Screen Diff Viewer Component */}
      <div className="flex-1 p-3 overflow-hidden">
        <DiffViewer
          files={REALISTIC_DIFF_FILES}
          findings={findings}
          onResolveFinding={handleResolve}
          onApplyFix={handleApplyFix}
        />
      </div>
    </div>
  );
}
