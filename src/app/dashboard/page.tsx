'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ShieldCheck,
  GitPullRequest,
  BookOpen,
  Plus,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Lock,
  Loader2,
  Layers,
  ArrowRight,
  Database,
} from 'lucide-react';
import { RuleStudio } from '@/components/rules/rule-studio';

interface RepositoryItem {
  id: number;
  dbId: string | null;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description: string | null;
  isConnected: boolean;
  isIndexed: boolean;
  indexingStatus: string;
  lastIndexedAt: string | null;
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [showRuleStudio, setShowRuleStudio] = useState(false);

  // Fetch repositories using TanStack Query
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    repositories: RepositoryItem[];
  }>({
    queryKey: ['repositories'],
    queryFn: async () => {
      const res = await fetch('/api/repos');
      if (!res.ok) throw new Error('Failed to fetch repositories');
      return res.json();
    },
  });

  // Connect repository mutation
  const connectMutation = useMutation({
    mutationFn: async (repo: { githubRepoId: number; fullName: string; defaultBranch: string }) => {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(repo),
      });
      if (!res.ok) throw new Error('Failed to connect repository');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });

  const repositories = data?.repositories || [];
  const connectedRepos = repositories.filter((r) => r.isConnected);
  const availableRepos = repositories.filter((r) => !r.isConnected);

  return (
    <div className="min-h-screen bg-[#070a10] text-[#f0f4fc] flex flex-col font-sans">
      {/* Dashboard Top Navigation */}
      <header className="border-b border-[#182335] bg-[#0c121d] px-8 h-15 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-[#f0f4fc]">CodeGuard AI</span>
          </Link>
          <span className="text-[#5e7394] font-mono">/</span>
          <span className="text-xs text-[#94a7c6] font-medium">Dashboard</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/repos/demo/prs/1"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#22324b] bg-[#111a2a] text-xs text-[#94a7c6] hover:text-[#f0f4fc] transition-colors"
          >
            <span>Live Audit Demo</span>
            <ExternalLink className="w-3 h-3 text-[#5e7394]" />
          </Link>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#182335] bg-[#070a10] text-xs text-[#94a7c6] hover:text-[#f0f4fc] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-400' : ''}`} />
            Sync Repositories
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8">
        {/* Connected Repositories Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#f0f4fc] tracking-tight">Connected Repositories</h2>
              <p className="text-xs text-[#94a7c6] mt-0.5">
                Repositories actively monitored with internal rules and zero-latency secrets traps.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-[#5e7394] text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              Loading repositories from GitHub...
            </div>
          ) : isError ? (
            <div className="p-6 rounded-xl border border-red-900/40 bg-[#21090d] text-red-200 text-xs">
              <div className="font-semibold text-white">GitHub Session Inactive</div>
              <p className="text-[#fca5a5] mt-1">
                Log in with your GitHub credentials to connect your team repositories.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded text-xs font-semibold"
                >
                  Sign in with GitHub
                </Link>
                <Link
                  href="/dashboard/repos/demo/prs/1"
                  className="px-4 py-2 bg-[#111a2a] hover:bg-[#162237] border border-[#22324b] text-[#f0f4fc] rounded text-xs font-medium"
                >
                  Explore Interactive Demo Instead
                </Link>
              </div>
            </div>
          ) : connectedRepos.length === 0 ? (
            <div className="p-12 text-center border border-[#182335] rounded-xl bg-[#0c121d]">
              <GitPullRequest className="w-8 h-8 text-[#5e7394] mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-[#f0f4fc]">No repositories connected yet</h3>
              <p className="text-xs text-[#94a7c6] mt-1 max-w-sm mx-auto">
                Select any repository from the list below to enable PR architectural audits and rule ingestion.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="p-5 rounded-xl border border-[#182335] bg-[#0c121d] hover:border-[#22324b] transition-all shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-[#f0f4fc] truncate">
                        {repo.private && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        <span className="truncate">{repo.fullName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#062316] border border-[#0b3d27] text-[#34d399] font-bold">
                        ACTIVE
                      </span>
                    </div>

                    <p className="text-xs text-[#94a7c6] mt-2 line-clamp-2">
                      {repo.description || 'Monitored repository with pgvector rule enforcement.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#182335] flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedRepoId(repo.dbId);
                        setShowRuleStudio(true);
                      }}
                      className="flex items-center gap-1 text-xs text-[#60a5fa] hover:text-[#93c5fd] font-medium transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Rule Studio
                    </button>

                    <Link
                      href={`/dashboard/repos/${repo.dbId}/prs/1`}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium transition-colors"
                    >
                      Audit Console
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rule Studio Drawer */}
        {showRuleStudio && selectedRepoId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#94a7c6]">Guideline Ingestion Console</span>
              <button
                onClick={() => setShowRuleStudio(false)}
                className="text-xs text-[#94a7c6] hover:text-white font-mono"
              >
                Close Studio [x]
              </button>
            </div>
            <RuleStudio repositoryId={selectedRepoId} onRuleAdded={() => refetch()} />
          </div>
        )}

        {/* Available GitHub Repositories Section */}
        {availableRepos.length > 0 && (
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#5e7394] mb-3">
              Available GitHub Repositories ({availableRepos.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableRepos.slice(0, 9).map((repo) => (
                <div
                  key={repo.id}
                  className="p-3.5 rounded-lg border border-[#182335] bg-[#0c121d] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate">
                    <div className="font-medium text-[#f0f4fc] truncate flex items-center gap-1.5">
                      {repo.private && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className="truncate">{repo.fullName}</span>
                    </div>
                    <div className="text-[11px] text-[#5e7394] font-mono truncate mt-0.5">
                      Branch: {repo.defaultBranch}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      connectMutation.mutate({
                        githubRepoId: repo.id,
                        fullName: repo.fullName,
                        defaultBranch: repo.defaultBranch,
                      })
                    }
                    disabled={connectMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#162237] hover:bg-[#22324b] text-[#f0f4fc] font-medium shrink-0 transition-colors border border-[#22324b]"
                  >
                    <Plus className="w-3 h-3" />
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
