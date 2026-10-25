import {
  RecursiveCharacterTextSplitter,
  type SupportedTextSplitterLanguage,
} from '@langchain/textsplitters';

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Splits markdown documents (e.g. architecture guidelines, security rules) into semantic chunks.
 */
export async function splitMarkdownDocument(
  content: string,
  chunkSize = 1000,
  chunkOverlap = 150
): Promise<string[]> {
  const splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
    chunkSize,
    chunkOverlap,
  });

  const docs = await splitter.createDocuments([content]);
  return docs.map((d) => d.pageContent);
}

/**
 * Splits source code into language-aware semantic blocks (functions, classes, interfaces).
 */
export async function splitSourceCode(
  content: string,
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'generic',
  chunkSize = 1200,
  chunkOverlap = 200
): Promise<CodeChunk[]> {
  let langKey: SupportedTextSplitterLanguage = 'js';

  switch (language) {
    case 'typescript':
    case 'javascript':
      langKey = 'js';
      break;
    case 'python':
      langKey = 'python';
      break;
    case 'go':
      langKey = 'go';
      break;
    case 'rust':
      langKey = 'rust';
      break;
    default:
      langKey = 'js';
  }

  const splitter = RecursiveCharacterTextSplitter.fromLanguage(langKey, {
    chunkSize,
    chunkOverlap,
  });

  const docs = await splitter.createDocuments([content]);

  // Map chunk line boundaries
  const lines = content.split('\n');
  return docs.map((d) => {
    const chunkText = d.pageContent;
    const firstLineText = chunkText.split('\n')[0].trim();
    let startLine = 1;

    if (firstLineText) {
      const idx = lines.findIndex((l) => l.includes(firstLineText));
      if (idx !== -1) {
        startLine = idx + 1;
      }
    }

    const chunkLineCount = chunkText.split('\n').length;
    const endLine = startLine + chunkLineCount - 1;

    return {
      content: chunkText,
      startLine,
      endLine,
    };
  });
}
