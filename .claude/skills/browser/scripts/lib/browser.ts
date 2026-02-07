import { chromium, type BrowserContext, type Page, type Browser } from 'playwright';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from './config.js';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

// Element ref mapping - persisted to file for cross-process sharing
const refMapFile = config.wsEndpointFile.replace('.ws-endpoint', '.refs.json');
let refMap = new Map<string, string>();
let refCounter = 0;

/**
 * Load refs from file (for cross-process sharing)
 */
function loadRefs(): void {
  if (existsSync(refMapFile)) {
    try {
      const data = JSON.parse(readFileSync(refMapFile, 'utf-8'));
      refMap = new Map(Object.entries(data.refs || {}));
      refCounter = data.counter || 0;
    } catch {}
  }
}

/**
 * Save refs to file (for cross-process sharing)
 */
function saveRefs(): void {
  const data = {
    refs: Object.fromEntries(refMap),
    counter: refCounter,
  };
  mkdirSync(dirname(refMapFile), { recursive: true });
  writeFileSync(refMapFile, JSON.stringify(data));
}

/**
 * Launch browser or connect to existing instance
 */
export async function launchOrConnect(): Promise<{ context: BrowserContext; page: Page }> {
  // Load refs from previous session
  loadRefs();

  // Try to connect to existing browser via CDP
  if (existsSync(config.wsEndpointFile)) {
    try {
      const cdpUrl = readFileSync(config.wsEndpointFile, 'utf-8').trim();
      browser = await chromium.connectOverCDP(cdpUrl);
      const contexts = browser.contexts();
      if (contexts.length > 0) {
        context = contexts[0];
        const pages = context.pages();
        page = pages.length > 0 ? pages[0] : await context.newPage();
        return { context, page };
      }
    } catch {
      // Connection failed, will launch new browser
      try { unlinkSync(config.wsEndpointFile); } catch {}
    }
  }

  // Ensure data directory exists
  mkdirSync(dirname(config.wsEndpointFile), { recursive: true });

  // Launch new persistent browser
  context = await chromium.launchPersistentContext(config.profileDir, {
    executablePath: config.browserPath,
    headless: config.headless,
    viewport: config.viewport,
    args: [
      '--remote-debugging-port=9222',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  // Save CDP endpoint for reconnection
  writeFileSync(config.wsEndpointFile, 'http://127.0.0.1:9222');

  page = context.pages()[0] || await context.newPage();
  return { context, page };
}

/**
 * Get current page (throws if not connected)
 */
export async function getPage(): Promise<Page> {
  if (!page || !context) {
    const result = await launchOrConnect();
    return result.page;
  }
  return page;
}

/**
 * Close browser and cleanup
 */
export async function closeBrowser(): Promise<void> {
  // Connect to browser if we have an endpoint
  if (!browser && existsSync(config.wsEndpointFile)) {
    try {
      const cdpUrl = readFileSync(config.wsEndpointFile, 'utf-8').trim();
      browser = await chromium.connectOverCDP(cdpUrl);
    } catch {}
  }

  // Close browser (kills the process)
  if (browser) {
    await browser.close();
    browser = null;
  }

  // Also close context if launched directly
  if (context) {
    try { await context.close(); } catch {}
    context = null;
  }

  page = null;

  // Cleanup state files
  try { unlinkSync(config.wsEndpointFile); } catch {}
  try { unlinkSync(refMapFile); } catch {}
}

/**
 * Read JSON input from stdin
 */
export async function readInput<T = Record<string, unknown>>(): Promise<T> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      if (data.trim()) {
        try {
          resolve(JSON.parse(data.trim()) as T);
        } catch {
          resolve({} as T);
        }
      } else {
        resolve({} as T);
      }
    });
    // If no stdin after 100ms, resolve with empty object
    setTimeout(() => {
      if (!data) resolve({} as T);
    }, 100);
  });
}

/**
 * Output JSON to stdout
 */
export function output(data: Record<string, unknown>): void {
  console.log(JSON.stringify(data));
}

/**
 * Output success response
 */
export function success(message: string, data?: Record<string, unknown>): void {
  output({ success: true, message, ...data });
}

/**
 * Output error response
 */
export function error(message: string): void {
  output({ success: false, message });
}

/**
 * Clear ref map for new snapshot
 */
export function clearRefs(): void {
  refMap.clear();
  refCounter = 0;
  saveRefs();
}

/**
 * Assign a ref to a selector
 */
export function assignRef(selector: string): string {
  refCounter++;
  const ref = `@e${refCounter}`;
  refMap.set(ref, selector);
  saveRefs();
  return ref;
}

/**
 * Get selector for a ref
 */
export function getSelector(ref: string): string | undefined {
  loadRefs();
  return refMap.get(ref);
}

/**
 * Get interactive elements with refs
 */
export async function getInteractiveElements(p: Page): Promise<Array<{ type: string; label: string; ref: string }>> {
  clearRefs();

  const elements: Array<{ type: string; label: string; ref: string }> = [];

  // Selectors for interactive elements
  const selectors = [
    { selector: 'input:not([type="hidden"])', type: 'input' },
    { selector: 'textarea', type: 'textarea' },
    { selector: 'button', type: 'button' },
    { selector: 'a[href]', type: 'link' },
    { selector: '[role="button"]', type: 'button' },
    { selector: '[role="link"]', type: 'link' },
    { selector: '[role="textbox"]', type: 'textbox' },
    { selector: 'select', type: 'select' },
  ];

  for (const { selector, type } of selectors) {
    const handles = await p.$$(selector);
    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const isVisible = await handle.isVisible().catch(() => false);
      if (!isVisible) continue;

      // Get label/text
      let label = await handle.getAttribute('aria-label') ||
                  await handle.getAttribute('placeholder') ||
                  await handle.getAttribute('title') ||
                  await handle.getAttribute('name') ||
                  await handle.innerText().catch(() => '') ||
                  '';
      label = label.trim().slice(0, 50);

      // Create unique selector using nth-match
      const uniqueSelector = `${selector} >> nth=${i}`;
      const ref = assignRef(uniqueSelector);

      elements.push({ type, label, ref });
    }
  }

  return elements;
}

/**
 * Find element by ref and perform action
 */
export async function findByRef(p: Page, ref: string): Promise<ReturnType<Page['$']>> {
  const selector = getSelector(ref);
  if (!selector) {
    throw new Error(`Unknown ref: ${ref}`);
  }
  const element = await p.$(selector);
  if (!element) {
    throw new Error(`Element not found for ref: ${ref}`);
  }
  return element;
}
