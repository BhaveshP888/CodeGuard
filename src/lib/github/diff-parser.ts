export interface DiffLine {
  type: 'add' | 'delete' | 'normal';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface ParsedFileDiff {
  oldPath: string;
  newPath: string;
  isNew: boolean;
  isDeleted: boolean;
  isModified: boolean;
  hunks: DiffHunk[];
  addedLinesCount: number;
  deletedLinesCount: number;
  touchedSymbols: string[];
}

/**
 * Parses raw unified diff string (e.g. from GitHub PR diff endpoint) into structured hunks.
 */
export function parseUnifiedDiff(rawDiff: string): ParsedFileDiff[] {
  if (!rawDiff || !rawDiff.trim()) {
    return [];
  }

  const files: ParsedFileDiff[] = [];
  const fileBlocks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const block of fileBlocks) {
    const lines = block.split('\n');
    const headerLine = lines[0]; // e.g. "a/src/auth.ts b/src/auth.ts"

    let oldPath = '';
    let newPath = '';

    const pathsMatch = headerLine.match(/a\/(.*?)\s+b\/(.*)/);
    if (pathsMatch) {
      oldPath = pathsMatch[1];
      newPath = pathsMatch[2];
    }

    let isNew = false;
    let isDeleted = false;
    let isModified = true;

    if (block.includes('new file mode')) {
      isNew = true;
      isModified = false;
    } else if (block.includes('deleted file mode')) {
      isDeleted = true;
      isModified = false;
    }

    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let currentOldLine = 0;
    let currentNewLine = 0;
    let addedCount = 0;
    let deletedCount = 0;
    const touchedSymbolsSet = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Hunk header: @@ -10,5 +10,8 @@ function verify()
      if (line.startsWith('@@')) {
        const hunkMatch = line.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)/);
        if (hunkMatch) {
          const oldStart = parseInt(hunkMatch[1], 10);
          const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
          const newStart = parseInt(hunkMatch[3], 10);
          const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;
          const extraHeader = hunkMatch[5]?.trim() || '';

          if (extraHeader) {
            const symMatch = extraHeader.match(/(?:function|class|interface|type|const|let)\s+([a-zA-Z0-9_$]+)/);
            if (symMatch?.[1]) {
              touchedSymbolsSet.add(symMatch[1]);
            }
          }

          currentHunk = {
            header: line,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: [],
          };
          hunks.push(currentHunk);
          currentOldLine = oldStart;
          currentNewLine = newStart;
          continue;
        }
      }

      if (!currentHunk) continue;

      if (line.startsWith('+')) {
        addedCount++;
        const content = line.slice(1);
        currentHunk.lines.push({
          type: 'add',
          content,
          newLineNumber: currentNewLine,
        });

        // Extract identifier definitions
        const symMatch = content.match(/(?:function|class|interface|type|const|let|def|func)\s+([a-zA-Z0-9_$]+)/);
        if (symMatch?.[1]) {
          touchedSymbolsSet.add(symMatch[1]);
        }

        currentNewLine++;
      } else if (line.startsWith('-')) {
        deletedCount++;
        currentHunk.lines.push({
          type: 'delete',
          content: line.slice(1),
          oldLineNumber: currentOldLine,
        });
        currentOldLine++;
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'normal',
          content: line.startsWith(' ') ? line.slice(1) : line,
          oldLineNumber: currentOldLine,
          newLineNumber: currentNewLine,
        });
        currentOldLine++;
        currentNewLine++;
      }
    }

    if (!newPath && oldPath) newPath = oldPath;
    if (!oldPath && newPath) oldPath = newPath;

    files.push({
      oldPath,
      newPath,
      isNew,
      isDeleted,
      isModified,
      hunks,
      addedLinesCount: addedCount,
      deletedLinesCount: deletedCount,
      touchedSymbols: Array.from(touchedSymbolsSet),
    });
  }

  return files;
}
