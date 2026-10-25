import { findRelevantRules, findRelevantCodeSymbols, type RuleSearchResult, type CodebaseSearchResult } from '../db/vector-search';
import { generateEmbedding } from '../ingestion/embedder';
import type { ParsedFileDiff } from '../github/diff-parser';

export interface FileRAGContext {
  filePath: string;
  matchedRules: RuleSearchResult[];
  relatedCodeSymbols: CodebaseSearchResult[];
}

export interface PRRAGContext {
  fileContexts: FileRAGContext[];
  assembledPromptContext: string;
}

/**
 * Builds semantic RAG context from pgvector for all changed files in a pull request.
 */
export async function buildPRRAGContext(
  repositoryId: string,
  files: ParsedFileDiff[]
): Promise<PRRAGContext> {
  const fileContexts: FileRAGContext[] = [];
  const promptSections: string[] = [];

  for (const file of files) {
    // Construct query from file path, touched symbols, and added line snippets
    const sampleAddedLines = file.hunks
      .flatMap((h) => h.lines)
      .filter((l) => l.type === 'add')
      .slice(0, 5)
      .map((l) => l.content)
      .join(' ');

    const queryText = `${file.newPath} ${file.touchedSymbols.join(' ')} ${sampleAddedLines}`.trim();
    if (!queryText) continue;

    try {
      const embedding = await generateEmbedding(queryText.slice(0, 1000));

      const [matchedRules, relatedCodeSymbols] = await Promise.all([
        findRelevantRules(repositoryId, embedding, 4, 0.45),
        findRelevantCodeSymbols(repositoryId, embedding, 3, 0.55),
      ]);

      fileContexts.push({
        filePath: file.newPath,
        matchedRules,
        relatedCodeSymbols,
      });

      // Format context block for the LLM
      if (matchedRules.length > 0 || relatedCodeSymbols.length > 0) {
        let section = `### Context for changed file: ${file.newPath}\n`;

        if (matchedRules.length > 0) {
          section += `\n**Team Architecture & Security Guidelines (MUST BE ENFORCED):**\n`;
          for (const rule of matchedRules) {
            section += `- [Rule: ${rule.metadata.ruleTitle || 'Guideline'}] (Severity: ${rule.metadata.severity || 'high'}, Category: ${rule.metadata.category || 'security'}):\n  "${rule.chunkContent.trim()}"\n`;
          }
        }

        if (relatedCodeSymbols.length > 0) {
          section += `\n**Existing Codebase References (Related Functions/Classes in Project):**\n`;
          for (const sym of relatedCodeSymbols) {
            section += `- File: ${sym.filePath} (Lines ${sym.startLine}-${sym.endLine}, Symbol: ${sym.symbolName || 'N/A'}):\n  \`\`\`\n  ${sym.chunkContent.trim()}\n  \`\`\`\n`;
          }
        }

        promptSections.push(section);
      }
    } catch (err) {
      console.warn(`RAG context generation failed for ${file.newPath}:`, err);
    }
  }

  const assembledPromptContext =
    promptSections.length > 0
      ? `## RELEVANT TEAM ARCHITECTURAL RULES & CODEBASE CONTEXT:\n\n${promptSections.join('\n---\n\n')}`
      : 'No specific custom architectural rules or related symbols found in vector database.';

  return {
    fileContexts,
    assembledPromptContext,
  };
}
