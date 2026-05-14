import { Link } from "wouter";
import { ArrowRight, Github, Globe, Zap, CreditCard, Users, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/StatusDot";
import { cn, statusBg, priorityColor, formatRelative } from "@/lib/utils";
import type { Project } from "../../shared/schema";

const STAGE_ORDER = ["idea", "prototype", "beta", "live", "scaling"];

function StageBar({ stage }: { stage: string }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex gap-1 items-center">
      {STAGE_ORDER.map((s, i) => (
        <div
          key={s}
          className={cn(
            "h-1 rounded-full flex-1 transition-colors",
            i <= idx ? "bg-primary/70" : "bg-border"
          )}
          title={s}
        />
      ))}
      <span className="text-[10px] text-muted-foreground ml-1 capitalize shrink-0">{stage}</span>
    </div>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const hasBlocker = !!project.blockers;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="cursor-pointer hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 group">
        <CardContent className="pt-5 space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusDot status={project.status === "active" ? "healthy" : project.status === "building" ? "warning" : "unknown"} />
                <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                {hasBlocker && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" aria-label="Has blockers" />
                )}
              </div>
              {project.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className={cn("text-[10px] border", statusBg(project.status))}>
                {project.status}
              </Badge>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide", priorityColor(project.priority))}>
                {project.priority}
              </span>
            </div>
          </div>

          {/* Stage bar */}
          <StageBar stage={project.productionStage} />

          {/* Integration chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {project.aiEnabled && (
              <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                <Zap className="h-2.5 w-2.5" />AI
              </span>
            )}
            {project.stripeConnected && (
              <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full border border-violet-400/20">
                <CreditCard className="h-2.5 w-2.5" />Stripe
              </span>
            )}
            {project.clerkConnected && (
              <span className="inline-flex items-center gap-1 text-[10px] text-pink-400 bg-pink-400/10 px-2 py-0.5 rounded-full border border-pink-400/20">
                <Users className="h-2.5 w-2.5" />Clerk
              </span>
            )}
            {project.domain && (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                <Globe className="h-2.5 w-2.5" />{project.domain}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="h-3.5 w-3.5" />
                </a>
              )}
              {project.lastDeployedAt && (
                <span className="text-[10px] text-muted-foreground">
                  Deployed {formatRelative(project.lastDeployedAt)}
                </span>
              )}
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
