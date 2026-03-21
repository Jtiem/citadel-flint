-- Flint Project Schema (Phase C)
-- This file prepares the local data layer for Flint IDE integration.
-- Run this against your project's SQLite database to initialise the schema.

CREATE TABLE IF NOT EXISTS project_meta (
    key        TEXT    PRIMARY KEY,
    value      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
