/**
 * src/lib/api.ts — Typed API client
 */

import type { Project, ProjectNote, FullHealthResponse, SystemHealthCard, InsertProject, InsertProjectNote } from "../../shared/schema";

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

export const fetchHealth = () =>
  apiFetch<FullHealthResponse>("/api/health/full");

export const fetchServices = () =>
  apiFetch<{ services: SystemHealthCard[] }>("/api/health/services");

// ── Projects ──────────────────────────────────────────────────────────────────

export const fetchProjects = () =>
  apiFetch<{ projects: Project[] }>("/api/projects");

export const fetchProject = (id: number) =>
  apiFetch<{ project: Project; notes: ProjectNote[] }>(`/api/projects/${id}`);

export const createProject = (data: Partial<InsertProject>) =>
  apiFetch<{ project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProject = (id: number, data: Partial<InsertProject>) =>
  apiFetch<{ project: Project }>(`/api/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// ── Notes ─────────────────────────────────────────────────────────────────────

export const fetchNotes = (projectId: number) =>
  apiFetch<{ notes: ProjectNote[] }>(`/api/projects/${projectId}/notes`);

export const createNote = (projectId: number, data: Omit<InsertProjectNote, "projectId">) =>
  apiFetch<{ note: ProjectNote }>(`/api/projects/${projectId}/notes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
