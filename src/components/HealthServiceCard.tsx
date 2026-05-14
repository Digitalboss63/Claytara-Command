import { Activity, Server, CreditCard, Users, Github, Cpu, Globe, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDot, StatusLabel } from "@/components/StatusDot";
import { formatRelative } from "@/lib/utils";

const SERVICE_META: Record<string, { label: string; icon: typeof Server }> = {
  railway: { label: "Railway",  icon: Server },
  stripe:  { label: "Stripe",   icon: CreditCard },
  clerk:   { label: "Clerk",    icon: Users },
  github:  { label: "GitHub",   icon: Github },
  ai:      { label: "AI Systems", icon: Cpu },
  domains: { label: "Domains",  icon: Globe },
};

interface ServiceCardProps {
  service: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  statusText?: string | null;
  checkedAt?: string | Date | null;
}

export function HealthServiceCard({ service, status, statusText, checkedAt }: ServiceCardProps) {
  const meta = SERVICE_META[service] ?? { label: service, icon: HelpCircle };
  const Icon = meta.icon;

  return (
    <Card className="glass">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-4">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <StatusDot status={status} />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">{meta.label}</p>
        <StatusLabel status={status} />
        {statusText && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{statusText}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          Checked {formatRelative(checkedAt)}
        </p>
      </CardContent>
    </Card>
  );
}
