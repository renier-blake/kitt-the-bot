#!/usr/bin/env npx tsx
/**
 * Asana API CLI — Direct OAuth / PAT
 * Usage: npx tsx .claude/skills/asana/asana-api.ts <command> [options]
 */

import { config } from 'dotenv';
config();

import { asanaFetch, getAsanaToken, getWorkspaceGid } from '../../../src/integrations/asana.js';

// --- Types ---

interface AsanaUser {
  gid: string;
  name: string;
  email: string;
  workspaces: Array<{ gid: string; name: string }>;
}

interface AsanaProject {
  gid: string;
  name: string;
  color?: string;
  archived?: boolean;
  team?: { name: string };
  notes?: string;
  members?: Array<{ name: string }>;
}

interface AsanaSection {
  gid: string;
  name: string;
}

interface AsanaTask {
  gid: string;
  name: string;
  completed?: boolean;
  assignee?: { name: string; email?: string } | null;
  due_on?: string | null;
  notes?: string;
  tags?: Array<{ gid: string; name: string }>;
  memberships?: Array<{ section?: { name: string } }>;
}

interface AsanaStory {
  gid: string;
  text: string;
  type: string;
  created_at: string;
  created_by?: { name: string };
}

interface AsanaTag {
  gid: string;
  name: string;
  color?: string;
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

async function checkConnection(): Promise<void> {
  const token = await getAsanaToken();
  if (!token) {
    console.error('Asana niet verbonden. Koppel via Portal > Integrations > Asana.');
    process.exit(1);
  }
}

// --- Commands ---

async function me(): Promise<void> {
  const user = await asanaFetch<AsanaUser>('/users/me');
  console.log(`User: ${user.name} (${user.email})`);
  console.log(`Workspaces:`);
  for (const ws of user.workspaces) {
    console.log(`  - ${ws.name} (${ws.gid})`);
  }
}

async function listProjects(): Promise<void> {
  const workspaceGid = await getWorkspaceGid();
  const projects = await asanaFetch<AsanaProject[]>('/projects', {
    params: {
      workspace: workspaceGid,
      opt_fields: 'name,color,archived,team.name',
      limit: '100',
    },
  });

  const active = projects.filter(p => !p.archived);
  const archived = projects.filter(p => p.archived);

  console.log(`Projecten (${active.length} actief):\n`);
  for (const p of active) {
    const team = p.team?.name ? ` [${p.team.name}]` : '';
    console.log(`  ${p.name}${team} (${p.gid})`);
  }

  if (archived.length > 0) {
    console.log(`\nGearchiveerd (${archived.length}):`);
    for (const p of archived) {
      console.log(`  ${p.name} (${p.gid})`);
    }
  }
}

async function getProject(gid: string): Promise<void> {
  const project = await asanaFetch<AsanaProject>(`/projects/${gid}`, {
    params: { opt_fields: 'name,notes,color,archived,team.name,members.name' },
  });

  console.log(`Project: ${project.name}`);
  if (project.team?.name) console.log(`Team: ${project.team.name}`);
  if (project.archived) console.log(`Status: Gearchiveerd`);
  if (project.notes) console.log(`\nNotes:\n${project.notes}`);
  if (project.members?.length) {
    console.log(`\nMembers:`);
    for (const m of project.members) {
      console.log(`  - ${m.name}`);
    }
  }
}

async function listSections(projectGid: string): Promise<void> {
  const sections = await asanaFetch<AsanaSection[]>(`/projects/${projectGid}/sections`, {
    params: { opt_fields: 'name' },
  });

  console.log(`Secties (${sections.length}):\n`);
  for (const s of sections) {
    console.log(`  ${s.name} (${s.gid})`);
  }
}

async function listTasks(projectGid: string, sectionGid?: string): Promise<void> {
  const params: Record<string, string> = {
    opt_fields: 'name,completed,assignee.name,due_on,tags.name',
    limit: '100',
  };

  let endpoint: string;
  if (sectionGid) {
    endpoint = `/sections/${sectionGid}/tasks`;
  } else {
    endpoint = '/tasks';
    params.project = projectGid;
  }

  const tasks = await asanaFetch<AsanaTask[]>(endpoint, { params });

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  console.log(`Taken (${open.length} open, ${done.length} afgerond):\n`);

  for (const t of open) {
    const assignee = t.assignee?.name ? ` -> ${t.assignee.name}` : '';
    const due = t.due_on ? ` [${t.due_on}]` : '';
    const tags = t.tags?.length ? ` {${t.tags.map(tag => tag.name).join(', ')}}` : '';
    console.log(`  [ ] ${t.name}${assignee}${due}${tags} (${t.gid})`);
  }

  if (done.length > 0) {
    console.log(`\nAfgerond:`);
    for (const t of done) {
      console.log(`  [x] ${t.name} (${t.gid})`);
    }
  }
}

async function getTask(gid: string): Promise<void> {
  const task = await asanaFetch<AsanaTask>(`/tasks/${gid}`, {
    params: {
      opt_fields: 'name,notes,completed,assignee.name,assignee.email,due_on,tags.name,memberships.section.name',
    },
  });

  const status = task.completed ? '[x]' : '[ ]';
  console.log(`${status} ${task.name}`);
  if (task.assignee) console.log(`Assignee: ${task.assignee.name}${task.assignee.email ? ` (${task.assignee.email})` : ''}`);
  if (task.due_on) console.log(`Due: ${task.due_on}`);
  if (task.tags?.length) console.log(`Tags: ${task.tags.map(t => t.name).join(', ')}`);
  if (task.memberships?.length) {
    const sections = task.memberships.filter(m => m.section?.name).map(m => m.section!.name);
    if (sections.length) console.log(`Secties: ${sections.join(', ')}`);
  }
  if (task.notes) console.log(`\nNotes:\n${task.notes}`);
}

async function createTask(
  projectGid: string,
  name: string,
  flags: Record<string, string>
): Promise<void> {
  const workspaceGid = await getWorkspaceGid();

  const data: Record<string, unknown> = {
    name,
    projects: [projectGid],
    workspace: workspaceGid,
  };

  if (flags.assignee) data.assignee = flags.assignee;
  if (flags.due) data.due_on = flags.due;
  if (flags.notes) data.notes = flags.notes;
  if (flags.section) data.memberships = [{ project: projectGid, section: flags.section }];

  const task = await asanaFetch<AsanaTask>('/tasks', {
    method: 'POST',
    data,
  });

  console.log(`Taak aangemaakt: ${task.name} (${task.gid})`);
}

async function updateTask(gid: string, flags: Record<string, string>): Promise<void> {
  const data: Record<string, unknown> = {};

  if (flags.name) data.name = flags.name;
  if (flags.due) data.due_on = flags.due;
  if (flags.notes) data.notes = flags.notes;
  if (flags.assignee) data.assignee = flags.assignee;

  if (Object.keys(data).length === 0) {
    console.error('Geen velden om te updaten. Gebruik --name=x --due=x --notes=x --assignee=x');
    process.exit(1);
  }

  const task = await asanaFetch<AsanaTask>(`/tasks/${gid}`, {
    method: 'PUT',
    data,
  });

  console.log(`Taak geüpdatet: ${task.name} (${task.gid})`);
}

async function completeTask(gid: string): Promise<void> {
  const task = await asanaFetch<AsanaTask>(`/tasks/${gid}`, {
    method: 'PUT',
    data: { completed: true },
  });

  console.log(`Taak afgerond: ${task.name}`);
}

async function assignTask(gid: string, email: string): Promise<void> {
  const task = await asanaFetch<AsanaTask>(`/tasks/${gid}`, {
    method: 'PUT',
    data: { assignee: email },
  });

  console.log(`Taak toegewezen: ${task.name} -> ${email}`);
}

async function listComments(taskGid: string): Promise<void> {
  const stories = await asanaFetch<AsanaStory[]>(`/tasks/${taskGid}/stories`, {
    params: { opt_fields: 'text,type,created_at,created_by.name' },
  });

  const comments = stories.filter(s => s.type === 'comment');

  if (comments.length === 0) {
    console.log('Geen comments.');
    return;
  }

  console.log(`Comments (${comments.length}):\n`);
  for (const c of comments) {
    const date = new Date(c.created_at).toLocaleString('nl-NL', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    });
    const author = c.created_by?.name || 'Onbekend';
    console.log(`  ${author} (${date}):`);
    console.log(`  ${c.text}\n`);
  }
}

