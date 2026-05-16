/**
 * IntelligencePage — Operational Intelligence
 * Phase 3: Detection engine, issue tracking, readiness scores, activity feed
 */

import { useState } from "react";
import {
  ShieldCheck, AlertTriangle, Activity, BarChart2,
  CheckCircle2, RefreshCw, X,
} from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/StatusDot";
import {
  useIssues, useActivity, useDetectionRules,
  useRunDetection, useResolveIssue,
} from "@/hooks/useIntelligence";
import { cn, formatRelative } from "@/lib/utils";
import type { IssueEntry, ActivityEntry, DetectionRule } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-400";
    case "warning":  return "text-amber-400";
    case "info":     return "text-blue-400";
    default:         return "text-gray-400";
  }
}

function severityBg(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-400/10 text-red-400 border-red-400/20";
    case "warning":  return "bg-amber-400/10 text-amber-400 border-amber-400/20";
    case "info":     return "bg-blue-400/10 text-blue-400 border-blue-400/20";
    default:         return "bg-gray-400/10 text-gray-400 border-gray-400/20";
  }
}

function severityDotStatus(severity: string): "healthy" | "warning" | "critical" | "unknown" {
  switch (severity) {
    case "critical": return "critical";
    case "warning":  return "warning";
    case "info":     return "healthy";
    default:         return "unknown";
  }
}

// ── ResolveModal ──────────────────────────────────────────────────────────────

