#!/usr/bin/env npx tsx
/**
 * Notion API CLI — Direct OAuth / Internal Token
 * Usage: npx tsx .claude/skills/notion/notion-api.ts <command> [options]
 */

import { config } from 'dotenv';
config();

import { notionFetch, getNotionToken } from '../../../src/integrations/notion.js';

// --- Types ---

interface NotionUser {
  object: string;
  id: string;
  type: string;
  name: string;
  avatar_url: string | null;
  person?: { email: string };
  bot?: {
    owner: { type: string; workspace?: boolean };
    workspace_name?: string;
  };
}

interface NotionPage {
  object: string;
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
  properties: Record<string, NotionProperty>;
  parent: { type: string; page_id?: string; database_id?: string; workspace?: boolean };
  icon?: { type: string; emoji?: string } | null;
}

interface NotionDatabase {
  object: string;
  id: string;
  created_time: string;
  last_edited_time: string;
  title: Array<{ plain_text: string }>;
  description: Array<{ plain_text: string }>;
  properties: Record<string, { id: string; type: string; name: string }>;
  url: string;
  archived: boolean;
}

interface NotionBlock {
  object: string;
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  [key: string]: unknown;
}

interface NotionComment {
  object: string;
  id: string;
  created_time: string;
  created_by: { id: string };
  rich_text: Array<{ plain_text: string }>;
}

interface NotionProperty {
  id: string;
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  number?: number | null;
  select?: { name: string } | null;
  multi_select?: Array<{ name: string }>;
  date?: { start: string; end?: string | null } | null;
  checkbox?: boolean;
  url?: string | null;
  email?: string | null;
  phone_number?: string | null;
  status?: { name: string } | null;
  people?: Array<{ name: string; id: string }>;
  relation?: Array<{ id: string }>;
  formula?: { type: string; string?: string; number?: number; boolean?: boolean };
  rollup?: { type: string; number?: number; array?: unknown[] };
  [key: string]: unknown;
}

interface NotionList<T> {
  object: string;
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
}

// --- Helpers ---

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=');
      flags[key] = valueParts.join('=') || 'true';
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function formatId(id: string): string {
  // Notion accepts IDs with or without dashes
  return id.replace(/-/g, '');
}

function getPropertyValue(prop: NotionProperty): string {
  switch (prop.type) {
    case 'title':
      return prop.title?.map(t => t.plain_text).join('') || '';
    case 'rich_text':
      return prop.rich_text?.map(t => t.plain_text).join('') || '';
    case 'number':
      return prop.number !== null && prop.number !== undefined ? String(prop.number) : '';
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return prop.multi_select?.map(s => s.name).join(', ') || '';
    case 'date':
      if (!prop.date) return '';
      return prop.date.end ? `${prop.date.start} → ${prop.date.end}` : prop.date.start;
    case 'checkbox':
      return prop.checkbox ? '✓' : '✗';
    case 'url':
      return prop.url || '';
    case 'email':
      return prop.email || '';
    case 'phone_number':
      return prop.phone_number || '';
    case 'status':
      return prop.status?.name || '';
    case 'people':
      return prop.people?.map(p => p.name).join(', ') || '';
    case 'formula':
      return prop.formula?.string || String(prop.formula?.number ?? prop.formula?.boolean ?? '');
    default:
      return `(${prop.type})`;
  }
}

function getPageTitle(page: NotionPage): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === 'title') {
      return prop.title?.map(t => t.plain_text).join('') || '(untitled)';
    }
  }
  return '(untitled)';
}

