import { getPage, findByRef, readInput, success, error } from './lib/browser.js';
import { config } from './lib/config.js';

interface Input {
  ref: string;
  text: string;
}

async function main() {
  const input = await readInput<Input>();

  if (!input.ref) {
    error('Missing ref parameter');
    process.exit(1);
  }
  if (input.text === undefined) {
    error('Missing text parameter');
    process.exit(1);
  }

  try {
    const page = await getPage();
    const element = await findByRef(page, input.ref);
    await element.type(input.text, { timeout: config.timeouts.action });
    success('Typed text', { ref: input.ref, text: input.text });
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to type text');
    process.exit(1);
  }
}

main();
