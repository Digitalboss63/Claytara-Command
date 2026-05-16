/**
 * server/index.ts — Claytara Command API Server (Phase 2)
 *
 * New in Phase 2:
 *   GET  /api/projects/:id/check-health
 *   POST /api/projects/check-all-health
 *   GET  /api/protocols
 *   GET  /api/protocols/:id
 *   POST /api/protocols
 *   PUT  /api/protocols/:id
 *
 *   Projects now include: healthEndpointUrl, lastHealthStatus,
 *   lastHealthCheckedAt, lastHealthResponseSummary, lastHealthError, nextAction
 */

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { eq, desc, sql as drizzleSql } from "drizzle-orm";
import { resolve } from "path";
import { fileURLToPath } from "url";
import db from "./db/index.js";
import { runMigrations } from "./db/migrate.js";
import {
  projects, projectNotes, systemHealthSnapshots, protocols,
  detectionRules, readinessSnapshots, activityLog, detectionAuditLog,
  insertProjectSchema, insertNoteSchema, insertProtocolSchema,
} from "../shared/schema.js";

const _serverDir = resolve(fileURLToPath(import.meta.url), "..");
const app = express();
const PORT = parseInt(process.env.PORT || "5002", 10);
const startedAt = Date.now();

app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;"
  );
  next();
});

app.use(cors({ origin: process.env.APP_URL ?? true }));
app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { error: "Too many requests" },
});
app.use("/api", apiLimiter);

// ── Sanitizer ─────────────────────────────────────────────────────────────────
function safeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/postgresql:\/\/[^\s"]*/gi, "[DB_URL]")
    .replace(/sk-[a-zA-Z0-9-]{20,}/g, "[API_KEY]")
    .replace(/Bearer [^\s"]*/g, "[TOKEN]");
}

// ── ENV validation ────────────────────────────────────────────────────────────
const REQUIRED_ENV = ["CLAYTARA_COMMAND_DATABASE_URL", "DATABASE_URL"];
function envOk(): boolean {
  return REQUIRED_ENV.some((k) => !!process.env[k]);
}

// ── Health endpoint checker ───────────────────────────────────────────────────
interface HealthCheckResult {
  status: "healthy" | "warning" | "critical" | "unknown";
  summary: string;
  error: string | null;
  responseMs: number;
}

async function checkProjectHealth(url: string): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Strict: only allow https URLs, cap timeout at 8s
    if (!url.startsWith("https://") && !url.startsWith("http://localhost")) {
      return { status: "unknown", summary: "Invalid endpoint URL", error: "Only https:// allowed", responseMs: 0 };
    }
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ClaytaraCommand/2.0 health-checker" },
    });
    const ms = Date.now() - start;
    if (!res.ok) {
      return { status: "critical", summary: `HTTP ${res.status}`, error: `HTTP ${res.status} ${res.statusText}`, responseMs: ms };
    }
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    // Interpret status field if present
    const s = String(data.status ?? "").toLowerCase();
    const status: HealthCheckResult["status"] =
      s === "ok" || s === "healthy" ? "healthy"
      : s === "degraded" || s === "warning" ? "warning"
      : s === "critical" ? "critical"
      : res.ok ? "healthy"
      : "critical";
    const summary = JSON.stringify(data).slice(0, 300);
    return { status, summary, error: null, responseMs: ms };
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const isTimed = msg.includes("timeout") || msg.includes("abort");
    return {
      status: "critical",
      summary: isTimed ? "Request timed out" : "Connection failed",
      error: isTimed ? "Timed out after 8s" : "Could not reach endpoint",
      responseMs: ms,
    };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/health/full
