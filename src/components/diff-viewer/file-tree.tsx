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
    <aside className="w-72 border-r border-[#182335] bg-[#090d16] p-3 flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between pb-2.5 border-b border-[#182335]">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#94a7c6]">
          Files Changed ({files.length})
        </span>
        {findings.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-900/60 font-bold">
            <ShieldAlert className="w-3 h-3" />
            {findings.length}
          </span>
        )}
      </div>

      <div className="mt-2.5 space-y-1 overflow-y-auto flex-1 pr-1">
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
              className={`w-full text-left p-2 rounded transition-all flex items-start justify-between gap-2 text-xs ${
                isActive
                  ? 'bg-[#162237] text-white border border-[#2563eb]/50 font-medium'
                  : 'hover:bg-[#111a2a] text-[#94a7c6] border border-transparent'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {file.isNew ? (
                  <FilePlus className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : file.isDeleted ? (
                  <FileMinus className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <FileCode className="w-4 h-4 text-[#5e7394] shrink-0 mt-0.5" />
                )}
                <div className="truncate">
                  <div className="text-xs text-[#f0f4fc] truncate">{fileName}</div>
                  {dirPath && <div className="text-[10px] text-[#5e7394] font-mono truncate">{dirPath}</div>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pt-0.5 font-mono">
                {counts && counts.total > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      counts.critical > 0
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-600/30 text-amber-300 border border-amber-600/50'
                    }`}
                  >
                    {counts.total}
                  </span>
                )}
                <span className="text-[10px] text-emerald-400">+{file.addedLinesCount}</span>
                <span className="text-[10px] text-red-400">-{file.deletedLinesCount}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
