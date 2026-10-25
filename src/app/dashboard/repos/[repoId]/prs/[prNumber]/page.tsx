'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  ChevronLeft,
  Sparkles,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
} from 'lucide-react';
import { DiffViewer } from '@/components/diff-viewer/diff-viewer';
import type { ParsedFileDiff } from '@/lib/github/diff-parser';
import type { InlineFinding } from '@/components/diff-viewer/inline-finding-card';

// Realistic sample diff for instant visual inspection and testing
const DEMO_DIFF_FILES: ParsedFileDiff[] = [
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
    message: 'Hardcoded AWS Access Key ID detected. Move AWS credentials to environment variables or IAM roles immediately.',
    ruleCited: 'Hardcoded Secret / SAST Detection Rule',
    suggestedPatch: 'const legacySecret = process.env.AWS_ACCESS_KEY_ID;',
    isResolved: false,
  },
  {
    id: 'finding-2',
    filePath: 'src/lib/auth/session.ts',
    lineNumber: 20,
    category: 'security',
    severity: 'high',
    title: 'Dangerous eval() Invocation',
    message: 'Direct invocation of eval() allows arbitrary code execution. Call the function directly.',
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
    message: 'Direct template literal interpolation into SQL statement detected. Use parameterized queries ($1, ?) to prevent SQL injection.',
    ruleCited: 'OWASP Top 10: SQL Injection Prevention Standard',
    suggestedPatch: 'const result = await db.execute(sql`SELECT * FROM users WHERE id = ${id}`);',
    isResolved: false,
  },
];

export default function PRReviewPage() {
  const params = useParams();
  const repoId = params.repoId as string;
  const prNumber = parseInt((params.prNumber as string) || '1', 10);
  const queryClient = useQueryClient();

  const [findings, setFindings] = useState<InlineFinding[]>(INITIAL_FINDINGS);
  const [isAuditing, setIsAuditing] = useState(false);
  const [summary, setSummary] = useState<string | null>(
    'Audit complete: 2 Critical security flaws (Hardcoded AWS Credential, SQL Injection) and 1 High risk eval() detected.'
  );
  const [riskScore, setRiskScore] = useState<number>(85);

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
        // Fallback for demo if live GitHub PR is not reachable
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
      console.warn('Could not persist resolve to DB (demo mode active)');
    }
  };

  // One-click apply fix to PR branch
  const handleApplyFix = async (finding: InlineFinding) => {
    if (!finding.suggestedPatch) return;

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

    handleResolve(finding.id || '', true);
  };

  return (
    <div className="h-screen bg-[#080c14] flex flex-col overflow-hidden">
      {/* Top PR Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-blue-400" />
              <h1 className="text-sm font-bold text-slate-100">
                PR #{prNumber}: Feature / Auth & User Query Refactor
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Open
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Auditing against team guidelines via <code>pgvector</code> (Gemini 2.5 Flash)
            </p>
          </div>
        </div>

        {/* Risk Score & Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">Risk Score:</span>
            <span
              className={`font-bold ${
                riskScore >= 70
                  ? 'text-red-400'
                  : riskScore >= 40
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {riskScore}/100
            </span>
          </div>

          <button
            onClick={runLiveAudit}
            disabled={isAuditing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
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

      {/* Summary Alert Banner */}
      {summary && (
        <div className="px-6 py-2.5 bg-red-950/20 border-b border-red-900/30 flex items-center justify-between text-xs text-red-200 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{summary}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Enforced by CodeGuard AI
          </span>
        </div>
      )}

      {/* Main Split-Screen Diff Viewer */}
      <div className="flex-1 p-4 overflow-hidden">
        <DiffViewer
          files={DEMO_DIFF_FILES}
          findings={findings}
          onResolveFinding={handleResolve}
          onApplyFix={handleApplyFix}
        />
      </div>
    </div>
  );
}