app.get("/api/health/full", async (_req, res) => {
  let dbOk = false;
  try {
    await db.execute(drizzleSql`SELECT 1`);
    dbOk = true;
  } catch { /* db down */ }
  const envValid = envOk();
  res.json({
    status: dbOk && envValid ? "healthy" : "degraded",
    server: true, database: dbOk, env: envValid,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/health/services
app.get("/api/health/services", async (_req, res) => {
  try {
    const rows = await db.select().from(systemHealthSnapshots).orderBy(desc(systemHealthSnapshots.checkedAt)).limit(50);
    const byService: Record<string, typeof rows[0]> = {};
    for (const row of rows) {
      if (!byService[row.service]) byService[row.service] = row;
    }
    res.json({ services: Object.values(byService) });
  } catch (err) {
    res.status(500).json({ error: "Failed to load service health" });
    process.stderr.write(`[health] services error: ${safeError(err)}\n`);
  }
});

// GET /api/projects
app.get("/api/projects", async (_req, res) => {
  try {
    const rows = await db.select().from(projects).orderBy(projects.priority, projects.name);
    res.json({ projects: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load projects" });
    process.stderr.write(`[projects] list error: ${safeError(err)}\n`);
  }
});

// GET /api/projects/:id
app.get("/api/projects/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    const notes = await db.select().from(projectNotes).where(eq(projectNotes.projectId, id)).orderBy(desc(projectNotes.createdAt)).limit(20);
    res.json({ project, notes });
  } catch (err) {
    res.status(500).json({ error: "Failed to load project" });
    process.stderr.write(`[projects] get error: ${safeError(err)}\n`);
  }
});

// POST /api/projects
app.post("/api/projects", async (req, res) => {
  const parsed = insertProjectSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid project data", issues: parsed.error.issues }); return; }
  try {
    const insertData = { ...parsed.data, lastDeployedAt: parsed.data.lastDeployedAt ? new Date(parsed.data.lastDeployedAt) : null };
    const [created] = await db.insert(projects).values(insertData as any).returning();
    res.status(201).json({ project: created });
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
    process.stderr.write(`[projects] create error: ${safeError(err)}\n`);
  }
});

// PUT /api/projects/:id
app.put("/api/projects/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const parsed = insertProjectSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid project data", issues: parsed.error.issues }); return; }
  try {
    const updateData = { ...parsed.data, lastDeployedAt: parsed.data.lastDeployedAt !== undefined ? (parsed.data.lastDeployedAt ? new Date(parsed.data.lastDeployedAt) : null) : undefined, updatedAt: new Date() };
    const [updated] = await db.update(projects).set(updateData as any).where(eq(projects.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Project not found" }); return; }
    await logActivity({ projectId: id, eventType: "project_updated", severity: "info", title: `Project updated: ${updated.name}` });
    res.json({ project: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update project" });
    process.stderr.write(`[projects] update error: ${safeError(err)}\n`);
  }
});

// GET /api/projects/:id/check-health
app.get("/api/projects/:id/check-health", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!project.healthEndpointUrl) {
      res.json({ status: "unknown", message: "No health endpoint configured for this project." });
      return;
    }
    const result = await checkProjectHealth(project.healthEndpointUrl);
    await db.update(projects).set({
      lastHealthStatus: result.status,
      lastHealthCheckedAt: new Date(),
      lastHealthResponseSummary: result.summary,
      lastHealthError: result.error,
      updatedAt: new Date(),
    }).where(eq(projects.id, id));
    await logActivity({
      projectId: project.id,
      eventType: result.status === "healthy" ? "health_check_passed" : "health_check_failed",
      severity: result.status === "critical" ? "critical" : result.status === "warning" ? "warning" : "info",
      title: `Health check ${result.status}: ${project.name}`,
      description: result.summary?.slice(0, 200) ?? undefined,
    });
    process.stdout.write(`[health-check] project=${id} status=${result.status} ms=${result.responseMs}\n`);
    res.json({ ...result, checkedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Health check failed" });
    process.stderr.write(`[health-check] error: ${safeError(err)}\n`);
  }
});

// POST /api/projects/check-all-health
app.post("/api/projects/check-all-health", async (_req, res) => {
  try {
    const allProjects = await db.select().from(projects);
    const withEndpoints = allProjects.filter(p => !!p.healthEndpointUrl);
    if (withEndpoints.length === 0) {
      res.json({ checked: 0, results: [], message: "No projects have health endpoints configured." });
      return;
    }
    const results = await Promise.allSettled(
      withEndpoints.map(async (p) => {
        const result = await checkProjectHealth(p.healthEndpointUrl!);
        await db.update(projects).set({
          lastHealthStatus: result.status,
          lastHealthCheckedAt: new Date(),
          lastHealthResponseSummary: result.summary,
          lastHealthError: result.error,
          updatedAt: new Date(),
        }).where(eq(projects.id, p.id));
        return { id: p.id, name: p.name, ...result };
      })
    );
    const summary = results.map(r =>
      r.status === "fulfilled" ? r.value : { id: 0, name: "unknown", status: "critical", error: "Check failed" }
    );
    process.stdout.write(`[health-check] checked ${summary.length} projects\n`);
    res.json({ checked: summary.length, results: summary });
  } catch (err) {
    res.status(500).json({ error: "Bulk health check failed" });
    process.stderr.write(`[health-check] bulk error: ${safeError(err)}\n`);
  }
});

// GET /api/projects/:id/notes
app.get("/api/projects/:id/notes", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  try {
    const notes = await db.select().from(projectNotes).where(eq(projectNotes.projectId, id)).orderBy(desc(projectNotes.createdAt));
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: "Failed to load notes" });
    process.stderr.write(`[notes] list error: ${safeError(err)}\n`);
  }
});

// POST /api/projects/:id/notes
app.post("/api/projects/:id/notes", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const parsed = insertNoteSchema.safeParse({ ...req.body, projectId: id });
  if (!parsed.success) { res.status(400).json({ error: "Invalid note data", issues: parsed.error.issues }); return; }
  try {
    const [note] = await db.insert(projectNotes).values(parsed.data).returning();
    res.status(201).json({ note });
  } catch (err) {
    res.status(500).json({ error: "Failed to create note" });
    process.stderr.write(`[notes] create error: ${safeError(err)}\n`);
  }
});

