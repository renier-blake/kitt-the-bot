/**
 * KITT Memory System - Text Chunking
 *
 * Token-aware text chunking with:
 * - Configurable chunk size and overlap
 * - Line number tracking for citations
 * - Hash-based change detection
 */

import type { TextChunk, ChunkingOptions } from './types.js';
import { hashText } from './utils.js';

// Approximate 4 characters per token (conservative estimate)
const CHARS_PER_TOKEN = 4;

/**
 * Chunk text into overlapping segments
 */
export function chunkText(
  content: string,
  options: ChunkingOptions = {}
): TextChunk[] {
  const { tokens = 400, overlap = 80 } = options;

  const maxChars = Math.max(32, tokens * CHARS_PER_TOKEN);
  const overlapChars = overlap * CHARS_PER_TOKEN;

  // Handle empty or very short content
  if (!content || content.trim().length === 0) {
    return [];
  }

  // If content fits in one chunk, return it directly
  if (content.length <= maxChars) {
    return [
      {
        content: content.trim(),
        hash: hashText(content),
        startLine: 1,
        endLine: content.split('\n').length,
      },
    ];
  }

  const lines = content.split('\n');
  const chunks: TextChunk[] = [];

  let currentLines: string[] = [];
  let currentChars = 0;
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineChars = line.length + 1; // +1 for newline

    // Check if adding this line would exceed max chars
    if (currentChars + lineChars > maxChars && currentLines.length > 0) {
      // Flush current chunk
      const chunkContent = currentLines.join('\n').trim();
      if (chunkContent.length > 0) {
        chunks.push({
          content: chunkContent,
          hash: hashText(chunkContent),
          startLine,
          endLine: startLine + currentLines.length - 1,
        });
      }

      // Calculate overlap lines from end of current chunk
      const overlapLines = getOverlapLines(currentLines, overlapChars);
      const overlapLineCount = overlapLines.length;

      // Start new chunk with overlap
      currentLines = overlapLines;
      currentChars = currentLines.join('\n').length;
      startLine = i + 1 - overlapLineCount;
    }

    // Handle very long lines by splitting them
    if (line.length > maxChars) {
      const lineParts = splitLongLine(line, maxChars);
      for (const part of lineParts) {
        if (currentChars + part.length > maxChars && currentLines.length > 0) {
          // Flush current chunk
          const chunkContent = currentLines.join('\n').trim();
          if (chunkContent.length > 0) {
            chunks.push({
              content: chunkContent,
              hash: hashText(chunkContent),
              startLine,
              endLine: i + 1,
            });
          }

          currentLines = [];
          currentChars = 0;
          startLine = i + 1;
        }

        currentLines.push(part);
        currentChars += part.length + 1;
      }
    } else {
      currentLines.push(line);
      currentChars += lineChars;
    }
  }

  // Flush remaining content
  if (currentLines.length > 0) {
    const chunkContent = currentLines.join('\n').trim();
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        hash: hashText(chunkContent),
        startLine,
        endLine: startLine + currentLines.length - 1,
      });
    }
  }

  return chunks;
}

/**
 * Get lines from end of array that fit within overlap budget
 */
function getOverlapLines(lines: string[], overlapChars: number): string[] {
  if (lines.length === 0 || overlapChars <= 0) {
    return [];
  }

  const result: string[] = [];
  let chars = 0;

  // Work backwards from the end
  for (let i = lines.length - 1; i >= 0; i--) {
    const lineChars = lines[i].length + 1;

    if (chars + lineChars > overlapChars && result.length > 0) {
      break;
    }

    result.unshift(lines[i]);
    chars += lineChars;
  }

  return result;
}

/**
 * Split a very long line into smaller parts
 */
function splitLongLine(line: string, maxChars: number): string[] {
  const parts: string[] = [];

  // Try to split at word boundaries
  let remaining = line;
  while (remaining.length > maxChars) {
    // Find last space within limit
    let splitIndex = remaining.lastIndexOf(' ', maxChars);

    // If no space found, force split at maxChars
    if (splitIndex <= 0) {
      splitIndex = maxChars;
    }

    parts.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}

/**
 * Merge small chunks together if they're below a minimum size
 * (Optional optimization to reduce embedding API calls)
 */
export function mergeSmallChunks(
  chunks: TextChunk[],
  minChars = 100
): TextChunk[] {
  if (chunks.length <= 1) {
    return chunks;
  }

  const result: TextChunk[] = [];
  let pending: TextChunk | null = null;

  for (const chunk of chunks) {
    if (pending === null) {
      if (chunk.content.length < minChars) {
        pending = chunk;
      } else {
        result.push(chunk);
      }
      continue;
    }

    // Merge pending with current
    const merged: TextChunk = {
      content: pending.content + '\n\n' + chunk.content,
      hash: hashText(pending.content + '\n\n' + chunk.content),
      startLine: pending.startLine,
      endLine: chunk.endLine,
    };

    if (merged.content.length < minChars) {
      pending = merged;
    } else {
      result.push(merged);
      pending = null;
    }
  }

  // Push any remaining pending chunk
  if (pending !== null) {
    result.push(pending);
  }

  return result;
}
