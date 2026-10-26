'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  GitPullRequest,
  CheckCircle2,
  Terminal,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  Sparkles,
  Lock,
  GitCommit,
  Check,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

interface DemoScenario {
  id: string;
  label: string;
  fileName: string;
  violationType: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  ruleTitle: string;
  similarity: number;
  oldCode: string;
  newCode: string;
  offendingLine: number;
  fixedCode: string;
  explanation: string;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'secrets',
    label: 'Hardcoded AWS Credential & eval()',
    fileName: 'src/lib/auth/session.ts',
    violationType: 'CRITICAL',
    ruleTitle: 'RFC-104: Zero-Secret Ingestion & IAM Mandate',
    similarity: 0.94,
    offendingLine: 17,
    oldCode: `  const sessionExpiresAt = new Date();
  sessionExpiresAt.setHours(sessionExpiresAt.getHours() + 24);
  return {
    userId,
    token: generateSecureToken(),
    expiresAt: sessionExpiresAt,
  };`,
    newCode: `  const sessionExpiresAt = new Date();
  // 30 days session lifetime without re-authentication
  sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 30);
  const legacySecret = "AKIAIOSFODNN7EXAMPLE"; // AWS test key for sync
  return {
    userId,
    token: eval("generateSecureToken()"),
    expiresAt: sessionExpiresAt,
  };`,
    fixedCode: `  const sessionExpiresAt = new Date();
  sessionExpiresAt.setHours(sessionExpiresAt.getHours() + 24);
  const legacySecret = process.env.AWS_ACCESS_KEY_ID;
  return {
    userId,
    token: generateSecureToken(),
    expiresAt: sessionExpiresAt,
  };`,
    explanation:
      'Hardcoded AWS Access Key ID detected on line 17. Violates team RFC-104. Credentials must be sourced exclusively from environment variables or runtime IAM instance profiles.',
  },
  {
    id: 'sql',
    label: 'SQL Injection via Template Literal',
    fileName: 'src/app/api/users/route.ts',
    violationType: 'CRITICAL',
    ruleTitle: 'SEC-202: Mandatory Parameterized SQL Queries',
    similarity: 0.97,
    offendingLine: 4,
    oldCode: `export async function GET(req: Request) {
  return Response.json({ status: "ok" });
}`,
    newCode: `export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const query = \`SELECT * FROM users WHERE id = \${id}\`;
  return Response.json(await db.execute(query));
}`,
    fixedCode: `export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const result = await db.execute(sql\`SELECT * FROM users WHERE id = \${id}\`);
  return Response.json(result);
}`,
    explanation:
      'Direct string interpolation into raw SQL detected on line 4. Parameterized SQL queries with sql tagged template literals are mandatory to prevent SQL injection.',
  },
  {
    id: 'crypto',
    label: 'Insecure Password Hashing',
    fileName: 'src/lib/services/auth-service.ts',
    violationType: 'HIGH',
    ruleTitle: 'RFC-88: Cryptographic Standards (Argon2id)',
    similarity: 0.91,
    offendingLine: 12,
    oldCode: `export async function registerUser(email: string, pass: string) {
  const hash = await hashPassword(pass);
  return db.user.create({ email, passwordHash: hash });
}`,
    newCode: `export async function registerUser(email: string, pass: string) {
  // Legacy fast MD5 hash for rapid onboarding
  const hash = crypto.createHash("md5").update(pass).digest("hex");
  return db.user.create({ email, passwordHash: hash });
}`,
    fixedCode: `export async function registerUser(email: string, pass: string) {
  // Enforced Argon2id with 64MB memory cost per RFC-88
  const hash = await argon2.hash(pass, { type: argon2.argon2id, memoryCost: 65536 });
  return db.user.create({ email, passwordHash: hash });
}`,
    explanation:
      'MD5 is cryptographically broken and vulnerable to collision and rainbow table attacks. Team standard RFC-88 mandates Argon2id with 64MB memory cost.',
  },
];

