'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Sparkles,
  Loader2,
  GitBranch,
  ShieldAlert,
  AlertCircle,
  FileCode2,
} from 'lucide-react';
import { DiffViewer } from '@/components/diff-viewer/diff-viewer';
import type { ParsedFileDiff } from '@/lib/github/diff-parser';
import type { InlineFinding } from '@/components/diff-viewer/inline-finding-card';

// Fallback demo pull request diff for interactive offline exploration
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

const DEMO_FINDINGS: InlineFinding[] = [
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

interface PRMetadata {
  number: number;
  title: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  state: string;
  htmlUrl: string;
}

export default function PRReviewPage() {
  const params = useParams();
  const repoId = params.repoId as string;
  const prNumber = parseInt((params.prNumber as string) || '1', 10);
  const isDemo = repoId === 'demo';

  const [isLoading, setIsLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<ParsedFileDiff[]>(isDemo ? DEMO_DIFF_FILES : []);
  const [findings, setFindings] = useState<InlineFinding[]>(isDemo ? DEMO_FINDINGS : []);
  const [prMeta, setPrMeta] = useState<PRMetadata>({
    number: prNumber,
    title: isDemo ? 'Refactor session lifetime & user query handler' : `Pull Request #${prNumber}`,
    author: isDemo ? 'octocat' : 'loading...',
    baseBranch: 'main',
    headBranch: isDemo ? 'feature/auth-hardening' : 'branch',
    state: 'OPEN',
    htmlUrl: '#',
  });
  const [isAuditing, setIsAuditing] = useState(false);
  const [riskScore, setRiskScore] = useState<number>(isDemo ? 85 : 0);

  // Fetch real PR data and diff from API
  const fetchPRData = useCallback(async () => {
    if (isDemo) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/repos/${repoId}/prs/${prNumber}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: Failed to fetch PR data`);
      }

      const data = await res.json();
      setFiles(data.files || []);
      setFindings(data.findings || []);
      setRiskScore(data.riskScore ?? 0);
      if (data.pr) {
        setPrMeta(data.pr);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error loading PR';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [repoId, prNumber, isDemo]);

  useEffect(() => {
    fetchPRData();
  }, [fetchPRData]);

  const criticalCount = findings.filter((f) => f.severity === 'critical' && !f.isResolved).length;
  const resolvedCount = findings.filter((f) => f.isResolved).length;

  // Trigger real AI & SAST audit
  const runLiveAudit = async () => {
    setIsAuditing(true);
    try {
      if (isDemo) {
        // Simulated audit delay for demo mode
        await new Promise((r) => setTimeout(r, 1200));
        setFindings(DEMO_FINDINGS);
        setRiskScore(85);
        return;
      }

      const res = await fetch('/api/review/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: repoId,
          prNumber,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Audit failed with HTTP ${res.status}`);
      }

      // Read the response stream to completion
      if (res.body) {
        const reader = res.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      // Refresh PR findings saved to DB
      await fetchPRData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Audit streaming error';
      console.error('Audit streaming error:', msg);
      alert(`Audit failed: ${msg}`);
    } finally {
      setIsAuditing(false);
    }
  };

  // Optimistic resolve comment handler
  const handleResolve = async (findingId: string, resolved: boolean) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, isResolved: resolved } : f))
    );

    if (isDemo) return;

    try {
      await fetch(`/api/review/comments/${findingId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: resolved }),
      });
    } catch (err) {
      console.warn('Could not persist resolve to DB', err);
    }
  };

  // One-click apply fix to PR branch
  const handleApplyFix = async (finding: InlineFinding) => {
    if (!finding.suggestedPatch) return;

    if (isDemo) {
      handleResolve(finding.id || '', true);
      return;
    }

    try {
      const res = await fetch('/api/review/apply-fix', {
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(`Apply fix error: ${errData.error || 'Failed to commit patch'}`);
        return;
      }
    } catch (err) {
      console.warn('Apply fix dispatched', err);
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
              <span className="text-xs font-bold text-[#f0f4fc]">{prMeta.title}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 uppercase">
                {prMeta.state || 'OPEN'}
              </span>
              {isDemo && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  DEMO MODE
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-[#5e7394] mt-1">
              <span className="flex items-center gap-1 text-[#94a7c6]">
                <GitBranch className="w-3 h-3" />
                {prMeta.baseBranch} ← {prMeta.headBranch}
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
            disabled={isAuditing || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {isAuditing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isAuditing ? 'Auditing with Gemini...' : 'Re-Run AI Audit'}
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

      {/* Main Diff Content / Loading / Error states */}
      <div className="flex-1 p-3 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#5e7394]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
            <h3 className="text-sm font-semibold text-[#f0f4fc]">Fetching Pull Request Diff from GitHub...</h3>
            <p className="text-xs text-[#94a7c6] mt-1 max-w-md">
              Loading modified files and running security analysis with Gemini and pgvector guidelines.
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-400 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-red-300">Could Not Load Pull Request</h3>
            <p className="text-xs text-[#94a7c6] mt-1.5 max-w-md">{error}</p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={fetchPRData}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Retry
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg border border-[#182335] bg-[#0c121d] text-[#94a7c6] hover:text-[#f0f4fc] text-xs font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#5e7394]">
            <FileCode2 className="w-10 h-10 text-[#5e7394] mb-3" />
            <h3 className="text-sm font-semibold text-[#f0f4fc]">No Changed Files Detected</h3>
            <p className="text-xs text-[#94a7c6] mt-1 max-w-md">
              This pull request currently has no file modifications or diff content available from GitHub.
            </p>
            <button
              onClick={runLiveAudit}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              Run Audit Now
            </button>
          </div>
        ) : (
          <DiffViewer
            files={files}
            findings={findings}
            onResolveFinding={handleResolve}
            onApplyFix={handleApplyFix}
          />
        )}
      </div>
    </div>
  );
}
