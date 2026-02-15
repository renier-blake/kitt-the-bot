/**
 * Slack Events API Endpoint
 *
 * Handles incoming events from Slack via HTTP webhook.
 * - Verifies Slack signing secret (HMAC SHA256)
 * - Handles url_verification challenge
 * - Routes message events to SlackAdapter.handleEvent()
 */

import type { Express, Request, Response } from 'express';
import crypto from 'node:crypto';
import { log } from './logger.js';
import { getCredential } from '../credentials/index.js';
import type { SlackAdapter } from './adapters/slack.js';

// Cache signing secret to avoid repeated vault lookups
let signingSecretCache: string | null = null;

async function getSigningSecret(): Promise<string | null> {
  if (signingSecretCache) return signingSecretCache;
  signingSecretCache = await getCredential('SLACK_SIGNING_SECRET');
  return signingSecretCache;
}

// Event deduplication (Slack may retry if ack is slow)
const processedEvents = new Set<string>();
const EVENT_TTL = 60_000; // 1 minute

/**
 * Verify Slack request signature using HMAC SHA256.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
async function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  const signingSecret = await getSigningSecret();
  if (!signingSecret) {
    log.error('SLACK_SIGNING_SECRET not configured');
    return false;
  }

  // Check timestamp freshness (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    log.warn('Slack request timestamp too old', { timestamp, now: String(now) });
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(sigBaseString);
  const computedSignature = `v0=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(signature)
  );
}

/**
 * Register Slack Events API route on the Express app.
 * Requires raw body to be preserved on req (via express.json verify callback).
 */
export function registerSlackEventsRoute(
  app: Express,
  getAdapter: () => SlackAdapter | undefined
): void {
  app.post('/slack/events', async (req: Request, res: Response) => {
    log.info('Slack events endpoint hit', { type: req.body?.type, eventType: req.body?.event?.type });
    try {
      // Get raw body (preserved by express.json verify callback)
      const rawBody = (req as unknown as { rawBody?: string }).rawBody;
      if (!rawBody) {
        log.error('Slack events: rawBody not available (check express.json verify config)');
        return res.status(500).json({ error: 'Server misconfigured' });
      }

      const timestamp = req.headers['x-slack-request-timestamp'] as string;
      const slackSignature = req.headers['x-slack-signature'] as string;

      if (!timestamp || !slackSignature) {
        return res.status(401).json({ error: 'Missing Slack headers' });
      }

      // Verify signature
      const valid = await verifySlackSignature(rawBody, timestamp, slackSignature);
      if (!valid) {
        log.warn('Invalid Slack signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const payload = req.body;

      // Handle url_verification challenge (Slack sends this once during setup)
      if (payload.type === 'url_verification') {
        log.info('Slack URL verification challenge received');
        return res.json({ challenge: payload.challenge });
      }

      // Handle event_callback (actual events)
      if (payload.type === 'event_callback') {
        // Deduplicate events
        const eventId = payload.event_id as string;
        if (eventId && processedEvents.has(eventId)) {
          return res.status(200).send();
        }
        if (eventId) {
          processedEvents.add(eventId);
          setTimeout(() => processedEvents.delete(eventId), EVENT_TTL);
        }

        // Respond immediately with 200 (Slack requires <3 seconds)
        res.status(200).send();

        // Process event asynchronously
        const event = payload.event;
        if (event?.type === 'message') {
          const adapter = getAdapter();
          if (adapter && adapter.isConnected()) {
            adapter.handleEvent(event).catch((err: unknown) => {
              log.error('Failed to handle Slack event', { error: String(err) });
            });
          } else {
            log.warn('Slack adapter not connected, dropping event');
          }
        }
        return;
      }

      // Unknown event type — acknowledge anyway
      res.status(200).send();
    } catch (err) {
      log.error('Slack events endpoint error', { error: String(err) });
      res.status(500).json({ error: 'Internal error' });
    }
  });

  log.info('Slack events route registered at POST /slack/events');
}
