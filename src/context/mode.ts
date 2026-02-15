/**
 * Operating Mode Detection
 *
 * Determines if KITT runs as personal assistant (1 user)
 * or digital employee (team/company deployment).
 *
 * Convention: if profile/user/BUSINESS.md exists → digital employee mode.
 */

import { readFileSafe } from './loaders/file-loader.js';

export type OperatingMode = 'personal-assistant' | 'digital-employee';

export async function getOperatingMode(): Promise<OperatingMode> {
  const business = await readFileSafe('profile/user/BUSINESS.md');
  return business ? 'digital-employee' : 'personal-assistant';
}

export async function isDigitalEmployee(): Promise<boolean> {
  return (await getOperatingMode()) === 'digital-employee';
}
