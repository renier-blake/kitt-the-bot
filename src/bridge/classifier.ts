/**
 * KITT Message Classifier
 *
 * Uses OpenAI gpt-4o-mini via direct API call for fast routing (~200-500ms).
 * Reuses the same OPENAI_API_KEY as embeddings — no extra keys needed.
 *
 * Determines whether a message should be handled:
 * - Direct: Main agent (Opus) handles immediately
 * - Background: Dispatch to background runner, return ack
 *
 * @see _prd/kitt-orchestrator-model.md
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  getBackgroundSkills,
  getAgentMode,
  type Capability,
} from '../capabilities/index.js';
import { createLogger } from './logger.js';
import { getCredential } from '../credentials/index.js';

const log = createLogger('classifier');

// ==========================================
// Types
// ==========================================

export interface ClassificationResult {
  type: 'direct' | 'background';
  needsContext: boolean; // Whether message needs long-term memory search
  capability?: string; // Skill ID for background tasks
  ack?: string; // Acknowledgment message for user
  confidence: number; // 0-1 confidence score
}

// ==========================================
// Constants
// ==========================================

const CLASSIFIER_PROMPT_PATH = path.resolve(
  process.cwd(),
  'profile/context/instructions/classifier.md'
);

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const CLASSIFIER_MODEL = 'gpt-4o-mini';

// Cache for classifier prompt (reload on file change)
let cachedPrompt: string | null = null;
let promptMtime: number = 0;

// Cache for API key (loaded once from env/vault)
let cachedApiKey: string | null = null;

// ==========================================
// API Key
// ==========================================

async function getOpenAIKey(): Promise<string | null> {
  if (cachedApiKey) return cachedApiKey;

  // Try env first, then credential vault
  if (process.env.OPENAI_API_KEY) {
    cachedApiKey = process.env.OPENAI_API_KEY;
    return cachedApiKey;
  }

  try {
    const vaultKey = await getCredential('OPENAI_API_KEY');
    if (vaultKey) {
      cachedApiKey = vaultKey;
      return cachedApiKey;
    }
  } catch {
    // Vault not available
  }

  return null;
}

// ==========================================
// Prompt Loading
// ==========================================

/**
 * Load the classifier prompt template
 * Reloads if file has changed
 */
function loadClassifierPrompt(): string {
  try {
    const stats = fs.statSync(CLASSIFIER_PROMPT_PATH);
    const currentMtime = stats.mtimeMs;

    if (cachedPrompt && currentMtime === promptMtime) {
      return cachedPrompt;
    }

    cachedPrompt = fs.readFileSync(CLASSIFIER_PROMPT_PATH, 'utf-8');
    promptMtime = currentMtime;

    log.debug('Prompt loaded', { length: cachedPrompt.length });
    return cachedPrompt;
  } catch (err) {
    log.error('Failed to load prompt', { error: String(err) });
    return `Classify the user message. Return JSON with type "direct" or "background".`;
  }
}

/**
 * Format capabilities list for injection into prompt
 */
function formatCapabilitiesForPrompt(capabilities: Capability[]): string {
  if (capabilities.length === 0) {
    return 'No background capabilities available.';
  }

  return capabilities
    .map((cap) => {
      const triggers = cap.triggers.length > 0 ? ` [triggers: ${cap.triggers.join(', ')}]` : '';
      return `- **${cap.id}**: ${cap.description || cap.name}${triggers}`;
    })
    .join('\n');
}

// ==========================================
// Classification
// ==========================================

/**
 * Classify a user message
 *
 * Uses OpenAI gpt-4o-mini via direct API call (~200-500ms).
 *
 * @param message - User message to classify
 * @returns Classification result with type and optional capability
 */
export async function classifyMessage(
  message: string
): Promise<ClassificationResult> {
  const startTime = Date.now();

  try {
    // Get API key
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      log.warn('No OpenAI API key, skipping classification');
      return { type: 'direct', needsContext: true, confidence: 0 };
    }

    // Get current mode and available background skills
    const mode = await getAgentMode();
    const backgroundSkills = await getBackgroundSkills(mode);

    // If no background skills available, always route direct
    if (backgroundSkills.length === 0) {
      log.debug('No background skills, routing direct');
      return { type: 'direct', needsContext: true, confidence: 1.0 };
    }

    // Load and prepare prompt
    const promptTemplate = loadClassifierPrompt();
    const capabilitiesList = formatCapabilitiesForPrompt(backgroundSkills);

    const systemPrompt = promptTemplate
      .replace('{{CAPABILITIES}}', capabilitiesList)
      .replace('{{MODE}}', mode);

    // Direct OpenAI API call — no subprocess overhead
    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? '';
    const elapsed = Date.now() - startTime;

    if (!content) {
      log.warn('Empty response', { elapsed });
      return { type: 'direct', needsContext: true, confidence: 0 };
    }

    const result = parseClassifierResponse(content);

    // Validate capability exists
    if (result.type === 'background' && result.capability) {
      const validCapability = backgroundSkills.find(
        (s) => s.id === result.capability
      );
      if (!validCapability) {
        log.warn('Invalid capability returned', {
          capability: result.capability,
          available: backgroundSkills.map((s) => s.id),
        });
        return { type: 'direct', needsContext: true, confidence: 0 };
      }
    }

    log.info('Classified', {
      type: result.type,
      needsContext: result.needsContext,
      capability: result.capability,
      confidence: result.confidence,
      elapsed,
    });

    return result;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    log.error('Classification failed', {
      error: err instanceof Error ? err.message : String(err),
      elapsed,
    });

    // Fail-safe: route direct on error (with context search for safety)
    return { type: 'direct', needsContext: true, confidence: 0 };
  }
}

/**
 * Parse the classifier's JSON response
 */
function parseClassifierResponse(text: string): ClassificationResult {
  try {
    // Extract JSON from response (might be wrapped in markdown code block)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn('No JSON found in response', { text });
      return { type: 'direct', needsContext: true, confidence: 0 };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize
    const type = parsed.type === 'background' ? 'background' : 'direct';
    const needsContext = parsed.needsContext !== false; // Default true (safe: search when unsure)
    const capability = type === 'background' ? parsed.capability : undefined;
    const ack = type === 'background' ? parsed.ack : undefined;
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.8;

    return { type, needsContext, capability, ack, confidence };
  } catch (err) {
    log.warn('Failed to parse response', {
      error: err instanceof Error ? err.message : String(err),
      text,
    });
    return { type: 'direct', needsContext: true, confidence: 0 };
  }
}
