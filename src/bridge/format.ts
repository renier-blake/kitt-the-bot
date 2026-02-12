/**
 * KITT Response Formatting
 *
 * Converts GitHub-flavored markdown (from LLM output) to Telegram MarkdownV2.
 * Telegram supports: *bold*, _italic_, `code`, ```code blocks```, ~strikethrough~, [links](url)
 * Telegram does NOT support: ## headers, ---, tables, > blockquotes
 */

/**
 * Characters that need escaping in Telegram MarkdownV2 (outside code/bold/italic/link sections)
 */
const ESCAPE_CHARS = ['[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

/**
 * Escape special characters for Telegram MarkdownV2
 * Does NOT escape * and _ since those are used for bold/italic formatting
 */
function escapeMarkdownV2(text: string): string {
  let result = text;
  for (const char of ESCAPE_CHARS) {
    result = result.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
  }
  return result;
}

/**
 * Convert GitHub-flavored markdown to Telegram MarkdownV2
 *
 * Transforms:
 * - ## Header → *Header* (bold)
 * - **bold** → *bold*
 * - --- → (removed)
 * - | table | → plain text rows
 * - > blockquote → italic text
 * - - list item → • list item
 */
function markdownToTelegram(text: string): string {
  // Split into code blocks and non-code sections
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts: { type: 'text' | 'code'; content: string; lang?: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2], lang: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // Process each part
  const result = parts.map((part) => {
    if (part.type === 'code') {
      // Code blocks pass through as-is
      return `\`\`\`${part.lang || ''}\n${part.content}\`\`\``;
    }

    // Process text sections line by line
    let processed = part.content;

    // Convert markdown tables to simple text
    processed = convertTables(processed);

    // Process line by line
    const lines = processed.split('\n');
    const resultLines = lines.map((line) => {
      // Remove horizontal rules
      if (/^-{3,}\s*$/.test(line) || /^\*{3,}\s*$/.test(line)) {
        return '';
      }

      // Convert headers: ## Header → *Header*
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const headerText = headerMatch[2]
          // Strip bold from header text (it's already bold via *)
          .replace(/\*\*(.+?)\*\*/g, '$1');
        return `\n*${escapeMarkdownV2(headerText)}*`;
      }

      // Convert blockquotes: > text → _text_
      const quoteMatch = line.match(/^>\s*(.*)$/);
      if (quoteMatch) {
        return `_${escapeMarkdownV2(quoteMatch[1])}_`;
      }

      // Convert bullet lists: - item → • item
      const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1];
        const content = convertInlineFormatting(bulletMatch[2]);
        return `${indent}• ${content}`;
      }

      // Regular line: convert inline formatting
      return convertInlineFormatting(line);
    });

    return resultLines.join('\n');
  });

  // Clean up excessive blank lines
  return result.join('')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/**
 * Convert inline markdown formatting to Telegram MarkdownV2
 */
function convertInlineFormatting(line: string): string {
  // Extract and preserve inline code spans first
  const codeSpans: string[] = [];
  let processed = line.replace(/`([^`]+)`/g, (_match, code) => {
    codeSpans.push(code);
    return `\x00CODE${codeSpans.length - 1}\x00`;
  });

  // Extract and preserve links
  const links: { text: string; url: string }[] = [];
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    links.push({ text, url });
    return `\x00LINK${links.length - 1}\x00`;
  });

  // Convert **bold** to *bold* (Telegram uses single *)
  processed = processed.replace(/\*\*(.+?)\*\*/g, '*$1*');

  // Convert __italic__ to _italic_ (keep as-is, Telegram supports this)
  // Already correct format

  // Escape remaining special chars (but not inside * or _ formatting)
  // We need to be careful: escape chars that aren't part of formatting
  const formattingParts: string[] = [];
  let remaining = processed;
  let safeProcessed = '';

  // Simple approach: split on formatting markers, escape non-formatted parts
  const formatRegex = /(\*[^*]+\*|_[^_]+_)/g;
  let fmtMatch;
  let fmtLastIndex = 0;

  while ((fmtMatch = formatRegex.exec(remaining)) !== null) {
    // Escape text before this formatting
    safeProcessed += escapeMarkdownV2(remaining.slice(fmtLastIndex, fmtMatch.index));
    // Keep formatting as-is (but escape inner special chars except the markers)
    const inner = fmtMatch[0];
    const marker = inner[0]; // * or _
    const innerText = inner.slice(1, -1);
    safeProcessed += `${marker}${escapeMarkdownV2(innerText)}${marker}`;
    fmtLastIndex = fmtMatch.index + fmtMatch[0].length;
  }
  safeProcessed += escapeMarkdownV2(remaining.slice(fmtLastIndex));

  // Restore inline code spans
  safeProcessed = safeProcessed.replace(/\x00CODE(\d+)\x00/g, (_match, idx) => {
    return `\`${codeSpans[parseInt(idx)]}\``;
  });

  // Restore links
  safeProcessed = safeProcessed.replace(/\x00LINK(\d+)\x00/g, (_match, idx) => {
    const link = links[parseInt(idx)];
    return `[${escapeMarkdownV2(link.text)}](${link.url})`;
  });

  return safeProcessed;
}

