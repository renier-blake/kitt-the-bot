/**
 * KITT Session Manager
 * Manages per-chat session persistence for conversation context
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { log } from './logger.js';

interface ChatSession {
  chatId: string;
  sessionId: string;
  lastActivity: string;
  messageCount: number;
  displayName?: string;
}

interface SessionsData {
  sessions: Record<string, ChatSession>;
  lastSaved: string;
}

const SESSIONS_FILE = './profile/state/sessions.json';
const sessions: Map<string, ChatSession> = new Map();

/**
 * Load sessions from disk
 */
export async function loadSessions(): Promise<void> {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const data = await readFile(SESSIONS_FILE, 'utf-8');
      const parsed: SessionsData = JSON.parse(data);

      for (const [chatId, session] of Object.entries(parsed.sessions)) {
        sessions.set(chatId, session);
      }

      log.info('Sessions loaded', { count: sessions.size });
    } else {
      log.info('No existing sessions, starting fresh');
    }
  } catch (err) {
    log.error('Failed to load sessions', { error: String(err) });
  }
}

/**
 * Save sessions to disk
 */
async function saveSessions(): Promise<void> {
  try {
    const data: SessionsData = {
      sessions: Object.fromEntries(sessions),
      lastSaved: new Date().toISOString(),
    };
    await writeFile(SESSIONS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    log.error('Failed to save sessions', { error: String(err) });
  }
}

/**
 * Get session ID for a chat
 */
export function getSessionId(chatId: string): string | undefined {
  return sessions.get(chatId)?.sessionId;
}

/**
 * Update session for a chat
 */
export function updateSession(
  chatId: string,
  sessionId: string,
  displayName?: string
): void {
  const existing = sessions.get(chatId);

  sessions.set(chatId, {
    chatId,
    sessionId,
    displayName: displayName || existing?.displayName,
    lastActivity: new Date().toISOString(),
    messageCount: (existing?.messageCount || 0) + 1,
  });

  // Save asynchronously
  saveSessions().catch((err) => {
    log.error('Failed to save sessions after update', { error: String(err) });
  });
}

/**
 * Get session info for a chat
 */
export function getSession(chatId: string): ChatSession | undefined {
  return sessions.get(chatId);
}

/**
 * List all active sessions
 */
export function listSessions(): ChatSession[] {
  return Array.from(sessions.values());
}

/**
 * Clear session for a chat (start fresh)
 */
export function clearSession(chatId: string): void {
  sessions.delete(chatId);
  saveSessions().catch((err) => {
    log.error('Failed to save sessions after clear', { error: String(err) });
  });
}
