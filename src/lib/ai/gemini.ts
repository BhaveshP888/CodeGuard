import { GoogleGenAI } from '@google/genai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

/**
 * Official Google GenAI SDK v2 client.
 * Configured per the gemini-api-dev specifications.
 */
export const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
});

/**
 * Current primary model for CodeGuard AI code audit:
 * gemini-3.8-flash (1M tokens context, fast, balanced performance for agentic and coding tasks)
 * Note: gemini-2.5, gemini-2.0, and gemini-1.5 models are deprecated.
 */
export const reviewModel = google('gemini-3.8-flash');

export const ReviewFindingSchema = z.object({
  filePath: z.string().describe('Relative file path matching the diff'),
  lineNumber: z.number().int().describe('Line number in the newly added or modified file'),
  category: z.enum(['security', 'architecture', 'performance', 'style']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string().describe('Concise headline of the finding'),
  message: z.string().describe('Detailed explanation of why this violates architectural or security guidelines'),
  ruleCited: z.string().optional().describe('Title of the uploaded team guideline rule cited'),
  suggestedPatch: z
    .string()
    .optional()
    .describe('Concrete replacement code block suitable for a GitHub suggestion block'),
});

export const ReviewReportSchema = z.object({
  summary: z.string().describe('Executive summary of the pull request changes and architectural compliance'),
  riskScore: z.number().int().min(0).max(100).describe('Overall risk score (0 = pristine, 100 = critical threat)'),
  findings: z.array(ReviewFindingSchema),
});

export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;

/**
 * Direct call using the official @google/genai SDK Interactions API
 */
export async function auditWithGeminiInteraction(prompt: string): Promise<string | null> {
  const interaction = await genAI.interactions.create({
    model: 'gemini-3.8-flash',
    input: prompt,
  });

  return interaction.output_text ?? null;
}
