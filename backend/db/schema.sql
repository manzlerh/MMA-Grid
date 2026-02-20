-- UFC Trivia Game App - PostgreSQL Schema
-- Run with: psql -f schema.sql (or your connection string)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- FIGHTERS
-- =============================================================================
CREATE TABLE fighters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL UNIQUE,
    nickname            TEXT,
    nationality         TEXT,
    gym                 TEXT,
    weight_classes      TEXT[],
    stance              TEXT,
    height_inches       INT,
    weight_lbs          INT,
    reach_inches        INT,
    wins                INT,
    losses              INT,
    draws               INT,
    win_by_ko           INT,
    win_by_sub          INT,
    win_by_dec          INT,
    total_fights        INT,
    is_champion         BOOLEAN,
    is_former_champion  BOOLEAN,
    title_weight_classes TEXT[],
    performance_bonuses INT,
    born_year           INT,
    ufc_debut_year      INT,
    image_url           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fighters_name ON fighters (name);

-- =============================================================================
-- FIGHT HISTORY
-- =============================================================================
CREATE TABLE fight_history (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id     UUID NOT NULL REFERENCES fighters (id) ON DELETE CASCADE,
    opponent_name  TEXT,
    event_name     TEXT,
    fight_year     INT,
    result         TEXT CHECK (result IN ('W', 'L', 'D', 'NC')),
    method         TEXT,
    weight_class   TEXT
);

CREATE INDEX idx_fight_history_fighter_id ON fight_history (fighter_id);

-- =============================================================================
-- DAILY PUZZLES
-- =============================================================================
CREATE TABLE daily_puzzles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_type    TEXT NOT NULL CHECK (game_type IN ('grid', 'connections')),
    puzzle_date  DATE NOT NULL,
    puzzle_data  JSONB,
    difficulty   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (game_type, puzzle_date)
);

CREATE INDEX idx_daily_puzzles_puzzle_date ON daily_puzzles (puzzle_date);
CREATE INDEX idx_daily_puzzles_game_type_date ON daily_puzzles (game_type, puzzle_date);

-- =============================================================================
-- USER SCORES
-- =============================================================================
CREATE TABLE user_scores (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_user_id UUID NOT NULL,
    game_type         TEXT NOT NULL,
    puzzle_date       DATE NOT NULL,
    score             INT,
    completed         BOOLEAN,
    attempts          INT,
    time_seconds      INT,
    played_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_scores_anonymous_user_id ON user_scores (anonymous_user_id);
CREATE INDEX idx_user_scores_puzzle_date ON user_scores (puzzle_date);
CREATE INDEX idx_user_scores_game_type_date ON user_scores (game_type, puzzle_date);
