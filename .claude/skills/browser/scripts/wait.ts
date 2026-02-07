import { getPage, findByRef, readInput, success, error } from './lib/browser.js';
import { config } from './lib/config.js';

interface Input {
  ref?: string;
  text?: string;
  url?: string;
  timeout?: number;
}

async function main() {
  const input = await readInput<Input>();
  const timeout = input.timeout ?? config.timeouts.element;

  try {
    const page = await getPage();

    if (input.ref) {
      // Wait for element by ref
      await findByRef(page, input.ref);
      success('Element found', { ref: input.ref });
    } else if (input.text) {
      // Wait for text on page
      await page.waitForSelector(`text=${input.text}`, { timeout });
      success('Text found', { text: input.text });
    } else if (input.url) {
      // Wait for URL match (supports glob patterns)
      await page.waitForURL(input.url, { timeout });
      success('URL matched', { url: page.url(), pattern: input.url });
    } else {
      error('Provide ref, text, or url parameter');
      process.exit(1);
    }
  } catch (e) {
    error(e instanceof Error ? e.message : 'Wait timeout');
    process.exit(1);
  }
}

main();