async function addComment(taskGid: string, text: string): Promise<void> {
  await asanaFetch(`/tasks/${taskGid}/stories`, {
    method: 'POST',
    data: { text },
  });

  console.log(`Comment geplaatst op taak ${taskGid}.`);
}

async function listTags(): Promise<void> {
  const workspaceGid = await getWorkspaceGid();
  const tags = await asanaFetch<AsanaTag[]>('/tags', {
    params: { workspace: workspaceGid, opt_fields: 'name,color', limit: '100' },
  });

  console.log(`Tags (${tags.length}):\n`);
  for (const t of tags) {
    const color = t.color ? ` [${t.color}]` : '';
    console.log(`  ${t.name}${color} (${t.gid})`);
  }
}

async function addTag(taskGid: string, tagGid: string): Promise<void> {
  await asanaFetch(`/tasks/${taskGid}/addTag`, {
    method: 'POST',
    data: { tag: tagGid },
  });

  console.log(`Tag ${tagGid} toegevoegd aan taak ${taskGid}.`);
}

async function searchTasks(query: string): Promise<void> {
  const workspaceGid = await getWorkspaceGid();
  const tasks = await asanaFetch<AsanaTask[]>(`/workspaces/${workspaceGid}/tasks/search`, {
    params: {
      text: query,
      opt_fields: 'name,completed,assignee.name,due_on',
      limit: '25',
    },
  });

  if (tasks.length === 0) {
    console.log(`Geen taken gevonden voor "${query}".`);
    return;
  }

  console.log(`Zoekresultaten voor "${query}" (${tasks.length}):\n`);
  for (const t of tasks) {
    const status = t.completed ? '[x]' : '[ ]';
    const assignee = t.assignee?.name ? ` -> ${t.assignee.name}` : '';
    const due = t.due_on ? ` [${t.due_on}]` : '';
    console.log(`  ${status} ${t.name}${assignee}${due} (${t.gid})`);
  }
}

