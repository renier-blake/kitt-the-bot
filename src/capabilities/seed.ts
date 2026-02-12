/**
 * KITT Capabilities Seed Data
 *
 * Seeds the capabilities table with all tools and skills.
 * Run with: npx tsx src/capabilities/seed.ts
 */

import {
  initCapabilitiesTable,
  upsertCapability,
  type CapabilityInput,
} from './index.js';

// ==========================================
// Tools (Claude Code native tools)
// ==========================================

const TOOLS: CapabilityInput[] = [
  {
    id: 'bash',
    name: 'Bash Shell',
    description: 'Execute shell commands',
    icon: '💻',
    category: 'tool',
    execution: 'direct',
    modes: ['developer'], // Only in developer mode
    sortOrder: 1,
  },
  {
    id: 'read',
    name: 'Read File',
    description: 'Read file contents',
    icon: '📖',
    category: 'tool',
    execution: 'direct',
    modes: ['secure', 'developer'],
    sortOrder: 2,
  },
  {
    id: 'write',
    name: 'Write File',
    description: 'Write content to files',
    icon: '✏️',
    category: 'tool',
    execution: 'direct',
    modes: ['developer'],
    sortOrder: 3,
  },
  {
    id: 'edit',
    name: 'Edit File',
    description: 'Edit existing files',
    icon: '📝',
    category: 'tool',
    execution: 'direct',
    modes: ['developer'],
    sortOrder: 4,
  },
  {
    id: 'glob',
    name: 'Find Files',
    description: 'Search for files by pattern',
    icon: '🔍',
    category: 'tool',
    execution: 'direct',
    modes: ['secure', 'developer'],
    sortOrder: 5,
  },
  {
    id: 'grep',
    name: 'Search Content',
    description: 'Search file contents',
    icon: '🔎',
    category: 'tool',
    execution: 'direct',
    modes: ['secure', 'developer'],
    sortOrder: 6,
  },
  {
    id: 'websearch',
    name: 'Web Search',
    description: 'Search the web',
    icon: '🌐',
    category: 'tool',
    execution: 'direct',
    modes: ['secure', 'developer'],
    sortOrder: 7,
  },
  {
    id: 'webfetch',
    name: 'Fetch URL',
    description: 'Fetch content from URLs',
    icon: '📥',
    category: 'tool',
    execution: 'direct',
    modes: ['secure', 'developer'],
    sortOrder: 8,
  },
];

// ==========================================
// Skills (from .claude/skills/)
// ==========================================

