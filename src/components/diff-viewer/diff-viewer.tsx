'use client';

import React from 'react';
import { useDiffStore, type SeverityLevel } from '@/stores/diff-store';
import { FileTree } from './file-tree';
import { InlineFindingCard, type InlineFinding } from './inline-finding-card';
import type { ParsedFileDiff } from '@/lib/github/diff-parser';
import { Columns, AlignJustify, Filter, EyeOff } from 'lucide-react';

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
    <div className="flex flex-col h-full bg-[#070a10] rounded-xl border border-[#182335] overflow-hidden shadow-2xl">
      {/* Diff Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0c121d] border-b border-[#182335]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#94a7c6]">View:</span>
          <div className="flex items-center bg-[#070a10] p-0.5 rounded border border-[#182335]">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'split'
                  ? 'bg-[#2563eb] text-white font-medium shadow-sm'
                  : 'text-[#94a7c6] hover:text-[#f0f4fc]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'unified'
                  ? 'bg-[#2563eb] text-white font-medium shadow-sm'
                  : 'text-[#94a7c6] hover:text-[#f0f4fc]'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              Unified
            </button>
          </div>
        </div>

        {/* Severity Filters */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-[11px] font-mono text-[#5e7394] mr-1">Filter:</span>
          {(['critical', 'high', 'medium', 'low'] as SeverityLevel[]).map((sev) => {
            const active = severityFilters[sev];
            const count = countsBySev[sev];

            const badgeStyles: Record<SeverityLevel, string> = {
              critical: active
                ? 'bg-red-950/80 text-red-300 border-red-700'
                : 'text-[#5e7394] border-[#182335]',
              high: active
                ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                : 'text-[#5e7394] border-[#182335]',
              medium: active
                ? 'bg-blue-950/80 text-blue-300 border-blue-700'
                : 'text-[#5e7394] border-[#182335]',
              low: active
                ? 'bg-slate-900 text-slate-300 border-slate-700'
                : 'text-[#5e7394] border-[#182335]',
            };

            return (
              <button
                key={sev}
                onClick={() => toggleSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${badgeStyles[sev]}`}
              >
                <span>{sev}</span>
                {count > 0 && <span className="opacity-80">({count})</span>}
              </button>
            );
          })}

          <button
            onClick={() => setHideResolved(!hideResolved)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono transition-all ml-2 ${
              hideResolved
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'text-[#5e7394] border-[#182335] hover:text-[#94a7c6]'
            }`}
          >
            <EyeOff className="w-3 h-3" />
            Hide Resolved
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
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-[#070a10]">
          {!activeFile ? (
            <div className="text-center py-24 text-[#5e7394]">No file selected.</div>
          ) : (
            <div className="border border-[#182335] rounded-lg overflow-hidden bg-[#0c121d]">
              {/* File Header */}
              <div className="px-4 py-2 bg-[#111a2a] border-b border-[#182335] flex items-center justify-between text-[#f0f4fc]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs">{activeFile.newPath}</span>
                  {activeFile.isNew && (
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
                      NEW
                    </span>
                  )}
                  {activeFile.isDeleted && (
                    <span className="text-[10px] bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.2 rounded font-mono">
                      DELETED
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono">
                  <span className="text-emerald-400">+{activeFile.addedLinesCount}</span> /{' '}
                  <span className="text-red-400">-{activeFile.deletedLinesCount}</span>
                </div>
              </div>

              {/* Hunks Rendering */}
              {activeFile.hunks.map((hunk, hIdx) => (
                <div key={hIdx} className="border-b border-[#182335] last:border-b-0">
                  <div className="bg-[#090d16] px-4 py-1.5 text-[#5e7394] text-[11px] select-none border-b border-[#182335] font-mono">
                    {hunk.header}
                  </div>

                  {viewMode === 'unified' ? (
                    /* Unified View Mode */
                    <div className="divide-y divide-[#182335]/40">
                      {hunk.lines.map((line, lIdx) => {
                        const lineFindings = line.newLineNumber ? findingsByLine[line.newLineNumber] : undefined;
                        const isAdd = line.type === 'add';
                        const isDel = line.type === 'delete';

                        return (
                          <React.Fragment key={lIdx}>
                            <div
                              className={`flex items-stretch hover:bg-white/[0.02] transition-colors ${
                                isAdd
                                  ? 'bg-[#062316] text-[#34d399]'
                                  : isDel
                                  ? 'bg-[#2d0b0f] text-[#f87171]'
                                  : 'text-[#94a7c6]'
                              }`}
                            >
                              <div className="w-12 py-0.5 pr-2 text-right select-none text-[#5e7394] bg-[#090d16] border-r border-[#182335]">
                                {line.oldLineNumber || ''}
                              </div>
                              <div className="w-12 py-0.5 pr-2 text-right select-none text-[#5e7394] bg-[#090d16] border-r border-[#182335]">
                                {line.newLineNumber || ''}
                              </div>
                              <div className="w-6 py-0.5 text-center select-none font-bold">
                                {isAdd ? '+' : isDel ? '-' : ' '}
                              </div>
                              <div className="flex-1 py-0.5 px-2 overflow-x-auto whitespace-pre font-mono">
                                {line.content}
                              </div>
                            </div>

                            {lineFindings && lineFindings.length > 0 && (
                              <div className="px-6 py-2 bg-[#090d16] border-y border-[#7f1d1d]/40">
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
                    <div className="divide-y divide-[#182335]/40">
                      {hunk.lines.map((line, lIdx) => {
                        const lineFindings = line.newLineNumber ? findingsByLine[line.newLineNumber] : undefined;
                        const isAdd = line.type === 'add';
                        const isDel = line.type === 'delete';

                        return (
                          <React.Fragment key={lIdx}>
                            <div className="flex items-stretch">
                              {/* Left Side: Base / Old */}
                              <div
                                className={`w-1/2 flex border-r border-[#182335] ${
                                  isDel ? 'bg-[#2d0b0f] text-[#f87171]' : 'text-[#94a7c6]'
                                }`}
                              >
                                <div className="w-12 py-0.5 pr-2 text-right select-none text-[#5e7394] bg-[#090d16] border-r border-[#182335] shrink-0">
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
                                  isAdd ? 'bg-[#062316] text-[#34d399]' : 'text-[#94a7c6]'
                                }`}
                              >
                                <div className="w-12 py-0.5 pr-2 text-right select-none text-[#5e7394] bg-[#090d16] border-r border-[#182335] shrink-0">
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
                              <div className="px-6 py-2 bg-[#090d16] border-y border-[#7f1d1d]/40">
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
