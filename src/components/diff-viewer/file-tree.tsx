'use client';

import React from 'react';
import { FileCode, FilePlus, FileMinus, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { ParsedFileDiff } from '@/lib/github/diff-parser';
import type { InlineFinding } from './inline-finding-card';

interface FileTreeProps {
  files: ParsedFileDiff[];
  activeFilePath: string | null;
  onSelectFile: (filePath: string) => void;
  findings: InlineFinding[];
}

export function FileTree({
  files,
  activeFilePath,
  onSelectFile,
  findings,
}: FileTreeProps) {
  // Count findings per file
  const fileFindingCounts = findings.reduce<
    Record<string, { total: number; critical: number; high: number }>
  >((acc, f) => {
    if (!acc[f.filePath]) acc[f.filePath] = { total: 0, critical: 0, high: 0 };
    acc[f.filePath].total++;
    if (f.severity === 'critical') acc[f.filePath].critical++;
    if (f.severity === 'high') acc[f.filePath].high++;
    return acc;
  }, {});

  return (
    <aside className="w-64 border-r border-[#1a2333] bg-[#090d16] p-3 flex flex-col h-full shrink-0 select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#1a2333] px-1">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Files Changed ({files.length})
        </span>
        {findings.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-semibold">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            {findings.length}
          </span>
        )}
      </div>

      {/* File List */}
      <div className="mt-2 space-y-1 overflow-y-auto flex-1 pr-1">
        {files.map((file) => {
          const isActive = activeFilePath === file.newPath;
          const counts = fileFindingCounts[file.newPath];
          const parts = file.newPath.split('/');
          const fileName = parts.pop() || file.newPath;
          const dirPath = parts.join('/');

          return (
            <button
              key={file.newPath}
              onClick={() => onSelectFile(file.newPath)}
              className={`w-full text-left p-2 rounded-lg transition-all flex items-start justify-between gap-2 text-xs group ${
                isActive
                  ? 'bg-blue-600/15 text-white border border-blue-500/40 font-medium'
                  : 'hover:bg-white/[0.04] text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {file.isNew ? (
                  <FilePlus className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : file.isDeleted ? (
                  <FileMinus className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <FileCode
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'
                    }`}
                  />
                )}
                <div className="truncate">
                  <div
                    className={`text-xs truncate ${
                      isActive ? 'text-white font-medium' : 'text-slate-300'
                    }`}
                  >
                    {fileName}
                  </div>
                  {dirPath && (
                    <div className="text-[10px] text-slate-500 font-mono truncate">{dirPath}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pt-0.5 font-mono text-[10px]">
                {counts && counts.total > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold ${
                      counts.critical > 0
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                    title={`${counts.total} findings (${counts.critical} critical)`}
                  >
                    {counts.total}
                  </span>
                )}
                <span className="text-emerald-400">+{file.addedLinesCount}</span>
                <span className="text-rose-400">-{file.deletedLinesCount}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
