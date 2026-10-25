import { genAI } from '../ai/gemini';
import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';

/**
 * Current text embedding model:
 * gemini-embedding-001 (Recommended dimension: 768)
 */
export const EMBEDDING_MODEL_NAME = 'gemini-embedding-001';

/**
 * Generates a 768-dimension embedding vector for a single string using @google/genai.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Cannot embed empty text');
  }

  try {
    // 1. Primary: Use official @google/genai SDK
    const response = await genAI.models.embedContent({
      model: EMBEDDING_MODEL_NAME,
      contents: cleanText,
    });

    if (response.embeddings?.[0]?.values) {
      return response.embeddings[0].values;
    }
  } catch (err) {
    console.warn(`@google/genai embedContent fallback to Vercel AI SDK:`, err);
  }

  // 2. Fallback via Vercel AI SDK
  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
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

  const results: number[][] = [];

  for (const text of filtered) {
    const vector = await generateEmbedding(text);
    results.push(vector);
  }

  return results;
}
