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
  Send,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { DiffViewer } from '@/components/diff-viewer/diff-viewer';
import { MermaidViewer } from '@/components/mermaid-viewer';
import { PRChatDrawer } from '@/components/pr-chat-drawer';
import type { ParsedFileDiff } from '@/lib/github/diff-parser';
import type { InlineFinding } from '@/components/diff-viewer/inline-finding-card';

// Fallback demo sequence diagram
const DEMO_SEQUENCE_DIAGRAM = `sequenceDiagram
  autonumber
  actor Client as User / Client
  participant AuthRouter as /api/auth
  participant SessionService as session.ts
  participant UserRoute as /api/users
  participant NeonDB as Neon Database (Postgres)

  Client->>AuthRouter: POST /api/auth/login
  AuthRouter->>SessionService: createSession(userId)
  Note over SessionService: 30-Day Expiry + Eval Token (Security Risk)
  SessionService->>NeonDB: INSERT INTO sessions (token, expires_at)
  NeonDB-->>SessionService: 201 Created
  SessionService-->>AuthRouter: session payload
  AuthRouter-->>Client: 200 OK (Set-Cookie)

  Client->>UserRoute: GET /api/users?id=123
  Note over UserRoute: Unsafe string interpolation SQL injection
  UserRoute->>NeonDB: SELECT * FROM users WHERE id = 123
  NeonDB-->>UserRoute: User record
  UserRoute-->>Client: 200 OK (User JSON)`;

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
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ url?: string; count?: number } | null>(null);
  const [sequenceDiagram, setSequenceDiagram] = useState<string | null>(
    isDemo ? DEMO_SEQUENCE_DIAGRAM : null
  );
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Publish review and suggestions to GitHub PR
  const handlePublishToGitHub = async () => {
    if (isDemo) {
      alert('Demo Mode: Connect a real repository to publish reviews directly to GitHub Pull Requests.');
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const res = await fetch('/api/review/publish-to-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: repoId,
          prNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish review to GitHub');
      }

      setPublishResult({
        url: data.htmlUrl,
        count: data.commentsPostedCount,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish error';
      alert(`Error publishing to GitHub: ${msg}`);
    } finally {
      setIsPublishing(false);
    }
  };

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
      if (data.sequenceDiagram) {
        setSequenceDiagram(data.sequenceDiagram);
      }
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
        setSequenceDiagram(DEMO_SEQUENCE_DIAGRAM);
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
    <div className="h-screen bg-[#070b13] text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Top PR Header Bar */}
      <header className="border-b border-[#1a2333] bg-[#090e1a] px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg border border-[#1b2436] bg-[#0c1220] text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                #{prNumber}
              </span>
              <h1 className="text-xs font-bold text-white tracking-tight">{prMeta.title}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                {prMeta.state || 'OPEN'}
              </span>
              {isDemo && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  DEMO MODE
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-[11px] font-mono text-slate-400 mt-0.5">
              <span className="flex items-center gap-1 text-slate-300">
                <GitBranch className="w-3 h-3 text-slate-400" />
                {prMeta.baseBranch} ← {prMeta.headBranch}
              </span>
              <span>•</span>
              <span className="text-slate-400">pgvector RAG</span>
              <span>•</span>
              <span className="text-blue-400">Gemini 3.8 Flash</span>
            </div>
          </div>
        </div>

        {/* Threat Level & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#0c1220] px-3 py-1.5 rounded-lg border border-[#1b2436] text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                criticalCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="text-[11px] font-mono text-slate-400">Threat Level:</span>
            <span
              className={`font-mono font-bold ${
                criticalCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {criticalCount > 0 ? 'HIGH RISK' : 'CLEAN'} ({riskScore}/100)
            </span>
          </div>

          {/* Publish Review to GitHub */}
          {!isDemo && (
            <button
              onClick={handlePublishToGitHub}
              disabled={isPublishing || isAuditing || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1b2436] bg-[#0c1220] hover:bg-[#11192c] text-xs font-medium text-slate-200 hover:text-white shadow-sm transition-all disabled:opacity-50"
              title="Post review comments and suggestions directly to the GitHub PR"
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Send className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{isPublishing ? 'Publishing...' : 'Publish to PR'}</span>
            </button>
          )}

          {/* Interactive PR Chatbot launcher */}
          <button
            onClick={() => setIsChatOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-semibold shadow-sm transition-all"
            title="Chat with CodeGuard Copilot (⌘K)"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Ask CodeGuard</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono bg-blue-900/40 border border-blue-400/30 rounded text-blue-300">
              ⌘K
            </kbd>
          </button>

          <button
            onClick={runLiveAudit}
            disabled={isAuditing || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {isAuditing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isAuditing ? 'Auditing...' : 'Re-Run Audit'}</span>
          </button>
        </div>
      </header>

      {/* Published to GitHub Success Banner */}
      {publishResult && (
        <div className="px-5 py-2 bg-emerald-950/40 border-b border-emerald-900/40 flex items-center justify-between text-xs text-emerald-300 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Published to GitHub!</strong> Summary and {publishResult.count ?? 0} inline suggestions added to PR timeline.
            </span>
          </div>
          {publishResult.url && (
            <a
              href={publishResult.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 underline hover:text-white"
            >
              <span>View on GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* CodeRabbit-style Status Banner */}
      <div className="px-5 py-2 bg-[#090e1a] border-b border-[#1a2333] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
              criticalCount > 0
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {criticalCount > 0 ? (
              <>
                <ShieldAlert className="w-3 h-3" />
                Changes Requested
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Review Passed
              </>
            )}
          </span>

          <span className="text-slate-300 text-xs">
            {criticalCount > 0
              ? `${criticalCount} unresolved critical violations block merge per team security mandate.`
              : 'All security and architecture checks passed.'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-slate-400">
            Findings: <strong className="text-white">{findings.length}</strong>
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-rose-400">
            Critical: <strong>{criticalCount}</strong>
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-400">
            Resolved: <strong>{resolvedCount}</strong> of {findings.length}
          </span>
        </div>
      </div>

      {/* Main Diff Content / Loading / Error states */}
      <div className="flex-1 p-3 overflow-hidden flex flex-col bg-[#070b13]">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
            <h3 className="text-sm font-semibold text-white">Fetching Pull Request Diff...</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Loading modified files and running security analysis with Gemini 3.8 Flash and pgvector guidelines.
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-center justify-center text-rose-400 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-rose-300">Could Not Load Pull Request</h3>
            <p className="text-xs text-slate-400 mt-1.5 max-w-md">{error}</p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={fetchPRData}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Retry
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg border border-[#1b2436] bg-[#0c1220] text-slate-300 hover:text-white text-xs font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <FileCode2 className="w-10 h-10 text-slate-500 mb-3" />
            <h3 className="text-sm font-semibold text-white">No Changed Files Detected</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
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
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {sequenceDiagram && (
              <div className="shrink-0 mb-1 max-h-[340px] overflow-y-auto">
                <MermaidViewer chart={sequenceDiagram} defaultExpanded={false} />
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
              <DiffViewer
                files={files}
                findings={findings}
                onResolveFinding={handleResolve}
                onApplyFix={handleApplyFix}
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating Ask CodeGuard AI Button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-500/20 border border-blue-400/30 transition-all hover:scale-105 active:scale-95 group"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-200 group-hover:rotate-12 transition-transform" />
          <span>Ask CodeGuard</span>
          <kbd className="px-1.5 py-0.2 text-[9px] font-mono bg-blue-900/60 border border-blue-400/30 rounded text-blue-200">
            ⌘K
          </kbd>
        </button>
      )}

      {/* Interactive PR Chatbot Drawer */}
      <PRChatDrawer
        repositoryId={repoId}
        prNumber={prNumber}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}
