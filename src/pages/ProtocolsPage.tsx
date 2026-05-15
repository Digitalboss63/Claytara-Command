import { Link } from "wouter";
import { BookOpen, ArrowRight, Shield, Hammer, Palette, Cpu, GitBranch } from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProtocols } from "@/hooks/useProtocols";
import { cn } from "@/lib/utils";
import type { Protocol } from "../../shared/schema";

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  "Build & Deploy":  Hammer,
  "UX Design":       Palette,
  "Documentation":   BookOpen,
  "Security":        Shield,
  "Operations":      Cpu,
  "AI Systems":      Cpu,
};

const PRIORITY_STYLES: Record<string, string> = {
  mandatory:    "bg-red-400/10 text-red-400 border-red-400/20",
  recommended:  "bg-amber-400/10 text-amber-400 border-amber-400/20",
  optional:     "bg-gray-400/10 text-gray-400 border-gray-400/20",
};

function ProtocolCard({ protocol }: { protocol: Protocol }) {
  const Icon = CATEGORY_ICONS[protocol.category] ?? BookOpen;
  return (
    <Link href={`/protocols/${protocol.id}`}>
      <Card className="cursor-pointer hover:border-primary/40 transition-all duration-200 group h-full">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <Badge className={cn("text-[10px] border capitalize shrink-0", PRIORITY_STYLES[protocol.priority] ?? PRIORITY_STYLES.optional)}>
              {protocol.priority}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1">{protocol.title}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">{protocol.category}</p>
            {protocol.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{protocol.description}</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className={cn("text-[10px] rounded-full px-2 py-0.5 border", protocol.active ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-gray-400 bg-gray-400/10 border-gray-400/20")}>
              {protocol.active ? "Active" : "Inactive"}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProtocolsPage() {
  const { data: protocols, isLoading } = useProtocols();

  // Group by category
  const grouped: Record<string, Protocol[]> = {};
  for (const p of protocols ?? []) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }

  const mandatoryCount = protocols?.filter(p => p.priority === "mandatory").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Protocol Library"
        subtitle={`${protocols?.length ?? 0} protocols · ${mandatoryCount} mandatory`}
      />
      <div className="px-8 py-6 space-y-8">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}

        {Object.entries(grouped).map(([category, items]) => (
          <section key={category}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5" />
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(p => <ProtocolCard key={p.id} protocol={p} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
