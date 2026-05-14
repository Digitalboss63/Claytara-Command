/**
 * HealthPage — System health monitor
 */

import { Activity, RefreshCw, Clock } from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HealthServiceCard } from "@/components/HealthServiceCard";
import { StatusDot } from "@/components/StatusDot";
import { useHealth, useServices } from "@/hooks/useHealth";
import { useQueryClient } from "@tanstack/react-query";
import { formatRelative } from "@/lib/utils";

const DEFAULT_SERVICES = [
  "railway", "stripe", "clerk", "github", "ai", "domains"
].map((s) => ({ service: s, status: "unknown" as const, statusText: "Not yet checked", checkedAt: null }));

export default function HealthPage() {
  const { data: health, isLoading, dataUpdatedAt } = useHealth();
  const { data: services } = useServices();
  const qc = useQueryClient();

  const displayServices = services && services.length > 0 ? services : DEFAULT_SERVICES;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["health"] });
    qc.invalidateQueries({ queryKey: ["services"] });
  };

  return (
    <div>
      <PageHeader
        title="System Health"
        subtitle="Live operational status across all services"
        action={
          <Button size="sm" variant="outline" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <div className="px-8 py-6 space-y-8">

        {/* ── Core health card ──────────────────────────────────────────────── */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Claytara Command — Core System
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-16 animate-pulse bg-muted rounded" />
            ) : health ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Overall Status</p>
                  <div className="flex items-center gap-2">
                    <StatusDot status={health.status === "healthy" ? "healthy" : "warning"} />
                    <span className="text-sm font-semibold capitalize text-foreground">{health.status}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Database</p>
                  <div className="flex items-center gap-2">
                    <StatusDot status={health.database ? "healthy" : "critical"} />
                    <span className="text-sm font-medium text-foreground">{health.database ? "Connected" : "Down"}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Environment</p>
                  <div className="flex items-center gap-2">
                    <StatusDot status={health.env ? "healthy" : "warning"} />
                    <span className="text-sm font-medium text-foreground">{health.env ? "Valid" : "Missing vars"}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                  <p className="text-sm font-medium text-foreground">
                    {health.uptime < 60
                      ? `${health.uptime}s`
                      : health.uptime < 3600
                      ? `${Math.floor(health.uptime / 60)}m`
                      : `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-400">Could not reach server.</p>
            )}
            {dataUpdatedAt > 0 && (
              <p className="text-[10px] text-muted-foreground mt-4 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last checked {formatRelative(new Date(dataUpdatedAt))}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── External services ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">External Services</h2>
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

        {/* ── Health endpoint docs ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">Health Endpoints</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { method: "GET", path: "/api/health/full",     desc: "Full system status: server, db, env, uptime" },
              { method: "GET", path: "/api/health/services", desc: "Latest snapshot per external service" },
              { method: "GET", path: "/api/projects",        desc: "All projects with status" },
              { method: "GET", path: "/api/ai/agents",       desc: "AI agent layer status (Phase 2)" },
            ].map(({ method, path, desc }) => (
              <Card key={path}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                      {method}
                    </span>
                    <code className="text-xs font-mono text-foreground">{path}</code>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
