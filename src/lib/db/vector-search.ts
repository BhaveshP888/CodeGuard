import { sql } from 'drizzle-orm';
import { db } from './index';
import { ruleEmbeddings, codebaseEmbeddings } from './schema';

export interface RuleSearchResult {
  id: string;
  ruleId: string;
  chunkContent: string;
  metadata: {
    category?: string;
    severity?: string;
    scopePattern?: string;
    ruleTitle?: string;
  };
  similarity: number;
}

export interface CodebaseSearchResult {
  id: string;
  filePath: string;
  symbolName: string | null;
  chunkContent: string;
  startLine: number;
  endLine: number;
  similarity: number;
}

/**
 * Searches for relevant architecture rules using pgvector cosine distance `<=>`.
 * Cosine similarity = 1 - (embedding <=> target_vector).
 */
export async function findRelevantRules(
  repositoryId: string,
  queryEmbedding: number[],
  limit = 5,
  minSimilarity = 0.5
): Promise<RuleSearchResult[]> {
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const results = await db.execute<{
    id: string;
    rule_id: string;
    chunk_content: string;
    metadata: string | Record<string, unknown>;
    similarity: number;
  }>(sql`
    SELECT 
      id,
      rule_id,
      chunk_content,
      metadata,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM ${ruleEmbeddings}
    WHERE repository_id = ${repositoryId}::uuid
      AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY embedding <=> ${vectorStr}::vector ASC
    LIMIT ${limit};
  `);

  return results.map((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    chunkContent: row.chunk_content,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
    similarity: Number(row.similarity),
  }));
}

/**
 * Searches for relevant codebase symbols/functions using pgvector cosine distance `<=>`.
 */
export async function findRelevantCodeSymbols(
  repositoryId: string,
  queryEmbedding: number[],
  limit = 5,
  minSimilarity = 0.6
): Promise<CodebaseSearchResult[]> {
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const results = await db.execute<{
    id: string;
    file_path: string;
    symbol_name: string | null;
    chunk_content: string;
    start_line: number;
    end_line: number;
    similarity: number;
  }>(sql`
    SELECT 
      id,
      file_path,
      symbol_name,
      chunk_content,
      start_line,
      end_line,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM ${codebaseEmbeddings}
    WHERE repository_id = ${repositoryId}::uuid
      AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY embedding <=> ${vectorStr}::vector ASC
    LIMIT ${limit};
  `);

  return results.map((row) => ({
    id: row.id,
    filePath: row.file_path,
    symbolName: row.symbol_name,
    chunkContent: row.chunk_content,
    startLine: Number(row.start_line),
    endLine: Number(row.end_line),
    similarity: Number(row.similarity),
  }));
}
