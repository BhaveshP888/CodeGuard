'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, Sparkles, Check, Loader2 } from 'lucide-react';
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

  const severityColors: Record<SeverityLevel, { bg: string; text: string; border: string; badge: string }> = {
    critical: {
      bg: 'bg-red-950/40',
      text: 'text-red-400',
      border: 'border-red-900/60',
      badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    },
    high: {
      bg: 'bg-amber-950/40',
      text: 'text-amber-400',
      border: 'border-amber-900/60',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    medium: {
      bg: 'bg-blue-950/40',
      text: 'text-blue-400',
      border: 'border-blue-900/60',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    low: {
      bg: 'bg-slate-900/40',
      text: 'text-slate-400',
      border: 'border-slate-800',
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
    },
  };

  const style = severityColors[finding.severity] || severityColors.medium;

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
      className={`my-3 p-4 rounded-lg border ${style.border} ${style.bg} backdrop-blur-sm transition-all shadow-lg`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-5 h-5 ${style.text}`} />
          <span className="font-semibold text-slate-100 text-sm">{finding.title}</span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full border uppercase tracking-wider ${style.badge}`}
          >
            {finding.severity}
          </span>
          <span className="text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded capitalize">
            {finding.category}
          </span>
        </div>

        {finding.id && (
          <button
            onClick={handleToggleResolve}
            disabled={isResolving}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors ${
              finding.isResolved
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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

      <p className="mt-2 text-xs text-slate-300 leading-relaxed">{finding.message}</p>

      {finding.ruleCited && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-950/40 px-2.5 py-1.5 rounded border border-indigo-900/50">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>
            Violates Team Guideline: <strong className="font-medium">{finding.ruleCited}</strong>
          </span>
        </div>
      )}

      {finding.suggestedPatch && (
        <div className="mt-3">
          <div className="flex items-center justify-between pb-1.5 text-xs font-mono text-slate-400">
            <span>Suggested Remediation</span>
            {onApplyFix && (
              <button
                onClick={handleApply}
                disabled={isApplying || applied}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-all font-sans font-medium ${
                  applied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                }`}
              >
                {isApplying ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : applied ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {applied ? 'Committed to PR' : 'Apply Fix to PR'}
              </button>
            )}
          </div>
          <pre className="p-3 bg-black/60 rounded border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre">
            {finding.suggestedPatch}
          </pre>
        </div>
      )}
    </div>
  );
}