function getBlockText(block: NotionBlock): string {
  const content = block[block.type] as { rich_text?: Array<{ plain_text: string }>; checked?: boolean } | undefined;
  if (!content?.rich_text) return '';
  const text = content.rich_text.map((t: { plain_text: string }) => t.plain_text).join('');
  if (block.type === 'to_do' && content.checked !== undefined) {
    return `${content.checked ? '[x]' : '[ ]'} ${text}`;
  }
  return text;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

async function checkConnection(): Promise<void> {
  const token = await getNotionToken();
  if (!token) {
    console.error('Notion niet verbonden. Koppel via Portal > Integrations > Notion.');
    process.exit(1);
  }
}

// --- Commands ---

async function me(): Promise<void> {
  const user = await notionFetch<NotionUser>('/v1/users/me');
  console.log(`Bot: ${user.name}`);
  if (user.bot?.workspace_name) console.log(`Workspace: ${user.bot.workspace_name}`);
  console.log(`Type: ${user.type}`);
  console.log(`ID: ${user.id}`);
}

async function search(query: string, type?: string): Promise<void> {
  const data: Record<string, unknown> = { query, page_size: 20 };
  if (type === 'page' || type === 'database') {
    data.filter = { value: type, property: 'object' };
  }
  data.sort = { direction: 'descending', timestamp: 'last_edited_time' };

  const result = await notionFetch<NotionList<NotionPage | NotionDatabase>>('/v1/search', {
    method: 'POST',
    data,
  });

  if (result.results.length === 0) {
    console.log(`Geen resultaten voor "${query}".`);
    return;
  }

  console.log(`Zoekresultaten voor "${query}" (${result.results.length}):\n`);

  for (const item of result.results) {
    if (item.object === 'page') {
      const page = item as NotionPage;
      const title = getPageTitle(page);
      const icon = page.icon?.emoji ? `${page.icon.emoji} ` : '';
      const edited = formatDate(page.last_edited_time);
      console.log(`  📄 ${icon}${title}`);
      console.log(`     ID: ${page.id} | Edited: ${edited}`);
      if (page.archived) console.log(`     ⚠️ Gearchiveerd`);
      console.log('');
    } else if (item.object === 'database') {
      const db = item as NotionDatabase;
      const title = db.title.map(t => t.plain_text).join('') || '(untitled)';
      const edited = formatDate(db.last_edited_time);
      console.log(`  🗃️ ${title}`);
      console.log(`     ID: ${db.id} | Edited: ${edited}`);
      console.log('');
    }
  }

  if (result.has_more) {
    console.log(`... meer resultaten beschikbaar`);
  }
}

async function getPage(pageId: string): Promise<void> {
  const page = await notionFetch<NotionPage>(`/v1/pages/${formatId(pageId)}`);

  const title = getPageTitle(page);
  const icon = page.icon?.emoji ? `${page.icon.emoji} ` : '';

  console.log(`📄 ${icon}${title}`);
  console.log(`ID: ${page.id}`);
  console.log(`URL: ${page.url}`);
  console.log(`Created: ${formatDate(page.created_time)}`);
  console.log(`Edited: ${formatDate(page.last_edited_time)}`);
  if (page.archived) console.log(`Status: Gearchiveerd`);

  // Show properties (skip title which we already showed)
  const props = Object.entries(page.properties).filter(([, p]) => p.type !== 'title');
  if (props.length > 0) {
    console.log(`\nProperties:`);
    for (const [name, prop] of props) {
      const value = getPropertyValue(prop);
      if (value) console.log(`  ${name}: ${value}`);
    }
  }
}

async function createPage(parentId: string, title: string, parentType: string): Promise<void> {
  const data: Record<string, unknown> = {};

  if (parentType === 'database') {
    data.parent = { database_id: formatId(parentId) };
    data.properties = {
      Name: { title: [{ text: { content: title } }] },
    };
  } else {
    data.parent = { page_id: formatId(parentId) };
    data.properties = {
      title: { title: [{ text: { content: title } }] },
    };
  }

  const page = await notionFetch<NotionPage>('/v1/pages', {
    method: 'POST',
    data,
  });

  console.log(`Page aangemaakt: ${title}`);
  console.log(`ID: ${page.id}`);
  console.log(`URL: ${page.url}`);
}

async function updatePage(pageId: string, flags: Record<string, string>): Promise<void> {
  const data: Record<string, unknown> = {};

  if (flags.title) {
    data.properties = {
      Name: { title: [{ text: { content: flags.title } }] },
    };
  }
  if (flags.archived === 'true') {
    data.archived = true;
  } else if (flags.archived === 'false') {
    data.archived = false;
  }

  if (Object.keys(data).length === 0) {
    console.error('Geen velden om te updaten. Gebruik --title=x of --archived=true');
    process.exit(1);
  }

  const page = await notionFetch<NotionPage>(`/v1/pages/${formatId(pageId)}`, {
    method: 'PATCH',
    data,
  });

  const title = getPageTitle(page);
  console.log(`Page geüpdatet: ${title}`);
  if (page.archived) console.log(`Status: Gearchiveerd`);
}

async function getDatabase(dbId: string): Promise<void> {
  const db = await notionFetch<NotionDatabase>(`/v1/databases/${formatId(dbId)}`);

  const title = db.title.map(t => t.plain_text).join('') || '(untitled)';
  const desc = db.description.map(t => t.plain_text).join('') || '';

  console.log(`🗃️ ${title}`);
  console.log(`ID: ${db.id}`);
  console.log(`URL: ${db.url}`);
  if (desc) console.log(`Beschrijving: ${desc}`);
  console.log(`Edited: ${formatDate(db.last_edited_time)}`);

  console.log(`\nProperties schema:`);
  for (const [name, prop] of Object.entries(db.properties)) {
    console.log(`  ${name} (${prop.type})`);
  }
}

async function queryDatabase(dbId: string, flags: Record<string, string>): Promise<void> {
  const data: Record<string, unknown> = {
    page_size: parseInt(flags.limit) || 50,
  };

  if (flags.filter) {
    try {
      data.filter = JSON.parse(flags.filter);
    } catch {
      console.error('Invalid --filter JSON');
      process.exit(1);
    }
  }

  const result = await notionFetch<NotionList<NotionPage>>(`/v1/databases/${formatId(dbId)}/query`, {
    method: 'POST',
    data,
  });

  if (result.results.length === 0) {
    console.log('Geen resultaten.');
    return;
  }

  console.log(`Resultaten (${result.results.length}):\n`);

  for (const page of result.results) {
    const title = getPageTitle(page);
    const icon = page.icon?.emoji ? `${page.icon.emoji} ` : '';

    // Get key properties (non-title, with values)
    const props = Object.entries(page.properties)
      .filter(([, p]) => p.type !== 'title')
      .map(([name, p]) => ({ name, value: getPropertyValue(p) }))
      .filter(p => p.value);

    console.log(`  ${icon}${title} (${page.id})`);
    for (const p of props.slice(0, 4)) {
      console.log(`    ${p.name}: ${p.value}`);
    }
    console.log('');
  }

  if (result.has_more) {
    console.log(`... meer resultaten beschikbaar (next_cursor: ${result.next_cursor})`);
  }
}

async function createDatabase(parentPageId: string, title: string): Promise<void> {
  const db = await notionFetch<NotionDatabase>('/v1/databases', {
    method: 'POST',
    data: {
      parent: { page_id: formatId(parentPageId) },
      title: [{ text: { content: title } }],
      properties: {
        Name: { title: {} },
      },
    },
  });

  const dbTitle = db.title.map(t => t.plain_text).join('');
  console.log(`Database aangemaakt: ${dbTitle}`);
  console.log(`ID: ${db.id}`);
  console.log(`URL: ${db.url}`);
}

async function listBlocks(blockId: string, limit?: number): Promise<void> {
  const params: Record<string, string> = {};
  if (limit) params.page_size = String(limit);

  const result = await notionFetch<NotionList<NotionBlock>>(`/v1/blocks/${formatId(blockId)}/children`, {
    params,
  });

  if (result.results.length === 0) {
    console.log('Geen blocks.');
    return;
  }

  console.log(`Blocks (${result.results.length}):\n`);

  for (const block of result.results) {
    const text = getBlockText(block);
    const prefix = blockTypePrefix(block.type);
    const children = block.has_children ? ' (+children)' : '';
    console.log(`  ${prefix}${text}${children}`);
    console.log(`    [${block.type}] ${block.id}`);
  }

  if (result.has_more) {
    console.log(`\n... meer blocks beschikbaar`);
  }
}

function blockTypePrefix(type: string): string {
  switch (type) {
    case 'heading_1': return '# ';
    case 'heading_2': return '## ';
    case 'heading_3': return '### ';
    case 'bulleted_list_item': return '• ';
    case 'numbered_list_item': return '1. ';
    case 'to_do': return '';
    case 'toggle': return '▸ ';
    case 'quote': return '> ';
    case 'callout': return '💡 ';
    case 'code': return '``` ';
    case 'divider': return '---';
    case 'image': return '🖼️ ';
    default: return '';
  }
}

async function appendBlock(blockId: string, text: string, blockType: string): Promise<void> {
  const richText = [{ text: { content: text } }];

  let blockData: Record<string, unknown>;
  switch (blockType) {
    case 'heading_2':
      blockData = { type: 'heading_2', heading_2: { rich_text: richText } };
      break;
    case 'to_do':
      blockData = { type: 'to_do', to_do: { rich_text: richText, checked: false } };
      break;
    case 'bulleted_list_item':
      blockData = { type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText } };
      break;
    default:
      blockData = { type: 'paragraph', paragraph: { rich_text: richText } };
  }

  await notionFetch(`/v1/blocks/${formatId(blockId)}/children`, {
    method: 'PATCH',
    data: { children: [blockData] },
  });

  console.log(`Block toegevoegd aan ${blockId} (${blockType}).`);
}

