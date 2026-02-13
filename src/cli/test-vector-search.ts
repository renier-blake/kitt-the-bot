#!/usr/bin/env tsx
/**
 * Vector Search Baseline/After Test
 *
 * Runs 5 diverse search queries and records chunk IDs, scores, and timing.
 * Used to verify that the vector store migration produces identical results.
 *
 * Usage:
 *   npx tsx src/cli/test-vector-search.ts                    # Print results
 *   npx tsx src/cli/test-vector-search.ts --save baseline    # Save as baseline
 *   npx tsx src/cli/test-vector-search.ts --save after       # Save as after
 *   npx tsx src/cli/test-vector-search.ts --compare          # Compare baseline vs after
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { getMemoryService } from '../memory/index.js';

const QUERIES = [
  'garmin slaap data',
  'training workout hyrox',
  'think loop reliability',
  'goedemorgen',
  'database performance',
];

const DATA_DIR = path.resolve('profile/data');
const BASELINE_PATH = path.join(DATA_DIR, 'vector-search-baseline.json');
const AFTER_PATH = path.join(DATA_DIR, 'vector-search-after.json');

interface QueryResult {
  query: string;
  durationMs: number;
  results: Array<{
    id: string;
    score: number;
    source: string;
    snippet: string;
  }>;
}

async function runTests(): Promise<QueryResult[]> {
  const memory = getMemoryService();
  await memory.initialize();

  const testResults: QueryResult[] = [];

  for (const query of QUERIES) {
    const start = performance.now();
    const results = await memory.search(query, {
      maxResults: 5,
      minScore: 0.3,
      sources: ['transcript'],
    });
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    testResults.push({
      query,
      durationMs,
      results: results.map((r) => ({
        id: r.id,
        score: Math.round(r.score * 10000) / 10000,
        source: r.source,
        snippet: r.content.slice(0, 100),
      })),
    });

    console.log(`\n  "${query}" — ${durationMs}ms, ${results.length} results`);
    for (const r of results) {
      console.log(`    [${(r.score * 100).toFixed(1)}%] ${r.id.slice(0, 8)}… ${r.content.slice(0, 80).replace(/\n/g, ' ')}`);
    }
  }

  return testResults;
}

function compare(baseline: QueryResult[], after: QueryResult[]) {
  let allMatch = true;

  for (let i = 0; i < QUERIES.length; i++) {
    const b = baseline[i];
    const a = after[i];
    console.log(`\n  Query: "${b.query}"`);
    console.log(`    Baseline: ${b.durationMs}ms | After: ${a.durationMs}ms`);

    const bIds = b.results.map((r) => r.id);
    const aIds = a.results.map((r) => r.id);

    if (JSON.stringify(bIds) === JSON.stringify(aIds)) {
      console.log(`    Chunk IDs: MATCH`);
    } else {
      console.log(`    Chunk IDs: MISMATCH`);
      console.log(`      Baseline: ${bIds.map((id) => id.slice(0, 8)).join(', ')}`);
      console.log(`      After:    ${aIds.map((id) => id.slice(0, 8)).join(', ')}`);
      allMatch = false;
    }

    // Compare scores (allow tiny floating point differences)
    for (let j = 0; j < Math.min(b.results.length, a.results.length); j++) {
      const bScore = b.results[j].score;
      const aScore = a.results[j].score;
      const diff = Math.abs(bScore - aScore);
      if (diff > 0.001) {
        console.log(`    Score diff at #${j}: ${bScore} vs ${aScore} (delta: ${diff.toFixed(4)})`);
        allMatch = false;
      }
    }
  }

  console.log(allMatch ? '\n  ALL TESTS PASSED — results identical' : '\n  SOME DIFFERENCES DETECTED');
  return allMatch;
}

async function main() {
  const args = process.argv.slice(2);
  const saveFlag = args.indexOf('--save');
  const compareFlag = args.includes('--compare');

  if (compareFlag) {
    if (!fs.existsSync(BASELINE_PATH) || !fs.existsSync(AFTER_PATH)) {
      console.error('Need both baseline and after files. Run with --save baseline and --save after first.');
      process.exit(1);
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
    const after = JSON.parse(fs.readFileSync(AFTER_PATH, 'utf-8'));
    const ok = compare(baseline, after);
    process.exit(ok ? 0 : 1);
  }

  console.log('Running vector search tests...');
  const results = await runTests();

  if (saveFlag >= 0) {
    const label = args[saveFlag + 1] || 'baseline';
    const outPath = label === 'after' ? AFTER_PATH : BASELINE_PATH;
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\nSaved to ${outPath}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
