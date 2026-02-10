/**
 * Conversation State Loader
 *
 * Calculates conversation state for think loop awareness:
 * - Recent exchanges
 * - Conversation gap (minutes since last interaction)
 * - Unanswered user messages
 *
 * Only used in think mode.
 */

import type { LoaderContext, ConversationExchange, ConversationState } from '../types.js';

/**
 * Build conversation state from recent transcripts
 */
async function buildConversationState(
  db: NonNullable<LoaderContext['db']>
): Promise<ConversationState | null> {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    // Get today's transcripts
    const result = await db.execute({
      sql: `SELECT role, type, content, created_at
            FROM transcripts
            WHERE created_at >= ?
            ORDER BY created_at ASC`,
      args: [todayStart.getTime()],
    });

    if (result.rows.length === 0) {
      return {
        recentExchanges: [],
        conversationGap: 999,
        unansweredUserMessages: [],
      };
    }

    // Get last 10 exchanges
    const recentExchanges: ConversationExchange[] = result.rows.slice(-10).map((row) => {
      const msgTime = new Date(Number(row.created_at));
      const minutesAgo = Math.round((now - msgTime.getTime()) / 60000);
      const type = (row.type || 'message') as 'message' | 'thought' | 'task';

      return {
        role: row.role as 'user' | 'kitt',
        type,
        content: String(row.content).slice(0, 100),
        time: msgTime.toLocaleTimeString('nl-NL', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Amsterdam',
        }),
        minutesAgo,
      };
    });

    // Calculate conversation gap
    const lastInteraction = recentExchanges[recentExchanges.length - 1];
    const conversationGap = lastInteraction ? lastInteraction.minutesAgo : 999;

    // Find unanswered user messages
    const unansweredUserMessages: ConversationState['unansweredUserMessages'] = [];
    for (let i = 0; i < recentExchanges.length; i++) {
      const exchange = recentExchanges[i];
      if (exchange.role === 'user') {
        // Check if there's a kitt|message after this user message
        const hasKittResponse = recentExchanges
          .slice(i + 1)
          .some((e) => e.role === 'kitt' && e.type === 'message');
        if (!hasKittResponse) {
          unansweredUserMessages.push({
            content: exchange.content,
            time: exchange.time,
            minutesAgo: exchange.minutesAgo,
          });
        }
      }
    }

    return {
      recentExchanges,
      conversationGap,
      unansweredUserMessages,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[conversation-state] Failed:', errorMessage);
    return null;
  }
}

/**
 * Format conversation state for think loop prompt
 */
function formatConversationState(state: ConversationState): string {
  const exchangesFormatted = state.recentExchanges
    .map((e) => {
      const roleLabel =
        e.role === 'user'
          ? 'Renier'
          : e.type === 'thought'
            ? 'KITT (gedachte)'
            : e.type === 'task'
              ? 'KITT (task)'
              : 'KITT';
      const preview = e.content.length > 80 ? e.content.slice(0, 80) + '...' : e.content;
      return `[${e.time}] ${roleLabel}: "${preview}"`;
    })
    .join('\n');

  const unansweredSection =
    state.unansweredUserMessages.length > 0
      ? `**Onbeantwoord:** ${state.unansweredUserMessages
          .map((m) => `"${m.content}" (${m.minutesAgo} min geleden)`)
          .join(', ')}`
      : '';

  return `**Recente uitwisselingen (laatste ${state.recentExchanges.length}):**
${exchangesFormatted || 'Geen recente berichten.'}

**Laatste interactie:** ${state.conversationGap} min geleden
${unansweredSection}`;
}

/**
 * Conversation state loader - main entry point
 */
export async function conversationStateLoader(
  context: LoaderContext
): Promise<string | null> {
  const { db } = context;

  if (!db) {
    return null;
  }

  const state = await buildConversationState(db);

  if (!state) {
    return null;
  }

  return formatConversationState(state);
}