// ── Protocols ─────────────────────────────────────────────────────────────────

// GET /api/protocols
app.get("/api/protocols", async (_req, res) => {
  try {
    const rows = await db.select().from(protocols).orderBy(protocols.priority, protocols.category, protocols.title);
    res.json({ protocols: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load protocols" });
    process.stderr.write(`[protocols] list error: ${safeError(err)}\n`);
  }
});

// GET /api/protocols/:id
app.get("/api/protocols/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid protocol ID" }); return; }
  try {
    const [protocol] = await db.select().from(protocols).where(eq(protocols.id, id));
    if (!protocol) { res.status(404).json({ error: "Protocol not found" }); return; }
    res.json({ protocol });
  } catch (err) {
    res.status(500).json({ error: "Failed to load protocol" });
    process.stderr.write(`[protocols] get error: ${safeError(err)}\n`);
  }
});

// POST /api/protocols
app.post("/api/protocols", async (req, res) => {
  const parsed = insertProtocolSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid protocol data", issues: parsed.error.issues }); return; }
  try {
    const [created] = await db.insert(protocols).values(parsed.data).returning();
    res.status(201).json({ protocol: created });
  } catch (err) {
    res.status(500).json({ error: "Failed to create protocol" });
    process.stderr.write(`[protocols] create error: ${safeError(err)}\n`);
  }
});

