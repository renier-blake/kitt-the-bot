import { launchOrConnect, readInput, success, error } from './lib/browser.js';
import { config } from './lib/config.js';

interface Input {
  url: string;
}

async function main() {
  const input = await readInput<Input>();

  if (!input.url) {
    error('Missing url parameter');
    process.exit(1);
  }

  try {
    const { page } = await launchOrConnect();
    await page.goto(input.url, { timeout: config.timeouts.navigation });
    const title = await page.title();
    success('Page loaded', { url: page.url(), title });
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to open URL');
    process.exit(1);
  }
}

main();
