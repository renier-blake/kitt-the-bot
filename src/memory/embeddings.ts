/**
 * KITT Memory System - Embedding Service
 *
 * Wrapper for OpenAI's embedding API with:
 * - Single and batch embedding
 * - Retry logic with exponential backoff
 * - Rate limit handling
 */

import { withRetry, sleep } from './utils.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const MAX_BATCH_SIZE = 100; // OpenAI limit
const MAX_TOKENS_PER_BATCH = 8000; // Conservative token budget

export class EmbeddingService {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'text-embedding-3-large') {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for embeddings');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Embed a single text query
   * Truncates if text exceeds token limit
   */
  async embedQuery(text: string): Promise<number[]> {
    // Truncate to ~8000 tokens (~32000 chars) to stay within OpenAI limit
    const maxChars = 30000;
    const truncated = text.length > maxChars ? text.slice(0, maxChars) : text;
    const [embedding] = await this.embedBatch([truncated]);
    return embedding ?? [];
  }

  /**
   * Embed multiple texts in a batch
   * Automatically splits into sub-batches if needed
   * Truncates individual texts that exceed token limit
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Truncate and filter empty texts
    const maxChars = 30000; // ~8000 tokens
    const validTexts = texts
      .map((t) => (t.length > maxChars ? t.slice(0, maxChars) : t))
      .filter((t) => t.trim().length > 0);
    if (validTexts.length === 0) {
      return texts.map(() => []);
    }

    // Split into sub-batches based on token budget
    const batches = this.splitIntoBatches(validTexts);
    const results: number[][] = [];

    for (const batch of batches) {
      const batchResults = await this.embedBatchDirect(batch);
      results.push(...batchResults);
    }

    // Map results back to original indices (handle filtered empty texts)
    const mappedResults: number[][] = [];
    let resultIndex = 0;

    for (let i = 0; i < texts.length; i++) {
      if (texts[i].trim().length > 0) {
        mappedResults.push(results[resultIndex++] ?? []);
      } else {
        mappedResults.push([]);
      }
    }

    return mappedResults;
  }

  /**
   * Split texts into batches based on token budget
   */
  private splitIntoBatches(texts: string[]): string[][] {
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentTokens = 0;

    for (const text of texts) {
      const estimatedTokens = this.estimateTokens(text);

      // Start new batch if current would exceed limits
      if (
        currentBatch.length >= MAX_BATCH_SIZE ||
        (currentTokens + estimatedTokens > MAX_TOKENS_PER_BATCH &&
          currentBatch.length > 0)
      ) {
        batches.push(currentBatch);
        currentBatch = [];
        currentTokens = 0;
      }

      currentBatch.push(text);
      currentTokens += estimatedTokens;
    }

    // Push remaining batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Estimate token count for text (conservative: ~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Make direct API call for a batch with retry
   */
  private async embedBatchDirect(texts: string[]): Promise<number[][]> {
    return withRetry(
      async () => {
        const response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: texts,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            if (retryAfter) {
              await sleep(parseInt(retryAfter, 10) * 1000);
            }
            throw new Error(`Rate limited: ${response.status}`);
          }

          // Don't retry auth errors
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              `Authentication failed: ${response.status} ${errorText}`
            );
          }

          throw new Error(
            `Embedding request failed: ${response.status} ${errorText}`
          );
        }

        const data = (await response.json()) as {
          data: Array<{ embedding: number[]; index: number }>;
          usage?: { total_tokens: number };
        };

        // Sort by index to ensure correct order
        const sorted = data.data.sort((a, b) => a.index - b.index);
        return sorted.map((item) => this.normalizeEmbedding(item.embedding));
      },
      {
        maxAttempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 8000,
        shouldRetry: (error) => {
          // Don't retry auth errors
          if (
            error.message.includes('401') ||
            error.message.includes('403') ||
            error.message.includes('Authentication')
          ) {
            return false;
          }
          // Retry rate limits and server errors
          return (
            error.message.includes('429') ||
            error.message.includes('5') ||
            error.message.includes('Rate')
          );
        },
      }
    );
  }

  /**
   * Normalize embedding vector (L2 normalization)
   * Also sanitizes NaN/Infinity values
   */
  private normalizeEmbedding(embedding: number[]): number[] {
    // Sanitize values
    const sanitized = embedding.map((v) =>
      Number.isFinite(v) ? v : 0
    );

    // Calculate L2 norm
    const norm = Math.sqrt(
      sanitized.reduce((sum, v) => sum + v * v, 0)
    );

    // Normalize if norm is non-zero
    if (norm > 0) {
      return sanitized.map((v) => v / norm);
    }

    return sanitized;
  }
}
