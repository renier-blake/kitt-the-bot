/**
 * Credential Vault — Crypto Module
 *
 * AES-256-GCM encryption with machine-derived master key.
 * Master key is derived from machine-specific identifiers using PBKDF2.
 */

import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import os from 'node:os';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const SALT = 'kitt-credential-vault-v1'; // Static salt — machine ID provides entropy

let _masterKey: Buffer | null = null;

/**
 * Get a machine-specific identifier for master key derivation.
 * Cross-platform: macOS serial, Linux machine-id, Windows MachineGuid.
 * Falls back to hostname + username if nothing else works.
 */
function getMachineId(): string {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      // macOS: IOPlatformSerialNumber
      const serial = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice | awk -F'\"' '/IOPlatformSerialNumber/{print $4}'",
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();
      if (serial) return serial;
    } else if (platform === 'linux') {
      // Linux: /etc/machine-id
      const machineId = execSync('cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (machineId) return machineId;
    } else if (platform === 'win32') {
      // Windows: MachineGuid from registry
      const guid = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid 2>nul',
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();
      const match = guid.match(/MachineGuid\s+REG_SZ\s+(.+)/);
      if (match) return match[1].trim();
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: hostname + username (less unique but always available)
  return `${os.hostname()}-${os.userInfo().username}-fallback`;
}

/**
 * Derive the master encryption key from machine identifier.
 * Uses PBKDF2 with 100k iterations for key stretching.
 */
function deriveMasterKey(): Buffer {
  if (_masterKey) return _masterKey;

  const machineId = getMachineId();
  _masterKey = crypto.pbkdf2Sync(
    machineId,
    SALT,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );

  return _masterKey;
}

/**
 * Encrypt a plaintext value using AES-256-GCM.
 * Returns { encrypted, iv, authTag } — all as Buffers.
 */
export function encrypt(plaintext: string): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
  const key = deriveMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return { encrypted, iv, authTag };
}

/**
 * Decrypt an encrypted value using AES-256-GCM.
 * Returns the plaintext string.
 * Throws if decryption fails (wrong key, tampered data).
 */
export function decrypt(encrypted: Buffer, iv: Buffer, authTag: Buffer): string {
  const key = deriveMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf-8');
}

/**
 * Clear the cached master key (for testing or key rotation).
 */
export function clearMasterKeyCache(): void {
  _masterKey = null;
}
