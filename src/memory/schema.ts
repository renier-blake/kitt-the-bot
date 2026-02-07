/**
 * KITT Memory System - Database Schema
 *
 * Handles libSQL database initialization with:
 * - Core tables (transcripts, chunks, meta)
 * - FTS5 virtual table for keyword search
 * - Native vector columns for semantic search
 */

import { createClient, type Client } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA_VERSION = 10; // Bumped for Daily Blog Post (F60)

// Core schema SQL
const CORE_SCHEMA = `
-- Metadata table for schema versioning
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Full conversation transcripts
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_channel ON transcripts(channel);
CREATE INDEX IF NOT EXISTS idx_transcripts_created ON transcripts(created_at);

-- Indexed chunks for search (with native vector column)
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  transcript_id TEXT,
  source TEXT NOT NULL,
  path TEXT,
  content TEXT NOT NULL,
  hash TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  embedding F32_BLOB(3072),
  model TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
);

CREATE INDEX IF NOT EXISTS idx_chunks_transcript ON chunks(transcript_id);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(hash);

-- Embedding cache to avoid re-computing
CREATE TABLE IF NOT EXISTS embedding_cache (
  hash TEXT PRIMARY KEY,
  embedding TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Task Engine: KITT's mental to-do list
CREATE TABLE IF NOT EXISTS kitt_tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT DEFAULT 'once',           -- 'once', 'daily', 'weekly', 'monthly'
  priority TEXT DEFAULT 'medium',          -- 'high', 'medium', 'low'
  skill_refs TEXT,                         -- JSON array: ["nutrition-log"]
  time_window_start TEXT,                  -- '07:00' (HH:MM)
  time_window_end TEXT,                    -- '11:00' (HH:MM)
  grace_period_minutes INTEGER DEFAULT 0,  -- extra time after window
  snoozed_until INTEGER,                   -- unix timestamp ms
  next_run INTEGER,                        -- unix timestamp ms (for retry logic)
  depends_on TEXT,                         -- JSON array: [1, 2, 3] (F54: changed from INTEGER)
  created_by TEXT DEFAULT 'kitt',          -- 'kitt' or 'renier'
  active INTEGER DEFAULT 1,                -- 0 = disabled
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_tasks_frequency ON kitt_tasks(frequency);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON kitt_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_active ON kitt_tasks(active);

-- Workout Programs (F57): Programma's zoals 12 weken HYROX prep
CREATE TABLE IF NOT EXISTS workout_programs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_weeks INTEGER,
  start_date TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Workout Templates (F57): Geplande workouts per week/dag
CREATE TABLE IF NOT EXISTS workout_templates (
  id INTEGER PRIMARY KEY,
  program_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  week_number INTEGER,
  day_of_week INTEGER,
  workout_type TEXT NOT NULL,
  exercises TEXT,
  duration_minutes INTEGER,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (program_id) REFERENCES workout_programs(id)
);

CREATE INDEX IF NOT EXISTS idx_workout_templates_program ON workout_templates(program_id);
CREATE INDEX IF NOT EXISTS idx_workout_templates_week ON workout_templates(week_number);

-- Workout Exercises (F57): Exercise definities met aliassen
CREATE TABLE IF NOT EXISTS workout_exercises (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  equipment TEXT,
  aliases TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_category ON workout_exercises(category);
`;