async function deleteBlock(blockId: string): Promise<void> {
  await notionFetch(`/v1/blocks/${formatId(blockId)}`, {
    method: 'DELETE',
  });

  console.log(`Block verwijderd: ${blockId}`);
}

async function listComments(pageOrBlockId: string): Promise<void> {
  const result = await notionFetch<NotionList<NotionComment>>('/v1/comments', {
    params: { block_id: formatId(pageOrBlockId), page_size: '100' },
  });

  if (result.results.length === 0) {
    console.log('Geen comments.');
    return;
  }

  console.log(`Comments (${result.results.length}):\n`);

  for (const c of result.results) {
    const text = c.rich_text.map(t => t.plain_text).join('');
    const date = formatDate(c.created_time);
    console.log(`  ${date}:`);
    console.log(`  ${text}\n`);
  }
}

async function addComment(pageId: string, text: string): Promise<void> {
  await notionFetch('/v1/comments', {
    method: 'POST',
    data: {
      parent: { page_id: formatId(pageId) },
      rich_text: [{ text: { content: text } }],
    },
  });

  console.log(`Comment geplaatst op ${pageId}.`);
}

async function listUsers(): Promise<void> {
  const result = await notionFetch<NotionList<NotionUser>>('/v1/users');

  console.log(`Users (${result.results.length}):\n`);

  for (const user of result.results) {
    const email = user.person?.email ? ` (${user.person.email})` : '';
    const type = user.type === 'bot' ? ' [bot]' : '';
    console.log(`  ${user.name}${email}${type}`);
    console.log(`    ID: ${user.id}`);
  }
}

