/**
 * KITT Bridge State Management
 * Persists bridge state to disk for recovery after restarts
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { BridgeState, ChatState } from './types.js';
import { log } from './logger.js';

const STATE_FILE = './profile/state/bridge-state.json';

let state: BridgeState = {
  startedAt: new Date().toISOString(),
  lastMessageTimestamp: 0,
  chats: {},
};

/**
 * Load state from disk
 */
export async function loadState(): Promise<BridgeState> {
  try {
    if (existsSync(STATE_FILE)) {
      const data = await readFile(STATE_FILE, 'utf-8');
      const loaded = JSON.parse(data) as BridgeState;
      // Keep old chat state, update startedAt
      state = {
        ...loaded,
        startedAt: new Date().toISOString(),
      };
      log.info('State loaded', { chats: Object.keys(state.chats).length });
    } else {
      log.info('No existing state, starting fresh');
    }
  } catch (err) {
    log.error('Failed to load state, starting fresh', { error: String(err) });
  }
  return state;
}

/**
 * Save state to disk
 */
export async function saveState(): Promise<void> {
  try {
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    log.error('Failed to save state', { error: String(err) });
  }
}

/**
 * Get current state
 */
export function getState(): BridgeState {
  return state;
}

/**
 * Update last message timestamp
 */
export function updateLastTimestamp(timestamp: number): void {
  state.lastMessageTimestamp = timestamp;
}

/**
 * Update chat state
 */
export function updateChatState(chatId: string, name: string): void {
  const existing = state.chats[chatId];
  state.chats[chatId] = {
    chatId,
    name,
    lastActivity: new Date().toISOString(),
    messageCount: (existing?.messageCount || 0) + 1,
  };
}

/**
 * Get chat state
 */
export function getChatState(chatId: string): ChatState | undefined {
  return state.chats[chatId];
}
