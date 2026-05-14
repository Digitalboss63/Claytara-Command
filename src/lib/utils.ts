import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }).format(new Date(date));
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "never";
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function statusColor(status: string): string {
  switch (status) {
    case "healthy":  case "active":  case "live":     return "text-green-400";
    case "warning":  case "building": case "beta":    return "text-amber-400";
    case "critical": case "archived":                 return "text-red-400";
    default:                                          return "text-gray-400";
  }
}

export function statusBg(status: string): string {
  switch (status) {
    case "healthy":  case "active":  case "live":     return "bg-green-400/10 text-green-400 border-green-400/20";
    case "warning":  case "building": case "beta":    return "bg-amber-400/10 text-amber-400 border-amber-400/20";
    case "critical": case "blocker":                  return "bg-red-400/10 text-red-400 border-red-400/20";
    case "info":                                       return "bg-blue-400/10 text-blue-400 border-blue-400/20";
    default:                                           return "bg-gray-400/10 text-gray-400 border-gray-400/20";
  }
}

export function priorityColor(p: string): string {
  switch (p) {
    case "critical": return "text-red-400";
    case "high":     return "text-orange-400";
    case "medium":   return "text-amber-400";
    case "low":      return "text-gray-400";
    default:         return "text-gray-400";
  }
}
