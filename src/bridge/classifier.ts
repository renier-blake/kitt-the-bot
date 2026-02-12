/**
 * KITT Message Classifier
 *
 * Uses OpenAI GPT-4o-mini for fast routing decisions (~300ms).
 * Reuses the same OpenAI auth as embeddings - no extra config needed.
 *
 * Determines whether a message should be handled:
 * - Direct: Main agent (Opus) handles immediately
 * - Background: Dispatch to background runner, return ack
 *
 * @see _prd/kitt-orchestrator-model.md
 */

import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import {
  getBackgroundSkills,
  getAgentMode,
  type Capability,
} from '../capabilities/index.js';
import { getCredential } from '../credentials/index.js';
import { log } from './logger.js';

// ==========================================
// Types
// ==========================================

export interface ClassificationResult {
  type: 'direct' | 'background';
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

// Cache for classifier prompt (reload on file change)
let cachedPrompt: string | null = null;
let promptMtime: number = 0;

// OpenAI client (lazy init)
let openaiClient: OpenAI | null = null;

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

    log.debug('Classifier prompt loaded', { length: cachedPrompt.length });
    return cachedPrompt;
  } catch (err) {
    log.error('Failed to load classifier prompt', { error: String(err) });
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

/**
 * Get or create OpenAI client
 */
async function getOpenAI(): Promise<OpenAI | null> {
  if (openaiClient) return openaiClient;

  const apiKey = await getCredential('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.error('No OpenAI API key available for classifier');
    return null;
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

// ==========================================
// Classification
// ==========================================

/**
 * Classify a user message
 *
 * @param message - User message to classify
 * @returns Classification result with type and optional capability
 */
export async function classifyMessage(
  message: string
): Promise<ClassificationResult> {
  const startTime = Date.now();

  try {
    // Get current mode and available background skills
    const mode = await getAgentMode();
    const backgroundSkills = await getBackgroundSkills(mode);

    // If no background skills available, always route direct
    if (backgroundSkills.length === 0) {
      log.debug('No background skills available, routing direct');
      return { type: 'direct', confidence: 1.0 };
    }

    // Get OpenAI client
    const client = await getOpenAI();
    if (!client) {
      return { type: 'direct', confidence: 0 };
    }

    // Load and prepare prompt
    const promptTemplate = loadClassifierPrompt();
    const capabilitiesList = formatCapabilitiesForPrompt(backgroundSkills);

    const systemPrompt = promptTemplate
      .replace('{{CAPABILITIES}}', capabilitiesList)
      .replace('{{MODE}}', mode);

    // Call GPT-4o-mini (fast and cheap)
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    const elapsed = Date.now() - startTime;

    // Parse response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      log.warn('Classifier got empty response', { elapsed });
      return { type: 'direct', confidence: 0 };
    }

    const result = parseClassifierResponse(content);

    // Validate capability exists
    if (result.type === 'background' && result.capability) {
      const validCapability = backgroundSkills.find(
        (s) => s.id === result.capability
      );
      if (!validCapability) {
        log.warn('Classifier returned invalid capability', {
          capability: result.capability,
          available: backgroundSkills.map((s) => s.id),
        });
        return { type: 'direct', confidence: 0 };
      }
    }

    log.info('Message classified', {
      type: result.type,
      capability: result.capability,
      confidence: result.confidence,
      elapsed,
    });

    console.log(
      `[classifier] ${result.type === 'background' ? '🔄' : '💬'} ${result.type}${result.capability ? ` → ${result.capability}` : ''} (${elapsed}ms)`
    );

    return result;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    log.error('Classification failed', {
      error: err instanceof Error ? err.message : String(err),
      elapsed,
    });

    // Fail-safe: route direct on error
    return { type: 'direct', confidence: 0 };
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
      log.warn('No JSON found in classifier response', { text });
      return { type: 'direct', confidence: 0 };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize
    const type = parsed.type === 'background' ? 'background' : 'direct';
    const capability = type === 'background' ? parsed.capability : undefined;
    const ack = type === 'background' ? parsed.ack : undefined;
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.8;

    return { type, capability, ack, confidence };
  } catch (err) {
    log.warn('Failed to parse classifier response', {
      error: err instanceof Error ? err.message : String(err),
      text,
    });
    return { type: 'direct', confidence: 0 };
  }
}
