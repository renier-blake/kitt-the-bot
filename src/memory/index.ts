/**
 * KITT Memory System - Main Service
 *
 * Two-layer memory system:
 * 1. Working Memory (MEMORY.md) - always in context
 * 2. Long-term Memory (libSQL) - searchable transcripts with vector search
 */

import type { Client } from '@libsql/client';
import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  MemoryConfig,
  StoreMessageParams,
  SearchOptions,
  SearchResult,
  TranscriptSearchOptions,
  TranscriptSearchResult,
  TranscriptTimeframe,
  TranscriptType,
  Channel,
  Role,
} from './types.js';
import {
  initializeDatabase,
  closeDatabase,
  type DatabaseStatus,
} from './schema.js';
import { generateId, now, formatDate } from './utils.js';

// Default configuration
const DEFAULT_CONFIG: MemoryConfig = {
  dbPath: './profile/memory/kitt.db',
  memoryPath: './profile/memory/MEMORY.md',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  embeddingModel: 'text-embedding-3-large',
  embeddingDimensions: 3072,
  chunkTokens: 400,
  chunkOverlap: 80,
  vectorWeight: 0.7,
  textWeight: 0.3,
};

export class MemoryService {
  private db: Client | null = null;
  private config: MemoryConfig;
  private status: DatabaseStatus | null = null;
  private initialized = false;

  // Background indexing queue
  private indexQueue: Set<string> = new Set();
  private indexTimer: NodeJS.Timeout | null = null;

