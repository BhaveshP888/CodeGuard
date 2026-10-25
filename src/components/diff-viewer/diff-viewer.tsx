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

  return (
    <div className="flex flex-col h-full bg-[#0b0f17] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Diff Controls Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">View Mode:</span>
          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              Unified
            </button>
          </div>
        </div>

        {/* Severity Filters */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            Filters:
          </span>
          {(['critical', 'high', 'medium', 'low'] as SeverityLevel[]).map((sev) => {
            const active = severityFilters[sev];
            const badgeClasses: Record<SeverityLevel, string> = {
              critical: active ? 'bg-red-500/20 text-red-300 border-red-500' : 'text-slate-600 border-slate-800',
              high: active ? 'bg-amber-500/20 text-amber-300 border-amber-500' : 'text-slate-600 border-slate-800',
              medium: active ? 'bg-blue-500/20 text-blue-300 border-blue-500' : 'text-slate-600 border-slate-800',
              low: active ? 'bg-slate-800 text-slate-300 border-slate-600' : 'text-slate-600 border-slate-800',
            };

            return (
              <button
                key={sev}
                onClick={() => toggleSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded border text-[11px] font-medium uppercase transition-all ${badgeClasses[sev]}`}
              >
                {sev}
              </button>
            );
          })}

          <button
            onClick={() => setHideResolved(!hideResolved)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-all ${
              hideResolved
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'text-slate-500 border-slate-800 hover:text-slate-300'
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

        {/* Diff Hunk Stream Viewer */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
          {!activeFile ? (
            <div className="text-center py-20 text-slate-500">No file selected.</div>
          ) : (
            <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-black/40">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-300">
                <span className="font-semibold">{activeFile.newPath}</span>
                <span className="text-[11px] text-slate-500">
                  +{activeFile.addedLinesCount} / -{activeFile.deletedLinesCount}
                </span>
              </div>

              {activeFile.hunks.map((hunk, hIdx) => (
                <div key={hIdx} className="border-b border-slate-900 last:border-b-0">
                  <div className="bg-slate-950 px-4 py-1.5 text-slate-500 text-[11px] select-none border-b border-slate-900">
                    {hunk.header}
                  </div>

                  <div className="divide-y divide-slate-900/40">
                    {hunk.lines.map((line, lIdx) => {
                      const lineFindings = line.newLineNumber ? findingsByLine[line.newLineNumber] : undefined;

                      const isAdd = line.type === 'add';
                      const isDel = line.type === 'delete';

                      return (
                        <React.Fragment key={lIdx}>
                          <div
                            className={`flex items-stretch hover:bg-slate-900/40 transition-colors ${
                              isAdd
                                ? 'bg-emerald-950/20 text-emerald-200'
                                : isDel
                                ? 'bg-red-950/20 text-red-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {/* Line Numbers */}
                            <div className="w-12 py-0.5 pr-2 text-right select-none text-slate-600 bg-slate-950/60 border-r border-slate-900">
                              {line.oldLineNumber || ''}
                            </div>
                            <div className="w-12 py-0.5 pr-2 text-right select-none text-slate-600 bg-slate-950/60 border-r border-slate-800">
                              {line.newLineNumber || ''}
                            </div>

                            {/* Diff prefix */}
                            <div className="w-6 py-0.5 text-center select-none font-bold">
                              {isAdd ? '+' : isDel ? '-' : ' '}
                            </div>

                            {/* Code Line Content */}
                            <div className="flex-1 py-0.5 px-2 overflow-x-auto whitespace-pre">
                              {line.content}
                            </div>
                          </div>

                          {/* Inline Findings positioned directly under the offending line */}
                          {lineFindings && lineFindings.length > 0 && (
                            <div className="px-6 py-2 bg-slate-950/80 border-y border-red-900/40">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
