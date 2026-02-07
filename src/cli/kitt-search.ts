#!/usr/bin/env tsx
/**
 * KITT Search CLI
 * Semantic search through conversations and memory
 *
 * Usage:
 *   npm run search -- "zoekterm"
 *   npm run search -- "tandarts afspraak" -l 20
 *   npm run search -- "exact phrase" --exact
 *
 * Options:
 *   --limit, -l    Max results (default: 10)
 *   --exact        Use keyword search instead of semantic (for exact matches)
 *   --json         Output as JSON
 *
 * Examples:
 *   npm run search -- "wanneer tandarts"
 *   npm run search -- "herinnering training" -l 5
 *   npm run search -- "KITT" --exact
 */

import 'dotenv/config';
import { getMemoryService } from '../memory/index.js';

// Parse command line arguments
function parseArgs(): {
  query: string;
  limit: number;
  exact: boolean;
  json: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    query: '',
    limit: 10,
    exact: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--limit':
      case '-l':
        result.limit = parseInt(next, 10) || 10;
        i++;
        break;
      case '--exact':
        result.exact = true;
        break;
      case '--json':
        result.json = true;
        break;
      default:
        // First non-flag argument is the query
        if (!arg.startsWith('-') && !result.query) {
          result.query = arg;
        }
    }
  }

  return result;
}

async function main() {
  const opts = parseArgs();

  if (!opts.query) {
    console.error('Usage: npm run search -- "zoekterm" [options]');
    console.error('');
    console.error('Options:');
    console.error('  -l, --limit N   Max results (default: 10)');
    console.error('  --exact         Keyword search instead of semantic');
    console.error('  --json          Output as JSON');
    process.exit(1);
  }

  try {
    const memory = getMemoryService();

    if (opts.exact) {
      // Keyword search (LIKE query) - for exact matches
      const results = await memory.searchTranscripts({
        query: opts.query,
        timeframe: 'all',
        limit: opts.limit,
      });

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log(`Geen exacte matches voor "${opts.query}"`);
        return;
      }

      console.log(`\n🔍 ${results.length} exacte matches voor "${opts.query}"\n`);

      for (const r of results) {
        const date = r.createdAt.toLocaleString('nl-NL', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        // F53: Use type for thoughts instead of role
        const role = r.role === 'user' ? '👤 Renier'
          : r.type === 'thought' ? '🧠 Gedachte'
          : r.type === 'task' ? '📋 Task'
          : '🤖 KITT';
        const content = r.content.length > 200 ? r.content.slice(0, 200) + '...' : r.content;

        console.log(`[${date}] ${role}:`);
        console.log(`  ${content.replace(/\n/g, '\n  ')}`);
        console.log('');
      }
    } else {
      // Semantic search (vector) - default
      const results = await memory.search(opts.query, {
        maxResults: opts.limit,
        minScore: 0.3,
        sources: ['transcript'], // Only search conversations
      });

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log(`Geen relevante resultaten voor "${opts.query}"`);
        console.log('Tip: probeer --exact voor letterlijke matches');
        return;
      }

      console.log(`\n🧠 ${results.length} semantische matches voor "${opts.query}"\n`);

      for (const r of results) {
        const score = (r.score * 100).toFixed(0);
        const content = r.content.length > 200 ? r.content.slice(0, 200) + '...' : r.content;

        console.log(`[${score}% match]`);
        console.log(`  ${content.replace(/\n/g, '\n  ')}`);
        console.log('');
      }
    }
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
