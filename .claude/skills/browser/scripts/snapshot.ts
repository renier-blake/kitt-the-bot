import { getPage, getInteractiveElements, success, error } from './lib/browser.js';

async function main() {
  try {
    const page = await getPage();
    const elements = await getInteractiveElements(page);

    // Format as readable list
    const lines = elements.map(el => {
      const label = el.label ? ` "${el.label}"` : '';
      return `${el.type}${label} [ref=${el.ref}]`;
    });

    success('Snapshot complete', {
      url: page.url(),
      title: await page.title(),
      elementCount: elements.length,
      elements: lines,
    });
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to get snapshot');
    process.exit(1);
  }
}

main();
