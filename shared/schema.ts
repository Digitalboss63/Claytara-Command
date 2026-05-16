/**
 * shared/schema.ts — Drizzle ORM schema + shared types
 * Phase 2: added project health fields, nextAction, protocols table
 */

import {
  pgTable, text, boolean, timestamp, integer, serial, pgEnum,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const projectStatusEnum = pgEnum("project_status", [
  "active", "building", "paused", "archived",
]);

export const productionStageEnum = pgEnum("production_stage", [
  "idea", "prototype", "beta", "live", "scaling",
]);

export const priorityEnum = pgEnum("priority", [
  "critical", "high", "medium", "low",
]);

export const noteSeverityEnum = pgEnum("note_severity", [
  "info", "warning", "critical", "blocker",
]);

export const healthStatusEnum = pgEnum("health_status", [
  "healthy", "warning", "critical", "unknown",
]);

export const protocolPriorityEnum = pgEnum("protocol_priority", [
  "mandatory", "recommended", "optional",
]);

// ── Projects ──────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id:                          serial("id").primaryKey(),
  name:                        text("name").notNull(),
  description:                 text("description"),
  status:                      projectStatusEnum("status").notNull().default("active"),
  priority:                    priorityEnum("priority").notNull().default("medium"),
  productionStage:             productionStageEnum("production_stage").notNull().default("idea"),
  domain:                      text("domain"),
  githubUrl:                   text("github_url"),
  railwayUrl:                  text("railway_url"),
  healthEndpointUrl:           text("health_endpoint_url"),
  lastHealthStatus:            healthStatusEnum("last_health_status").default("unknown"),
  lastHealthCheckedAt:         timestamp("last_health_checked_at"),
  lastHealthResponseSummary:   text("last_health_response_summary"),
  lastHealthError:             text("last_health_error"),
  stripeConnected:             boolean("stripe_connected").notNull().default(false),
  clerkConnected:              boolean("clerk_connected").notNull().default(false),
  aiEnabled:                   boolean("ai_enabled").notNull().default(false),
  notes:                       text("notes"),
  blockers:                    text("blockers"),
  nextAction:                  text("next_action"),
  lastDeployedAt:              timestamp("last_deployed_at"),
  createdAt:                   timestamp("created_at").notNull().defaultNow(),
  updatedAt:                   timestamp("updated_at").notNull().defaultNow(),
});

// ── Project Notes ─────────────────────────────────────────────────────────────

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
  id:          serial("id").primaryKey(),
  service:     text("service").notNull(),
  status:      healthStatusEnum("status").notNull().default("unknown"),
  statusText:  text("status_text"),
  checkedAt:   timestamp("checked_at").notNull().defaultNow(),
  responseMs:  integer("response_ms"),
  metadata:    text("metadata"),
});

// ── Protocols ─────────────────────────────────────────────────────────────────

