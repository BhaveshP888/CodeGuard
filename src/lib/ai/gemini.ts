import { GoogleGenAI } from '@google/genai';
import { createGoogle } from '@ai-sdk/google';
import { z } from 'zod';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

/**
 * Official Google GenAI SDK v2 client.
 */
export const genAI = new GoogleGenAI({
  apiKey,
});

/**
 * Vercel AI SDK Google provider configured with GEMINI_API_KEY.
 */
export const googleProvider = createGoogle({
  apiKey,
});

/**
 * Primary model for CodeGuard AI code audit per /gemini-api-dev:
 * - gemini-3.8-flash: 1M tokens, balanced speed and agentic code reasoning
 * - gemini-3.5-flash-lite: fastest, lowest-cost high-throughput execution fallback
 */
export const ACTIVE_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const reviewModel = googleProvider(ACTIVE_GEMINI_MODEL);

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
  sequenceDiagram: z
    .string()
    .optional()
    .describe(
      'A valid Mermaid.js sequenceDiagram showing the architectural interaction flow of the touched components/APIs/database (e.g. starting with "sequenceDiagram\\nautonumber\\n..."). Keep node names alphanumeric without special characters or quotes.'
    ),
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
