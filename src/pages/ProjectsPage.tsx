/**
 * ProjectsPage — Full project registry
 */

import { useState } from "react";
import { PageHeader } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjects } from "@/hooks/useProjects";
import { Search, SlidersHorizontal } from "lucide-react";
import type { Project } from "../../shared/schema";

const STATUS_FILTERS = ["all", "active", "building", "paused", "archived"] as const;

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = projects?.filter((p: Project) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.domain?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Sort: critical first, then by stage
  const STAGE_ORDER = ["live", "scaling", "beta", "prototype", "idea"];
  const PRIORITY_ORDER = ["critical", "high", "medium", "low"];

  const sorted = filtered?.slice().sort((a: Project, b: Project) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return STAGE_ORDER.indexOf(a.productionStage) - STAGE_ORDER.indexOf(b.productionStage);
  });

  return (
    <div>
      <PageHeader
        title="Project Registry"
        subtitle={`${projects?.length ?? 0} projects tracked`}
      />

      <div className="px-8 py-6 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "ghost"}
                onClick={() => setStatusFilter(s)}
                className="capitalize h-8 px-3 text-xs"
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-16 text-red-400 text-sm">
            Failed to load projects. Is the server running?
          </div>
        )}

        {!isLoading && sorted && sorted.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No projects match your filters.
          </div>
        )}

        {sorted && sorted.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((p: Project) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
