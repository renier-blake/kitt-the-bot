/**
 * KITT Memory System - Hybrid Search
 *
 * Combines vector search (semantic) with keyword search (BM25):
 * - Vector search via libSQL native vector support (cosine distance)
 * - Keyword search via FTS5 (BM25 ranking)
 * - Merge with weighted scoring: 0.7 × vector + 0.3 × text
 */

import type { Client } from '@libsql/client';
import type {
  SearchResult,
  ChunkSource,
  VectorSearchRow,
  KeywordSearchRow,
} from './types.js';
import { distanceToScore, bm25RankToScore, createSnippet } from './utils.js';

export interface HybridSearchParams {
  db: Client;
  query: string;
  queryEmbedding: number[];
  maxResults: number;
  minScore?: number;
  vectorWeight?: number;
  textWeight?: number;
  sources?: ChunkSource[];
  vectorAvailable: boolean;
  ftsAvailable: boolean;
}

interface MergedResult {
  id: string;
  content: string;
  source: ChunkSource;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
  vectorScore: number;
  textScore: number;
}

/**
 * Perform hybrid search combining vector and keyword search
 */
export async function hybridSearch(
  params: HybridSearchParams
): Promise<SearchResult[]> {
  const {
    db,
    query,
    queryEmbedding,
    maxResults,
    minScore = 0.3,
    vectorWeight = 0.7,
    textWeight = 0.3,
    sources,
    vectorAvailable,
    ftsAvailable,
  } = params;

  // Over-fetch candidates for better merging
  const candidateLimit = Math.max(maxResults * 3, 50);

  // Get results from both search methods (run in parallel)
  const [vectorResults, keywordResults] = await Promise.all([
    vectorAvailable
      ? searchVector(db, queryEmbedding, candidateLimit, sources)
      : Promise.resolve([]),
    ftsAvailable
      ? searchKeyword(db, query, candidateLimit, sources)
      : Promise.resolve([]),
  ]);

  // If neither search is available, fall back to simple text match
  if (!vectorAvailable && !ftsAvailable) {
    return searchSimple(db, query, maxResults, sources);
  }

  // Merge results
  const merged = mergeResults(
    vectorResults,
    keywordResults,
    vectorWeight,
    textWeight
  );

  // Filter by minimum score and limit
  return merged
    .filter((r) => r.score >= minScore)
    .slice(0, maxResults)
    .map((r) => ({
      id: r.id,
      source: r.source,
      content: r.content,
      snippet: createSnippet(r.content),
      score: r.score,
      metadata: {
        path: r.path ?? undefined,
        startLine: r.startLine ?? undefined,
        endLine: r.endLine ?? undefined,
      },
    }));
}

/**
 * Vector search using libSQL native vector support
 */
async function searchVector(
  db: Client,
  embedding: number[],
  limit: number,
  sources?: ChunkSource[]
): Promise<Array<MergedResult>> {
  try {
    // Build source filter
    const sourceFilter = buildSourceFilter(sources);

    // libSQL native vector search using vector_distance_cos
    // Note: vector32() converts JSON array to F32_BLOB
    const sql = `
      SELECT id, content, source, path, start_line, end_line,
             vector_distance_cos(embedding, vector32(?)) AS distance
      FROM chunks
      WHERE embedding IS NOT NULL ${sourceFilter.sql}
      ORDER BY distance ASC
      LIMIT ?
    `;

    const result = await db.execute({
      sql,
      args: [JSON.stringify(embedding), ...sourceFilter.params, limit],
    });

    return result.rows.map((row) => ({
      id: String(row.id),
      content: String(row.content),
      source: String(row.source) as ChunkSource,
      path: row.path ? String(row.path) : null,
      startLine: row.start_line ? Number(row.start_line) : null,
      endLine: row.end_line ? Number(row.end_line) : null,
      vectorScore: distanceToScore(Number(row.distance)),
      textScore: 0,
    }));
  } catch (err) {
    console.error('[search] Vector search failed:', err);
    return [];
  }
}

/**
 * Keyword search using FTS5 with BM25 ranking
 */