  // Lazy-loaded services (initialized on first use)
  private _embedder: any = null;
  private _searcher: any = null;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Override from environment variables if set
    if (process.env.KITT_MEMORY_DB) {
      this.config.dbPath = process.env.KITT_MEMORY_DB;
    }
    if (process.env.OPENAI_API_KEY) {
      this.config.openaiApiKey = process.env.OPENAI_API_KEY;
    }
  }

  /**
   * Initialize the memory service
   * Must be called before using any methods
   */
  async initialize(): Promise<DatabaseStatus> {
    if (this.initialized && this.status) {
      return this.status;
    }

    const { db, status } = await initializeDatabase(this.config.dbPath, {
      vectorDimensions: this.config.embeddingDimensions,
    });

    this.db = db;
    this.status = status;
    this.initialized = true;

    // Log status
    if (status.errors.length > 0) {
      console.warn('[memory] Initialization warnings:', status.errors);
    }

    console.log('[memory] Initialized:', {
      fts: status.ftsAvailable,
      vector: status.vectorAvailable,
      dimensions: status.vectorDimensions,
    });

    return status;
  }

  /**
   * Close the memory service
   */
  async close(): Promise<void> {
    // Clear any pending index timer
    if (this.indexTimer) {
      clearTimeout(this.indexTimer);
      this.indexTimer = null;
    }

    // Process remaining queue
    if (this.indexQueue.size > 0) {
      await this.processIndexQueue();
    }

    // Close database
    if (this.db) {
      closeDatabase(this.db);
      this.db = null;
    }

    this.initialized = false;
  }

  /**
   * Get database status
   */
  getStatus(): DatabaseStatus | null {
    return this.status;
  }

  /**
   * Get the database client (for search module)
   */
  getDb(): Client | null {
    return this.db;
  }

  // ==========================================
  // Transcript Storage
  // ==========================================

  /**
   * Store a message in the transcript database
   * Returns the transcript ID
   *
   * @param params.role - 'kitt' or 'user' (not 'assistant')
   * @param params.type - 'message' (default), 'thought', or 'task'
   * @param params.taskId - For type='task': FK to kitt_tasks.id
   * @param params.taskStatus - For type='task': 'reminder', 'completed', 'skipped', 'deferred'
   */
  async storeMessage(params: StoreMessageParams): Promise<string> {
    await this.ensureInitialized();

    const id = generateId();
    const timestamp = now();

    await this.db!.execute({
      sql: `INSERT INTO transcripts (id, session_id, channel, role, type, content, task_id, task_status, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        params.sessionId,
        params.channel,
        params.role,
        params.type || 'message',
        params.content,
        params.taskId ?? null,
        params.taskStatus ?? null,
        JSON.stringify(params.metadata ?? {}),
        timestamp,
      ],
    });

    // Schedule background indexing (non-blocking) - but not for task logs
    if (params.type !== 'task') {
      this.scheduleIndexing(id);
    }

    return id;
  }

  // ==========================================
  // Search (hybrid: vector + keyword)
  // ==========================================

  /**
   * Search memory using hybrid search (vector + keyword)
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    await this.ensureInitialized();

    // Import search module lazily
    if (!this._searcher) {
      const { hybridSearch } = await import('./search.js');
      this._searcher = hybridSearch;
    }

    // Import embeddings module lazily
    if (!this._embedder) {
      const { EmbeddingService } = await import('./embeddings.js');
      this._embedder = new EmbeddingService(
        this.config.openaiApiKey,
        this.config.embeddingModel
      );
    }

    // Get query embedding
    const queryEmbedding = await this._embedder.embedQuery(query);

    // Run hybrid search
    return this._searcher({
      db: this.db!,
      query,
      queryEmbedding,
      maxResults: options.maxResults ?? 10,
      minScore: options.minScore ?? 0.3,
      vectorWeight: this.config.vectorWeight,
      textWeight: this.config.textWeight,
      sources: options.sources,
      vectorAvailable: this.status?.vectorAvailable ?? false,
      ftsAvailable: this.status?.ftsAvailable ?? false,
    });
  }

  // ==========================================
  // Transcript Search (direct DB query)
  // ==========================================

  /**
   * Search transcripts with flexible timeframe and filters
   * This searches the raw transcripts table (not chunks)
   * Useful for: "wat bespraken we vorige week?", "heb ik hem al herinnerd?"
   */
  async searchTranscripts(
    options: TranscriptSearchOptions = {}
  ): Promise<TranscriptSearchResult[]> {
    await this.ensureInitialized();

    const {
      query,
      timeframe = 'today',
      roles,
      channels,
      limit = 20,
    } = options;

    // Calculate start date based on timeframe
    const startDate = this.getTimeframeStart(timeframe);

    // Build WHERE clauses
    const whereClauses: string[] = [];
    const args: (string | number)[] = [];

    // Timeframe filter
    if (startDate) {
      whereClauses.push('created_at >= ?');
      args.push(startDate);
    }

    // Role filter
    if (roles && roles.length > 0) {
      const placeholders = roles.map(() => '?').join(', ');
      whereClauses.push(`role IN (${placeholders})`);
      args.push(...roles);
    }

    // Channel filter
    if (channels && channels.length > 0) {
      const placeholders = channels.map(() => '?').join(', ');
      whereClauses.push(`channel IN (${placeholders})`);
      args.push(...channels);
    }

    // Query filter (LIKE search)
    if (query && query.trim()) {
      whereClauses.push('content LIKE ?');
      args.push(`%${query.trim()}%`);
    }

    // Build SQL
    // F53: Include type column
    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const sql = `
      SELECT id, session_id, channel, role, type, content, created_at
      FROM transcripts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `;
    args.push(limit);

    // Execute query
    const result = await this.db!.execute({ sql, args });

    // Map to results
    // F53: Include type in result
    return result.rows.map((row) => {
      const content = String(row.content);
      return {
        id: String(row.id),
        sessionId: String(row.session_id),
        channel: String(row.channel) as Channel,
        role: String(row.role) as Role,
        type: (String(row.type || 'message')) as TranscriptType,
        content,
        snippet: content.length > 150 ? content.slice(0, 150) + '...' : content,
        createdAt: new Date(Number(row.created_at)),
      };
    });
  }

  /**
   * Get start timestamp for timeframe
   */
  private getTimeframeStart(timeframe: TranscriptTimeframe): number | null {
    const now = new Date();

    switch (timeframe) {
      case 'today': {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
      }
      case 'week': {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
      }
      case 'month': {
        const start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
      }
      case 'all':
        return null;
      default:
        return null;
    }
  }

  // ==========================================
  // Working Memory (MEMORY.md)
  // ==========================================

  /**
   * Read the current working memory (MEMORY.md)
   */
  async getWorkingMemory(): Promise<string> {
    try {
      return await fs.readFile(this.config.memoryPath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Add a fact to MEMORY.md under the specified section
   */
  async addFact(fact: string, section = 'Notes'): Promise<void> {
    const content = await this.getWorkingMemory();
    const date = formatDate();
    const entry = `- [${date}] ${fact}`;

    // Find section and append
    const updated = this.appendToSection(content, section, entry);
    await fs.writeFile(this.config.memoryPath, updated);
  }

  /**
   * Append entry to a markdown section
   */
  private appendToSection(
    content: string,
    section: string,
    entry: string
  ): string {
    const sectionPattern = new RegExp(`^## ${section}\\s*$`, 'im');
    const match = content.match(sectionPattern);

    if (!match || match.index === undefined) {
      // Section not found, append at end
      return content.trimEnd() + `\n\n## ${section}\n\n${entry}\n`;
    }

    // Find end of section (next ## or end of file)
    const afterSection = content.slice(match.index + match[0].length);
    const nextSection = afterSection.search(/^## /m);

    if (nextSection === -1) {
      // No next section, append at end
      return content.trimEnd() + `\n${entry}\n`;
    }

    // Insert before next section
    const insertIndex = match.index + match[0].length + nextSection;
    return (
      content.slice(0, insertIndex).trimEnd() +
      `\n${entry}\n\n` +
      content.slice(insertIndex)
    );
  }

  // ==========================================
  // Sync & Indexing
  // ==========================================

  /**
   * Sync memory files (MEMORY.md) to the search index
   */
  async sync(): Promise<void> {
    await this.ensureInitialized();

    // Import chunking module
    const { chunkText } = await import('./chunking.js');

    // Sync MEMORY.md
    try {
      const memoryContent = await this.getWorkingMemory();
      if (memoryContent) {
        await this.indexMemoryFile(
          this.config.memoryPath,
          memoryContent,
          'memory',
          chunkText
        );
      }
    } catch (err) {
      console.error('[memory] Failed to sync MEMORY.md:', err);
    }
  }

  /**
   * Index a memory file into chunks
   */
  private async indexMemoryFile(
    filePath: string,
    content: string,
    source: 'memory',
    chunkText: any
  ): Promise<void> {
    const { hashText } = await import('./utils.js');
    const relativePath = path.relative(process.cwd(), filePath);

    // Chunk the content
    const chunks = chunkText(content, {
      tokens: this.config.chunkTokens,
      overlap: this.config.chunkOverlap,
    });

    // Check if already indexed with same hash
    const contentHash = hashText(content);
    const existingResult = await this.db!.execute({
      sql: `SELECT id FROM chunks WHERE path = ? AND hash = ? AND source = ? LIMIT 1`,
      args: [relativePath, contentHash, source],
    });

    if (existingResult.rows.length > 0) {
      return; // Already indexed
    }

    // Delete old chunks for this path
    await this.db!.execute({
      sql: `DELETE FROM chunks WHERE path = ? AND source = ?`,
      args: [relativePath, source],
    });

    // Delete from FTS if available
    if (this.status?.ftsAvailable) {
      try {
        await this.db!.execute({
          sql: `DELETE FROM chunks_fts WHERE path = ? AND source = ?`,
          args: [relativePath, source],
        });
      } catch {
        // Ignore FTS errors
      }
    }

    // Get embeddings for all chunks
    let embeddings: number[][] = [];
    if (this.status?.vectorAvailable && this.config.openaiApiKey) {
      if (!this._embedder) {
        const { EmbeddingService } = await import('./embeddings.js');
        this._embedder = new EmbeddingService(
          this.config.openaiApiKey,
          this.config.embeddingModel
        );
      }

      try {
        embeddings = await this._embedder.embedBatch(
          chunks.map((c: any) => c.content)
        );
      } catch (err) {
        console.error('[memory] Failed to generate embeddings:', err);
      }
    }

    // Insert new chunks
    const timestamp = now();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i] ?? null;
      const id = generateId();

      // Insert chunk with vector embedding
      await this.db!.execute({
        sql: `INSERT INTO chunks (id, transcript_id, source, path, content, hash, start_line, end_line, embedding, model, created_at)
              VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ${embedding ? 'vector32(?)' : 'NULL'}, ?, ?)`,
        args: [
          id,
          source,
          relativePath,
          chunk.content,
          chunk.hash,
          chunk.startLine,
          chunk.endLine,
          ...(embedding ? [JSON.stringify(embedding)] : []),
          this.config.embeddingModel,
          timestamp,
        ],
      });

      // Insert into FTS
      if (this.status?.ftsAvailable) {
        try {
          await this.db!.execute({
            sql: `INSERT INTO chunks_fts (id, content, source, path) VALUES (?, ?, ?, ?)`,
            args: [id, chunk.content, source, relativePath],
          });
        } catch {
          // Ignore FTS errors
        }
      }
    }
  }

  // ==========================================
  // Background Indexing
  // ==========================================

  /**
   * Schedule a transcript for background indexing
   */
  private scheduleIndexing(transcriptId: string): void {
    this.indexQueue.add(transcriptId);

    // Debounce: wait 1 second before processing
    if (!this.indexTimer) {
      this.indexTimer = setTimeout(() => {
        this.indexTimer = null;
        this.processIndexQueue().catch((err) => {
          console.error('[memory] Index queue processing failed:', err);
        });
      }, 1000);
    }
  }

  /**
   * Process all queued transcripts for indexing
   */
  private async processIndexQueue(): Promise<void> {
    if (this.indexQueue.size === 0) return;

    const ids = Array.from(this.indexQueue);
    this.indexQueue.clear();

    for (const id of ids) {
      try {
        await this.indexTranscript(id);
      } catch (err) {
        console.error(`[memory] Failed to index transcript ${id}:`, err);
      }
    }
  }

  /**
   * Index a single transcript
   */
  private async indexTranscript(transcriptId: string): Promise<void> {
    // Get transcript content
    const result = await this.db!.execute({
      sql: `SELECT content FROM transcripts WHERE id = ?`,
      args: [transcriptId],
    });

    if (result.rows.length === 0) return;
    const content = String(result.rows[0].content);

    // Import chunking
    const { chunkText } = await import('./chunking.js');

    // Chunk the content
    const chunks = chunkText(content, {
      tokens: this.config.chunkTokens,
      overlap: this.config.chunkOverlap,
    });

    // Skip if no meaningful chunks
    if (chunks.length === 0) return;

    // Get embeddings if vector search is available
    let embeddings: number[][] = [];
    if (this.status?.vectorAvailable && this.config.openaiApiKey) {
      if (!this._embedder) {
        const { EmbeddingService } = await import('./embeddings.js');
        this._embedder = new EmbeddingService(
          this.config.openaiApiKey,
          this.config.embeddingModel
        );
      }

      try {
        embeddings = await this._embedder.embedBatch(
          chunks.map((c: any) => c.content)
        );
      } catch (err) {
        console.error('[memory] Failed to generate embeddings:', err);
      }
    }

    // Store chunks
    const timestamp = now();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i] ?? null;
      const id = generateId();

      // Insert chunk with vector embedding
      await this.db!.execute({
        sql: `INSERT INTO chunks (id, transcript_id, source, path, content, hash, start_line, end_line, embedding, model, created_at)
              VALUES (?, ?, 'transcript', NULL, ?, ?, ?, ?, ${embedding ? 'vector32(?)' : 'NULL'}, ?, ?)`,
        args: [
          id,
          transcriptId,
          chunk.content,
          chunk.hash,
          chunk.startLine,
          chunk.endLine,
          ...(embedding ? [JSON.stringify(embedding)] : []),
          this.config.embeddingModel,
          timestamp,
        ],
      });

      // Insert into FTS
      if (this.status?.ftsAvailable) {
        try {
          await this.db!.execute({
            sql: `INSERT INTO chunks_fts (id, content, source, path) VALUES (?, ?, 'transcript', NULL)`,
            args: [id, chunk.content],
          });
        } catch {
          // Ignore FTS errors
        }
      }
    }
  }

  // ==========================================
  // Helpers
  // ==========================================

  /**
   * Ensure service is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// ==========================================
// Singleton Instance
// ==========================================

let instance: MemoryService | null = null;

/**
 * Get the singleton MemoryService instance
 */
export function getMemoryService(
  config?: Partial<MemoryConfig>
): MemoryService {
  if (!instance) {
    instance = new MemoryService(config);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export async function resetMemoryService(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
