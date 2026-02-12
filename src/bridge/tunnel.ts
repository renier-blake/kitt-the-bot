/**
 * Cloudflare Tunnel Manager
 *
 * Spawns cloudflared as a child process using a tunnel token from the credential vault.
 * Used by the Slack Events API adapter to receive webhooks on a public URL.
 *
 * The tunnel token is a dashboard-managed token — no cloudflared login or config file needed.
 * Just: cloudflared tunnel run --token <TOKEN>
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { getCredential } from '../credentials/index.js';
import { log } from './logger.js';

let tunnelProcess: ChildProcess | null = null;
let tunnelRunning = false;

/**
 * Start the Cloudflare Tunnel if a token is configured.
 * Returns true if the tunnel was started, false if skipped (no token or already running).
 */
export async function startTunnel(): Promise<boolean> {
  if (tunnelRunning) {
    log.info('Tunnel already running, skipping');
    return true;
  }

  const token = await getCredential('CLOUDFLARE_TUNNEL_TOKEN');
  if (!token) {
    log.warn('CLOUDFLARE_TUNNEL_TOKEN not configured — Slack events won\'t be received from external');
    return false;
  }

  // Check if cloudflared is available
  try {
    const { execSync } = await import('node:child_process');
    execSync('which cloudflared', { stdio: 'ignore' });
  } catch {
    log.error('cloudflared not found in PATH — install with: brew install cloudflared');
    return false;
  }

  log.info('Starting Cloudflare Tunnel...');

  tunnelProcess = spawn('cloudflared', ['tunnel', 'run', '--token', token], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  tunnelProcess.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) {
      console.log(`[tunnel] ${line}`);
    }
  });

  tunnelProcess.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) {
      // cloudflared logs most output to stderr (even info messages)
      // Filter for actual errors vs normal operation logs
      if (line.includes('ERR') || line.includes('error')) {
        console.error(`[tunnel] ${line}`);
      } else {
        console.log(`[tunnel] ${line}`);
      }
    }
  });

  tunnelProcess.on('exit', (code, signal) => {
    tunnelRunning = false;
    tunnelProcess = null;
    if (code !== null && code !== 0) {
      log.error('Cloudflare Tunnel exited', { code: String(code) });
    } else if (signal) {
      log.info('Cloudflare Tunnel stopped', { signal });
    }
  });

  tunnelProcess.on('error', (err) => {
    tunnelRunning = false;
    tunnelProcess = null;
    log.error('Cloudflare Tunnel spawn error', { error: String(err) });
  });

  tunnelRunning = true;
  log.info('Cloudflare Tunnel started');
  return true;
}

/**
 * Stop the Cloudflare Tunnel gracefully.
 */
export function stopTunnel(): void {
  if (tunnelProcess) {
    log.info('Stopping Cloudflare Tunnel...');
    tunnelProcess.kill('SIGTERM');
    tunnelProcess = null;
    tunnelRunning = false;
  }
}

/**
 * Check if the tunnel is currently running.
 */
export function isTunnelRunning(): boolean {
  return tunnelRunning;
}
