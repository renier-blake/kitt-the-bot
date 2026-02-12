/**
 * Transcript Loader
 *
 * Loads recent conversation transcripts from the database.
 * - Chat mode: configurable window (default 15 min, 10 messages)
 * - Think mode: configurable window (default full day, 50 messages)
 */

import type { LoaderContext, TranscriptLoaderConfig, TranscriptWindowConfig } from '../types.js';

const DEFAULT_CHAT_CONFIG: TranscriptWindowConfig = { windowMinutes: 15, maxMessages: 10 };
const DEFAULT_THINK_CONFIG: TranscriptWindowConfig = { windowMode: 'today', maxMessages: 200 };

/**
 * Transcript loader - main entry point
 */
export async function transcriptLoader(
  context: LoaderContext
): Promise<string | null> {
  const { db, mode, config } = context;

  if (!db) {
    return null;
  }

  const loaderConfig = config as TranscriptLoaderConfig | undefined;
  const modeConfig =
    mode === 'chat'
      ? loaderConfig?.chat || DEFAULT_CHAT_CONFIG
      : loaderConfig?.think || DEFAULT_THINK_CONFIG;

  // Build WHERE clause based on window mode
  let whereClause: string;
  let whereArgs: (string | number | bigint | ArrayBuffer | null)[];

  if (modeConfig.windowMode === 'today') {
    // Filter on today only (local timezone) — prevents date confusion
    whereClause = "date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')";
    whereArgs = [modeConfig.maxMessages];
  } else {
    // Sliding window (default for chat)
    const windowMinutes = modeConfig.windowMinutes ?? 1440;
    const windowStart = Date.now() - windowMinutes * 60 * 1000;
    whereClause = 'created_at >= ?';
    whereArgs = [windowStart, modeConfig.maxMessages];
  }

  try {
    const result = await db.execute({
      sql: `SELECT role, type, content, created_at
            FROM transcripts
            WHERE ${whereClause}
            ORDER BY created_at ${mode === 'chat' ? 'DESC' : 'ASC'}
            LIMIT ?`,
      args: whereArgs,
    });

    if (result.rows.length === 0) {
      return mode === 'think' ? 'Geen gesprekken in deze periode.' : null;
    }

    // Format in chronological order for display
    const rows = mode === 'chat' ? [...result.rows].reverse() : result.rows;

    const formatted = rows
      .map((row) => {
        const time = new Date(Number(row.created_at)).toLocaleTimeString('nl-NL', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Amsterdam',
        });
        const type = row.type || 'message';
        const isThought = type === 'thought';
        const isTask = type === 'task';
        const role =
          row.role === 'user'
            ? 'Renier'
            : isThought
              ? 'KITT (gedachte)'
              : isTask
                ? 'KITT (task)'
                : 'KITT';
        const content = String(row.content);
        // Truncate for readability
        const maxLen = mode === 'chat' ? 400 : 200;
        const preview = content.length > maxLen ? content.slice(0, maxLen) + '...' : content;
        return `[${time}] ${role}: ${preview}`;
      })
      .join('\n');

    // Add context note for chat mode
    if (mode === 'chat') {
      return `Dit is wat er recent is gezegd — inclusief berichten van de Think Loop die je anders niet zou zien.\n\n${formatted}\n\nLet op: Als de user refereert naar iets dat hierboven staat (bijv. een bericht van de Think Loop), gebruik dan die context.`;
    }

    return formatted;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[transcript-loader] Failed:', errorMessage);
    return null;
  }
}
