/**
 * KITT Memory System - Type Definitions
 */

// === Configuration ===

export interface MemoryConfig {
  /** Path to SQLite database */
  dbPath: string;
  /** Path to MEMORY.md working memory file */
  memoryPath: string;
  /** OpenAI API key for embeddings */
  openaiApiKey: string;
  /** Embedding model to use */
  embeddingModel: string;
  /** Embedding vector dimensions */
  embeddingDimensions: number;
  /** Chunk size in tokens */
  chunkTokens: number;
  /** Overlap between chunks in tokens */
  chunkOverlap: number;
  /** Weight for vector search in hybrid */
  vectorWeight: number;
  /** Weight for text search in hybrid */
  textWeight: number;
}

// === Message Types ===

export type Channel = 'telegram' | 'claude_ui' | 'sub_agent' | 'think-loop';
export type Role = 'kitt' | 'user' | 'system'; // kitt = KITT's messages, user = Renier
export type TranscriptType = 'message' | 'thought' | 'task' | 'reflection';
export type TranscriptTaskStatus = 'reminder' | 'completed' | 'skipped' | 'deferred';
export type ChunkSource = 'transcript' | 'memory';

// === Store Message ===

export interface StoreMessageParams {
  /** Session/conversation identifier */
  sessionId: string;
  /** Source channel */
  channel: Channel;
  /** Message role: 'kitt' or 'user' */
  role: Role;
  /** Message content */
  content: string;
  /** Message type (default: 'message') */
  type?: TranscriptType;
  /** Task ID for type='task' - FK to kitt_tasks.id */
  taskId?: number;
  /** Task status for type='task' */
  taskStatus?: TranscriptTaskStatus;
  /** Additional metadata (userId, username, etc.) */
  metadata?: Record<string, unknown>;
}

// === Search ===

export interface SearchOptions {
  /** Maximum results to return (default: 10) */
  maxResults?: number;
  /** Minimum score threshold (default: 0.3) */
  minScore?: number;
  /** Filter by source types */
  sources?: ChunkSource[];
  /** Filter by time range */
  timeRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface SearchResult {
  /** Chunk ID */
  id: string;
  /** Source type */
  source: ChunkSource;
  /** Full chunk content */
  content: string;
  /** Truncated snippet for display */
  snippet: string;
  /** Combined search score (0-1) */
  score: number;
  /** Additional metadata */
  metadata?: {
    sessionId?: string;
    channel?: Channel;
    role?: Role;
    path?: string;
    startLine?: number;
    endLine?: number;
    createdAt?: Date;
  };
}

// === Internal Search Types ===

export interface VectorSearchResult {
  id: string;
  content: string;
  source: ChunkSource;
  path: string | null;
  score: number;
  startLine: number | null;
  endLine: number | null;
}

export interface KeywordSearchResult {
  id: string;
  content: string;
  source: ChunkSource;
  path: string | null;
  score: number;
  startLine: number | null;
  endLine: number | null;
}

export interface MergedSearchResult extends VectorSearchResult {
  vectorScore: number;
  textScore: number;
}

// === Database Entities ===

export interface Transcript {
  id: string;
  sessionId: string;
  channel: Channel;
  role: Role;
  type: TranscriptType;
  content: string;
  taskId: number | null;
  taskStatus: TranscriptTaskStatus | null;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface Chunk {
  id: string;
  transcriptId: string | null;
  source: ChunkSource;
  path: string | null;
  content: string;
  hash: string;
  startLine: number | null;
  endLine: number | null;
  embedding: number[] | null;
  model: string;
  createdAt: number;
}

// === Chunking ===

export interface TextChunk {
  /** Chunk content */
  content: string;
  /** Content hash for change detection */
  hash: string;
  /** Start line number (1-indexed) */
  startLine: number;
  /** End line number (1-indexed) */
  endLine: number;
}

export interface ChunkingOptions {
  /** Max tokens per chunk (default: 400) */
  tokens?: number;
  /** Overlap tokens between chunks (default: 80) */
  overlap?: number;
}

// === Embedding ===

export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** Token count used */
  tokenCount?: number;
}

// === Database Row Types (for SQLite queries) ===

export interface TranscriptRow {
  id: string;
  session_id: string;
  channel: string;
  role: string;
  type: string;
  content: string;
  task_id: number | null;
  task_status: string | null;
  metadata: string | null;
  created_at: number;
}

export interface ChunkRow {
  id: string;
  transcript_id: string | null;
  source: string;
  path: string | null;
  content: string;
  hash: string;
  start_line: number | null;
  end_line: number | null;
  embedding: string | null;
  model: string;
  created_at: number;
}

export interface VectorSearchRow {
  id: string;
  content: string;
  source: string;
  path: string | null;
  start_line: number | null;
  end_line: number | null;
  distance: number;
}

export interface KeywordSearchRow {
  id: string;
  content: string;
  source: string;
  path: string | null;
  start_line: number | null;
  end_line: number | null;
  rank: number;
}

// === Transcript Search ===

export type TranscriptTimeframe = 'today' | 'week' | 'month' | 'all';

export interface TranscriptSearchOptions {
  /** Search query (optional - if empty, returns all in timeframe) */
  query?: string;
  /** Time range to search */
  timeframe?: TranscriptTimeframe;
  /** Filter by role types */
  roles?: Role[];
  /** Filter by channels */
  channels?: Channel[];
  /** Maximum results (default: 20) */
  limit?: number;
}

export interface TranscriptSearchResult {
  /** Transcript ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** Channel */
  channel: Channel;
  /** Role: 'kitt' or 'user' */
  role: Role;
  /** Type: 'message', 'thought', or 'task' (F53) */
  type: TranscriptType;
  /** Full content */
  content: string;
  /** Truncated snippet for display */
  snippet: string;
  /** When created */
  createdAt: Date;
}
