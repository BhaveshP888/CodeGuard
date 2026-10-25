'use client';

import React from 'react';
import { FileCode, FilePlus, FileMinus, ShieldAlert } from 'lucide-react';
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
  const fileFindingCounts = findings.reduce<Record<string, { total: number; critical: number }>>(
    (acc, f) => {
      if (!acc[f.filePath]) acc[f.filePath] = { total: 0, critical: 0 };
      acc[f.filePath].total++;
      if (f.severity === 'critical') acc[f.filePath].critical++;
      return acc;
    },
    {}
  );

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Changed Files ({files.length})
        </h3>
        {findings.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/40">
            <ShieldAlert className="w-3 h-3" />
            {findings.length} findings
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1 overflow-y-auto flex-1 pr-1">
        {files.map((file) => {
          const isActive = activeFilePath === file.newPath;
          const counts = fileFindingCounts[file.newPath];
          const fileName = file.newPath.split('/').pop() || file.newPath;
          const dirPath = file.newPath.split('/').slice(0, -1).join('/');

          return (
            <button
              key={file.newPath}
              onClick={() => onSelectFile(file.newPath)}
              className={`w-full text-left p-2.5 rounded-md transition-all flex items-start justify-between gap-2 text-xs ${
                isActive
                  ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                  : 'hover:bg-slate-900 text-slate-300'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {file.isNew ? (
                  <FilePlus className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : file.isDeleted ? (
                  <FileMinus className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <FileCode className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div className="truncate">
                  <div className="font-medium text-slate-200 truncate">{fileName}</div>
                  {dirPath && <div className="text-[10px] text-slate-500 truncate">{dirPath}</div>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                {counts && counts.total > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      counts.critical > 0
                        ? 'bg-red-500 text-white'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {counts.total}
                  </span>
                )}
                <span className="text-[10px] text-emerald-400 font-mono">+{file.addedLinesCount}</span>
                <span className="text-[10px] text-red-400 font-mono">-{file.deletedLinesCount}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
