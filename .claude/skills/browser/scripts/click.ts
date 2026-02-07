import { getPage, findByRef, readInput, success, error } from './lib/browser.js';
import { config } from './lib/config.js';

interface Input {
  ref: string;
}

async function main() {
  const input = await readInput<Input>();

  if (!input.ref) {
    error('Missing ref parameter');
    process.exit(1);
  }

  try {
    const page = await getPage();
    const element = await findByRef(page, input.ref);
    await element.click({ timeout: config.timeouts.action });

    // Wait a bit for any navigation/updates
    await page.waitForLoadState('domcontentloaded', { timeout: config.timeouts.navigation }).catch(() => {});

    success('Clicked element', { ref: input.ref, url: page.url() });
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to click element');
    process.exit(1);
  }
}

main();