// PUT /api/protocols/:id
app.put("/api/protocols/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid protocol ID" }); return; }
  const parsed = insertProtocolSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid protocol data", issues: parsed.error.issues }); return; }
  try {
    const [updated] = await db.update(protocols).set({ ...parsed.data, updatedAt: new Date() }).where(eq(protocols.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Protocol not found" }); return; }
    await logActivity({ eventType: "protocol_updated", severity: "info", title: `Protocol updated: ${updated.title}` });
    res.json({ protocol: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update protocol" });
    process.stderr.write(`[protocols] update error: ${safeError(err)}\n`);
  }
});

// ── Phase 3: Activity logging helper ─────────────────────────────────────────
async function logActivity(opts: {
  projectId?: number | null;
  eventType: string;
  severity?: string;
  title: string;
  description?: string;
}): Promise<void> {
  try {
    await db.insert(activityLog).values({
      projectId: opts.projectId ?? null,
      eventType: opts.eventType as "health_check_passed" | "health_check_failed" | "project_updated" | "protocol_updated" | "blocker_added" | "blocker_resolved" | "readiness_changed" | "issue_detected" | "issue_resolved",
      severity: (opts.severity ?? "info") as "info" | "warning" | "critical",
      title: opts.title,
      description: opts.description ?? null,
    });
  } catch { /* never crash on activity log failures */ }
}

// ── Phase 3: Readiness scoring ────────────────────────────────────────────────
function calculateReadiness(project: typeof projects.$inferSelect): {
  infrastructure: number;
  deployment: number;
  ai: number;
  operational: number;
  monitoring: number;
  overall: number;
} {
  // Infrastructure (0-100): +25 each for: githubUrl, railwayUrl, domain, healthEndpointUrl
  let infrastructure = 0;
  if (project.githubUrl)         infrastructure += 25;
  if (project.railwayUrl)        infrastructure += 25;
  if (project.domain)            infrastructure += 25;
  if (project.healthEndpointUrl) infrastructure += 25;

  // Deployment (0-100)
  const stageScore: Record<string, number> = { idea: 20, prototype: 40, beta: 65, live: 90, scaling: 100 };
  let deployment = stageScore[project.productionStage] ?? 20;
  if ((project.productionStage === "live" || project.productionStage === "scaling") && !project.lastDeployedAt) {
    deployment -= 20;
  }
  if (project.lastDeployedAt) {
    const daysSinceDeployment = (Date.now() - new Date(project.lastDeployedAt).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceDeployment > 90) deployment -= 15;
  }
  deployment = Math.max(0, Math.min(100, deployment));

  // AI (0-100)
  let ai = 0;
  if (project.aiEnabled)        ai += 60;
  if (project.stripeConnected)  ai += 20;
  if (project.clerkConnected)   ai += 20;
  ai = Math.max(0, Math.min(100, ai));

  // Operational (0-100): start=50, +30 nextAction, +10 notes, -40 blockers
  let operational = 50;
  if (project.nextAction) operational += 30;
  if (project.notes)      operational += 10;
  if (project.blockers)   operational -= 40;
  operational = Math.max(0, Math.min(100, operational));

  // Monitoring (0-100)
  let monitoring = 0;
  if (project.healthEndpointUrl) monitoring += 40;
  const hs = project.lastHealthStatus;
  if (hs === "healthy")       monitoring += 40;
  else if (hs === "warning")  monitoring += 20;
  else if (hs === "critical") monitoring -= 10;
  if (project.lastHealthCheckedAt) {
    const hoursAgo = (Date.now() - new Date(project.lastHealthCheckedAt).getTime()) / (60 * 60 * 1000);
    if (hoursAgo < 24)  monitoring += 20;
    else if (hoursAgo > 72) monitoring -= 10;
  }
  monitoring = Math.max(0, Math.min(100, monitoring));

  const overall = Math.round((infrastructure + deployment + ai + operational + monitoring) / 5);

  return { infrastructure, deployment, ai, operational, monitoring, overall };
}

// ── Phase 3: Save readiness snapshot ─────────────────────────────────────────
async function saveReadinessSnapshot(project: typeof projects.$inferSelect): Promise<void> {
  const scores = calculateReadiness(project);
  await db.insert(readinessSnapshots).values({
    projectId:           project.id,
    infrastructureScore: scores.infrastructure,
    deploymentScore:     scores.deployment,
    aiScore:             scores.ai,
    operationalScore:    scores.operational,
    monitoringScore:     scores.monitoring,
    overallScore:        scores.overall,
  });
}

// ── Phase 3: Detection engine ─────────────────────────────────────────────────
async function runDetectionEngine(): Promise<{
  projectsChecked: number;
  rulesChecked: number;
  issuesFound: number;
  issuesNew: number;
}> {
  const allProjects = await db.select().from(projects);
  const activeRules = await db.select().from(detectionRules).where(eq(detectionRules.active, true));
  const protocolRows = await db.select().from(protocols).where(eq(protocols.active, true));
  const protocolCount = protocolRows.length;

  let issuesFound = 0;
  let issuesNew = 0;

  for (const project of allProjects) {
    for (const rule of activeRules) {
      let config: Record<string, string> = {};
      try { if (rule.ruleConfig) config = JSON.parse(rule.ruleConfig); } catch { /* ignore */ }
      const key = config.key ?? "";

      let violated = false;
      switch (key) {
        case "missing_health_endpoint":
          violated = !project.healthEndpointUrl;
          break;
        case "failed_health_check":
          violated = project.lastHealthStatus === "critical";
          break;
        case "missing_github_url":
          violated = !project.githubUrl;
          break;
        case "missing_railway_url":
          violated = !project.railwayUrl && (project.productionStage === "live" || project.productionStage === "scaling");
          break;
        case "missing_domain":
          violated = !project.domain && (project.productionStage === "beta" || project.productionStage === "live" || project.productionStage === "scaling");
          break;
        case "ai_disabled":
          violated = !project.aiEnabled;
          break;
        case "stale_deployment":
          violated = (project.productionStage === "live" || project.productionStage === "scaling") &&
            (!project.lastDeployedAt || (Date.now() - new Date(project.lastDeployedAt).getTime()) > 30 * 24 * 60 * 60 * 1000);
          break;
        case "missing_next_action":
          violated = !project.nextAction;
          break;
        case "repeated_critical_failures":
          violated = project.lastHealthStatus === "critical" && !!project.lastHealthError;
          break;
        case "missing_protocol_coverage":
          violated = protocolCount === 0;
          break;
        default:
          violated = false;
      }

      if (!violated) continue;
      issuesFound++;

      // Check for existing unresolved issue for this project + rule combo
      const existing = await db.select().from(detectionAuditLog).where(
        drizzleSql`${detectionAuditLog.projectId} = ${project.id}
          AND ${detectionAuditLog.detectionRuleId} = ${rule.id}
          AND ${detectionAuditLog.resolved} = false`
      ).limit(1);

      if (existing.length === 0) {
        const issueTitle = rule.title;
        const issueDescription = `${rule.description ?? rule.title} — detected for project "${project.name}"`;
        await db.insert(detectionAuditLog).values({
          projectId:        project.id,
          detectionRuleId:  rule.id,
          severity:         rule.severity,
          issueTitle,
          issueDescription,
          resolved:         false,
        });
        await logActivity({
          projectId:   project.id,
          eventType:   "issue_detected",
          severity:    rule.severity,
          title:       `Issue detected: ${issueTitle}`,
          description: issueDescription.slice(0, 200),
        });
        issuesNew++;
      }
    }
  }

  return {
    projectsChecked: allProjects.length,
    rulesChecked:    activeRules.length,
    issuesFound,
    issuesNew,
  };
}

// ── Phase 3: Routes ───────────────────────────────────────────────────────────

// GET /api/detection-rules
app.get("/api/detection-rules", async (_req, res) => {
  try {
    const rules = await db.select().from(detectionRules).orderBy(
      drizzleSql`CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`,
      detectionRules.title,
    );
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: "Failed to load detection rules" });
    process.stderr.write(`[detection-rules] list error: ${safeError(err)}\n`);
  }
});

