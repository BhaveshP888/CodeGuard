'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Check,
  CheckCircle2,
  Loader2,
  GitCommit,
  Copy,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { SeverityLevel } from '@/stores/diff-store';

export interface InlineFinding {
  id?: string;
  filePath: string;
  lineNumber: number;
  category: 'security' | 'architecture' | 'performance' | 'style';
  severity: SeverityLevel;
  title: string;
  message: string;
  ruleCited?: string | null;
  suggestedPatch?: string | null;
  isResolved?: boolean;
}

interface InlineFindingCardProps {
  finding: InlineFinding;
  onResolve?: (findingId: string, resolved: boolean) => Promise<void>;
  onApplyFix?: (finding: InlineFinding) => Promise<void>;
}

export function InlineFindingCard({ finding, onResolve, onApplyFix }: InlineFindingCardProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  const severityConfigs: Record<
    SeverityLevel,
    {
      cardBg: string;
      cardBorder: string;
      badgeBg: string;
      badgeText: string;
      badgeBorder: string;
      icon: typeof ShieldAlert;
      accentColor: string;
    }
  > = {
    critical: {
      cardBg: 'bg-[#12080a]',
      cardBorder: 'border-rose-900/40',
      badgeBg: 'bg-rose-500/10',
      badgeText: 'text-rose-400',
      badgeBorder: 'border-rose-500/30',
      icon: ShieldAlert,
      accentColor: 'text-rose-400',
    },
    high: {
      cardBg: 'bg-[#140e06]',
      cardBorder: 'border-amber-900/40',
      badgeBg: 'bg-amber-500/10',
      badgeText: 'text-amber-400',
      badgeBorder: 'border-amber-500/30',
      icon: AlertTriangle,
      accentColor: 'text-amber-400',
    },
    medium: {
      cardBg: 'bg-[#091122]',
      cardBorder: 'border-sky-900/40',
      badgeBg: 'bg-sky-500/10',
      badgeText: 'text-sky-400',
      badgeBorder: 'border-sky-500/30',
      icon: Info,
      accentColor: 'text-sky-400',
    },
    low: {
      cardBg: 'bg-[#0e131f]',
      cardBorder: 'border-slate-800',
      badgeBg: 'bg-slate-800',
      badgeText: 'text-slate-300',
      badgeBorder: 'border-slate-700',
      icon: Info,
      accentColor: 'text-slate-400',
    },
  };

  const config = severityConfigs[finding.severity] || severityConfigs.medium;
  const IconComponent = config.icon;

  const handleApply = async () => {
    if (!onApplyFix) return;
    try {
      setIsApplying(true);
      await onApplyFix(finding);
      setApplied(true);
    } finally {
      setIsApplying(false);
    }
  };

  const handleToggleResolve = async () => {
    if (!onResolve || !finding.id) return;
    try {
      setIsResolving(true);
      await onResolve(finding.id, !finding.isResolved);
    } finally {
      setIsResolving(false);
    }
  };

  const handleCopyPatch = async () => {
    if (!finding.suggestedPatch) return;
    await navigator.clipboard.writeText(finding.suggestedPatch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`my-2.5 rounded-lg border ${config.cardBorder} ${config.cardBg} shadow-sm overflow-hidden transition-all font-sans text-xs`}
    >
      {/* Top Comment Bar */}
      <div className="px-3.5 py-2.5 bg-black/30 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Avatar Pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[10px]">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span className="font-semibold">CodeGuard AI</span>
          </div>

          {/* Severity Tag */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
          >
            <IconComponent className="w-3 h-3" />
            {finding.severity}
          </span>

          {/* Line and Title */}
          <span className="font-semibold text-slate-200">
            Line {finding.lineNumber}: {finding.title}
          </span>

          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1.5 py-0.2 rounded bg-white/[0.04]">
            {finding.category}
          </span>
        </div>

        {/* Resolve Action */}
        {finding.id && (
          <button
            onClick={handleToggleResolve}
            disabled={isResolving}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              finding.isResolved
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08]'
            }`}
          >
            {isResolving ? (
              <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
            ) : finding.isResolved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Check className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{finding.isResolved ? 'Resolved' : 'Mark as Resolved'}</span>
          </button>
        )}
      </div>

      {/* Message and Context */}
      <div className="p-3.5 space-y-3">
        <p className="text-slate-300 leading-relaxed">{finding.message}</p>

        {/* Rule Citation Pill */}
        {finding.ruleCited && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/5 border border-blue-500/20 text-blue-300 text-[11px]">
            <Shield className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="font-mono text-slate-400">Rule:</span>
            <span className="font-medium text-slate-200">{finding.ruleCited}</span>
          </div>
        )}

        {/* Suggested Code Diff Box */}
        {finding.suggestedPatch && (
          <div className="rounded-lg border border-white/[0.08] bg-[#070b12] overflow-hidden">
            <div className="px-3 py-1.5 bg-[#0a0f19] border-b border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Suggested Change
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyPatch}
                  className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {onApplyFix && (
                  <button
                    onClick={handleApply}
                    disabled={isApplying || applied}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-sans font-medium text-[11px] transition-all shadow-sm ${
                      applied
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isApplying ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <GitCommit className="w-3 h-3" />
                    )}
                    <span>{applied ? 'Committed to PR' : 'Apply Fix to PR'}</span>
                  </button>
                )}
              </div>
            </div>

            <pre className="p-3 font-mono text-xs text-emerald-300 bg-emerald-950/10 overflow-x-auto whitespace-pre leading-relaxed select-all">
              {finding.suggestedPatch}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
