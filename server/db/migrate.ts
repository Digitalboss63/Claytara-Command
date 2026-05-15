/**
 * server/db/migrate.ts — Inline migration runner
 * Each statement executed individually — postgres.js does not support
 * multi-statement strings in a single db.execute() call.
 */

import db from "./index.js";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  process.stdout.write("[db] Running migrations...\n");

  // ── Enums — use DO block to create only if missing (IF NOT EXISTS not
  // supported for types in all PG versions via simple CREATE TYPE syntax)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE project_status AS ENUM ('active','building','paused','archived');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE production_stage AS ENUM ('idea','prototype','beta','live','scaling');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE priority AS ENUM ('critical','high','medium','low');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE note_severity AS ENUM ('info','warning','critical','blocker');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE health_status AS ENUM ('healthy','warning','critical','unknown');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);

  // ── Tables
  await db.execute(sql`
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
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_notes (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      note        TEXT NOT NULL,
      severity    note_severity NOT NULL DEFAULT 'info',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_health_snapshots (
      id           SERIAL PRIMARY KEY,
      service      TEXT NOT NULL,
      status       health_status NOT NULL DEFAULT 'unknown',
      status_text  TEXT,
      checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      response_ms  INTEGER,
      metadata     TEXT
    )
  `);

  process.stdout.write("[db] Migrations complete.\n");
}
