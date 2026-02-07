-- Migration 003: Gym Race Coach Tables
-- Created: 5 februari 2026
-- Feature: F31 - Gym Race Coach

-- Training state (race info, progress, targets)
CREATE TABLE IF NOT EXISTS training_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'renier',
    current_week INTEGER NOT NULL DEFAULT 1,
    race_name TEXT NOT NULL DEFAULT 'GYMRACE Amsterdam',
    race_date TEXT NOT NULL,
    target_time TEXT DEFAULT '1:20:00',
    countdown_days INTEGER,
    resting_hr_baseline INTEGER DEFAULT 54,

    -- Skill progress tracking
    wall_ball_max INTEGER DEFAULT 18,
    wall_ball_target INTEGER DEFAULT 30,
    slam_ball_carry_status TEXT DEFAULT 'untested',
    kb_swings_status TEXT DEFAULT 'untested',
    sled_push_status TEXT DEFAULT 'high',
    farmers_lunges_status TEXT DEFAULT 'high',

    -- Weekly completion rates
    week_1_completion REAL DEFAULT 0.0,
    week_2_completion REAL DEFAULT 0.0,
    week_3_completion REAL DEFAULT 0.0,
    week_4_completion REAL DEFAULT 0.0,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Workout log (completed workouts + RPE)
CREATE TABLE IF NOT EXISTS workout_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'renier',
    workout_date TEXT NOT NULL,
    week INTEGER NOT NULL,
    day TEXT NOT NULL,
    workout_name TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    duration_minutes INTEGER,
    rpe INTEGER,  -- Rate of Perceived Exertion (1-10)
    notes TEXT,
    wall_ball_reps INTEGER,

    -- Performance metrics
    readiness_score INTEGER,
    sleep_score INTEGER,
    hrv_status TEXT,
    body_battery INTEGER,
    resting_hr INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_state_week ON training_state(current_week);
CREATE INDEX IF NOT EXISTS idx_workout_log_date ON workout_log(workout_date);
CREATE INDEX IF NOT EXISTS idx_workout_log_week ON workout_log(week);