function ResolveModal({ issue, onClose }: { issue: IssueEntry; onClose: () => void }) {
  const [notes, setNotes] = useState("");
  const { mutate: resolveIssue, isPending } = useResolveIssue();

  function handleConfirm() {
    resolveIssue({ id: issue.id, notes: notes.trim() || undefined }, {
      onSuccess: () => onClose(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Resolve Issue</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{issue.issueTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Resolution notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="What was done to resolve this issue…"
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm} disabled={isPending} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isPending ? "Resolving…" : "Mark Resolved"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = "text-foreground" }: {
  label: string; value: number | string; sub?: string;
  icon: typeof Activity; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className={cn("text-3xl font-bold tracking-tight", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── IssueCard ─────────────────────────────────────────────────────────────────

function IssueCard({ issue, onResolve }: { issue: IssueEntry; onResolve: (issue: IssueEntry) => void }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
      <StatusDot status={severityDotStatus(issue.severity)} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-[10px] border capitalize", severityBg(issue.severity))}>
            {issue.severity}
          </Badge>
          {issue.projectName && (
            <Badge className="text-[10px] bg-accent text-muted-foreground border border-border">
              {issue.projectName}
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">{issue.issueTitle}</p>
        {issue.issueDescription && (
          <p className="text-xs text-muted-foreground leading-relaxed">{issue.issueDescription.slice(0, 140)}</p>
        )}
        <p className="text-[10px] text-muted-foreground">Detected {formatRelative(issue.detectedAt)}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onResolve(issue)}
        className="text-xs h-7 gap-1 shrink-0"
      >
        <CheckCircle2 className="h-3 w-3" /> Resolve
      </Button>
    </div>
  );
}

// ── ActivityItem ──────────────────────────────────────────────────────────────

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 border-b border-border last:border-0">
      <div className="mt-0.5">
        <StatusDot status={severityDotStatus(entry.severity)} />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          {entry.projectName && (
            <Badge className="text-[10px] bg-accent text-muted-foreground border border-border">
              {entry.projectName}
            </Badge>
          )}
          <Badge className={cn("text-[10px] border", severityBg(entry.severity))}>
            {entry.severity}
          </Badge>
        </div>
        <p className="text-sm text-foreground font-medium">{entry.title}</p>
        {entry.description && (
          <p className="text-xs text-muted-foreground">{entry.description.slice(0, 120)}</p>
        )}
        <p className="text-[10px] text-muted-foreground">{formatRelative(entry.createdAt)}</p>
      </div>
    </div>
  );
}

// ── RuleCard ──────────────────────────────────────────────────────────────────

function RuleCard({ rule }: { rule: DetectionRule }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-foreground leading-tight">{rule.title}</p>
          <div className={cn("h-2 w-2 rounded-full shrink-0 mt-1", rule.active ? "bg-green-400" : "bg-gray-500")} title={rule.active ? "Active" : "Inactive"} />
        </div>
        {rule.description && (
          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{rule.description}</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={cn("text-[10px] border capitalize", severityBg(rule.severity))}>{rule.severity}</Badge>
          <Badge className="text-[10px] bg-muted text-muted-foreground border border-border">{rule.ruleType}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const { data: issuesData, isLoading: loadingIssues } = useIssues(false);
  const { data: activityData } = useActivity(30);
  const { data: rulesData } = useDetectionRules();
  const { mutate: runDetectionMutate, isPending: running } = useRunDetection();
  const [resolvingIssue, setResolvingIssue] = useState<IssueEntry | null>(null);

  const issues   = issuesData?.issues ?? [];
  const activity = activityData?.activity ?? [];
  const rules    = rulesData?.rules ?? [];

  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const warningCount  = issues.filter(i => i.severity === "warning").length;
  const infoCount     = issues.filter(i => i.severity === "info").length;

  // Group issues by project for attention section
  const projectMap = new Map<number, { projectId: number; projectName: string; issues: IssueEntry[]; worstSeverity: string }>();
  for (const issue of issues) {
    if (!issue.projectId) continue;
    if (issue.severity !== "critical" && issue.severity !== "warning") continue;
    const existing = projectMap.get(issue.projectId);
    if (!existing) {
      projectMap.set(issue.projectId, {
        projectId: issue.projectId,
        projectName: issue.projectName ?? `Project ${issue.projectId}`,
        issues: [issue],
        worstSeverity: issue.severity,
      });
    } else {
      existing.issues.push(issue);
      if (issue.severity === "critical") existing.worstSeverity = "critical";
    }
  }
  const attentionProjects = [...projectMap.values()].sort((a, b) =>
    a.worstSeverity === "critical" ? -1 : b.worstSeverity === "critical" ? 1 : 0
  );

  return (
    <div>
      <PageHeader
        title="Operational Intelligence"
        subtitle="Detection engine · Issue tracking · Readiness scores"
        action={
          <Button size="sm" onClick={() => runDetectionMutate()} disabled={running} className="gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", running && "animate-spin")} />
            {running ? "Running…" : "Run Detection"}
          </Button>
        }
      />

      <div className="px-8 py-6 space-y-8">

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Critical Issues"  value={criticalCount}         icon={AlertTriangle} color={criticalCount > 0 ? "text-red-400" : "text-gray-400"} sub="require immediate attention" />
          <StatCard label="Warnings"         value={warningCount}          icon={AlertTriangle} color={warningCount > 0 ? "text-amber-400" : "text-gray-400"} sub="should be addressed" />
          <StatCard label="Info"             value={infoCount}             icon={Activity}      color="text-blue-400" sub="informational" />
          <StatCard label="Detection Rules"  value={rules.length}          icon={ShieldCheck}   color="text-green-400" sub="active monitors" />
        </div>

        {/* ── Projects requiring attention ──────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Projects Requiring Attention
          </h2>
          {attentionProjects.length === 0 ? (
            <Card>
              <CardContent className="py-8 flex items-center justify-center gap-3 text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">All systems nominal — no critical or warning issues detected.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {attentionProjects.map(proj => (
                <Card key={proj.projectId} className={cn(
                  "border",
                  proj.worstSeverity === "critical" ? "border-red-400/30" : "border-amber-400/20"
                )}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-foreground">{proj.projectName}</p>
                      <Badge className={cn("text-[10px] border capitalize shrink-0", severityBg(proj.worstSeverity))}>
                        {proj.worstSeverity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {proj.issues.length} issue{proj.issues.length !== 1 ? "s" : ""}
                    </p>
                    <div className="space-y-1">
                      {proj.issues.slice(0, 3).map(issue => (
                        <div key={issue.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("shrink-0", severityColor(issue.severity))}>•</span>
                          <span className="truncate">{issue.issueTitle}</span>
                        </div>
                      ))}
                      {proj.issues.length > 3 && (
                        <p className="text-xs text-muted-foreground pl-3">+{proj.issues.length - 3} more</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Active Issues ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Active Issues
            {issues.length > 0 && (
              <Badge className="text-[10px] bg-accent text-muted-foreground border border-border ml-1">
                {issues.length}
              </Badge>
            )}
          </h2>
          <Card>
            {loadingIssues ? (
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Loading issues…</CardContent>
            ) : issues.length === 0 ? (
              <CardContent className="py-8 flex items-center justify-center gap-3 text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">No active issues detected.</p>
              </CardContent>
            ) : (
              <div className="divide-y divide-border">
                {issues.map(issue => (
                  <IssueCard key={issue.id} issue={issue} onResolve={setResolvingIssue} />
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* ── Recent Activity ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Recent Activity
          </h2>
          <Card>
            {activity.length === 0 ? (
              <CardContent className="py-8 text-center text-sm text-muted-foreground">No recent activity.</CardContent>
            ) : (
              <div className="divide-y divide-border">
                {activity.map(entry => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* ── Detection Rules ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            Detection Rules
          </h2>
          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">No detection rules configured.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rules.map(rule => <RuleCard key={rule.id} rule={rule} />)}
            </div>
          )}
        </section>

      </div>

      {/* Resolve modal */}
      {resolvingIssue && (
        <ResolveModal issue={resolvingIssue} onClose={() => setResolvingIssue(null)} />
      )}
    </div>
  );
}