// GET /api/issues
app.get("/api/issues", async (req, res) => {
  try {
    const resolvedParam = req.query.resolved as string | undefined;
    let resolvedFilter = "";
    if (resolvedParam === "true")  resolvedFilter = "AND dal.resolved = true";
    else if (resolvedParam !== "all") resolvedFilter = "AND dal.resolved = false";

    const rows = await db.execute(drizzleSql.raw(`
      SELECT
        dal.id,
        dal.project_id       AS "projectId",
        p.name               AS "projectName",
        dal.detection_rule_id AS "detectionRuleId",
        dal.severity,
        dal.issue_title      AS "issueTitle",
        dal.issue_description AS "issueDescription",
        dal.resolved,
        dal.resolution_notes AS "resolutionNotes",
        dal.detected_at      AS "detectedAt",
        dal.resolved_at      AS "resolvedAt"
      FROM detection_audit_log dal
      LEFT JOIN projects p ON p.id = dal.project_id
      WHERE 1=1 ${resolvedFilter}
      ORDER BY
        CASE dal.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        dal.detected_at DESC
      LIMIT 100
    `));
    res.json({ issues: Array.from(rows) });
  } catch (err) {
    res.status(500).json({ error: "Failed to load issues" });
    process.stderr.write(`[issues] list error: ${safeError(err)}\n`);
  }
});

// GET /api/activity
app.get("/api/activity", async (req, res) => {
  try {
    const limitParam = parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Math.min(isNaN(limitParam) ? 50 : limitParam, 200);
    const rows = await db.execute(drizzleSql.raw(`
      SELECT
        al.id,
        al.project_id  AS "projectId",
        p.name         AS "projectName",
        al.event_type  AS "eventType",
        al.severity,
        al.title,
        al.description,
        al.created_at  AS "createdAt"
      FROM activity_log al
      LEFT JOIN projects p ON p.id = al.project_id
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `));
    res.json({ activity: Array.from(rows) });
  } catch (err) {
    res.status(500).json({ error: "Failed to load activity" });
    process.stderr.write(`[activity] list error: ${safeError(err)}\n`);
  }
});

// GET /api/readiness
app.get("/api/readiness", async (_req, res) => {
  try {
    const rows = await db.execute(drizzleSql.raw(`
      SELECT DISTINCT ON (rs.project_id)
        rs.id,
        rs.project_id          AS "projectId",
        p.name                 AS "projectName",
        rs.infrastructure_score AS "infrastructureScore",
        rs.deployment_score    AS "deploymentScore",
        rs.ai_score            AS "aiScore",
        rs.operational_score   AS "operationalScore",
        rs.monitoring_score    AS "monitoringScore",
        rs.overall_score       AS "overallScore",
        rs.created_at          AS "createdAt"
      FROM readiness_snapshots rs
      JOIN projects p ON p.id = rs.project_id
      ORDER BY rs.project_id, rs.created_at DESC
    `));
    // Re-sort by overall_score asc after DISTINCT ON
    const sorted = Array.from(rows).sort((a: any, b: any) => (a.overallScore ?? 0) - (b.overallScore ?? 0));
    res.json({ readiness: sorted });
  } catch (err) {
    res.status(500).json({ error: "Failed to load readiness" });
    process.stderr.write(`[readiness] list error: ${safeError(err)}\n`);
  }
});

// GET /api/readiness/:projectId
app.get("/api/readiness/:projectId", async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  try {
    const rows = await db.execute(drizzleSql.raw(`
      SELECT
        rs.id,
        rs.project_id          AS "projectId",
        p.name                 AS "projectName",
        rs.infrastructure_score AS "infrastructureScore",
        rs.deployment_score    AS "deploymentScore",
        rs.ai_score            AS "aiScore",
        rs.operational_score   AS "operationalScore",
        rs.monitoring_score    AS "monitoringScore",
        rs.overall_score       AS "overallScore",
        rs.created_at          AS "createdAt"
      FROM readiness_snapshots rs
      JOIN projects p ON p.id = rs.project_id
      WHERE rs.project_id = ${projectId}
      ORDER BY rs.created_at DESC
      LIMIT 1
    `));
    res.json({ readiness: Array.from(rows)[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: "Failed to load readiness" });
    process.stderr.write(`[readiness] project error: ${safeError(err)}\n`);
  }
});

// POST /api/intelligence/run
app.post("/api/intelligence/run", async (_req, res) => {
  try {
    const detectionResult = await runDetectionEngine();
    const allProjects = await db.select().from(projects);
    for (const project of allProjects) {
      await saveReadinessSnapshot(project).catch(e =>
        process.stderr.write(`[readiness] snapshot error project=${project.id}: ${safeError(e)}\n`)
      );
    }
    process.stdout.write(`[intelligence] Detection run complete: ${JSON.stringify(detectionResult)}\n`);
    res.json(detectionResult);
  } catch (err) {
    res.status(500).json({ error: "Intelligence run failed" });
    process.stderr.write(`[intelligence] run error: ${safeError(err)}\n`);
  }
});

