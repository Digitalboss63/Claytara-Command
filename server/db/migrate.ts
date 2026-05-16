/**
 * server/db/migrate.ts — Inline migration runner (idempotent)
 * Phase 2: adds health fields + nextAction to projects, adds protocols table.
 * Each statement executed individually — postgres.js rejects multi-statement strings.
 */

import db from "./index.js";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  process.stdout.write("[db] Running migrations...\n");

  // ── Enums ─────────────────────────────────────────────────────────────────
  for (const [name, values] of [
    ["project_status",    "'active','building','paused','archived'"],
    ["production_stage",  "'idea','prototype','beta','live','scaling'"],
    ["priority",          "'critical','high','medium','low'"],
    ["note_severity",     "'info','warning','critical','blocker'"],
    ["health_status",     "'healthy','warning','critical','unknown'"],
    ["protocol_priority", "'mandatory','recommended','optional'"],
  ] as [string, string][]) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE TYPE ${name} AS ENUM (${values});
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `));
  }

  // ── Core tables ────────────────────────────────────────────────────────────
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

  // ── Phase 2: safe ALTER TABLE for new columns ──────────────────────────────
  const projectAlters: [string, string][] = [
    ["health_endpoint_url",          "TEXT"],
    ["last_health_status",           "health_status DEFAULT 'unknown'"],
    ["last_health_checked_at",       "TIMESTAMPTZ"],
    ["last_health_response_summary", "TEXT"],
    ["last_health_error",            "TEXT"],
    ["next_action",                  "TEXT"],
  ];

  for (const [col, def] of projectAlters) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE projects ADD COLUMN ${col} ${def};
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `));
  }

  // ── Protocols table ────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS protocols (
      id            SERIAL PRIMARY KEY,
      title         TEXT NOT NULL,
      category      TEXT NOT NULL,
      description   TEXT,
      protocol_text TEXT NOT NULL,
      priority      protocol_priority NOT NULL DEFAULT 'recommended',
      active        BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Phase 3: new enums ────────────────────────────────────────────────────
  for (const [name, values] of [
    ["severity_level",        "'info','warning','critical'"],
    ["rule_type",             "'missing_field','health_check','staleness','threshold','coverage'"],
    ["activity_event_type",   "'health_check_passed','health_check_failed','project_updated','protocol_updated','blocker_added','blocker_resolved','readiness_changed','issue_detected','issue_resolved'"],
  ] as [string, string][]) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE TYPE ${name} AS ENUM (${values});
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `));
  }

  // ── Phase 3: new tables ───────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS detection_rules (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      severity    severity_level NOT NULL DEFAULT 'warning',
      active      BOOLEAN NOT NULL DEFAULT true,
      rule_type   rule_type NOT NULL DEFAULT 'missing_field',
      rule_config TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS readiness_snapshots (
      id                   SERIAL PRIMARY KEY,
      project_id           INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      infrastructure_score INTEGER NOT NULL DEFAULT 0,
      deployment_score     INTEGER NOT NULL DEFAULT 0,
      ai_score             INTEGER NOT NULL DEFAULT 0,
      operational_score    INTEGER NOT NULL DEFAULT 0,
      monitoring_score     INTEGER NOT NULL DEFAULT 0,
      overall_score        INTEGER NOT NULL DEFAULT 0,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      event_type  activity_event_type NOT NULL,
      severity    severity_level NOT NULL DEFAULT 'info',
      title       TEXT NOT NULL,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS detection_audit_log (
      id                SERIAL PRIMARY KEY,
      project_id        INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      detection_rule_id INTEGER REFERENCES detection_rules(id) ON DELETE SET NULL,
      severity          severity_level NOT NULL DEFAULT 'warning',
      issue_title       TEXT NOT NULL,
      issue_description TEXT,
      resolved          BOOLEAN NOT NULL DEFAULT false,
      resolution_notes  TEXT,
      detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at       TIMESTAMPTZ
    )
  `);

  process.stdout.write("[db] Migrations complete.\n");
}