// --- Main ---

async function main(): Promise<void> {
  const [, , command, ...rawArgs] = process.argv;
  const { positional, flags } = parseFlags(rawArgs);

  if (!command) {
    console.log(`Usage: npx tsx asana-api.ts <command> [options]

Commands:
  me                              User en workspace info
  projects                        Lijst alle projecten
  project <gid>                   Project details
  sections <project_gid>          Secties in een project
  tasks <project_gid> [--section] Taken in een project
  task <gid>                      Taak details
  create <project_gid> <name>     Taak aanmaken [--assignee --due --notes --section]
  update <gid>                    Taak updaten [--name --due --notes --assignee]
  complete <gid>                  Taak afronden
  assign <gid> <email>            Taak toewijzen
  comments <gid>                  Comments op een taak
  comment <gid> <text>            Comment plaatsen
  tags                            Lijst alle tags
  tag <task_gid> <tag_gid>        Tag toevoegen aan taak
  search <query>                  Zoek taken in workspace`);
    process.exit(0);
  }

  await checkConnection();

  try {
    switch (command) {
      case 'me':
        await me();
        break;

      case 'projects':
        await listProjects();
        break;

      case 'project': {
        const gid = positional[0];
        if (!gid) { console.error('Usage: project <gid>'); process.exit(1); }
        await getProject(gid);
        break;
      }

      case 'sections': {
        const gid = positional[0];
        if (!gid) { console.error('Usage: sections <project_gid>'); process.exit(1); }
        await listSections(gid);
        break;
      }

      case 'tasks': {
        const gid = positional[0];
        if (!gid) { console.error('Usage: tasks <project_gid> [--section=gid]'); process.exit(1); }
        await listTasks(gid, flags.section);
        break;
      }

      case 'task': {
        const gid = positional[0];
        if (!gid) { console.error('Usage: task <gid>'); process.exit(1); }
        await getTask(gid);
        break;
      }

      case 'create': {
        const projectGid = positional[0];
        const name = positional.slice(1).join(' ');
        if (!projectGid || !name) { console.error('Usage: create <project_gid> <name> [--assignee=email] [--due=YYYY-MM-DD]'); process.exit(1); }
        await createTask(projectGid, name, flags);
        break;
      }

      case 'update': {
        const gid = positional[0];
        if (!gid) { console.error('Usage: update <gid> [--name=x] [--due=x] [--notes=x]'); process.exit(1); }
        await updateTask(gid, flags);
        break;
      }

      case 'complete': {
        const gid = positional[0];
        if (!gid) { console.error('Usage: complete <gid>'); process.exit(1); }
        await completeTask(gid);
        break;
      }

      case 'assign': {
        const gid = positional[0];
        const email = positional[1];
        if (!gid || !email) { console.error('Usage: assign <gid> <email>'); process.exit(1); }
        await assignTask(gid, email);
        break;
      }

      case 'comments': {
        const gid = positional[0];
        if (!gid) { console.error('Usage: comments <task_gid>'); process.exit(1); }
        await listComments(gid);
        break;
      }

      case 'comment': {
        const gid = positional[0];
        const text = positional.slice(1).join(' ');
        if (!gid || !text) { console.error('Usage: comment <task_gid> <text>'); process.exit(1); }
        await addComment(gid, text);
        break;
      }

      case 'tags':
        await listTags();
        break;

      case 'tag': {
        const taskGid = positional[0];
        const tagGid = positional[1];
        if (!taskGid || !tagGid) { console.error('Usage: tag <task_gid> <tag_gid>'); process.exit(1); }
        await addTag(taskGid, tagGid);
        break;
      }

      case 'search': {
        const query = positional.join(' ');
        if (!query) { console.error('Usage: search <query>'); process.exit(1); }
        await searchTasks(query);
        break;
      }

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
