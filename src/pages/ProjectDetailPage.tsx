/**
 * ProjectDetailPage — Phase 2
 * Added: edit modal, health check, handoff summary, nextAction, healthEndpointUrl
 */

import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Globe, Github, ExternalLink, Zap, CreditCard, Users,
  AlertTriangle, Clock, CheckCircle2, FileText, Edit2, Activity, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NoteForm } from "@/components/NoteForm";
import { StatusDot } from "@/components/StatusDot";
import { ProjectEditModal } from "@/components/ProjectEditModal";
import { HandoffSummary } from "@/components/HandoffSummary";
import { useProject, useCheckProjectHealth } from "@/hooks/useProjects";
import { cn, statusBg, priorityColor, formatDate, formatRelative } from "@/lib/utils";
import type { ProjectNote, Project } from "../../shared/schema";

type ExtProject = Project & { healthEndpointUrl?: string; lastHealthStatus?: string; lastHealthCheckedAt?: string; lastHealthResponseSummary?: string; lastHealthError?: string; nextAction?: string };

const SEVERITY_STYLES: Record<string, string> = {
  info:     "border-l-blue-400/60 bg-blue-400/5",
  warning:  "border-l-amber-400/60 bg-amber-400/5",
  critical: "border-l-red-400/60 bg-red-400/5",
  blocker:  "border-l-red-500 bg-red-500/10",
};
const SEVERITY_BADGE: Record<string, string> = {
  info:     "bg-blue-400/10 text-blue-400 border-blue-400/20",
  warning:  "bg-amber-400/10 text-amber-400 border-amber-400/20",
  critical: "bg-red-400/10 text-red-400 border-red-400/20",
  blocker:  "bg-red-500/15 text-red-400 border-red-500/30",
};

