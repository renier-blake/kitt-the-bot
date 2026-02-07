/**
 * KITT Response Formatting
 * Formats responses for Telegram MarkdownV2
 */

/**
 * Characters that need escaping in Telegram MarkdownV2 (outside code blocks)
 */
const ESCAPE_CHARS = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

/**
 * Escape special characters for Telegram MarkdownV2
 */
function escapeMarkdownV2(text: string): string {
  let result = text;
  for (const char of ESCAPE_CHARS) {
    result = result.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
  }
  return result;
}

/**
 * Format code blocks for Telegram
 * Preserves content inside code blocks without escaping
 */
function formatCodeBlocks(text: string): string {
  // Match fenced code blocks: ```lang\ncode```
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  // Split text into code blocks and regular text
  const parts: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add escaped text before code block
    if (match.index > lastIndex) {
      parts.push(escapeMarkdownV2(text.slice(lastIndex, match.index)));
    }

    // Add code block as-is (Telegram handles code block content)
    const lang = match[1] || '';
    const code = match[2];
    parts.push(`\`\`\`${lang}\n${code}\`\`\``);

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(escapeMarkdownV2(text.slice(lastIndex)));
  }

  return parts.join('');
}

/**
 * Format response for Telegram MarkdownV2
 * Returns the formatted text
 */
export function formatForTelegram(text: string): string {
  // Handle code blocks (they don't need escaping inside)
  return formatCodeBlocks(text);
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
