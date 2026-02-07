import { getPage, success, error } from './lib/browser.js';

const COOKIE_SELECTORS = [
  // Common accept buttons
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accepteren")',
  'button:has-text("Alles accepteren")',
  'button:has-text("Alle akzeptieren")',
  'button:has-text("Tout accepter")',
  'button:has-text("I agree")',
  'button:has-text("Agree")',
  'button:has-text("OK")',
  'button:has-text("Got it")',
  // Common IDs/classes
  '#onetrust-accept-btn-handler',
  '#accept-cookies',
  '.accept-cookies',
  '[data-testid="cookie-policy-dialog-accept-button"]',
  '[aria-label="Accept all"]',
  '[aria-label="Accept cookies"]',
];

async function main() {
  try {
    const page = await getPage();

    for (const selector of COOKIE_SELECTORS) {
      try {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
          await button.click();
          success('Cookie dialog dismissed', { selector });
          return;
        }
      } catch {}
    }

    success('No cookie dialog found');
  } catch (e) {
    error(e instanceof Error ? e.message : 'Failed to dismiss cookies');
    process.exit(1);
  }
}

main();