async function searchKeyword(
  db: Client,
  query: string,
  limit: number,
  sources?: ChunkSource[]
): Promise<Array<MergedResult & { textScore: number }>> {
  try {
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) {
      return [];
    }

    // Build source filter
    const sourceFilter = buildSourceFilter(sources, 'f');

    const sql = `
      SELECT f.id, c.content, c.source, c.path, c.start_line, c.end_line,
             bm25(chunks_fts) AS rank
      FROM chunks_fts f
      JOIN chunks c ON c.id = f.id
      WHERE chunks_fts MATCH ? ${sourceFilter.sql}
      ORDER BY rank
      LIMIT ?
    `;

    const result = await db.execute({
      sql,
      args: [ftsQuery, ...sourceFilter.params, limit],
    });

    return result.rows.map((row) => ({
      id: String(row.id),
      content: String(row.content),
      source: String(row.source) as ChunkSource,
      path: row.path ? String(row.path) : null,
      startLine: row.start_line ? Number(row.start_line) : null,
      endLine: row.end_line ? Number(row.end_line) : null,
      vectorScore: 0,
      textScore: bm25RankToScore(Number(row.rank)),
    }));
  } catch (err) {
    console.error('[search] Keyword search failed:', err);
    return [];
  }
}

/**
 * Simple text search fallback (LIKE-based)
 */
async function searchSimple(
  db: Client,
  query: string,
  limit: number,
  sources?: ChunkSource[]
): Promise<SearchResult[]> {
  try {
    const sourceFilter = buildSourceFilter(sources);
    const searchTerm = `%${query}%`;

    const sql = `
      SELECT id, content, source, path, start_line, end_line
      FROM chunks
      WHERE content LIKE ? ${sourceFilter.sql}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const result = await db.execute({
      sql,
      args: [searchTerm, ...sourceFilter.params, limit],
    });

    return result.rows.map((row) => ({
      id: String(row.id),
      source: String(row.source) as ChunkSource,
      content: String(row.content),
      snippet: createSnippet(String(row.content)),
      score: 0.5, // Fixed score for simple search
      metadata: {
        path: row.path ? String(row.path) : undefined,
        startLine: row.start_line ? Number(row.start_line) : undefined,
        endLine: row.end_line ? Number(row.end_line) : undefined,
      },
    }));
  } catch (err) {
    console.error('[search] Simple search failed:', err);
    return [];
  }
}

interface MergedSearchResult extends SearchResult {
  vectorScore: number;
  textScore: number;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
}

/**
 * Merge vector and keyword results with weighted scoring
 */
function mergeResults(
  vector: MergedResult[],
  keyword: Array<MergedResult & { textScore: number }>,
  vectorWeight: number,
  textWeight: number
): MergedSearchResult[] {
  const byId = new Map<string, MergedResult>();

  // Add vector results
  for (const r of vector) {
    byId.set(r.id, {
      ...r,
      textScore: 0,
    });
  }

  // Merge keyword results
  for (const r of keyword) {
    const existing = byId.get(r.id);
    if (existing) {
      existing.textScore = r.textScore;
    } else {
      byId.set(r.id, {
        ...r,
        vectorScore: 0,
      });
    }
  }

  // Calculate combined scores and sort
  const results = Array.from(byId.values()).map((r): MergedSearchResult => {
    const score = vectorWeight * r.vectorScore + textWeight * r.textScore;
    return {
      id: r.id,
      source: r.source,
      content: r.content,
      snippet: createSnippet(r.content),
      score,
      vectorScore: r.vectorScore,
      textScore: r.textScore,
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      metadata: {
        path: r.path ?? undefined,
        startLine: r.startLine ?? undefined,
        endLine: r.endLine ?? undefined,
      },
    };
  });

  // Sort by combined score (descending)
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Build FTS5 query from raw search text
 * Converts to AND-ed quoted terms for exact matching
 */
function buildFtsQuery(raw: string): string | null {
  // Extract alphanumeric tokens
  const tokens =
    raw
      .match(/[A-Za-z0-9_]+/g)
      ?.map((t) => t.trim())
      .filter((t) => t.length > 0) ?? [];

  if (tokens.length === 0) {
    return null;
  }

  // Quote each token and AND them together
  const quoted = tokens.map((t) => `"${t.replace(/"/g, '')}"`);
  return quoted.join(' AND ');
}

/**
 * Build SQL WHERE clause for source filtering
 */
function buildSourceFilter(
  sources?: ChunkSource[],
  tableAlias?: string
): { sql: string; params: string[] } {
  if (!sources || sources.length === 0) {
    return { sql: '', params: [] };
  }

  const column = tableAlias ? `${tableAlias}.source` : 'source';
  const placeholders = sources.map(() => '?').join(', ');

  return {
    sql: ` AND ${column} IN (${placeholders})`,
    params: sources,
  };
}
