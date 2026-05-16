/**
 * src/lib/api.ts — Typed API client (Phase 2)
 */

import type {
  Project, ProjectNote, Protocol,
  FullHealthResponse, SystemHealthCard,
  InsertProject, InsertProjectNote, InsertProtocol,
} from "../../shared/schema";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Health ────────────────────────────────────────────────────────────────────

export const fetchHealth   = () => apiFetch<FullHealthResponse>("/api/health/full");
export const fetchServices = () => apiFetch<{ services: SystemHealthCard[] }>("/api/health/services");

// ── Projects ──────────────────────────────────────────────────────────────────

export const fetchProjects  = () => apiFetch<{ projects: Project[] }>("/api/projects");
export const fetchProject   = (id: number) => apiFetch<{ project: Project; notes: ProjectNote[] }>(`/api/projects/${id}`);
export const createProject  = (data: Partial<InsertProject>) => apiFetch<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify(data) });
export const updateProject  = (id: number, data: Partial<InsertProject>) => apiFetch<{ project: Project }>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const checkProjectHealth = (id: number) =>
  apiFetch<{ status: string; summary?: string; error?: string | null; checkedAt?: string }>(`/api/projects/${id}/check-health`);

export const checkAllHealth = () =>
  apiFetch<{ checked: number; results: Array<{ id: number; name: string; status: string }> }>("/api/projects/check-all-health", { method: "POST" });

// ── Notes ─────────────────────────────────────────────────────────────────────

export const fetchNotes  = (projectId: number) => apiFetch<{ notes: ProjectNote[] }>(`/api/projects/${projectId}/notes`);
export const createNote  = (projectId: number, data: Omit<InsertProjectNote, "projectId">) =>
  apiFetch<{ note: ProjectNote }>(`/api/projects/${projectId}/notes`, { method: "POST", body: JSON.stringify(data) });

// ── Protocols ─────────────────────────────────────────────────────────────────

export const fetchProtocols = () => apiFetch<{ protocols: Protocol[] }>("/api/protocols");
export const fetchProtocol  = (id: number) => apiFetch<{ protocol: Protocol }>(`/api/protocols/${id}`);
export const createProtocol = (data: Partial<InsertProtocol>) => apiFetch<{ protocol: Protocol }>("/api/protocols", { method: "POST", body: JSON.stringify(data) });
export const updateProtocol = (id: number, data: Partial<InsertProtocol>) => apiFetch<{ protocol: Protocol }>(`/api/protocols/${id}`, { method: "PUT", body: JSON.stringify(data) });

// ── Intelligence ──────────────────────────────────────────────────────────────

export interface DetectionRule {
  id: number;
  title: string;
  description: string | null;
  severity: string;
  active: boolean;
  ruleType: string;
  ruleConfig: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueEntry {
  id: number;
  projectId: number | null;
  projectName?: string;
  detectionRuleId: number | null;
  severity: string;
  issueTitle: string;
  issueDescription: string | null;
  resolved: boolean;
  resolutionNotes: string | null;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface ActivityEntry {
  id: number;
  projectId: number | null;
  projectName?: string;
  eventType: string;
  severity: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export interface ReadinessEntry {
  id: number;
  projectId: number;
  projectName?: string;
  infrastructureScore: number;
  deploymentScore: number;
  aiScore: number;
  operationalScore: number;
  monitoringScore: number;
  overallScore: number;
  createdAt: string;
}

export const fetchDetectionRules = () => apiFetch<{ rules: DetectionRule[] }>("/api/detection-rules");
export const fetchIssues = (resolved?: boolean) =>
  apiFetch<{ issues: IssueEntry[] }>(`/api/issues${resolved !== undefined ? `?resolved=${resolved}` : ""}`);
export const fetchActivity = (limit = 50) =>
  apiFetch<{ activity: ActivityEntry[] }>(`/api/activity?limit=${limit}`);
export const fetchReadiness = () =>
  apiFetch<{ readiness: ReadinessEntry[] }>("/api/readiness");
export const fetchProjectReadiness = (projectId: number) =>
  apiFetch<{ readiness: ReadinessEntry | null }>(`/api/readiness/${projectId}`);
export const resolveIssue = (id: number, resolutionNotes?: string) =>
  apiFetch<{ issue: IssueEntry }>(`/api/issues/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolutionNotes }),
  });
export const runDetection = () =>
  apiFetch<{ projectsChecked: number; rulesChecked: number; issuesFound: number; issuesNew: number }>(
    "/api/intelligence/run",
    { method: "POST" }
  );
