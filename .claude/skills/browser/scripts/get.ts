import { getPage, findByRef, readInput, success, error } from './lib/browser.js';

interface Input {
  ref?: string;
  prop: string;
}

async function main() {
  const input = await readInput<Input>();

  if (!input.prop) {
    error('Missing prop parameter (text, href, value, title, etc.)');
    process.exit(1);
  }

  try {
    const page = await getPage();

    // Page-level properties
    if (!input.ref) {
      if (input.prop === 'title') {
        success('Got page title', { value: await page.title() });
      } else if (input.prop === 'url') {
        success('Got page URL', { value: page.url() });
      } else {
        error('For page-level, prop must be "title" or "url"');
        process.exit(1);
      }
      return;
    }

    // Element-level properties
    const element = await findByRef(page, input.ref);

    let value: string;
    if (input.prop === 'text') {
      value = await element.innerText();
    } else if (input.prop === 'value') {
      value = await element.inputValue();
    } else {
      value = await element.getAttribute(input.prop) || '';
    }

    success('Got property', { ref: input.ref, prop: input.prop, value });
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to get property');
    process.exit(1);
  }
}

main();
