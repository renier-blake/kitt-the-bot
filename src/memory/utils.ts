/**
 * KITT Memory System - Utility Functions
 */

import { createHash, randomUUID } from 'node:crypto';

/**
 * Generate a SHA-256 hash of text content
 * Used for change detection in chunks
 */
export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date as ISO 8601 string
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Parse timestamp from milliseconds to Date
 */
export function parseTimestamp(ms: number): Date {
  return new Date(ms);
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Create a snippet from content (first ~200 chars, clean breaks)
 */
export function createSnippet(content: string, maxLength = 200): string {
  if (content.length <= maxLength) return content;

  // Try to break at word boundary
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Normalize path to use forward slashes
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Convert embedding array to Buffer for sqlite-vec
 */
export function embeddingToBuffer(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

/**
 * Convert Buffer back to embedding array
 */
export function bufferToEmbedding(buffer: Buffer): number[] {
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.length / 4
  );
  return Array.from(float32);
}

/**
 * Cosine similarity between two Float32Arrays
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal)
 * For L2-normalized vectors this simplifies to dot product,
 * but we compute full formula for safety.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Convert BM25 rank to normalized score (0-1)
 * FTS5 rank is typically negative, lower is better
 *
 * Old formula: 1/(1+|rank|) — too conservative, typical ranks -5 to -25
 * gave scores 0.04-0.17 which barely contributed to the hybrid score.
 * New formula: sigmoid-style that maps typical BM25 ranges to 0.3-0.9
 */
export function bm25RankToScore(rank: number): number {
  // FTS5 returns negative values where more negative = better match
  const absRank = Number.isFinite(rank) ? Math.abs(rank) : 0;
  // Sigmoid-style: maps rank 1->0.33, 5->0.71, 10->0.83, 25->0.93
  return absRank / (absRank + 3);
}

/**
 * Convert cosine distance to similarity score (0-1)
 * Distance 0 = identical, Distance 2 = opposite
 */
export function distanceToScore(distance: number): number {
  return Math.max(0, 1 - distance);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      if (!shouldRetry(lastError) || attempt === maxAttempts - 1) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt) * (1 + Math.random() * 0.1)
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
