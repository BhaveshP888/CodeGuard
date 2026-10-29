'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Check,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileCode2,
  RotateCcw,
  BookOpen,
} from 'lucide-react';

interface RuleStudioProps {
  repositoryId: string;
  onRuleAdded?: () => void;
  onClose?: () => void;
}

const DEFAULT_SPEC_TEMPLATE = `# Repository Security & Review Guidelines

### 1. Credentials & Secrets
- Never commit private keys, AWS access tokens, GitHub PATs, or webhook secrets.
- Ingest all sensitive configuration at runtime exclusively via process.env or IAM instance roles.

### 2. Database Queries & Injection Prevention
- All database mutations and queries must use tagged templates (sql\`SELECT ...\`) or parameterized ORM builders.
- Direct template literal interpolation or concatenation into raw SQL is strictly prohibited.
- User-supplied query parameters must be validated with Zod schemas prior to query execution.

### 3. Authentication & Access Control
- Every API endpoint and Next.js Server Action must verify caller session auth as its initial operation.
- Derive user identifiers strictly from authenticated session context to prevent Insecure Direct Object References (IDOR).
`;

const TEMPLATE_PRESETS = [
  {
    name: '+ Zero-Secret Mandate',
    snippet: `\n### Zero-Secret Mandate (RFC-104)
- No cloud credentials, API tokens (AKIA*, ghp_*, sk_live_*), or private keys in source code.
- Must be loaded exclusively through environment variables.\n`,
  },
  {
    name: '+ SQL Injection Guard',
    snippet: `\n### Parameterized SQL Only (SEC-202)
- Raw SQL query string concatenation is strictly banned.
- Use parameterized query builders or tagged sql template literals with input validation.\n`,
  },
  {
    name: '+ Server Action Auth',
    snippet: `\n### Server Action Auth Isolation (ARCH-305)
- All Server Actions must verify the session using \`await auth()\` before any data mutation.
- Never accept \`user_id\` from user input payload.\n`,
  },
];

export function RuleStudio({ repositoryId, onRuleAdded, onClose }: RuleStudioProps) {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load existing repository security spec
  const fetchSpec = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/rules?repositoryId=${repositoryId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.markdownContent) {
          setMarkdown(data.markdownContent);
          setLastUpdated(data.lastUpdated);
        } else {
          // If no custom spec has been saved yet, provide the clean default template
          setMarkdown(DEFAULT_SPEC_TEMPLATE);
        }
      }
    } catch {
      setMarkdown(DEFAULT_SPEC_TEMPLATE);
    } finally {
      setIsLoading(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    fetchSpec();
  }, [fetchSpec]);

  const handleSave = async () => {
    if (!markdown.trim() || isSaving) return;

    setIsSaving(true);
    setNotification(null);

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId,
          markdownContent: markdown.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save security instructions');
      }

      setNotification({
        type: 'success',
        message: `Security spec saved! ${data.chunksIndexed} semantic rules indexed for PR reviews.`,
      });
      setLastUpdated(data.lastUpdated || new Date().toISOString());

      if (onRuleAdded) onRuleAdded();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save error';
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const insertSnippet = (snippet: string) => {
    setMarkdown((prev) => prev.trim() + '\n' + snippet);
  };

  return (
    <div className="bg-[#0c1220] border border-[#1b2436] rounded-xl overflow-hidden shadow-2xl font-sans">
      {/* Header */}
      <div className="px-5 py-3.5 bg-[#090e1a] border-b border-[#1b2436] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">
              Security Spec & Review Instructions
            </h3>
            <p className="text-[11px] text-slate-400">
              Define custom architecture rules and security policies in Markdown. Enforced on every PR.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-xs font-mono text-slate-400 hover:text-white transition-colors"
          >
            Close [✕]
          </button>
        )}
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`px-5 py-2 text-xs flex items-center justify-between border-b ${
            notification.type === 'success'
              ? 'bg-emerald-950/30 text-emerald-300 border-emerald-900/40'
              : 'bg-rose-950/30 text-rose-300 border-rose-900/40'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[10px] uppercase font-mono text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Spec Editor Area */}
      <div className="p-5 space-y-3">
        {/* Template Presets Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-slate-400 mr-1">Insert Template:</span>
            {TEMPLATE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => insertSnippet(preset.snippet)}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMarkdown('')}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        </div>

        {/* Markdown Textarea */}
        <div className="relative">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 bg-[#070b13] border border-[#1b2436] rounded-xl">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span>Loading repository security spec...</span>
            </div>
          ) : (
            <textarea
              rows={12}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="# Enter custom security rules and architectural guidelines in Markdown..."
              className="w-full bg-[#070b13] border border-[#1b2436] focus:border-blue-500/80 rounded-xl p-4 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active in PR Reviews
            </span>
            {lastUpdated && (
              <>
                <span>•</span>
                <span>Last updated: {new Date(lastUpdated).toLocaleDateString()}</span>
              </>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || isLoading || !markdown.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-md"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Indexing Security Spec...' : 'Save Security Spec'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
