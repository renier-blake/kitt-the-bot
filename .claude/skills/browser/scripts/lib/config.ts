import { resolve } from 'path';

const skillDir = resolve(import.meta.dirname, '../..');

export const config = {
  browserPath: process.env.BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  profileDir: process.env.BROWSER_PROFILE_DIR || resolve(skillDir, 'data/browser-profile'),
  wsEndpointFile: resolve(skillDir, 'data/.ws-endpoint'),
  viewport: { width: 1280, height: 800 },
  headless: false,
  timeouts: {
    navigation: 30000,
    element: 5000,
    action: 2000,
  },
};
