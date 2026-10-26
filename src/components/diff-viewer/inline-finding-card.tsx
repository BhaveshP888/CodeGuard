'use client';

import React, { useState } from 'react';
import { ShieldAlert, Sparkles, Check, Loader2, GitCommit, CheckCircle2 } from 'lucide-react';
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

  const severityConfigs: Record<
    SeverityLevel,
    { bg: string; border: string; text: string; badge: string; pill: string }
  > = {
    critical: {
      bg: 'bg-[#21090d]',
      border: 'border-[#7f1d1d]/70',
      text: 'text-[#fca5a5]',
      badge: 'bg-red-600 text-white font-mono',
      pill: 'bg-red-950/80 text-red-300 border-red-800/60',
    },
    high: {
      bg: 'bg-[#241306]',
      border: 'border-[#78350f]/70',
      text: 'text-[#fcd34d]',
      badge: 'bg-amber-600 text-white font-mono',
      pill: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
    },
    medium: {
      bg: 'bg-[#09152b]',
      border: 'border-[#1e3a8a]/70',
      text: 'text-[#93c5fd]',
      badge: 'bg-blue-600 text-white font-mono',
      pill: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
    },
    low: {
      bg: 'bg-[#101724]',
      border: 'border-[#1e293b]',
      text: 'text-[#94a3b8]',
      badge: 'bg-slate-700 text-slate-200 font-mono',
      pill: 'bg-slate-900 text-slate-300 border-slate-700',
    },
  };

  const config = severityConfigs[finding.severity] || severityConfigs.medium;

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

  return (
    <div
      className={`my-3 p-4 rounded-lg border ${config.border} ${config.bg} shadow-md transition-all font-sans`}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-black/20">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${config.badge}`}>
            {finding.severity}
          </span>
          <span className="text-xs font-semibold text-[#f0f4fc]">
            Line {finding.lineNumber}: {finding.title}
          </span>
          <span className="text-[11px] font-mono text-[#94a7c6] bg-black/40 px-2 py-0.5 rounded border border-white/5 capitalize">
            {finding.category}
          </span>
        </div>

        {finding.id && (
          <button
            onClick={handleToggleResolve}
            disabled={isResolving}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors font-medium ${
              finding.isResolved
                ? 'bg-[#062316] text-[#34d399] border border-[#0b3d27]'
                : 'bg-[#162237] text-[#94a7c6] hover:text-white border border-[#22324b]'
            }`}
          >
            {isResolving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : finding.isResolved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {finding.isResolved ? 'Resolved' : 'Mark Resolved'}
          </button>
        )}
      </div>

      {/* Explanation */}
      <p className="mt-2.5 text-xs text-[#cbd5e1] leading-relaxed">{finding.message}</p>

      {/* Cited Team Rule */}
      {finding.ruleCited && (
        <div className="mt-3 flex items-center gap-2 text-xs bg-black/40 px-3 py-1.5 rounded border border-white/10 text-[#93c5fd]">
          <span className="text-[10px] font-mono uppercase text-[#60a5fa] font-bold">Rule Violated:</span>
          <span className="font-medium text-[#f0f4fc]">{finding.ruleCited}</span>
        </div>
      )}

      {/* Remediation Patch Block */}
      {finding.suggestedPatch && (
        <div className="mt-3.5 pt-3 border-t border-black/20">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-mono text-[#94a7c6]">Suggested Code Remediation:</span>
            {onApplyFix && (
              <button
                onClick={handleApply}
                disabled={isApplying || applied}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all shadow-sm ${
                  applied
                    ? 'bg-[#052e16] text-[#34d399] border border-[#0b3d27]'
                    : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white'
                }`}
              >
                {isApplying ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : applied ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <GitCommit className="w-3 h-3" />
                )}
                {applied ? 'Committed to PR Branch' : 'Apply Fix to PR Branch'}
              </button>
            )}
          </div>

          <div className="p-3 bg-[#05080e] rounded border border-white/10 font-mono text-xs text-[#34d399] overflow-x-auto whitespace-pre">
            {finding.suggestedPatch}
          </div>
        </div>
      )}
    </div>
  );
}
