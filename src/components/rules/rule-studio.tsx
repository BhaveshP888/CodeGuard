'use client';

import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface RuleStudioProps {
  repositoryId: string;
  onRuleAdded?: () => void;
}

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

      setSuccessMessage(`Successfully vectorized and stored rule! Chunks indexed: ${data.chunksIndexed}`);
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
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <UploadCloud className="w-5 h-5 text-blue-400" />
        <h2 className="text-base font-semibold text-slate-100">Team Architecture & Security Rule Studio</h2>
      </div>
      <p className="text-xs text-slate-400 mb-6">
        Upload your team's architecture guidelines, security rules, or RFCs (Markdown or text).
        CodeGuard AI chunks and indexes them into <code>pgvector</code> using Gemini's 768-dim embeddings to enforce during PR reviews.
      </p>

      {successMessage && (
        <div className="mb-4 p-3 rounded bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Rule / Guideline Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Session Token Expiration & Argon2id Mandate"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Scope Pattern</label>
            <input
              type="text"
              value={scopePattern}
              onChange={(e) => setScopePattern(e.target.value)}
              placeholder="e.g. src/auth/**, api/**/*.ts, **/*"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="security">Security</option>
              <option value="architecture">Architecture</option>
              <option value="performance">Performance</option>
              <option value="style">Style & Conventions</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Default Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="critical">Critical (Blocks PR)</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Upload File (Markdown / PDF)</label>
          <input
            type="file"
            accept=".md,.markdown,.txt,.pdf"
            onChange={handleFileChange}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
          />
        </div>

        {!file && (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Or Paste Guideline Content Directly</label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="### Password Hashing Policy&#10;All passwords must use Argon2id with 64MB memory cost..."
              className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading || (!file && !content.trim())}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors shadow-sm"
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          {isUploading ? 'Chunking & Vectorizing...' : 'Upload & Vectorize Rule'}
        </button>
      </form>
    </div>
  );
}
