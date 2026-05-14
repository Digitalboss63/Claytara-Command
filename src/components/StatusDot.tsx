import { cn } from "@/lib/utils";

type Status = "healthy" | "warning" | "critical" | "unknown";

const DOT_COLORS: Record<Status, string> = {
  healthy:  "bg-green-400 shadow-[0_0_6px_#4ade8080]",
  warning:  "bg-amber-400 shadow-[0_0_6px_#fbbf2480]",
  critical: "bg-red-400 shadow-[0_0_6px_#f8717180] animate-pulse",
  unknown:  "bg-gray-500",
};

const LABEL_COLORS: Record<Status, string> = {
  healthy:  "text-green-400",
  warning:  "text-amber-400",
  critical: "text-red-400",
  unknown:  "text-gray-400",
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", DOT_COLORS[status], className)}
      aria-label={status}
    />
  );
}

export function StatusLabel({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("text-xs font-medium capitalize", LABEL_COLORS[status], className)}>
      {status}
    </span>
  );
}
