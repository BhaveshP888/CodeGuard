import React from 'react';
import Link from 'next/link';
import { ShieldCheck, GitPullRequest, Database, Zap, Sparkles, Terminal, FileCode2 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/10 border border-blue-500/30 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-bold text-base tracking-tight text-slate-100">
              CodeGuard <span className="text-blue-500">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:shadow-blue-500/20"
            >
              Open Console
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/40 text-blue-400 text-xs font-medium mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Autonomous GitHub PR & Architectural Auditor • 100% Free Tier</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-100 leading-[1.1]">
          Enforce your team's architecture & security rules on <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">every Pull Request</span>.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Upload your architecture guidelines and security policies. CodeGuard AI indexes your rules in{' '}
          <strong className="text-slate-200">pgvector</strong> and streams file-by-file inline reviews directly into your split-diff viewer and GitHub PR comments.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            <GitPullRequest className="w-4 h-4" />
            Connect GitHub Repository
          </Link>

          <Link
            href="https://github.com"
            target="_blank"
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-sm font-medium transition-all"
          >
            <Terminal className="w-4 h-4 text-slate-400" />
            Documentation
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm">
            <div className="p-2 bg-emerald-950/50 border border-emerald-800/30 rounded-lg w-fit text-emerald-400 mb-3">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">Zero-Latency SAST Scanner</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Catches hardcoded AWS keys, GitHub tokens, and dangerous evals before LLM ingestion with 0ms latency and 0 AI tokens.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm">
            <div className="p-2 bg-blue-950/50 border border-blue-800/30 rounded-lg w-fit text-blue-400 mb-3">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">pgvector Semantic RAG</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Indexes custom team rules and codebase symbol definitions into PostgreSQL with Gemini 768-dim embeddings.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm">
            <div className="p-2 bg-indigo-950/50 border border-indigo-800/30 rounded-lg w-fit text-indigo-400 mb-3">
              <FileCode2 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">One-Click Remediations</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Interactive split-screen diff viewer allows engineers to review AI suggestions and commit patches straight to the PR branch.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        CodeGuard AI • Zero-Cost Cloud Architecture (Supabase pgvector • Cloudflare R2 • Google AI Studio • Next.js 15)
      </footer>
    </div>
  );
}