function NoteCard({ note }: { note: ProjectNote }) {
  return (
    <div className={cn("border-l-2 rounded-r-lg px-4 py-3 space-y-1", SEVERITY_STYLES[note.severity] ?? SEVERITY_STYLES.info)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{note.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={cn("text-[10px] border capitalize", SEVERITY_BADGE[note.severity] ?? SEVERITY_BADGE.info)}>
            {note.severity}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{formatRelative(note.createdAt)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{note.note}</p>
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 w-36">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 truncate">
          {value} <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className="text-xs text-foreground text-right">{value}</span>
      )}
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value
        ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />Connected</span>
        : <span className="text-xs text-muted-foreground">Not connected</span>}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const { data, isLoading, error } = useProject(id);
  const { mutate: checkHealth, isPending: checkingHealth } = useCheckProjectHealth(id);
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <div className="px-8 py-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-40 rounded-xl bg-card border border-border animate-pulse" />
    ))}</div>;
  }

  if (error || !data?.project) {
    return (
      <div className="px-8 py-16 text-center">
        <p className="text-red-400 text-sm mb-4">Project not found.</p>
        <Link href="/projects"><Button variant="outline" size="sm">← Back to Projects</Button></Link>
      </div>
    );
  }

  const { project: rawProject, notes } = data;
  const project = rawProject as ExtProject;
  const hasBlockers = !!project.blockers;
  const healthStatus = (project.lastHealthStatus ?? "unknown") as "healthy" | "warning" | "critical" | "unknown";

  return (
    <>
      {editing && <ProjectEditModal project={rawProject} onClose={() => setEditing(false)} />}

      <div>
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-2 mb-4 text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Projects
            </Button>
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusDot status={project.status === "active" ? "healthy" : project.status === "building" ? "warning" : "unknown"} />
                <h1 className="text-2xl font-bold text-foreground tracking-tight">{project.name}</h1>
                {hasBlockers && (
                  <Badge className="border bg-red-400/10 text-red-400 border-red-400/20 text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" /> Blocker
                  </Badge>
                )}
              </div>
              {project.description && <p className="text-sm text-muted-foreground max-w-2xl">{project.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <HandoffSummary project={rawProject} notes={notes} />
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-2">
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
              <Badge className={cn("border text-xs capitalize", statusBg(project.status))}>{project.status}</Badge>
              <Badge className={cn("border text-xs capitalize", statusBg(project.productionStage))}>{project.productionStage}</Badge>
              <span className={cn("text-xs font-semibold uppercase tracking-wide", priorityColor(project.priority))}>{project.priority}</span>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: Overview + Health + Infrastructure + AI ─────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <InfoRow label="Domain" value={project.domain} href={project.domain ? `https://${project.domain}` : undefined} />
                  <InfoRow label="Last Deployed" value={project.lastDeployedAt ? formatDate(project.lastDeployedAt) : null} />
                  {project.nextAction && (
                    <div className="py-2.5 border-b border-border last:border-0">
                      <p className="text-xs text-muted-foreground mb-1">Next Action</p>
                      <p className="text-sm text-primary font-medium">{project.nextAction}</p>
                    </div>
                  )}
                  {project.notes && (
                    <div className="pt-3">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm text-foreground leading-relaxed">{project.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Health Check */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-muted-foreground" /> Health Monitor
                    </CardTitle>
                    {project.healthEndpointUrl && (
                      <Button size="sm" variant="ghost" onClick={() => checkHealth()} disabled={checkingHealth} className="gap-1.5 text-xs h-7">
                        <RefreshCw className={cn("h-3 w-3", checkingHealth && "animate-spin")} />
                        {checkingHealth ? "Checking…" : "Check Now"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {project.healthEndpointUrl ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <StatusDot status={healthStatus} />
                        <span className="text-sm font-medium text-foreground capitalize">{healthStatus}</span>
                        {project.lastHealthCheckedAt && (
                          <span className="text-xs text-muted-foreground">— {formatRelative(project.lastHealthCheckedAt)}</span>
                        )}
                      </div>
                      <InfoRow label="Endpoint" value={project.healthEndpointUrl} href={project.healthEndpointUrl} />
                      {project.lastHealthResponseSummary && (
                        <div className="text-xs font-mono text-muted-foreground bg-muted/30 rounded px-3 py-2 break-all">
                          {project.lastHealthResponseSummary.slice(0, 200)}
                        </div>
                      )}
                      {project.lastHealthError && (
                        <div className="flex gap-2 bg-red-400/5 border border-red-400/20 rounded px-3 py-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-400">{project.lastHealthError}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <p className="text-sm">No health endpoint configured.</p>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="text-xs h-7 gap-1 text-primary">
                        <Edit2 className="h-3 w-3" /> Add one
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Infrastructure */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" /> Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <InfoRow label="Railway URL"  value={project.railwayUrl}  href={project.railwayUrl ?? undefined} />
                  <InfoRow label="GitHub Repo"  value={project.githubUrl ? project.githubUrl.replace("https://github.com/", "") : null} href={project.githubUrl ?? undefined} />
                  <BoolRow label="Stripe"       value={project.stripeConnected} />
                  <BoolRow label="Clerk Auth"   value={project.clerkConnected} />
                  <BoolRow label="AI Enabled"   value={project.aiEnabled} />
                </CardContent>
              </Card>

              {/* Blockers */}
              {hasBlockers && (
                <Card className="border-red-400/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4" /> Active Blockers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-foreground leading-relaxed">{project.blockers}</p>
                  </CardContent>
                </Card>
              )}

              {/* AI Systems */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-muted-foreground" /> AI Systems
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <BoolRow label="AI Enabled" value={project.aiEnabled} />
                  <div className="pt-3 space-y-1.5">
                    {[{ label: "Agent Layer", phase: "Phase 3" }, { label: "Retrieval System", phase: "Phase 3" }, { label: "Self-Heal", phase: "Phase 3" }].map(({ label, phase }) => (
                      <div key={label} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <Badge className="text-[10px] bg-muted text-muted-foreground border border-border">{phase}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Right: Operational Notes ──────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Operational Notes
                  {notes.length > 0 && (
                    <Badge className="text-[10px] bg-accent text-muted-foreground border border-border ml-1">{notes.length}</Badge>
                  )}
                </h2>
              </div>
              <NoteForm projectId={project.id} />
              {notes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No notes yet. Add the first one above.</p>
              )}
              <div className="space-y-2">
                {notes.map(note => <NoteCard key={note.id} note={note} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
