/**
 * DashboardPage — Mission Control Home
 * Shows: system health cards, project status summary, recent activity
 */

import { Activity, FolderKanban, AlertTriangle, CheckCircle2, TrendingUp, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthServiceCard } from "@/components/HealthServiceCard";
import { StatusDot } from "@/components/StatusDot";
import { Badge } from "@/components/ui/badge";
import { useHealth, useServices } from "@/hooks/useHealth";
import { useProjects } from "@/hooks/useProjects";
import { useIssues } from "@/hooks/useIntelligence";
import { cn, statusBg, priorityColor, formatRelative } from "@/lib/utils";

const DEFAULT_SERVICES = [
  { service: "railway", status: "unknown" as const, statusText: "Not yet checked", checkedAt: null },
  { service: "stripe",  status: "unknown" as const, statusText: "Not yet checked", checkedAt: null },
  { service: "clerk",   status: "unknown" as const, statusText: "Not yet checked", checkedAt: null },
  { service: "github",  status: "unknown" as const, statusText: "Not yet checked", checkedAt: null },
  { service: "ai",      status: "unknown" as const, statusText: "Not yet checked", checkedAt: null },
  { service: "domains", status: "unknown" as const, statusText: "Not yet checked", checkedAt: null },
];

function StatCard({ label, value, sub, icon: Icon, color = "text-foreground" }: {
  label: string; value: number | string; sub?: string;
  icon: typeof Activity; color?: string;
}) {
  return (
    <Card className="glass">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className={cn("text-3xl font-bold tracking-tight", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: health } = useHealth();
  const { data: services } = useServices();
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const { data: issuesData } = useIssues(false);

  const activeProjects  = projects?.filter(p => p.status === "active").length ?? 0;
  const buildingProjects = projects?.filter(p => p.status === "building").length ?? 0;
  const blockerCount    = projects?.filter(p => !!p.blockers).length ?? 0;
  const liveProjects    = projects?.filter(p => p.productionStage === "live").length ?? 0;

  const displayServices = services && services.length > 0 ? services : DEFAULT_SERVICES;

  return (
    <div>
      <PageHeader
        title="Mission Control"
        subtitle={`System ${health?.status ?? "loading"} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
      />

      <div className="px-8 py-6 space-y-8">

        {/* ── Stat summary row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Projects"   value={activeProjects}   icon={FolderKanban} color="text-green-400"  sub="in operation" />
          <StatCard label="In Build"          value={buildingProjects} icon={TrendingUp}   color="text-amber-400" sub="in progress" />
          <StatCard label="Live in Production" value={liveProjects}    icon={CheckCircle2} color="text-blue-400"  sub="deployed" />
          <StatCard label="Active Blockers"   value={blockerCount}     icon={AlertTriangle} color={blockerCount > 0 ? "text-red-400" : "text-gray-400"} sub="need attention" />
        </div>

        {/* ── System health grid ────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              System Health
            </h2>
            <Link href="/health">
              <span className="text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
                View all →
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {displayServices.map((svc) => (
              <HealthServiceCard
                key={svc.service}
                service={svc.service}
                status={svc.status as "healthy" | "warning" | "critical" | "unknown"}
                statusText={svc.statusText}
                checkedAt={svc.checkedAt}
              />
            ))}
          </div>
        </section>

        {/* ── Project summary table ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              All Projects
            </h2>
            <Link href="/projects">
              <span className="text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
                View all →
              </span>
            </Link>
          </div>

          <Card>
            <div className="divide-y divide-border">
              {loadingProjects && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading projects...</div>
              )}
              {projects?.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/30 transition-colors cursor-pointer group">
                    <StatusDot
                      status={p.status === "active" ? "healthy" : p.status === "building" ? "warning" : "unknown"}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {p.name}
                      </p>
                      {p.domain && (
                        <p className="text-xs text-muted-foreground truncate">{p.domain}</p>
                      )}
                    </div>
                    <Badge className={cn("text-[10px] border shrink-0", statusBg(p.status))}>
                      {p.productionStage}
                    </Badge>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wide shrink-0 w-12 text-right", priorityColor(p.priority))}>
                      {p.priority}
                    </span>
                    {p.blockers && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" aria-label="Has blockers" />
                    )}
                    {p.lastDeployedAt && (
                      <span className="text-[10px] text-muted-foreground shrink-0 hidden lg:block w-20 text-right">
                        {formatRelative(p.lastDeployedAt)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </section>

        {/* ── Operational Intelligence block ────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Operational Intelligence
            </h2>
            <Link href="/intelligence">
              <span className="text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
                View All Issues →
              </span>
            </Link>
          </div>
          {(() => {
            const issues = issuesData?.issues ?? [];
            const criticalIssues = issues.filter(i => i.severity === "critical");

            // Group by project
            const projectMap = new Map<number, { projectId: number; projectName: string; worstSeverity: string; count: number }>();
            for (const issue of issues) {
              if (!issue.projectId) continue;
              if (issue.severity !== "critical" && issue.severity !== "warning") continue;
              const existing = projectMap.get(issue.projectId);
              if (!existing) {
                projectMap.set(issue.projectId, { projectId: issue.projectId, projectName: issue.projectName ?? `Project ${issue.projectId}`, worstSeverity: issue.severity, count: 1 });
              } else {
                existing.count++;
                if (issue.severity === "critical") existing.worstSeverity = "critical";
              }
            }
            const attentionProjects = [...projectMap.values()]
              .sort((a, b) => a.worstSeverity === "critical" ? -1 : b.worstSeverity === "critical" ? 1 : 0)
              .slice(0, 3);

            return (
              <div className="space-y-3">
                {criticalIssues.length > 0 && (
                  <Card className="border-red-400/30 bg-red-400/5">
                    <CardContent className="py-3 px-5 flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                      <p className="text-sm text-red-400 font-medium">
                        {criticalIssues.length} critical issue{criticalIssues.length !== 1 ? "s" : ""} detected — immediate attention required.
                      </p>
                    </CardContent>
                  </Card>
                )}
                {attentionProjects.length === 0 ? (
                  <Card>
                    <CardContent className="py-5 flex items-center gap-3 text-green-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <p className="text-sm font-medium">All systems nominal — no critical or warning issues.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {attentionProjects.map(proj => (
                      <Card key={proj.projectId} className={cn("border", proj.worstSeverity === "critical" ? "border-red-400/30" : "border-amber-400/20")}>
                        <CardContent className="pt-3 pb-3 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{proj.projectName}</p>
                            <Badge className={cn("text-[10px] border capitalize shrink-0", proj.worstSeverity === "critical" ? "bg-red-400/10 text-red-400 border-red-400/20" : "bg-amber-400/10 text-amber-400 border-amber-400/20")}>
                              {proj.worstSeverity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{proj.count} issue{proj.count !== 1 ? "s" : ""}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </section>

      </div>
    </div>
  );
}
