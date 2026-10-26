'use client';

import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles, BookOpen } from 'lucide-react';

interface RuleStudioProps {
  repositoryId: string;
  onRuleAdded?: () => void;
}

const RULE_PRESETS = [
  {
    title: 'RFC-104: Zero-Secret Ingestion Policy',
    category: 'security' as const,
    severity: 'critical' as const,
    scopePattern: '**/*',
    content: `### Zero-Secret Ingestion Policy (RFC-104)
1. No cloud credentials, API keys, private keys, or webhook secrets may be committed directly to source control.
2. All credentials must be ingested at runtime exclusively via process.env or cloud IAM instance roles.
3. Detected hardcoded tokens (AKIA*, ghp_*, sk_live_*) block pull request merge automatically.`,
  },
  {
    title: 'SEC-202: Parameterized SQL & Anti-Injection Mandate',
    category: 'security' as const,
    severity: 'critical' as const,
    scopePattern: 'src/lib/db/**, src/app/api/**',
    content: `### Mandatory Parameterized SQL Queries (SEC-202)
1. Direct concatenation or template literal interpolation into raw SQL strings is strictly prohibited.
2. All database queries must use tagged template literals (sql\`SELECT ...\`) or ORM parameterized query builders.
3. User-supplied query parameters must be validated with Zod schemas prior to query execution.`,
  },
  {
    title: 'ARCH-305: Server Action & Auth Isolation Standard',
    category: 'architecture' as const,
    severity: 'high' as const,
    scopePattern: 'src/actions/**, src/app/**',
    content: `### Next.js 15 Server Action & Auth Isolation Standard
1. Every Server Action must verify the caller session using await auth() as its initial line.
2. Actions must never accept user-provided user_id in the payload; derive user_id strictly from session.user.id.
3. Mutation results must use typed result objects { success: true, data } | { success: false, error } rather than unhandled throws.`,
  },
];

export function RuleStudio({ repositoryId, onRuleAdded }: RuleStudioProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'security' | 'architecture' | 'performance' | 'style'>('security');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [scopePattern, setScopePattern] = useState('**/*');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectPreset = (preset: typeof RULE_PRESETS[0]) => {
    setTitle(preset.title);
    setCategory(preset.category);
    setSeverity(preset.severity);
    setScopePattern(preset.scopePattern);
    setContent(preset.content);
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      let res: Response;

      if (file) {
        const formData = new FormData();
        formData.append('repositoryId', repositoryId);
        formData.append('title', title);
        formData.append('category', category);
        formData.append('severity', severity);
        formData.append('scopePattern', scopePattern);
        formData.append('file', file);

        res = await fetch('/api/rules/upload', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/rules/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repositoryId,
            title,
            category,
            severity,
            scopePattern,
            content,
            sourceType: 'manual',
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload rule');
      }

      setSuccessMessage(`Successfully vectorized and stored rule! Chunks indexed into pgvector: ${data.chunksIndexed}`);
      setTitle('');
      setContent('');
      setFile(null);
      if (onRuleAdded) onRuleAdded();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-[#0c121d] border border-[#182335] rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-[#182335]">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-bold text-[#f0f4fc]">Team Rule & Policy Studio</h2>
        </div>
        <span className="text-[11px] font-mono text-[#5e7394]">pgvector (Gemini 768-dim)</span>
      </div>

      <p className="text-xs text-[#94a7c6] mt-3 mb-6 leading-relaxed">
        Upload architectural RFCs, coding conventions, or compliance policies (Markdown/PDF).
        CodeGuard AI chunks sections with LangChain and indexes them with Gemini embeddings to enforce during PR reviews.
      </p>

      {/* Quick Policy Presets */}
      <div className="mb-6">
        <label className="block text-[11px] font-mono uppercase tracking-wider text-[#5e7394] mb-2">
          Or Load Industry Standards / Team Presets:
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {RULE_PRESETS.map((preset) => (
            <button
              key={preset.title}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="p-3 text-left rounded-lg bg-[#070a10] border border-[#182335] hover:border-[#22324b] text-xs transition-colors"
            >
              <div className="font-semibold text-[#f0f4fc] truncate">{preset.title}</div>
              <div className="text-[10px] font-mono text-[#5e7394] mt-1 capitalize">
                {preset.category} • {preset.severity}
              </div>
            </button>
          ))}
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-3 rounded bg-[#062316] border border-[#0b3d27] text-xs text-[#34d399] flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded bg-[#2b0b0e] border border-red-900/60 text-xs text-red-300 flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#f0f4fc] mb-1">Rule / Guideline Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. RFC-104: Zero-Secret Ingestion Policy"
              className="w-full bg-[#070a10] border border-[#182335] rounded-md px-3 py-2 text-xs text-[#f0f4fc] focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f0f4fc] mb-1">Scope Pattern</label>
            <input
              type="text"
              value={scopePattern}
              onChange={(e) => setScopePattern(e.target.value)}
              placeholder="e.g. src/auth/**, api/**/*.ts, **/*"
              className="w-full bg-[#070a10] border border-[#182335] rounded-md px-3 py-2 text-xs text-[#f0f4fc] font-mono focus:outline-none focus:border-[#2563eb]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#f0f4fc] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-[#070a10] border border-[#182335] rounded-md px-3 py-2 text-xs text-[#f0f4fc] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="security">Security</option>
              <option value="architecture">Architecture</option>
              <option value="performance">Performance</option>
              <option value="style">Style & Conventions</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f0f4fc] mb-1">Default Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              className="w-full bg-[#070a10] border border-[#182335] rounded-md px-3 py-2 text-xs text-[#f0f4fc] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="critical">Critical (Blocks PR Merge)</option>
              <option value="high">High (Requires Reviewer Sign-off)</option>
              <option value="medium">Medium (Advisory Warning)</option>
              <option value="low">Low (Nit / Suggestion)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#f0f4fc] mb-1">Upload File (Markdown / PDF)</label>
          <input
            type="file"
            accept=".md,.markdown,.txt,.pdf"
            onChange={handleFileChange}
            className="w-full bg-[#070a10] border border-[#182335] rounded-md px-3 py-2 text-xs text-[#94a7c6] file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-[#162237] file:text-[#f0f4fc] hover:file:bg-[#22324b] cursor-pointer"
          />
        </div>

        {!file && (
          <div>
            <label className="block text-xs font-semibold text-[#f0f4fc] mb-1">Or Paste Guideline Content Directly</label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="### Password Hashing Policy&#10;All passwords must use Argon2id with 64MB memory cost..."
              className="w-full bg-[#070a10] border border-[#182335] rounded-md p-3 text-xs font-mono text-[#f0f4fc] focus:outline-none focus:border-[#2563eb]"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading || (!file && !content.trim())}
          className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors shadow-sm"
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          {isUploading ? 'Chunking & Vectorizing in pgvector...' : 'Upload & Vectorize Rule'}
        </button>
      </form>
    </div>
  );
}
