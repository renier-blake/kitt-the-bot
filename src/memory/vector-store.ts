/**
 * KITT Memory System - Dedicated Vector Store
 *
 * Stores embeddings in a separate SQLite file (vectors.db) with in-memory
 * cosine similarity search. Replaces the bloated libsql vector index that
 * inflated kitt.db from ~40MB to 1.8GB.
 *
 * Design:
 * - Plain BLOB column (no F32_BLOB, no vector index)
 * - All vectors loaded into Map<string, Float32Array> on startup
 * - Brute-force cosine similarity (sub-ms at <10k vectors)
 * - Write-through: every store() writes to disk + updates Map
 */

import { createClient, type Client } from '@libsql/client';
import { cosineSimilarity, embeddingToBuffer, bufferToEmbedding } from './utils.js';

export interface VectorSearchResult {
  chunkId: string;
  score: number; // cosine similarity (0-1)
}

export class VectorStore {
  private db: Client | null = null;
  private vectors: Map<string, Float32Array> = new Map();
  private dbPath: string;
  private dimensions: number;
  private loaded = false;

  constructor(dbPath: string, dimensions: number) {
    this.dbPath = dbPath;
    this.dimensions = dimensions;
  }

  /**
   * Initialize: create/open vectors.db and load all vectors into memory
   */
  async initialize(): Promise<{ count: number; memoryMB: number }> {
    this.db = createClient({ url: `file:${this.dbPath}` });

    // Create schema
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS vectors (
        chunk_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        dimensions INTEGER NOT NULL,
        model TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Load all vectors into memory
    const result = await this.db.execute('SELECT chunk_id, embedding FROM vectors');

    for (const row of result.rows) {
      const chunkId = String(row.chunk_id);
      const blob = row.embedding as ArrayBuffer;
      const float32 = new Float32Array(blob);
      this.vectors.set(chunkId, float32);
    }

    this.loaded = true;
    const memoryMB = Math.round((this.vectors.size * this.dimensions * 4) / 1024 / 1024 * 10) / 10;

    console.log(`[vector-store] Loaded ${this.vectors.size} vectors (${memoryMB}MB) from ${this.dbPath}`);

    return { count: this.vectors.size, memoryMB };
  }

  /**
   * Store a single vector (write-through: disk + memory)
   */
  async store(chunkId: string, embedding: number[], model: string): Promise<void> {
    if (!this.db) throw new Error('VectorStore not initialized');

    const buffer = embeddingToBuffer(embedding);
    const float32 = new Float32Array(embedding);

    await this.db.execute({
      sql: `INSERT OR REPLACE INTO vectors (chunk_id, embedding, dimensions, model, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [chunkId, buffer, embedding.length, model, Date.now()],
    });

    this.vectors.set(chunkId, float32);
  }

  /**
   * Store multiple vectors in a batch
   */
  async storeBatch(entries: Array<{ chunkId: string; embedding: number[]; model: string }>): Promise<void> {
    if (!this.db) throw new Error('VectorStore not initialized');

    const batch = entries.map((entry) => ({
      sql: `INSERT OR REPLACE INTO vectors (chunk_id, embedding, dimensions, model, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        entry.chunkId,
        embeddingToBuffer(entry.embedding),
        entry.embedding.length,
        entry.model,
        Date.now(),
      ] as any[],
    }));

    await this.db.batch(batch);

    // Update in-memory map
    for (const entry of entries) {
      this.vectors.set(entry.chunkId, new Float32Array(entry.embedding));
    }
  }

  /**
   * Delete a single vector
   */
  async delete(chunkId: string): Promise<void> {
    if (!this.db) throw new Error('VectorStore not initialized');

    await this.db.execute({
      sql: 'DELETE FROM vectors WHERE chunk_id = ?',
      args: [chunkId],
    });

    this.vectors.delete(chunkId);
  }

  /**
   * Delete multiple vectors by chunk IDs
   */
  async deleteByChunkIds(chunkIds: string[]): Promise<void> {
    if (!this.db || chunkIds.length === 0) return;

    const placeholders = chunkIds.map(() => '?').join(', ');
    await this.db.execute({
      sql: `DELETE FROM vectors WHERE chunk_id IN (${placeholders})`,
      args: chunkIds,
    });

    for (const id of chunkIds) {
      this.vectors.delete(id);
    }
  }

  /**
   * Search for nearest vectors using in-memory cosine similarity
   * Returns results sorted by score (highest first)
   */
  search(queryEmbedding: number[], limit: number): VectorSearchResult[] {
    if (this.vectors.size === 0) return [];

    const query = new Float32Array(queryEmbedding);
    const results: VectorSearchResult[] = [];

    for (const [chunkId, embedding] of this.vectors) {
      const score = cosineSimilarity(query, embedding);
      results.push({ chunkId, score });
    }

    // Sort by score descending, return top N
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /** Get count of stored vectors */
  count(): number {
    return this.vectors.size;
  }

  /** Check if a chunk has a stored vector */
  has(chunkId: string): boolean {
    return this.vectors.has(chunkId);
  }

  /** Check if the store is loaded and ready */
  isReady(): boolean {
    return this.loaded;
  }

  /** Close the store */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.vectors.clear();
    this.loaded = false;
  }
}