// --- Main ---

async function main(): Promise<void> {
  const [, , command, ...rawArgs] = process.argv;
  const { positional, flags } = parseFlags(rawArgs);

  if (!command) {
    console.log(`Usage: npx tsx notion-api.ts <command> [options]

Commands:
  me                                          Bot info en workspace
  search <query> [--type=page|database]       Zoek pages en databases
  page <id>                                   Page properties
  create-page <parent_id> <title> [--parent-type=page|database]  Page aanmaken
  update-page <id> [--title=x] [--archived=true|false]           Page updaten
  database <id>                               Database schema
  query <database_id> [--filter=json] [--limit=n]                Query database
  create-db <parent_page_id> <title>          Database aanmaken
  blocks <id> [--limit=n]                     Block children ophalen
  append <id> <text> [--type=paragraph|heading_2|to_do|bulleted_list_item]  Block toevoegen
  delete-block <id>                           Block verwijderen
  comments <page_or_block_id>                 Comments ophalen
  comment <page_id> <text>                    Comment plaatsen
  users                                       Lijst workspace users`);
    process.exit(0);
  }

  await checkConnection();

  try {
    switch (command) {
      case 'me':
        await me();
        break;

      case 'search': {
        const query = positional.join(' ');
        if (!query) { console.error('Usage: search <query> [--type=page|database]'); process.exit(1); }
        await search(query, flags.type);
        break;
      }

      case 'page': {
        const id = positional[0];
        if (!id) { console.error('Usage: page <id>'); process.exit(1); }
        await getPage(id);
        break;
      }

      case 'create-page': {
        const parentId = positional[0];
        const title = positional.slice(1).join(' ');
        if (!parentId || !title) { console.error('Usage: create-page <parent_id> <title> [--parent-type=page|database]'); process.exit(1); }
        await createPage(parentId, title, flags['parent-type'] || 'page');
        break;
      }

      case 'update-page': {
        const id = positional[0];
        if (!id) { console.error('Usage: update-page <id> [--title=x] [--archived=true]'); process.exit(1); }
        await updatePage(id, flags);
        break;
      }

      case 'database': {
        const id = positional[0];
        if (!id) { console.error('Usage: database <id>'); process.exit(1); }
        await getDatabase(id);
        break;
      }

      case 'query': {
        const dbId = positional[0];
        if (!dbId) { console.error('Usage: query <database_id> [--filter=json] [--limit=n]'); process.exit(1); }
        await queryDatabase(dbId, flags);
        break;
      }

      case 'create-db': {
        const parentId = positional[0];
        const title = positional.slice(1).join(' ');
        if (!parentId || !title) { console.error('Usage: create-db <parent_page_id> <title>'); process.exit(1); }
        await createDatabase(parentId, title);
        break;
      }

      case 'blocks': {
        const id = positional[0];
        if (!id) { console.error('Usage: blocks <id> [--limit=n]'); process.exit(1); }
        await listBlocks(id, flags.limit ? parseInt(flags.limit) : undefined);
        break;
      }

      case 'append': {
        const id = positional[0];
        const text = positional.slice(1).join(' ');
        if (!id || !text) { console.error('Usage: append <id> <text> [--type=paragraph|heading_2|to_do|bulleted_list_item]'); process.exit(1); }
        await appendBlock(id, text, flags.type || 'paragraph');
        break;
      }

      case 'delete-block': {
        const id = positional[0];
        if (!id) { console.error('Usage: delete-block <id>'); process.exit(1); }
        await deleteBlock(id);
        break;
      }

      case 'comments': {
        const id = positional[0];
        if (!id) { console.error('Usage: comments <page_or_block_id>'); process.exit(1); }
        await listComments(id);
        break;
      }

      case 'comment': {
        const id = positional[0];
        const text = positional.slice(1).join(' ');
        if (!id || !text) { console.error('Usage: comment <page_id> <text>'); process.exit(1); }
        await addComment(id, text);
        break;
      }

      case 'users':
        await listUsers();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
