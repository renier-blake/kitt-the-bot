import { getPage, readInput, success, error } from './lib/browser.js';
import { resolve } from 'path';
import { tmpdir } from 'os';

interface Input {
  fullPage?: boolean;
  path?: string;
}

async function main() {
  const input = await readInput<Input>();

  try {
    const page = await getPage();

    // Generate path if not provided
    const path = input.path || resolve(tmpdir(), `screenshot-${Date.now()}.png`);

    await page.screenshot({
      path,
      fullPage: input.fullPage ?? false,
    });

    success('Screenshot saved', { path, fullPage: input.fullPage ?? false });
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to take screenshot');
    process.exit(1);
  }
}

main();
