/**
 * server/db/migrate.ts — Inline migration runner
 * Runs on server start (not as a separate build step).
 * Uses raw SQL to create tables idempotently — works on fresh Railway Postgres.
 */

import db from "./index.js";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  process.stdout.write("[db] Running migrations...\n");

  await db.execute(sql`
    CREATE TYPE IF NOT EXISTS project_status AS ENUM ('active','building','paused','archived');
    CREATE TYPE IF NOT EXISTS production_stage AS ENUM ('idea','prototype','beta','live','scaling');
    CREATE TYPE IF NOT EXISTS priority AS ENUM ('critical','high','medium','low');
    CREATE TYPE IF NOT EXISTS note_severity AS ENUM ('info','warning','critical','blocker');
    CREATE TYPE IF NOT EXISTS health_status AS ENUM ('healthy','warning','critical','unknown');

    CREATE TABLE IF NOT EXISTS projects (
      id                SERIAL PRIMARY KEY,
      name              TEXT NOT NULL,
      description       TEXT,
      status            project_status NOT NULL DEFAULT 'active',
      priority          priority NOT NULL DEFAULT 'medium',
      production_stage  production_stage NOT NULL DEFAULT 'idea',
      domain            TEXT,
      github_url        TEXT,
      railway_url       TEXT,
      stripe_connected  BOOLEAN NOT NULL DEFAULT false,
      clerk_connected   BOOLEAN NOT NULL DEFAULT false,
      ai_enabled        BOOLEAN NOT NULL DEFAULT false,
      notes             TEXT,
      blockers          TEXT,
      last_deployed_at  TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS project_notes (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      note        TEXT NOT NULL,
      severity    note_severity NOT NULL DEFAULT 'info',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_health_snapshots (
      id           SERIAL PRIMARY KEY,
      service      TEXT NOT NULL,
      status       health_status NOT NULL DEFAULT 'unknown',
      status_text  TEXT,
      checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      response_ms  INTEGER,
      metadata     TEXT
    );
  `);

  process.stdout.write("[db] Migrations complete.\n");
}
