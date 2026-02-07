-- Migration 002: Nutrition Log Tables
-- Created: 5 februari 2026
-- Feature: F28 - Nutrition Log Skill
-- Compatible with Supabase renier_foods / renier_food_log schema

-- Foods catalog (per 100g/ml values)
CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    calories_per_100g REAL NOT NULL DEFAULT 0,
    protein_per_100g REAL NOT NULL DEFAULT 0,
    carbs_per_100g REAL NOT NULL DEFAULT 0,
    fat_per_100g REAL NOT NULL DEFAULT 0,
    fiber_per_100g REAL DEFAULT 0,
    default_serving_size REAL NOT NULL DEFAULT 100,
    default_serving_unit TEXT NOT NULL DEFAULT 'g',
    is_favorite INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Food log entries (with pre-calculated macros for the serving)
CREATE TABLE IF NOT EXISTS food_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER,
    logged_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    logged_time TEXT,
    meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'shake', 'supplement', 'pre_workout', 'post_workout')),
    food_name TEXT NOT NULL,
    brand TEXT,
    serving_size REAL NOT NULL,
    serving_unit TEXT NOT NULL DEFAULT 'g',
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL DEFAULT 0,
    carbs_g REAL DEFAULT 0,
    fat_g REAL DEFAULT 0,
    fiber_g REAL DEFAULT 0,
    notes TEXT,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (food_id) REFERENCES foods(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_food_log_date ON food_log(logged_date DESC);
CREATE INDEX IF NOT EXISTS idx_food_log_meal ON food_log(meal_type);
CREATE INDEX IF NOT EXISTS idx_food_log_food_id ON food_log(food_id);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_foods_brand ON foods(brand COLLATE NOCASE);
