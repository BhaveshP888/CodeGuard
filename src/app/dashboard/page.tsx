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
  ShieldAlert,
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
    <div className="min-h-screen bg-[#080c14] flex flex-col">
      {/* Dashboard Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            <span className="font-bold text-slate-100 tracking-tight">CodeGuard AI</span>
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-xs text-slate-400 font-medium">Dashboard</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Sync Repos
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8">
        {/* Connected Repositories Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">Connected Repositories</h2>
              <p className="text-xs text-slate-400">Repositories monitored for architectural and security compliance.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-500 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              Loading repositories from GitHub...
            </div>
          ) : isError ? (
            <div className="p-6 rounded-xl border border-red-900/40 bg-red-950/20 text-red-300 text-xs">
              Failed to load repositories. Please ensure you are logged in with valid GitHub credentials.
            </div>
          ) : connectedRepos.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
              <GitPullRequest className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-200">No repositories connected yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Connect a repository below to configure architectural style guides and audit Pull Requests.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-100 truncate">
                        {repo.private && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        <span className="truncate">{repo.fullName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-medium">
                        Active
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                      {repo.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedRepoId(repo.dbId);
                        setShowRuleStudio(true);
                      }}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Rule Studio
                    </button>

                    <Link
                      href={`/dashboard/repos/${repo.dbId}/prs/1`}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                    >
                      Audit PR
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rule Studio Drawer Modal */}
        {showRuleStudio && selectedRepoId && (
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-200">Manage Guidelines for Repository</h3>
              <button
                onClick={() => setShowRuleStudio(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close Rule Studio ✕
              </button>
            </div>
            <RuleStudio repositoryId={selectedRepoId} onRuleAdded={() => refetch()} />
          </div>
        )}

        {/* Available to Connect Section */}
        {availableRepos.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Available GitHub Repositories ({availableRepos.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableRepos.slice(0, 9).map((repo) => (
                <div
                  key={repo.id}
                  className="p-4 rounded-xl border border-slate-800/60 bg-slate-950/40 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate">
                    <div className="font-medium text-slate-200 truncate flex items-center gap-1.5">
                      {repo.private && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className="truncate">{repo.fullName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
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
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium shrink-0 transition-colors"
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
