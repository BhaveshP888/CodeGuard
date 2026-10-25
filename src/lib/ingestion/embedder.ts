import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';

export const embeddingModel = google.textEmbeddingModel('text-embedding-004');

/**
 * Generates a 768-dimension embedding vector for a single string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Cannot embed empty text');
  }

  const { embedding } = await embed({
    model: embeddingModel,
    value: cleanText,
  });

  return embedding;
}

/**
 * Generates 768-dimension embeddings for multiple chunks in batch.
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const filtered = texts.map((t) => t.trim()).filter(Boolean);
  if (filtered.length === 0) {
    return [];
  }

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: filtered,
  });

  return embeddings;
}