export default function HomePage() {
  const [activeScenario, setActiveScenario] = useState<DemoScenario>(DEMO_SCENARIOS[0]);
  const [isFixed, setIsFixed] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const handleSelectScenario = (scenario: DemoScenario) => {
    setActiveScenario(scenario);
    setIsFixed(false);
  };

  const handleApplySimulatedFix = () => {
    setIsCommitting(true);
    setTimeout(() => {
      setIsCommitting(false);
      setIsFixed(true);
    }, 600);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#070a10] text-[#f0f4fc]">
      {/* Top Application Bar */}
      <header className="border-b border-[#182335] bg-[#0c121d]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sm tracking-tight text-[#f0f4fc]">CodeGuard AI</span>
              <span className="text-[11px] font-mono text-[#5e7394]">v1.0.0</span>
            </div>
          </div>

          <nav className="flex items-center gap-6">
            <Link
              href="#architecture"
              className="text-xs font-medium text-[#94a7c6] hover:text-[#f0f4fc] transition-colors"
            >
              Architecture
            </Link>
            <Link
              href="#interactive-demo"
              className="text-xs font-medium text-[#94a7c6] hover:text-[#f0f4fc] transition-colors"
            >
              Live Demo
            </Link>
            <Link
              href="/login"
              className="text-xs font-medium text-[#94a7c6] hover:text-[#f0f4fc] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard/repos/demo/prs/1"
              className="px-3.5 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              Launch Console
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-24 pb-16 max-w-5xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#f0f4fc] leading-[1.08] max-w-4xl mx-auto">
          Enforce team architecture rules and security standards on every Pull Request.
        </h1>

        <p className="mt-7 text-base sm:text-lg text-[#94a7c6] max-w-2xl mx-auto leading-relaxed">
          Upload your architectural RFCs, security standards, and style guides. CodeGuard AI vectorizes them in{' '}
          <strong className="text-[#f0f4fc] font-semibold">pgvector</strong> and streams file-by-file audits with one-click direct PR branch remediations.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard/repos/demo/prs/1"
            className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/15 transition-all"
          >
            <GitPullRequest className="w-4 h-4" />
            Try Live PR Audit Console
          </Link>

          <Link
            href="/login"
            className="flex items-center gap-2 px-5 py-3 bg-[#111a2a] hover:bg-[#162237] border border-[#22324b] text-[#f0f4fc] rounded-lg text-xs font-medium transition-all"
          >
            Connect GitHub Organization
          </Link>
        </div>

        {/* Core Capabilities Ribbon */}
        <div className="mt-14 pt-8 border-t border-[#182335] grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#5e7394]">Pre-Scan Latency</div>
            <div className="text-xl font-bold text-[#f0f4fc] mt-1 font-mono">0 ms</div>
            <p className="text-xs text-[#94a7c6] mt-0.5">Instant heuristic SAST & secrets trap</p>
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#5e7394]">Vector Engine</div>
            <div className="text-xl font-bold text-[#f0f4fc] mt-1 font-mono">pgvector</div>
            <p className="text-xs text-[#94a7c6] mt-0.5">768-dim HNSW cosine indexing</p>
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#5e7394]">AI Auditor</div>
            <div className="text-xl font-bold text-[#f0f4fc] mt-1 font-mono">Gemini 3.8 Flash</div>
            <p className="text-xs text-[#94a7c6] mt-0.5">1M context agentic reasoning</p>
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#5e7394]">Monthly Cloud Bill</div>
            <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">$0.00 / mo</div>
            <p className="text-xs text-[#94a7c6] mt-0.5">Vercel, Supabase & AI Studio free tiers</p>
          </div>
        </div>
      </section>

      {/* Interactive Demonstration Section */}
      <section id="interactive-demo" className="px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#f0f4fc] tracking-tight">Interactive PR Audit Demonstration</h2>
            <p className="text-xs text-[#94a7c6] mt-1">
              Select a real-world pull request scenario below to observe how CodeGuard retrieves team rules and generates automated fixes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#5e7394]">Audit Target:</span>
            <span className="text-xs font-mono bg-[#111a2a] px-2 py-1 rounded border border-[#22324b] text-[#94a7c6]">
              {activeScenario.fileName}
            </span>
          </div>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {DEMO_SCENARIOS.map((scenario) => {
            const isSelected = activeScenario.id === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => handleSelectScenario(scenario)}
                className={`p-3.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-[#111a2a] border-[#2563eb] shadow-md'
                    : 'bg-[#0c121d] border-[#182335] hover:border-[#22324b] text-[#94a7c6]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                      scenario.violationType === 'CRITICAL'
                        ? 'bg-red-950/80 text-red-400 border border-red-900/40'
                        : 'bg-amber-950/80 text-amber-400 border border-amber-900/40'
                    }`}
                  >
                    {scenario.violationType}
                  </span>
                  <span className="text-[11px] font-mono text-[#5e7394]">
                    {Math.round(scenario.similarity * 100)}% Match
                  </span>
                </div>
                <div className="text-xs font-semibold text-[#f0f4fc] mt-2 truncate">{scenario.label}</div>
                <div className="text-[11px] text-[#5e7394] font-mono truncate mt-0.5">{scenario.fileName}</div>
              </button>
            );
          })}
        </div>

        {/* Live Diff & Finding Viewer Box */}
        <div className="rounded-xl border border-[#22324b] bg-[#0c121d] overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <div className="px-4 py-3 bg-[#111a2a] border-b border-[#182335] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[#f0f4fc]">{activeScenario.fileName}</span>
              <span className="text-xs text-[#5e7394] font-mono">
                {isFixed ? 'Remediated' : 'Pull Request #42 • Diff Hunk'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-[#94a7c6] bg-[#070a10] px-2.5 py-1 rounded border border-[#182335]">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-mono text-[11px] text-[#f0f4fc]">{activeScenario.ruleTitle}</span>
              </div>
            </div>
          </div>

          {/* Diff Code Area */}
          <div className="p-4 font-mono text-xs overflow-x-auto bg-[#070a10]">
            <pre className="text-[#94a7c6] leading-relaxed whitespace-pre">
              {isFixed ? activeScenario.fixedCode : activeScenario.newCode}
            </pre>
          </div>

          {/* Inline Finding Card (when not fixed yet) */}
          {!isFixed ? (
            <div className="m-4 p-4 rounded-lg bg-[#2b0b0e] border border-red-900/60 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white font-mono">
                    {activeScenario.violationType}
                  </span>
                  <span className="text-xs font-semibold text-red-200">
                    Line {activeScenario.offendingLine}: {activeScenario.label}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-red-300 bg-red-950 px-2 py-0.5 rounded border border-red-800">
                  pgvector similarity: {Math.round(activeScenario.similarity * 100)}%
                </div>
              </div>

              <p className="text-xs text-red-100/90 mt-2.5 leading-relaxed">{activeScenario.explanation}</p>

              <div className="mt-3.5 pt-3 border-t border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[11px] text-red-300 font-mono">
                  Enforces: <strong className="text-white">{activeScenario.ruleTitle}</strong>
                </div>

                <button
                  onClick={handleApplySimulatedFix}
                  disabled={isCommitting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded transition-all shadow-sm shrink-0 disabled:opacity-50"
                >
                  {isCommitting ? (
                    <GitCommit className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GitCommit className="w-3.5 h-3.5" />
                  )}
                  {isCommitting ? 'Committing to PR Branch...' : 'Apply Fix to PR Branch'}
                </button>
              </div>
            </div>
          ) : (
            <div className="m-4 p-4 rounded-lg bg-[#062316] border border-emerald-800 text-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Fix committed to PR branch successfully</div>
                  <div className="text-[11px] text-emerald-300 font-mono mt-0.5">
                    Commit sha: <code>9f8a2b1</code> • Status Check: Passed
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsFixed(false)}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline font-mono"
              >
                Reset Demo
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Architecture Deep Dive */}
      <section id="architecture" className="px-6 py-20 border-t border-[#182335] bg-[#0c121d]/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#f0f4fc] tracking-tight text-center">
            Zero-Cost Production Architecture
          </h2>
          <p className="text-xs text-[#94a7c6] text-center mt-2 max-w-xl mx-auto">
            Engineered to deploy permanently on zero-cost free tiers without expiring trial periods or sudden surprise bills.
          </p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-[#182335] bg-[#0c121d]">
              <div className="w-9 h-9 rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 flex items-center justify-center mb-4">
                <Terminal className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#f0f4fc]">1. Ingestion & SAST Pre-Scan</h3>
              <p className="text-xs text-[#94a7c6] mt-2 leading-relaxed">
                When a PR event arrives, diff hunks are parsed into structured additions and deletions. In-memory regex heuristics trap leaked AWS keys, GitHub tokens, and unsafe SQL concatenations with 0ms latency and 0 AI tokens.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#182335] bg-[#0c121d]">
              <div className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-800/40 text-blue-400 flex items-center justify-center mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#f0f4fc]">2. Semantic pgvector Retrieval</h3>
              <p className="text-xs text-[#94a7c6] mt-2 leading-relaxed">
                Team architectural guidelines and codebase symbol definitions are stored in PostgreSQL using Gemini 768-dim embeddings. Cosine queries (<code className="text-[#f0f4fc]">&lt;=&gt;</code>) pull all relevant rules for each touched file.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#182335] bg-[#0c121d]">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/80 border border-indigo-800/40 text-indigo-400 flex items-center justify-center mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#f0f4fc]">3. One-Click GitHub Remediation</h3>
              <p className="text-xs text-[#94a7c6] mt-2 leading-relaxed">
                Gemini 3.8 Flash streams structured findings and replacement hunks. Clicking "Apply Fix to PR" decrypts the engineer's OAuth token and commits the patch directly to the PR branch via GitHub Git Trees API.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#182335] py-8 text-center text-xs text-[#5e7394] bg-[#070a10]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-[#f0f4fc]">CodeGuard AI</span>
            <span>— Permanent $0 Cloud Auditor</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Next.js 15</span>
            <span>•</span>
            <span>pgvector</span>
            <span>•</span>
            <span>Gemini 3.8 Flash</span>
            <span>•</span>
            <span>Auth.js v5</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
