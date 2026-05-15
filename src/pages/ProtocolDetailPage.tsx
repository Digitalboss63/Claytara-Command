import { useParams, Link } from "wouter";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useProtocol } from "@/hooks/useProtocols";
import { cn, formatDate } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, string> = {
  mandatory:   "bg-red-400/10 text-red-400 border-red-400/20",
  recommended: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  optional:    "bg-gray-400/10 text-gray-400 border-gray-400/20",
};

export default function ProtocolDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const { data, isLoading, error } = useProtocol(id);

  if (isLoading) {
    return <div className="px-8 py-8"><div className="h-96 rounded-xl bg-card border border-border animate-pulse" /></div>;
  }

  if (error || !data?.protocol) {
    return (
      <div className="px-8 py-16 text-center">
        <p className="text-red-400 text-sm mb-4">Protocol not found.</p>
        <Link href="/protocols"><Button variant="outline" size="sm">← Back to Protocols</Button></Link>
      </div>
    );
  }

  const p = data.protocol;

  return (
    <div>
      <div className="px-8 pt-8 pb-6 border-b border-border">
        <Link href="/protocols">
          <Button variant="ghost" size="sm" className="gap-2 mb-4 text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Protocols
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">{p.title}</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{p.category}</p>
              {p.description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{p.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("border text-xs capitalize", PRIORITY_STYLES[p.priority] ?? PRIORITY_STYLES.optional)}>
              {p.priority}
            </Badge>
            <Badge className={cn("border text-xs", p.active ? "bg-green-400/10 text-green-400 border-green-400/20" : "bg-gray-400/10 text-gray-400 border-gray-400/20")}>
              {p.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5 max-w-4xl">
        {/* Protocol text */}
        <Card>
          <CardContent className="pt-5">
            <pre className="text-sm text-foreground font-mono leading-relaxed whitespace-pre-wrap break-words">
              {p.protocolText}
            </pre>
          </CardContent>
        </Card>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Created {formatDate(p.createdAt)}
          </span>
          {p.updatedAt !== p.createdAt && (
            <span>Updated {formatDate(p.updatedAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
