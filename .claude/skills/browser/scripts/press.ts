import { getPage, readInput, success, error } from './lib/browser.js';

interface Input {
  key: string;
}

async function main() {
  const input = await readInput<Input>();

  if (!input.key) {
    error('Missing key parameter (Enter, Tab, Escape, etc.)');
    process.exit(1);
  }

  try {
    const page = await getPage();
    await page.keyboard.press(input.key);
    success('Key pressed', { key: input.key });
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to press key');
    process.exit(1);
  }
}

main();
