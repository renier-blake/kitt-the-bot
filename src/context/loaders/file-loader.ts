/**
 * File Loader
 *
 * Loads markdown files from disk and formats them with headers.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Read a file safely, returning null on error
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    return content.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Load a markdown file and format it with a header
 */
export async function loadFile(
  filePath: string,
  header?: string
): Promise<string | null> {
  const content = await readFileSafe(filePath);

  if (!content) {
    return null;
  }

  if (header) {
    return `# ${header}\n\n${content}`;
  }

  return content;
}