const SKILLS: CapabilityInput[] = [
  // Health & Fitness
  {
    id: 'garmin',
    name: 'Garmin Health',
    description: 'Sleep, HRV, steps, activities, calories',
    icon: '⌚',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'haiku',
    path: '.claude/skills/garmin',
    triggers: ['garmin', 'slaap', 'hrv', 'stappen', 'activiteiten', 'health'],
    modes: ['secure', 'developer'],
    sortOrder: 10,
  },
  {
    id: 'nutrition-log',
    name: 'Nutrition Log',
    description: 'Log meals and track nutrition',
    icon: '🍽️',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'haiku',
    path: '.claude/skills/nutrition-log',
    triggers: ['voeding', 'eten', 'maaltijd', 'calorieen', 'nutrition'],
    modes: ['secure', 'developer'],
    sortOrder: 11,
  },
  {
    id: 'gym-race-coach',
    name: 'Gym Race Coach',
    description: 'GYMRACE/HYROX training coach',
    icon: '🏋️',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/gym-race-coach',
    triggers: ['training', 'workout', 'gymrace', 'hyrox', 'coach'],
    modes: ['secure', 'developer'],
    sortOrder: 12,
  },
  {
    id: 'daily-energy-balance',
    name: 'Daily Energy Balance',
    description: 'Daily energy balance summary',
    icon: '⚖️',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'sonnet',
    path: '.claude/skills/daily-energy-balance',
    triggers: ['energie', 'calorieen', 'balans'],
    modes: ['secure', 'developer'],
    sortOrder: 13,
  },
  {
    id: 'workout-plan',
    name: 'Workout Plan',
    description: 'Training plans en schema',
    icon: '📋',
    category: 'skill',
    skillType: 'user',
    execution: 'direct',
    path: '.claude/skills/workout-plan',
    triggers: ['schema', 'plan', 'training'],
    modes: ['secure', 'developer'],
    sortOrder: 14,
  },

  // Productivity
  {
    id: 'apple-reminders',
    name: 'Apple Reminders',
    description: 'Check and manage Apple Reminders',
    icon: '✅',
    category: 'skill',
    skillType: 'user',
    execution: 'direct', // Uses osascript, fast
    path: '.claude/skills/apple-reminders',
    triggers: ['reminders', 'herinnering', 'todo', 'taak'],
    modes: ['secure', 'developer'],
    sortOrder: 20,
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Access Google Calendar via Nango',
    icon: '📅',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'haiku',
    path: '.claude/skills/calendar',
    triggers: ['agenda', 'calendar', 'afspraak', 'meeting'],
    modes: ['secure', 'developer'],
    sortOrder: 21,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Access Gmail via Nango',
    icon: '📧',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'haiku',
    path: '.claude/skills/gmail',
    triggers: ['mail', 'email', 'gmail', 'inbox'],
    modes: ['secure', 'developer'],
    sortOrder: 22,
  },
  {
    id: 'daily-reflection',
    name: 'Daily Reflection',
    description: '6 Minute Diary framework',
    icon: '📔',
    category: 'skill',
    skillType: 'user',
    execution: 'direct',
    path: '.claude/skills/daily-reflection',
    triggers: ['reflectie', 'dagboek', 'diary'],
    modes: ['secure', 'developer'],
    sortOrder: 23,
  },

  // Content Creation
  {
    id: 'blog-writer',
    name: 'Blog Writer',
    description: 'Write blog post drafts',
    icon: '✍️',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/blog-writer',
    triggers: ['blog', 'artikel', 'schrijf'],
    modes: ['secure', 'developer'],
    sortOrder: 30,
  },
  {
    id: 'blog-publisher',
    name: 'Blog Publisher',
    description: 'Publish blog drafts',
    icon: '📤',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/blog-publisher',
    triggers: ['publiceer', 'publish'],
    modes: ['developer'], // Needs file write access
    sortOrder: 31,
  },
  {
    id: 'blog-post-archived',
    name: 'Blog Post (Archived)',
    description: 'Legacy blog post skill',
    icon: '📜',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    path: '.claude/skills/blog-post-archived',
    modes: ['developer'],
    enabled: false, // Archived
    sortOrder: 32,
  },
  {
    id: 'podcast',
    name: 'Podcast',
    description: 'Create podcast episodes from blog posts',
    icon: '🎙️',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/podcast',
    triggers: ['podcast', 'audio'],
    modes: ['developer'],
    sortOrder: 33,
  },
  {
    id: 'podbean',
    name: 'Podbean',
    description: 'Publish to Podbean',
    icon: '🎧',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    path: '.claude/skills/podbean',
    triggers: ['podbean'],
    modes: ['developer'],
    sortOrder: 34,
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn Post',
    description: 'Post to LinkedIn via browser',
    icon: '💼',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/linkedin-post',
    triggers: ['linkedin'],
    modes: ['developer'],
    sortOrder: 35,
  },
  {
    id: 'nano-banana',
    name: 'Image Generation',
    description: 'Generate images with fal.ai',
    icon: '🎨',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'sonnet',
    path: '.claude/skills/nano-banana',
    triggers: ['afbeelding', 'image', 'generate', 'illustratie'],
    modes: ['secure', 'developer'],
    sortOrder: 36,
  },

  // System & Automation
  {
    id: 'browser',
    name: 'Browser Automation',
    description: 'Playwright + Chrome automation',
    icon: '🌐',
    category: 'skill',
    skillType: 'user',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/browser',
    triggers: ['browser', 'website', 'screenshot'],
    modes: ['developer'], // Security sensitive
    sortOrder: 40,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Brainstorm ideas and solutions',
    icon: '💡',
    category: 'skill',
    skillType: 'user',
    execution: 'direct',
    path: '.claude/skills/brainstorm',
    triggers: ['brainstorm', 'ideeen', 'ideas'],
    modes: ['secure', 'developer'],
    sortOrder: 41,
  },

  // KITT Internal
  {
    id: 'kitt-self-reflection',
    name: 'KITT Self Reflection',
    description: "KITT's daily self reflection",
    icon: '🤖',
    category: 'skill',
    skillType: 'system',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/kitt-self-reflection',
    modes: ['developer'],
    sortOrder: 50,
  },
  {
    id: 'codebase-health-audit',
    name: 'Codebase Health Audit',
    description: 'Daily codebase health check',
    icon: '🔬',
    category: 'skill',
    skillType: 'system',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/codebase-health-audit',
    modes: ['developer'],
    sortOrder: 51,
  },

  // Project Management
  {
    id: 'project-management',
    name: 'Project Management',
    description: 'Projects, issues, workflow',
    icon: '📊',
    category: 'skill',
    skillType: 'system',
    execution: 'direct',
    path: '.claude/skills/project-management',
    triggers: ['project', 'issue', 'workflow'],
    modes: ['secure', 'developer'],
    sortOrder: 60,
  },
  {
    id: 'issue',
    name: 'Issue Workflow',
    description: 'Start working on an issue',
    icon: '🎯',
    category: 'skill',
    skillType: 'system',
    execution: 'background',
    model: 'opus',
    path: '.claude/skills/issue',
    triggers: ['issue', 'PAS-', 'KITT-', 'POR-', 'SKL-'],
    modes: ['developer'],
    sortOrder: 61,
  },
  {
    id: 'create-issue',
    name: 'Create Issue',
    description: 'Create a new issue via PO intake',
    icon: '➕',
    category: 'skill',
    skillType: 'system',
    execution: 'direct',
    path: '.claude/skills/create-issue',
    triggers: ['maak issue', 'nieuw issue', 'create issue'],
    modes: ['secure', 'developer'],
    sortOrder: 62,
  },
];

// ==========================================
// Seed Function
// ==========================================

export async function seedCapabilities(): Promise<void> {
  console.log('[capabilities] Starting seed...');

  // Initialize table
  await initCapabilitiesTable();

  // Seed tools
  console.log('[capabilities] Seeding tools...');
  for (const tool of TOOLS) {
    await upsertCapability(tool);
  }

  // Seed skills
  console.log('[capabilities] Seeding skills...');
  for (const skill of SKILLS) {
    await upsertCapability(skill);
  }

  console.log(
    `[capabilities] Seed complete: ${TOOLS.length} tools, ${SKILLS.length} skills`
  );
}

// Run if executed directly
const isMainModule = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMainModule) {
  seedCapabilities()
    .then(() => {
      console.log('[capabilities] Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[capabilities] Seed failed:', err);
      process.exit(1);
    });
}
