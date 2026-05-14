/**
 * server/index.ts — Claytara Command API Server
 *
 * Routes:
 *   GET  /api/health/full
 *   GET  /api/projects
 *   GET  /api/projects/:id
 *   POST /api/projects
 *   PUT  /api/projects/:id
 *   GET  /api/projects/:id/notes
 *   POST /api/projects/:id/notes
 *   GET  /api/health/services
 *
 * AI readiness: placeholder routes pre-wired for Phase 2 expansion.
 */

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { eq, desc } from "drizzle-orm";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import db from "./db/index.js";
import { runMigrations } from "./db/migrate.js";
import {
  projects, projectNotes, systemHealthSnapshots,
  insertProjectSchema, insertNoteSchema,
} from "../shared/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

// ── Global error sanitizer ───────────────────────────────────────────────────
function safeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Strip connection strings, keys, anything secret-shaped
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

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/health/full
app.get("/api/health/full", async (_req, res) => {
  let dbOk = false;
  try {
    await db.execute({ sql: "SELECT 1", params: [] } as never);
    dbOk = true;
  } catch { /* db down */ }

  const envValid = envOk();
  const overall = dbOk && envValid ? "healthy" : "degraded";

  res.json({
    status: overall,
    server: true,
    database: dbOk,
    env: envValid,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/health/services — latest snapshot per service
app.get("/api/health/services", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemHealthSnapshots)
      .orderBy(desc(systemHealthSnapshots.checkedAt))
      .limit(50);

    // Latest per service
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
    const rows = await db
      .select()
      .from(projects)
      .orderBy(projects.priority, projects.name);
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

    const notes = await db
      .select()
      .from(projectNotes)
      .where(eq(projectNotes.projectId, id))
      .orderBy(desc(projectNotes.createdAt))
      .limit(20);

    res.json({ project, notes });
  } catch (err) {
    res.status(500).json({ error: "Failed to load project" });
    process.stderr.write(`[projects] get error: ${safeError(err)}\n`);
  }
});

// POST /api/projects
app.post("/api/projects", async (req, res) => {
  const parsed = insertProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project data", issues: parsed.error.issues });
    return;
  }
  try {
    const [created] = await db.insert(projects).values(parsed.data).returning();
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
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project data", issues: parsed.error.issues });
    return;
  }
  try {
    const [updated] = await db
      .update(projects)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Project not found" }); return; }
    res.json({ project: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update project" });
    process.stderr.write(`[projects] update error: ${safeError(err)}\n`);
  }
});

// GET /api/projects/:id/notes
app.get("/api/projects/:id/notes", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid project ID" }); return; }
  try {
    const notes = await db
      .select()
      .from(projectNotes)
      .where(eq(projectNotes.projectId, id))
      .orderBy(desc(projectNotes.createdAt));
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
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid note data", issues: parsed.error.issues });
    return;
  }
  try {
    const [note] = await db.insert(projectNotes).values(parsed.data).returning();
    res.status(201).json({ note });
  } catch (err) {
    res.status(500).json({ error: "Failed to create note" });
    process.stderr.write(`[notes] create error: ${safeError(err)}\n`);
  }
});

// ── AI Readiness Placeholders (Phase 2) ───────────────────────────────────────
// Pre-wired endpoints — not implemented yet. Return 501 clearly.

app.get("/api/ai/agents", (_req, res) => {
  res.status(501).json({ message: "AI agents — Phase 2. Not yet implemented.", ready: false });
});

app.get("/api/ai/retrieval/status", (_req, res) => {
  res.status(501).json({ message: "Retrieval system — Phase 2. Not yet implemented.", ready: false });
});

app.get("/api/ai/self-heal/status", (_req, res) => {
  res.status(501).json({ message: "Self-heal system — Phase 2. Not yet implemented.", ready: false });
});

app.get("/api/protocols", (_req, res) => {
  res.status(501).json({ message: "Protocol engine — Phase 2. Not yet implemented.", ready: false });
});

// ── Serve frontend in production ──────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const frontendPath = resolve(__dirname, ".");
  app.use(express.static(frontendPath));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(resolve(frontendPath, "index.html"));
  });
}

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  process.stderr.write(`[error] ${safeError(err)}\n`);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await runMigrations();
  } catch (e) {
    process.stderr.write(`[db] Migration failed: ${safeError(e)}\n`);
    // Don't crash — server can still run in degraded mode
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
