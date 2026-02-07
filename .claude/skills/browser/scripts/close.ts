import { closeBrowser, success, error } from './lib/browser.js';

async function main() {
  try {
    await closeBrowser();
    success('Browser closed');
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to close browser');
    process.exit(1);
  }
}

main();