export const protocols = pgTable("protocols", {
  id:           serial("id").primaryKey(),
  title:        text("title").notNull(),
  category:     text("category").notNull(),
  description:  text("description"),
  protocolText: text("protocol_text").notNull(),
  priority:     protocolPriorityEnum("priority").notNull().default("recommended"),
  active:       boolean("active").notNull().default(true),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

// ── Zod validation schemas ────────────────────────────────────────────────────

export const insertProjectSchema = z.object({
  name:                      z.string().min(1).max(120),
  description:               z.string().max(1000).optional().nullable(),
  status:                    z.enum(["active","building","paused","archived"]).default("active"),
  priority:                  z.enum(["critical","high","medium","low"]).default("medium"),
  productionStage:           z.enum(["idea","prototype","beta","live","scaling"]).default("idea"),
  domain:                    z.string().max(200).optional().nullable(),
  githubUrl:                 z.string().max(300).optional().nullable(),
  railwayUrl:                z.string().max(300).optional().nullable(),
  healthEndpointUrl:         z.string().max(300).optional().nullable(),
  stripeConnected:           z.boolean().default(false),
  clerkConnected:            z.boolean().default(false),
  aiEnabled:                 z.boolean().default(false),
  notes:                     z.string().max(5000).optional().nullable(),
  blockers:                  z.string().max(2000).optional().nullable(),
  nextAction:                z.string().max(1000).optional().nullable(),
  lastDeployedAt:            z.string().datetime().optional().nullable(),
});

export const insertNoteSchema = z.object({
  projectId: z.number().int().positive(),
  title:     z.string().min(1).max(120),
  note:      z.string().min(1).max(5000),
  severity:  z.enum(["info","warning","critical","blocker"]).default("info"),
});

export const insertProtocolSchema = z.object({
  title:        z.string().min(1).max(200),
  category:     z.string().min(1).max(80),
  description:  z.string().max(500).optional().nullable(),
  protocolText: z.string().min(1),
  priority:     z.enum(["mandatory","recommended","optional"]).default("recommended"),
  active:       z.boolean().default(true),
});

// ── Phase 3 Enums ─────────────────────────────────────────────────────────────

export const severityLevelEnum = pgEnum("severity_level", [
  "info", "warning", "critical",
]);

export const ruleTypeEnum = pgEnum("rule_type", [
  "missing_field", "health_check", "staleness", "threshold", "coverage",
]);

export const activityEventTypeEnum = pgEnum("activity_event_type", [
  "health_check_passed", "health_check_failed", "project_updated",
  "protocol_updated", "blocker_added", "blocker_resolved",
  "readiness_changed", "issue_detected", "issue_resolved",
]);

// ── Phase 3 Tables ────────────────────────────────────────────────────────────

export const detectionRules = pgTable("detection_rules", {
  id:          serial("id").primaryKey(),
  title:       text("title").notNull(),
  description: text("description"),
  severity:    severityLevelEnum("severity").notNull().default("warning"),
  active:      boolean("active").notNull().default(true),
  ruleType:    ruleTypeEnum("rule_type").notNull().default("missing_field"),
  ruleConfig:  text("rule_config"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export const readinessSnapshots = pgTable("readiness_snapshots", {
  id:                 serial("id").primaryKey(),
  projectId:          integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  infrastructureScore: integer("infrastructure_score").notNull().default(0),
  deploymentScore:    integer("deployment_score").notNull().default(0),
  aiScore:            integer("ai_score").notNull().default(0),
  operationalScore:   integer("operational_score").notNull().default(0),
  monitoringScore:    integer("monitoring_score").notNull().default(0),
  overallScore:       integer("overall_score").notNull().default(0),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
});

export const activityLog = pgTable("activity_log", {
  id:          serial("id").primaryKey(),
  projectId:   integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  eventType:   activityEventTypeEnum("event_type").notNull(),
  severity:    severityLevelEnum("severity").notNull().default("info"),
  title:       text("title").notNull(),
  description: text("description"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const detectionAuditLog = pgTable("detection_audit_log", {
  id:                serial("id").primaryKey(),
  projectId:         integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  detectionRuleId:   integer("detection_rule_id").references(() => detectionRules.id, { onDelete: "set null" }),
  severity:          severityLevelEnum("severity").notNull().default("warning"),
  issueTitle:        text("issue_title").notNull(),
  issueDescription:  text("issue_description"),
  resolved:          boolean("resolved").notNull().default(false),
  resolutionNotes:   text("resolution_notes"),
  detectedAt:        timestamp("detected_at").notNull().defaultNow(),
  resolvedAt:        timestamp("resolved_at"),
});

// ── Phase 3 Zod schemas ───────────────────────────────────────────────────────

export const insertDetectionRuleSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  severity:    z.enum(["info", "warning", "critical"]).default("warning"),
  active:      z.boolean().default(true),
  ruleType:    z.enum(["missing_field", "health_check", "staleness", "threshold", "coverage"]).default("missing_field"),
  ruleConfig:  z.string().optional().nullable(),
});

export const insertReadinessSnapshotSchema = z.object({
  projectId:           z.number().int().positive(),
  infrastructureScore: z.number().int().min(0).max(100).default(0),
  deploymentScore:     z.number().int().min(0).max(100).default(0),
  aiScore:             z.number().int().min(0).max(100).default(0),
  operationalScore:    z.number().int().min(0).max(100).default(0),
  monitoringScore:     z.number().int().min(0).max(100).default(0),
  overallScore:        z.number().int().min(0).max(100).default(0),
});

export const insertActivityLogSchema = z.object({
  projectId:   z.number().int().positive().optional().nullable(),
  eventType:   z.enum(["health_check_passed","health_check_failed","project_updated","protocol_updated","blocker_added","blocker_resolved","readiness_changed","issue_detected","issue_resolved"]),
  severity:    z.enum(["info","warning","critical"]).default("info"),
  title:       z.string().min(1).max(300),
  description: z.string().max(1000).optional().nullable(),
});

export const insertDetectionAuditLogSchema = z.object({
  projectId:        z.number().int().positive().optional().nullable(),
  detectionRuleId:  z.number().int().positive().optional().nullable(),
  severity:         z.enum(["info","warning","critical"]).default("warning"),
  issueTitle:       z.string().min(1).max(300),
  issueDescription: z.string().max(1000).optional().nullable(),
  resolved:         z.boolean().default(false),
  resolutionNotes:  z.string().max(1000).optional().nullable(),
  resolvedAt:       z.string().datetime().optional().nullable(),
});

// ── TypeScript types ──────────────────────────────────────────────────────────

export type Project              = InferSelectModel<typeof projects>;
export type InsertProject        = InferInsertModel<typeof projects>;
export type ProjectNote          = InferSelectModel<typeof projectNotes>;
export type InsertProjectNote    = InferInsertModel<typeof projectNotes>;
export type HealthSnapshot       = InferSelectModel<typeof systemHealthSnapshots>;
export type InsertHealthSnapshot = InferInsertModel<typeof systemHealthSnapshots>;
export type Protocol             = InferSelectModel<typeof protocols>;
export type InsertProtocol       = InferInsertModel<typeof protocols>;

export type DetectionRule            = InferSelectModel<typeof detectionRules>;
export type InsertDetectionRule      = InferInsertModel<typeof detectionRules>;
export type ReadinessSnapshot        = InferSelectModel<typeof readinessSnapshots>;
export type InsertReadinessSnapshot  = InferInsertModel<typeof readinessSnapshots>;
export type ActivityLogEntry         = InferSelectModel<typeof activityLog>;
export type InsertActivityLogEntry   = InferInsertModel<typeof activityLog>;
export type DetectionAuditLogEntry   = InferSelectModel<typeof detectionAuditLog>;
export type InsertDetectionAuditLog  = InferInsertModel<typeof detectionAuditLog>;

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface SystemHealthCard {
  service:     string;
  label?:      string;
  status:      HealthStatus;
  statusText?: string | null;
  checkedAt:   string | null;
}

export interface FullHealthResponse {
  status:    "healthy" | "degraded" | "critical";
  server:    boolean;
  database:  boolean;
  env:       boolean;
  uptime:    number;
  timestamp: string;
}
