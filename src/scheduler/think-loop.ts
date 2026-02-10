/**
 * KITT Think Loop - Response Parser
 *
 * Parses the agent's response from the think loop and extracts
 * the action to take.
 *
 * Note: Context building has been moved to src/context/ (unified context builder).
 * Skill discovery is in src/context/loaders/skills-loader.ts.
 * Task engine is in src/scheduler/task-engine.ts.
 */

// ==========================================
// Types
// ==========================================

export interface ThinkLoopThought {
  shouldAct: boolean;
  action?: 'message' | 'remember' | 'reflect' | 'task';
  message?: string;
  memoryNote?: string;
  reflection?: string;
  reasoning?: string;
  // Task execution (when action === 'task')
  taskId?: number;
  taskTitle?: string;
  // F37: When true, task is completed (Phase 2) — store reflection, don't send to Telegram
  taskComplete?: boolean;
}

// ==========================================
// Response Parsing
// ==========================================

/**
 * Parse the agent's response
 */
export function parseThinkResponse(response: string): ThinkLoopThought {
  // Strip markdown bold markers (**) that the agent sometimes adds
  const trimmed = response.trim().replace(/\*\*/g, '');

  // Extract reasoning
  const reasoningMatch = trimmed.match(/REASONING:\s*(.+?)(?=ACTION:|$)/si);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;

  // Check for ACTION: OK
  if (/ACTION:\s*OK/i.test(trimmed)) {
    return {
      shouldAct: false,
      reasoning,
    };
  }

  // F37: Check for ACTION: COMPLETE_TASK #id (Phase 2 — store reflection, no Telegram)
  // Must be checked BEFORE ACTION: TASK to avoid partial match
  const completeTaskMatch = trimmed.match(/ACTION:\s*COMPLETE_TASK\s*#(\d+)\s*\n([\s\S]+)$/i);
  if (completeTaskMatch) {
    return {
      shouldAct: true,
      action: 'task',
      taskId: parseInt(completeTaskMatch[1], 10),
      taskComplete: true,
      message: completeTaskMatch[2].trim(),
      reasoning,
    };
  }

  // Check for ACTION: TASK #id
  const taskMatch = trimmed.match(/ACTION:\s*TASK\s*#(\d+)\s*\n([\s\S]+)$/i);
  if (taskMatch) {
    return {
      shouldAct: true,
      action: 'task',
      taskId: parseInt(taskMatch[1], 10),
      message: taskMatch[2].trim(),
      reasoning,
    };
  }

  // Check for ACTION: MESSAGE
  const messageMatch = trimmed.match(/ACTION:\s*MESSAGE\s*\n([\s\S]+)$/i);
  if (messageMatch) {
    return {
      shouldAct: true,
      action: 'message',
      message: messageMatch[1].trim(),
      reasoning,
    };
  }

  // Check for ACTION: MEMORY
  const memoryMatch = trimmed.match(/ACTION:\s*MEMORY\s*\n([\s\S]+)$/i);
  if (memoryMatch) {
    return {
      shouldAct: true,
      action: 'remember',
      memoryNote: memoryMatch[1].trim(),
      reasoning,
    };
  }

  // Check for ACTION: REFLECT
  if (/ACTION:\s*REFLECT/i.test(trimmed)) {
    return {
      shouldAct: true,
      action: 'reflect',
      reflection: reasoning, // The reasoning IS the reflection
      reasoning,
    };
  }

  // Legacy support: HEARTBEAT_OK
  if (trimmed.toUpperCase().includes('HEARTBEAT_OK') || trimmed.toUpperCase() === 'OK') {
    return {
      shouldAct: false,
      reasoning: reasoning || 'No action needed',
    };
  }

  // Legacy support: MEMORY: prefix
  if (trimmed.toUpperCase().startsWith('MEMORY:')) {
    return {
      shouldAct: true,
      action: 'remember',
      memoryNote: trimmed.slice(7).trim(),
      reasoning,
    };
  }

  // If no format matched but there's content, assume it's a message
  if (trimmed.length > 0 && !trimmed.toUpperCase().includes('OK')) {
    return {
      shouldAct: true,
      action: 'message',
      message: trimmed,
      reasoning,
    };
  }

  return {
    shouldAct: false,
    reasoning: reasoning || 'Could not parse response',
  };
}