/**
 * Convert markdown tables to plain text
 * | Col1 | Col2 | → Col1: Col2
 */
function convertTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let headers: string[] = [];

  for (const line of lines) {
    // Table separator row (|---|---|)
    if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) {
      inTable = true;
      continue;
    }

    // Table row
    const tableMatch = line.match(/^\s*\|(.+)\|\s*$/);
    if (tableMatch) {
      const cells = tableMatch[1].split('|').map((c) => c.trim());

      if (!inTable) {
        // This is the header row
        headers = cells;
        inTable = true;
      } else {
        // Data row: format as readable text
        if (headers.length === cells.length && headers.length <= 4) {
          // Small table: use "header: value" pairs
          const pairs = cells
            .map((cell, i) => {
              if (!cell) return '';
              if (headers[i] && headers[i] !== cell) {
                return `${headers[i]}: ${cell}`;
              }
              return cell;
            })
            .filter(Boolean);
          result.push(pairs.join(' · '));
        } else {
          // Wide table: just join non-empty cells
          result.push(cells.filter(Boolean).join(' · '));
        }
      }
      continue;
    }

    // Not a table row
    if (inTable) {
      inTable = false;
      headers = [];
    }
    result.push(line);
  }

  return result.join('\n');
}

/**
 * Format response for Telegram MarkdownV2
 */
export function formatForTelegram(text: string): string {
  return markdownToTelegram(text);
}

/**
 * Try to format as MarkdownV2, fall back to plain text on error
 */
export function formatForTelegramSafe(text: string): {
  text: string;
  parseMode: 'MarkdownV2' | undefined;
} {
  try {
    const formatted = formatForTelegram(text);
    return { text: formatted, parseMode: 'MarkdownV2' };
  } catch {
    // Fallback to plain text
    return { text, parseMode: undefined };
  }
}

/**
 * Convert GitHub-flavored markdown to Slack mrkdwn format.
 * Slack uses: *bold*, _italic_, ~strikethrough~, `code`, ```code blocks```, <url|text>
 * Slack does NOT support: ## headers, [links](url) — must be converted.
 */
export function formatForSlack(text: string): string {
  // Split into code blocks and non-code sections
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const codeBlocks: string[] = [];
  let processed = text.replace(codeBlockRegex, (_match, lang, code) => {
    codeBlocks.push(`\`\`\`${lang ? lang + '\n' : ''}${code}\`\`\``);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // Preserve inline code
  const inlineCodes: string[] = [];
  processed = processed.replace(/`([^`]+)`/g, (_match, code) => {
    inlineCodes.push(`\`${code}\``);
    return `\x00IC${inlineCodes.length - 1}\x00`;
  });

  // Convert headers: ## Header → *Header*
  processed = processed.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // Convert bold: **text** → *text*
  processed = processed.replace(/\*\*(.+?)\*\*/g, '*$1*');

  // Convert strikethrough: ~~text~~ → ~text~
  processed = processed.replace(/~~(.+?)~~/g, '~$1~');

  // Convert links: [text](url) → <url|text>
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // Convert bullet lists with * to -
  processed = processed.replace(/^(\s*)\*\s+/gm, '$1- ');

  // Remove horizontal rules
  processed = processed.replace(/^-{3,}\s*$/gm, '');

  // Restore inline code
  processed = processed.replace(/\x00IC(\d+)\x00/g, (_match, idx) => inlineCodes[parseInt(idx)]);

  // Restore code blocks
  processed = processed.replace(/\x00CB(\d+)\x00/g, (_match, idx) => codeBlocks[parseInt(idx)]);

  return processed.replace(/\n{4,}/g, '\n\n\n').trim();
}

/**
 * Split a long message into chunks at natural boundaries
 */
export function splitMessage(text: string, maxLength: number = 4000): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a double newline (paragraph)
    let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // Try single newline
      splitIndex = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // Try space
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // Force split
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