// POST /api/issues/:id/resolve
app.post("/api/issues/:id/resolve", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid issue ID" }); return; }
  const { resolutionNotes } = req.body as { resolutionNotes?: string };
  try {
    const [existing] = await db.select().from(detectionAuditLog).where(eq(detectionAuditLog.id, id));
    if (!existing) { res.status(404).json({ error: "Issue not found" }); return; }
    const [updated] = await db.update(detectionAuditLog)
      .set({
        resolved:        true,
        resolvedAt:      new Date(),
        resolutionNotes: resolutionNotes ?? null,
      })
      .where(eq(detectionAuditLog.id, id))
      .returning();
    await logActivity({
      projectId: existing.projectId ?? null,
      eventType: "issue_resolved",
      severity:  "info",
      title:     `Issue resolved: ${existing.issueTitle}`,
      description: resolutionNotes?.slice(0, 200) ?? undefined,
    });
    res.json({ issue: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve issue" });
    process.stderr.write(`[issues] resolve error: ${safeError(err)}\n`);
  }
});

// ── AI Readiness Placeholders ─────────────────────────────────────────────────
app.get("/api/ai/agents",          (_req, res) => { res.status(501).json({ message: "AI agents — Phase 3.", ready: false }); });
app.get("/api/ai/retrieval/status",(_req, res) => { res.status(501).json({ message: "Retrieval system — Phase 3.", ready: false }); });
app.get("/api/ai/self-heal/status",(_req, res) => { res.status(501).json({ message: "Self-heal — Phase 3.", ready: false }); });
app.get("/api/protocols-engine",   (_req, res) => { res.status(501).json({ message: "Protocol engine — Phase 3.", ready: false }); });

// ── Serve frontend ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const frontendPath = resolve(_serverDir, ".");
  app.use(express.static(frontendPath));
  app.get("/{*path}", (_req, res) => { res.sendFile(resolve(frontendPath, "index.html")); });
}

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  process.stderr.write(`[error] ${safeError(err)}\n`);
  res.status(500).json({ error: "Internal server error" });
});

// ── Detection Rules seeder — runs once if table is empty ─────────────────────
async function seedDetectionRulesIfEmpty(): Promise<void> {
  const existing = await db.select().from(detectionRules).limit(1);
  if (existing.length > 0) return;

  process.stdout.write("[detection-rules] Seeding default detection rules...\n");
  await db.insert(detectionRules).values([
    { title: "Missing Health Endpoint",       description: "Project has no health check URL configured.",                      severity: "warning",  active: true, ruleType: "missing_field", ruleConfig: JSON.stringify({ key: "missing_health_endpoint" }) },
    { title: "Critical Health Check Failure", description: "Project health endpoint is returning a critical status.",           severity: "critical", active: true, ruleType: "health_check",  ruleConfig: JSON.stringify({ key: "failed_health_check" }) },
    { title: "Missing GitHub URL",            description: "Project has no GitHub repository URL configured.",                  severity: "warning",  active: true, ruleType: "missing_field", ruleConfig: JSON.stringify({ key: "missing_github_url" }) },
    { title: "Missing Railway URL",           description: "Live/scaling project has no Railway deployment URL.",               severity: "warning",  active: true, ruleType: "missing_field", ruleConfig: JSON.stringify({ key: "missing_railway_url" }) },
    { title: "Missing Domain",                description: "Beta/live/scaling project has no domain configured.",               severity: "warning",  active: true, ruleType: "missing_field", ruleConfig: JSON.stringify({ key: "missing_domain" }) },
    { title: "AI Not Enabled",                description: "Project does not have AI features enabled.",                        severity: "info",     active: true, ruleType: "missing_field", ruleConfig: JSON.stringify({ key: "ai_disabled" }) },
    { title: "Stale Deployment",              description: "Live/scaling project has not been deployed in over 30 days.",       severity: "warning",  active: true, ruleType: "staleness",     ruleConfig: JSON.stringify({ key: "stale_deployment" }) },
    { title: "No Next Action Defined",        description: "Project has no next action defined.",                               severity: "info",     active: true, ruleType: "missing_field", ruleConfig: JSON.stringify({ key: "missing_next_action" }) },
    { title: "Repeated Critical Failures",    description: "Project is in critical health status with an active error logged.", severity: "critical", active: true, ruleType: "health_check",  ruleConfig: JSON.stringify({ key: "repeated_critical_failures" }) },
    { title: "No Protocol Coverage",          description: "No active protocols defined — team has no documented standards.",   severity: "warning",  active: true, ruleType: "coverage",      ruleConfig: JSON.stringify({ key: "missing_protocol_coverage" }) },
  ]);
  process.stdout.write("[detection-rules] 10 rules seeded.\n");
}

