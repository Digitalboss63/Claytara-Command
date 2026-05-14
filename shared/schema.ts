/**
 * shared/schema.ts — Drizzle ORM schema + shared types
 * Single source of truth for DB shape and TypeScript types.
 */

import {
  pgTable, text, boolean, timestamp, integer, serial, pgEnum,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "building",
  "paused",
  "archived",
]);

export const productionStageEnum = pgEnum("production_stage", [
  "idea",
  "prototype",
  "beta",
  "live",
  "scaling",
]);

export const priorityEnum = pgEnum("priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const noteSeverityEnum = pgEnum("note_severity", [
  "info",
  "warning",
  "critical",
  "blocker",
]);

export const healthStatusEnum = pgEnum("health_status", [
  "healthy",
  "warning",
  "critical",
  "unknown",
]);

// ── Projects ──────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id:               serial("id").primaryKey(),
  name:             text("name").notNull(),
  description:      text("description"),
  status:           projectStatusEnum("status").notNull().default("active"),
  priority:         priorityEnum("priority").notNull().default("medium"),
  productionStage:  productionStageEnum("production_stage").notNull().default("idea"),
  domain:           text("domain"),
  githubUrl:        text("github_url"),
  railwayUrl:       text("railway_url"),
  stripeConnected:  boolean("stripe_connected").notNull().default(false),
  clerkConnected:   boolean("clerk_connected").notNull().default(false),
  aiEnabled:        boolean("ai_enabled").notNull().default(false),
  notes:            text("notes"),
  blockers:         text("blockers"),
  lastDeployedAt:   timestamp("last_deployed_at"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

// ── Project Notes (operational log) ──────────────────────────────────────────

export const projectNotes = pgTable("project_notes", {
  id:        serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  note:      text("note").notNull(),
  severity:  noteSeverityEnum("severity").notNull().default("info"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── System Health Snapshots ───────────────────────────────────────────────────

export const systemHealthSnapshots = pgTable("system_health_snapshots", {
  id:            serial("id").primaryKey(),
  service:       text("service").notNull(),      // "railway" | "stripe" | "clerk" | "github" | "ai" | "domain"
  status:        healthStatusEnum("status").notNull().default("unknown"),
  statusText:    text("status_text"),
  checkedAt:     timestamp("checked_at").notNull().defaultNow(),
  responseMs:    integer("response_ms"),
  metadata:      text("metadata"),               // JSON string for extensibility
});

// ── Zod validation schemas ────────────────────────────────────────────────────

export const insertProjectSchema = z.object({
  name:            z.string().min(1).max(120),
  description:     z.string().max(1000).optional().nullable(),
  status:          z.enum(["active","building","paused","archived"]).default("active"),
  priority:        z.enum(["critical","high","medium","low"]).default("medium"),
  productionStage: z.enum(["idea","prototype","beta","live","scaling"]).default("idea"),
  domain:          z.string().max(200).optional().nullable(),
  githubUrl:       z.string().url().optional().nullable().or(z.literal("")),
  railwayUrl:      z.string().url().optional().nullable().or(z.literal("")),
  stripeConnected: z.boolean().default(false),
  clerkConnected:  z.boolean().default(false),
  aiEnabled:       z.boolean().default(false),
  notes:           z.string().max(5000).optional().nullable(),
  blockers:        z.string().max(2000).optional().nullable(),
  lastDeployedAt:  z.string().datetime().optional().nullable(),
});

export const insertNoteSchema = z.object({
  projectId: z.number().int().positive(),
  title:     z.string().min(1).max(120),
  note:      z.string().min(1).max(5000),
  severity:  z.enum(["info","warning","critical","blocker"]).default("info"),
});

// ── TypeScript types ──────────────────────────────────────────────────────────

export type Project             = InferSelectModel<typeof projects>;
export type InsertProject       = InferInsertModel<typeof projects>;
export type ProjectNote         = InferSelectModel<typeof projectNotes>;
export type InsertProjectNote   = InferInsertModel<typeof projectNotes>;
export type HealthSnapshot      = InferSelectModel<typeof systemHealthSnapshots>;
export type InsertHealthSnapshot = InferInsertModel<typeof systemHealthSnapshots>;

// ── API response types (used by both client and server) ───────────────────────

export interface ProjectWithNotes extends Project {
  recentNotes: ProjectNote[];
}

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface SystemHealthCard {
  service:    string;
  label?:     string;
  status:     HealthStatus;
  statusText?: string | null;
  checkedAt:  string | null;
}

export interface FullHealthResponse {
  status:    "healthy" | "degraded" | "critical";
  server:    boolean;
  database:  boolean;
  env:       boolean;
  uptime:    number;
  timestamp: string;
}