// FTS5 schema for keyword search
const FTS_SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  id UNINDEXED,
  source UNINDEXED,
  path UNINDEXED
);
`;

// Vector index for fast similarity search
const VECTOR_INDEX_SCHEMA = `
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks(libsql_vector_idx(embedding));
`;

export interface DatabaseStatus {
  /** Is database initialized */
  initialized: boolean;
  /** Schema version */
  schemaVersion: number;
  /** Is FTS5 available */
  ftsAvailable: boolean;
  /** Is vector search available */
  vectorAvailable: boolean;
  /** Vector dimensions (if available) */
  vectorDimensions?: number;
  /** Any initialization errors */
  errors: string[];
}

export interface InitOptions {
  /** Vector embedding dimensions (default: 3072) */
  vectorDimensions?: number;
}

/**
 * Ensure directory exists for database file
 */
function ensureDirectory(dbPath: string): void {
  // Extract path from file: URL format
  const filePath = dbPath.startsWith('file:') ? dbPath.slice(5) : dbPath;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Initialize the libSQL database with all tables
 */
export async function initializeDatabase(
  dbPath: string,
  options: InitOptions = {}
): Promise<{ db: Client; status: DatabaseStatus }> {
  const { vectorDimensions = 3072 } = options;
  const errors: string[] = [];
  let ftsAvailable = false;
  let vectorAvailable = false;

  // Ensure directory exists
  ensureDirectory(dbPath);

  // Format path for libSQL (needs file: prefix)
  const url = dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`;

  // Create libSQL client
  const db = createClient({ url });

  // Create core schema (execute statements one by one)
  const coreStatements = CORE_SCHEMA.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of coreStatements) {
    try {
      await db.execute(stmt);
    } catch (err) {
      // Ignore "already exists" errors for indexes
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('already exists')) {
        errors.push(`Core schema error: ${message}`);
      }
    }
  }

  // Check/set schema version and run migrations
  try {
    const versionResult = await db.execute({
      sql: 'SELECT value FROM meta WHERE key = ?',
      args: ['schema_version'],
    });

    const currentVersion = versionResult.rows.length > 0
      ? parseInt(String(versionResult.rows[0].value), 10)
      : 0;

    // Migration: v3 -> v4: Add depends_on column to kitt_tasks
    if (currentVersion < 4) {
      try {
        await db.execute('ALTER TABLE kitt_tasks ADD COLUMN depends_on INTEGER');
        console.log('[schema] Migration: Added depends_on column to kitt_tasks');
      } catch (alterErr) {
        // Column might already exist
        const alterMsg = alterErr instanceof Error ? alterErr.message : String(alterErr);
        if (!alterMsg.includes('duplicate column')) {
          console.warn('[schema] Migration warning:', alterMsg);
        }
      }
    }

    // Migration: v4 -> v5: Transcript Schema Refactor (F53)
    // Add type, task_id, task_status columns for proper task tracking
    if (currentVersion < 5) {
      console.log('[schema] Running migration v4 -> v5 (Transcript Schema Refactor)...');

      // Add type column (message, thought, task)
      try {
        await db.execute("ALTER TABLE transcripts ADD COLUMN type TEXT DEFAULT 'message'");
        console.log('[schema] Migration: Added type column to transcripts');
      } catch (alterErr) {
        const alterMsg = alterErr instanceof Error ? alterErr.message : String(alterErr);
        if (!alterMsg.includes('duplicate column')) {
          console.warn('[schema] Migration warning (type):', alterMsg);
        }
      }

      // Add task_id column (FK to kitt_tasks.id)
      try {
        await db.execute('ALTER TABLE transcripts ADD COLUMN task_id INTEGER');
        console.log('[schema] Migration: Added task_id column to transcripts');
      } catch (alterErr) {
        const alterMsg = alterErr instanceof Error ? alterErr.message : String(alterErr);
        if (!alterMsg.includes('duplicate column')) {
          console.warn('[schema] Migration warning (task_id):', alterMsg);
        }
      }

      // Add task_status column (reminder, completed, skipped, deferred)
      try {
        await db.execute('ALTER TABLE transcripts ADD COLUMN task_status TEXT');
        console.log('[schema] Migration: Added task_status column to transcripts');
      } catch (alterErr) {
        const alterMsg = alterErr instanceof Error ? alterErr.message : String(alterErr);
        if (!alterMsg.includes('duplicate column')) {
          console.warn('[schema] Migration warning (task_status):', alterMsg);
        }
      }

      // Migrate existing data: 'assistant' -> 'kitt'
      try {
        await db.execute("UPDATE transcripts SET role = 'kitt' WHERE role = 'assistant'");
        console.log('[schema] Migration: Renamed role assistant -> kitt');
      } catch (err) {
        console.warn('[schema] Migration warning (role rename):', err);
      }

      // Migrate existing data: role='thought' -> role='kitt', type='thought'
      try {
        await db.execute("UPDATE transcripts SET type = 'thought', role = 'kitt' WHERE role = 'thought'");
        console.log('[schema] Migration: Migrated thought role to type');
      } catch (err) {
        console.warn('[schema] Migration warning (thought migration):', err);
      }

      // Migrate existing task logs (role='task') to new schema
      // Extract task_id and status from metadata JSON
      try {
        await db.execute(`
          UPDATE transcripts
          SET type = 'task',
              task_id = CAST(json_extract(metadata, '$.task_id') AS INTEGER),
              task_status = json_extract(metadata, '$.status'),
              role = 'kitt'
          WHERE role = 'task'
        `);
        console.log('[schema] Migration: Migrated task role to type with task_id/task_status');
      } catch (err) {
        console.warn('[schema] Migration warning (task migration):', err);
      }

      // Add index for task queries
      try {
        await db.execute('CREATE INDEX IF NOT EXISTS idx_transcripts_type ON transcripts(type)');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_transcripts_task_id ON transcripts(task_id)');
        console.log('[schema] Migration: Added indexes for type and task_id');
      } catch (err) {
        console.warn('[schema] Migration warning (indexes):', err);
      }

      console.log('[schema] Migration v4 -> v5 complete');
    }

    // Migration: v5 -> v6: depends_on INTEGER -> TEXT (JSON array) for F54
    if (currentVersion < 6) {
      console.log('[schema] Running migration v5 -> v6 (depends_on to JSON array)...');

      // SQLite requires table recreation for column type changes
      // 1. Create new table with TEXT depends_on
      await db.execute(`
        CREATE TABLE kitt_tasks_new (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          frequency TEXT DEFAULT 'once',
          priority TEXT DEFAULT 'medium',
          skill_refs TEXT,
          time_window_start TEXT,
          time_window_end TEXT,
          grace_period_minutes INTEGER DEFAULT 0,
          snoozed_until INTEGER,
          next_run INTEGER,
          depends_on TEXT,
          created_by TEXT DEFAULT 'kitt',
          active INTEGER DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch() * 1000)
        )
      `);

      // 2. Copy data with conversion (INTEGER -> JSON array)
      await db.execute(`
        INSERT INTO kitt_tasks_new
        SELECT id, title, description, frequency, priority, skill_refs,
               time_window_start, time_window_end, grace_period_minutes,
               snoozed_until, next_run,
               CASE WHEN depends_on IS NULL THEN NULL ELSE '[' || depends_on || ']' END,
               created_by, active, created_at
        FROM kitt_tasks
      `);

      // 3. Drop old table
      await db.execute('DROP TABLE kitt_tasks');

      // 4. Rename new table
      await db.execute('ALTER TABLE kitt_tasks_new RENAME TO kitt_tasks');

      // 5. Recreate indexes
      await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_frequency ON kitt_tasks(frequency)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON kitt_tasks(priority)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_active ON kitt_tasks(active)');

      // 6. Add energy balance task (F54)
      const existing = await db.execute(`
        SELECT 1 FROM kitt_tasks WHERE title = 'Dagelijkse energiebalans'
      `);
      if (existing.rows.length === 0) {
        await db.execute(`
          INSERT INTO kitt_tasks (
            title, description, frequency, priority, skill_refs,
            time_window_start, time_window_end, grace_period_minutes,
            depends_on, created_by
          ) VALUES (
            'Dagelijkse energiebalans',
            'Samenvatting van gegeten calories/macros vs verbrand',
            'daily',
            'medium',
            '["daily-energy-balance"]',
            '21:00',
            '22:30',
            30,
            '[1, 2, 3]',
            'renier'
          )
        `);
        console.log('[schema] Added energy balance task');
      }

      console.log('[schema] Migration v5 -> v6 complete');
    }

    // Migration: v6 -> v7: Workout Plans (F57)
    if (currentVersion < 7) {
      console.log('[schema] Running migration v6 -> v7 (Workout Plans)...');

      // Tables are created in CORE_SCHEMA, just seed exercises
      await seedWorkoutExercises(db);

      console.log('[schema] Migration v6 -> v7 complete');
    }

    // Migration: v7 -> v8: Daily Reflection tasks (F37)
    if (currentVersion < 8) {
      console.log('[schema] Running migration v7 -> v8 (Daily Reflection)...');

      // Ochtend reflectie
      const existingMorning = await db.execute(`
        SELECT 1 FROM kitt_tasks WHERE title = 'Ochtend reflectie'
      `);
      if (existingMorning.rows.length === 0) {
        await db.execute(`
          INSERT INTO kitt_tasks (
            title, description, frequency, priority, skill_refs,
            time_window_start, time_window_end, grace_period_minutes,
            depends_on, created_by
          ) VALUES (
            'Ochtend reflectie',
            '6 Minute Diary ochtend: gratitude, intentie, affirmatie. Lees .claude/skills/daily-reflection/SKILL.md',
            'daily',
            'low',
            '["daily-reflection"]',
            '08:00',
            '10:00',
            30,
            '[0]',
            'renier'
          )
        `);
        console.log('[schema] Added ochtend reflectie task');
      }

      // Avond reflectie
      const existingEvening = await db.execute(`
        SELECT 1 FROM kitt_tasks WHERE title = 'Avond reflectie'
      `);
      if (existingEvening.rows.length === 0) {
        await db.execute(`
          INSERT INTO kitt_tasks (
            title, description, frequency, priority, skill_refs,
            time_window_start, time_window_end, grace_period_minutes,
            depends_on, created_by
          ) VALUES (
            'Avond reflectie',
            '6 Minute Diary avond: good deed, verbetering, three good things. Lees .claude/skills/daily-reflection/SKILL.md',
            'daily',
            'low',
            '["daily-reflection"]',
            '21:00',
            '23:00',
            30,
            '[0]',
            'renier'
          )
        `);
        console.log('[schema] Added avond reflectie task');
      }

      console.log('[schema] Migration v7 -> v8 complete');
    }

    // Migration: v8 -> v9: KITT Self-Reflection task (F58)
    if (currentVersion < 9) {
      console.log('[schema] Running migration v8 -> v9 (KITT Self-Reflection)...');

      const existingSelfReflection = await db.execute(`
        SELECT 1 FROM kitt_tasks WHERE title = 'KITT zelfreflectie'
      `);
      if (existingSelfReflection.rows.length === 0) {
        await db.execute(`
          INSERT INTO kitt_tasks (
            title, description, frequency, priority, skill_refs,
            time_window_start, time_window_end, grace_period_minutes,
            depends_on, created_by
          ) VALUES (
            'KITT zelfreflectie',
            'Dagelijkse zelfreflectie: reflecteer op geleerde lessen, update IDENTITY.md en USER.md. Lees .claude/skills/kitt-self-reflection/SKILL.md',
            'daily',
            'low',
            '["kitt-self-reflection"]',
            '22:00',
            '23:30',
            30,
            '[0]',
            'kitt'
          )
        `);
        console.log('[schema] Added KITT zelfreflectie task');
      }

      console.log('[schema] Migration v8 -> v9 complete');
    }

    // Migration: v9 -> v10: Daily Blog Post task (F60)
    if (currentVersion < 10) {
      console.log('[schema] Running migration v9 -> v10 (Daily Blog Post)...');

      const existingBlogPost = await db.execute(`
        SELECT 1 FROM kitt_tasks WHERE title = 'Dagelijkse blogpost'
      `);
      if (existingBlogPost.rows.length === 0) {
        await db.execute(`
          INSERT INTO kitt_tasks (
            title, description, frequency, priority, skill_refs,
            time_window_start, time_window_end, grace_period_minutes,
            depends_on, created_by
          ) VALUES (
            'Dagelijkse blogpost',
            'Schrijf en publiceer blogpost op basis van gisterens zelfreflectie. Lees .claude/skills/blog-post/SKILL.md',
            'daily',
            'low',
            '["blog-post"]',
            '10:00',
            '12:00',
            60,
            '[0]',
            'kitt'
          )
        `);
        console.log('[schema] Added dagelijkse blogpost task');
      }

      console.log('[schema] Migration v9 -> v10 complete');
    }

    // Update schema version
    await db.execute({
      sql: 'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      args: ['schema_version', String(SCHEMA_VERSION)],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Schema version error: ${message}`);
  }

  // Try to create FTS5 table
  try {
    await db.execute(FTS_SCHEMA);
    ftsAvailable = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`FTS5 not available: ${message}`);
  }

  // Try to create vector index (libSQL native)
  try {
    await db.execute(VECTOR_INDEX_SCHEMA);
    vectorAvailable = true;

    // Store vector dimensions in meta
    await db.execute({
      sql: 'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      args: ['vector_dimensions', String(vectorDimensions)],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Vector index might fail on older libSQL versions
    if (!message.includes('already exists')) {
      errors.push(`Vector index not available: ${message}`);
    } else {
      vectorAvailable = true;
    }
  }

  // Seed default tasks if this is a fresh database
  try {
    const seeded = await seedDefaultTasks(db);
    if (seeded > 0) {
      console.log(`[schema] Seeded ${seeded} default tasks`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Task seeding error: ${message}`);
  }

  const status: DatabaseStatus = {
    initialized: true,
    schemaVersion: SCHEMA_VERSION,
    ftsAvailable,
    vectorAvailable,
    vectorDimensions: vectorAvailable ? vectorDimensions : undefined,
    errors,
  };

  return { db, status };
}

/**
 * Get current database status
 */
export async function getDatabaseStatus(db: Client): Promise<DatabaseStatus> {
  const errors: string[] = [];
  let ftsAvailable = false;
  let vectorAvailable = false;
  let vectorDimensions: number | undefined;

  // Check schema version
  let schemaVersion = 0;
  try {
    const versionResult = await db.execute({
      sql: 'SELECT value FROM meta WHERE key = ?',
      args: ['schema_version'],
    });

    if (versionResult.rows.length > 0) {
      schemaVersion = parseInt(String(versionResult.rows[0].value), 10);
    }
  } catch {
    // Table might not exist
  }

  // Check FTS5
  try {
    await db.execute('SELECT * FROM chunks_fts LIMIT 0');
    ftsAvailable = true;
  } catch {
    ftsAvailable = false;
  }

  // Check vector support by testing the column
  try {
    // Try a simple vector query to see if it works
    await db.execute('SELECT embedding FROM chunks LIMIT 0');
    vectorAvailable = true;

    const dimsResult = await db.execute({
      sql: 'SELECT value FROM meta WHERE key = ?',
      args: ['vector_dimensions'],
    });

    if (dimsResult.rows.length > 0) {
      vectorDimensions = parseInt(String(dimsResult.rows[0].value), 10);
    }
  } catch {
    vectorAvailable = false;
  }

  return {
    initialized: schemaVersion > 0,
    schemaVersion,
    ftsAvailable,
    vectorAvailable,
    vectorDimensions,
    errors,
  };
}

/**
 * Close database connection
 */
export function closeDatabase(db: Client): void {
  try {
    db.close();
  } catch {
    // Ignore close errors
  }
}

/**
 * Seed default tasks for the Task Engine
 * Only seeds if no tasks exist yet
 */
export async function seedDefaultTasks(db: Client): Promise<number> {
  // Check if tasks already exist
  const existing = await db.execute('SELECT COUNT(*) as count FROM kitt_tasks');
  const count = Number(existing.rows[0].count);

  if (count > 0) {
    return 0; // Already seeded
  }

  // Nutrition logging tasks
  const nutritionTasks = [
    {
      title: 'Ontbijt check',
      description: 'Check of ontbijt is gelogd, herinner indien nodig',
      frequency: 'daily',
      priority: 'low',
      skill_refs: JSON.stringify(['nutrition-log']),
      time_window_start: '07:00',
      time_window_end: '11:00',
      grace_period_minutes: 30,
    },
    {
      title: 'Lunch check',
      description: 'Check of lunch is gelogd, herinner indien nodig',
      frequency: 'daily',
      priority: 'low',
      skill_refs: JSON.stringify(['nutrition-log']),
      time_window_start: '11:30',
      time_window_end: '15:00',
      grace_period_minutes: 30,
    },
    {
      title: 'Avondeten check',
      description: 'Check of avondeten is gelogd, herinner indien nodig',
      frequency: 'daily',
      priority: 'low',
      skill_refs: JSON.stringify(['nutrition-log']),
      time_window_start: '17:00',
      time_window_end: '21:00',
      grace_period_minutes: 30,
    },
  ];

  let seeded = 0;
  for (const task of nutritionTasks) {
    await db.execute({
      sql: `INSERT INTO kitt_tasks (title, description, frequency, priority, skill_refs, time_window_start, time_window_end, grace_period_minutes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'kitt')`,
      args: [
        task.title,
        task.description,
        task.frequency,
        task.priority,
        task.skill_refs,
        task.time_window_start,
        task.time_window_end,
        task.grace_period_minutes,
      ],
    });
    seeded++;
  }

  return seeded;
}

/**
 * Seed default workout exercises with aliases (F57)
 */
export async function seedWorkoutExercises(db: Client): Promise<number> {
  const exercises = [
    { name: 'Bench Press', category: 'chest', equipment: 'barbell', aliases: ['bench', 'bankdrukken', 'flat bench'] },
    { name: 'Incline Dumbbell Press', category: 'chest', equipment: 'dumbbell', aliases: ['incline db press', 'incline press'] },
    { name: 'Squat', category: 'legs', equipment: 'barbell', aliases: ['squats', 'back squat', 'barbell squat'] },
    { name: 'Deadlift', category: 'back', equipment: 'barbell', aliases: ['deadlifts', 'conventional deadlift', 'dl'] },
    { name: 'Pull-up', category: 'back', equipment: 'bodyweight', aliases: ['pull-ups', 'pullup', 'pullups', 'chin-up'] },
    { name: 'Push-up', category: 'chest', equipment: 'bodyweight', aliases: ['push-ups', 'pushup', 'pushups'] },
    { name: 'Wall Balls', category: 'full_body', equipment: 'medicine_ball', aliases: ['wallballs', 'wall ball', 'wb'] },
    { name: 'Sled Push', category: 'full_body', equipment: 'sled', aliases: ['sled', 'prowler', 'prowler push'] },
    { name: 'Sled Pull', category: 'full_body', equipment: 'sled', aliases: ['rope pull', 'sled rope'] },
    { name: 'Farmers Carry', category: 'full_body', equipment: 'dumbbells', aliases: ['farmers walk', 'farmers lunges', 'farmer carry'] },
    { name: 'Kettlebell Swing', category: 'full_body', equipment: 'kettlebell', aliases: ['kb swing', 'kb swings', 'swings'] },
    { name: 'Rowing', category: 'cardio', equipment: 'machine', aliases: ['row', 'rower', 'erg', 'ski erg'] },
    { name: 'Running', category: 'cardio', equipment: 'none', aliases: ['run', 'jog', 'treadmill'] },
    { name: 'Burpees', category: 'full_body', equipment: 'bodyweight', aliases: ['burpee', 'broad jump burpees'] },
    { name: 'Shoulder Press', category: 'shoulders', equipment: 'barbell', aliases: ['ohp', 'overhead press', 'military press'] },
    { name: 'Dumbbell Row', category: 'back', equipment: 'dumbbell', aliases: ['db row', 'one arm row', 'single arm row'] },
    { name: 'Lunges', category: 'legs', equipment: 'bodyweight', aliases: ['lunge', 'walking lunges', 'forward lunges'] },
    { name: 'Tricep Dips', category: 'arms', equipment: 'bodyweight', aliases: ['dips', 'bench dips', 'tricep dip'] },
  ];

  let seeded = 0;
  for (const ex of exercises) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO workout_exercises (name, category, equipment, aliases)
              VALUES (?, ?, ?, ?)`,
        args: [ex.name, ex.category, ex.equipment, JSON.stringify(ex.aliases)],
      });
      seeded++;
    } catch (err) {
      // Ignore duplicates
    }
  }

  console.log(`[schema] Seeded ${seeded} workout exercises`);
  return seeded;
}