// ── Protocol seeder — runs once if protocols table is empty ───────────────────
async function seedProtocolsIfEmpty(): Promise<void> {
  const existing = await db.select().from(protocols).limit(1);
  if (existing.length > 0) return;

  process.stdout.write("[protocols] Seeding default protocols...\n");
  await db.insert(protocols).values([
    {
      title: "MASTER-BUILD-PROCESS",
      category: "Build & Deploy",
      description: "End-to-end build protocol for all Claytara projects. Mandatory before any build starts.",
      priority: "mandatory",
      active: true,
      protocolText: `# MASTER BUILD PROCESS

## Phases
PHASE 0 — Pre-Flight: Gather secrets, define env vars, confirm model access, create PHASE-0-handoff.md
PHASE 1 — Foundation: Repo structure, DB schema, core routes, health endpoint
PHASE 2 — Features: Business logic, UI, integrations
PHASE 3 — AI Layer: Recommendation engine, self-heal, advisor
PHASE 4 — Deploy: Railway deploy, env vars, verify /api/health/full
PHASE 5 — Live Verification: Full test suite, Go/No-Go sign-off

## Rules
- Every phase produces a handoff doc in /handoff/
- Never skip phases
- /api/health/full must pass before Go
- Security scan on every build before ship
- Never expose err.message in API responses`,
    },
    {
      title: "Grandma Easy UX Protocol",
      category: "UX Design",
      description: "UX standards ensuring maximum accessibility and minimal cognitive load.",
      priority: "mandatory",
      active: true,
      protocolText: `# GRANDMA EASY UX PROTOCOL

## Core Rules
- Max 3-5 steps per workflow
- One decision per screen
- Visual-first — icons before words
- Always show progress
- "Order a result" model — user picks, system delivers

## Button Rules
- Primary action always biggest and clearest
- Destructive actions require confirmation
- No more than 3 actions visible at once

## Copy Rules
- Plain language — 8th grade reading level
- No jargon, no acronyms without definition
- Error messages explain what to do next, not just what failed

## Mobile Rules
- Touch targets minimum 44x44px
- No hover-only interactions
- Test on actual phone, not just browser resize`,
    },
    {
      title: "Change Report Protocol",
      category: "Documentation",
      description: "Mandatory change report format for all builds and deployments.",
      priority: "mandatory",
      active: true,
      protocolText: `# CHANGE REPORT PROTOCOL

## Required for every build/deploy

### Format
- Files created/modified
- Routes/endpoints added or changed
- DB schema changes
- Env vars required (new or changed)
- Verification steps performed
- Known TODOs
- Deployment notes

## Rules
- Change report written BEFORE marking work complete
- Every agent, every session, every phase
- No "I'll do it later" — write it now`,
    },
    {
      title: "Railway Deployment Protocol",
      category: "Build & Deploy",
      description: "Step-by-step Railway deployment process for all Claytara apps.",
      priority: "mandatory",
      active: true,
      protocolText: `# RAILWAY DEPLOYMENT PROTOCOL

## Pre-Deploy Checklist
- nixpacks.toml in root with NODE_ENV=development for install + build phases
- packages:"external" in esbuild config (avoids CJS/ESM bundling conflicts)
- APPNAME_DATABASE_URL env var (never raw DATABASE_URL)
- All required env vars staged in Railway Variables
- /api/health/full implemented and returning correct shape

## Deploy Steps
1. Push to GitHub main branch
2. Railway auto-deploys from GitHub
3. Watch logs for: migrations complete, server running
4. Hit /api/health/full — must return status: healthy
5. Run functional smoke tests
6. Write PHASE-N-handoff.md

## Common Failures
- Blank page: VITE_* env var missing at build time
- Boot crash: __dirname declared at module scope (use import.meta.url)
- DB error: wrong env var name or SSL not configured
- 500 on all routes: getAuth() called without Clerk middleware`,
    },
    {
      title: "Security Hardening Protocol",
      category: "Security",
      description: "Non-negotiable security requirements for all production deployments.",
      priority: "mandatory",
      active: true,
      protocolText: `# SECURITY HARDENING PROTOCOL

## API Rules
- NEVER return err.message in API responses — generic message to client, full error to logger only
- NEVER expose stack traces in responses
- NEVER log API keys, passwords, connection strings
- Rate limiting on all public endpoints
- Input validation with Zod before any DB operation
- Sanitize all error messages before logging

## Auth Rules
- No hardcoded credentials anywhere in code
- All secrets in env vars only
- Admin endpoints require token auth minimum

## Pre-Ship Security Scan
Pattern to grep before every deploy:
- res.json({ error: err.message }) — FORBIDDEN
- console.log with any secret-shaped value
- Hardcoded sk_, pk_, whsec_, postgresql:// strings`,
    },
    {
      title: "Self-Heal Protocol",
      category: "Operations",
      description: "Architecture pattern for self-healing systems. Applied to Vital Herbs.",
      priority: "recommended",
      active: true,
      protocolText: `# SELF-HEAL PROTOCOL

## Concept
System monitors itself and surfaces actionable issues without human polling.

## Detection Patterns
- Missing env vars → surface in /api/health/full
- DB schema drift → compare inline SQL against Drizzle schema
- AI provider errors → log + surface in health, don't crash
- Stripe webhook failures → log event + alert

## Self-Heal Rules
- Never auto-fix destructive operations (drops, deletes)
- Surface issues clearly — specific, actionable error messages
- Non-fatal degradation: server runs, features degrade gracefully
- Fatal only on: missing DB URL, port bind failure

## Health Endpoint Standard
GET /api/health/full must return:
{ status, server, database, env, uptime, timestamp }
status: "healthy" | "degraded" | "critical"`,
    },
    {
      title: "AI Voice/Advisor Protocol",
      category: "AI Systems",
      description: "Standards for AI advisor features. Based on Vital Herbs Voice Advisor build.",
      priority: "recommended",
      active: true,
      protocolText: `# AI VOICE/ADVISOR PROTOCOL

## Grounding Rules
- AI MUST answer only from supplied catalog context
- Retrieval runs BEFORE AI call — inject only retrieved records
- LOW retrieval confidence → skip AI, return clarification prompt
- Never hallucinate herbs, compounds, or benefits

## Safety Rules
- Urgent symptoms (chest pain, stroke) → bypass AI, return emergency message
- Sensitive conditions (pregnancy, cancer, diabetes, HIV) → professional referral prefix
- NEVER say "will cure" — educational language only
- NEVER provide specific dosages unless in approved catalog content
- Every response ends: "For educational purposes only — not medical advice"

## Post-Response Sanitizer
Block outputs containing: cure/cures, guaranteed, replace your doctor,
specific dosage patterns, clinically proven to cure/treat, FDA approved

## Feature Flag
VOICE_ADVISOR_ENABLED=true/false — default false
Never go live without explicit flag set`,
    },
    {
      title: "GitHub/Railway Export Protocol",
      category: "Build & Deploy",
      description: "How to export any project from local to GitHub and Railway.",
      priority: "recommended",
      active: true,
      protocolText: `# GITHUB / RAILWAY EXPORT PROTOCOL

## GitHub Steps
1. Create repo at github.com/new (private, no init files)
2. Local: git init && git add -A && git commit -m "initial"
3. git remote add origin <url>
4. git push -u origin main
   (If rejected: --force only when GitHub created a README)

## Railway Steps
1. New Project → Deploy from GitHub repo
2. Add Postgres plugin → copy DATABASE_URL
3. Set APPNAME_DATABASE_URL (service-specific, not DATABASE_URL)
4. Set NODE_ENV=production
5. nixpacks.toml handles build automatically
6. After deploy: verify /api/health/full

## Windows Gotchas
- PowerShell: curl is aliased to Invoke-WebRequest — use Invoke-RestMethod
- safe.directory: git config --global --add safe.directory <path>
- && not valid in PowerShell — use ; instead`,
    },
  ]);

  process.stdout.write("[protocols] 8 protocols seeded.\n");
}

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await runMigrations();
  } catch (e) {
    process.stderr.write(`[db] Migration failed: ${safeError(e)}\n`);
  }

  try {
    await seedProtocolsIfEmpty();
  } catch (e) {
    process.stderr.write(`[protocols] Seed failed: ${safeError(e)}\n`);
  }

  try {
    await seedDetectionRulesIfEmpty();
  } catch (e) {
    process.stderr.write(`[detection-rules] Seed failed: ${safeError(e)}\n`);
  }

  try {
    const detectionResult = await runDetectionEngine();
    process.stdout.write(`[intelligence] Startup detection: ${JSON.stringify(detectionResult)}\n`);
  } catch (e) {
    process.stderr.write(`[intelligence] Startup detection failed: ${safeError(e)}\n`);
  }

  try {
    const allProjects = await db.select().from(projects);
    for (const project of allProjects) {
      await saveReadinessSnapshot(project).catch(e =>
        process.stderr.write(`[readiness] startup snapshot error project=${project.id}: ${safeError(e)}\n`)
      );
    }
    process.stdout.write("[readiness] Startup snapshots saved.\n");
  } catch (e) {
    process.stderr.write(`[readiness] Startup snapshots failed: ${safeError(e)}\n`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    process.stdout.write(`[claytara-command] Server running on port ${PORT}\n`);
    process.stdout.write(`[claytara-command] DB: ${envOk() ? "configured" : "MISSING"}\n`);
  });
}

start().catch((e) => {
  process.stderr.write(`[startup] Fatal: ${safeError(e)}\n`);
  process.exit(1);
});

export default app;
