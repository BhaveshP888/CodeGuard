'use client';

import React from 'react';
import { useDiffStore, type SeverityLevel } from '@/stores/diff-store';
import { FileTree } from './file-tree';
import { InlineFindingCard, type InlineFinding } from './inline-finding-card';
import type { ParsedFileDiff } from '@/lib/github/diff-parser';
import { Columns, AlignJustify, EyeOff, Eye, Check } from 'lucide-react';

interface DiffViewerProps {
  files: ParsedFileDiff[];
  findings: InlineFinding[];
  onResolveFinding?: (findingId: string, resolved: boolean) => Promise<void>;
  onApplyFix?: (finding: InlineFinding) => Promise<void>;
}

export function DiffViewer({
  files,
  findings,
  onResolveFinding,
  onApplyFix,
}: DiffViewerProps) {
  const {
    viewMode,
    activeFilePath,
    severityFilters,
    hideResolved,
    setViewMode,
    setActiveFilePath,
    toggleSeverityFilter,
    setHideResolved,
  } = useDiffStore();

  const selectedPath = activeFilePath || files[0]?.newPath || null;
  const activeFile = files.find((f) => f.newPath === selectedPath) || files[0];

  // Filter findings based on severity and resolved status
  const visibleFindings = findings.filter((f) => {
    if (!severityFilters[f.severity]) return false;
    if (hideResolved && f.isResolved) return false;
    return true;
  });

  const findingsByLine = visibleFindings
    .filter((f) => f.filePath === selectedPath)
    .reduce<Record<number, InlineFinding[]>>((acc, finding) => {
      if (!acc[finding.lineNumber]) acc[finding.lineNumber] = [];
      acc[finding.lineNumber].push(finding);
      return acc;
    }, {});

  // Severity counts
  const countsBySev = findings.reduce<Record<SeverityLevel, number>>(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0f19] rounded-xl border border-[#1b2436] overflow-hidden shadow-xl">
      {/* Diff Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#0d1424] border-b border-[#1b2436]">
        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">View:</span>
          <div className="flex items-center bg-[#070b13] p-0.5 rounded-lg border border-[#1b2436]">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              Unified
            </button>
          </div>
        </div>

        {/* Severity Filters */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-[11px] font-mono text-slate-500 mr-1">Severity:</span>
          {(['critical', 'high', 'medium', 'low'] as SeverityLevel[]).map((sev) => {
            const active = severityFilters[sev];
            const count = countsBySev[sev];

            const badgeStyles: Record<SeverityLevel, string> = {
              critical: active
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300',
              high: active
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300',
              medium: active
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300',
              low: active
                ? 'bg-slate-700/30 text-slate-300 border-slate-600/40'
                : 'text-slate-500 border-transparent hover:text-slate-300',
            };

            return (
              <button
                key={sev}
                onClick={() => toggleSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold uppercase transition-all flex items-center gap-1 ${badgeStyles[sev]}`}
              >
                <span>{sev}</span>
                {count > 0 && <span className="opacity-90">({count})</span>}
              </button>
            );
          })}

          <button
            onClick={() => setHideResolved(!hideResolved)}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-mono transition-all ml-1 ${
              hideResolved
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {hideResolved ? <Check className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3" />}
            <span>Hide Resolved</span>
          </button>
        </div>
      </div>

      {/* Main Diff Content with File Tree Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <FileTree
          files={files}
          activeFilePath={selectedPath}
          onSelectFile={setActiveFilePath}
          findings={visibleFindings}
        />

        {/* Diff Content Body */}
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-[#070b13]">
          {!activeFile ? (
            <div className="text-center py-24 text-slate-500">No file selected.</div>
          ) : (
            <div className="border border-[#1b2436] rounded-lg overflow-hidden bg-[#0d1322]">
              {/* File Header */}
              <div className="px-4 py-2 bg-[#11182c] border-b border-[#1b2436] flex items-center justify-between text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-white">{activeFile.newPath}</span>
                  {activeFile.isNew && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-medium">
                      NEW
                    </span>
                  )}
                  {activeFile.isDeleted && (
                    <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/30 px-1.5 py-0.2 rounded font-mono font-medium">
                      DELETED
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono">
                  <span className="text-emerald-400">+{activeFile.addedLinesCount}</span> /{' '}
                  <span className="text-rose-400">-{activeFile.deletedLinesCount}</span>
                </div>
              </div>

              {/* Hunks Rendering */}
              {activeFile.hunks.map((hunk, hIdx) => (
                <div key={hIdx} className="border-b border-[#1b2436] last:border-b-0">
                  <div className="bg-[#090e1a] px-4 py-1.5 text-slate-500 text-[11px] select-none border-b border-[#1b2436]/60 font-mono">
                    {hunk.header}
                  </div>

                  {viewMode === 'unified' ? (
                    /* Unified View Mode */
                    <div className="divide-y divide-[#1b2436]/30">
                      {hunk.lines.map((line, lIdx) => {
                        const lineFindings = line.newLineNumber ? findingsByLine[line.newLineNumber] : undefined;
                        const isAdd = line.type === 'add';
                        const isDel = line.type === 'delete';

                        return (
                          <React.Fragment key={lIdx}>
                            <div
                              className={`flex items-stretch hover:bg-white/[0.02] ${
                                isAdd
                                  ? 'bg-emerald-950/20 text-emerald-300'
                                  : isDel
                                  ? 'bg-rose-950/20 text-rose-300'
                                  : 'text-slate-300'
                              }`}
                            >
                              <div className="w-12 py-0.5 pr-2 text-right select-none text-slate-500 bg-[#090e1a] border-r border-[#1b2436]/40 shrink-0">
                                {line.oldLineNumber || ''}
                              </div>
                              <div className="w-12 py-0.5 pr-2 text-right select-none text-slate-500 bg-[#090e1a] border-r border-[#1b2436]/40 shrink-0">
                                {line.newLineNumber || ''}
                              </div>
                              <div className="w-6 py-0.5 text-center select-none font-bold shrink-0">
                                {isAdd ? '+' : isDel ? '-' : ' '}
                              </div>
                              <div className="flex-1 py-0.5 px-2 overflow-x-auto whitespace-pre font-mono">
                                {line.content}
                              </div>
                            </div>

                            {/* Inline findings beneath line */}
                            {lineFindings && lineFindings.length > 0 && (
                              <div className="px-6 py-2 bg-[#090e1a] border-y border-rose-900/30">
                                {lineFindings.map((finding, fIdx) => (
                                  <InlineFindingCard
                                    key={finding.id || fIdx}
                                    finding={finding}
                                    onResolve={onResolveFinding}
                                    onApplyFix={onApplyFix}
                                  />
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : (
                    /* Side-by-Side Split View Mode */
                    <div className="divide-y divide-[#1b2436]/30">
                      {hunk.lines.map((line, lIdx) => {
                        const lineFindings = line.newLineNumber ? findingsByLine[line.newLineNumber] : undefined;
                        const isAdd = line.type === 'add';
                        const isDel = line.type === 'delete';

                        return (
                          <React.Fragment key={lIdx}>
                            <div className="flex items-stretch">
                              {/* Left Side: Base / Old */}
                              <div
                                className={`w-1/2 flex border-r border-[#1b2436] ${
                                  isDel ? 'bg-rose-950/20 text-rose-300' : 'text-slate-400'
                                }`}
                              >
                                <div className="w-12 py-0.5 pr-2 text-right select-none text-slate-500 bg-[#090e1a] border-r border-[#1b2436]/40 shrink-0">
                                  {line.oldLineNumber || ''}
                                </div>
                                <div className="w-6 py-0.5 text-center select-none font-bold shrink-0">
                                  {isDel ? '-' : ' '}
                                </div>
                                <div className="flex-1 py-0.5 px-2 overflow-x-auto whitespace-pre font-mono">
                                  {!isAdd ? line.content : ''}
                                </div>
                              </div>

                              {/* Right Side: Head / New */}
                              <div
                                className={`w-1/2 flex ${
                                  isAdd ? 'bg-emerald-950/20 text-emerald-300' : 'text-slate-400'
                                }`}
                              >
                                <div className="w-12 py-0.5 pr-2 text-right select-none text-slate-500 bg-[#090e1a] border-r border-[#1b2436]/40 shrink-0">
                                  {line.newLineNumber || ''}
                                </div>
                                <div className="w-6 py-0.5 text-center select-none font-bold shrink-0">
                                  {isAdd ? '+' : ' '}
                                </div>
                                <div className="flex-1 py-0.5 px-2 overflow-x-auto whitespace-pre font-mono">
                                  {!isDel ? line.content : ''}
                                </div>
                              </div>
                            </div>

                            {/* Inline findings directly beneath line */}
                            {lineFindings && lineFindings.length > 0 && (
                              <div className="px-6 py-2 bg-[#090e1a] border-y border-rose-900/30">
                                {lineFindings.map((finding, fIdx) => (
                                  <InlineFindingCard
                                    key={finding.id || fIdx}
                                    finding={finding}
                                    onResolve={onResolveFinding}
                                    onApplyFix={onApplyFix}
                                  />
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
