import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FolderKanban, Activity, Settings, Zap, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",         label: "Dashboard",  icon: LayoutDashboard },
  { href: "/projects", label: "Projects",   icon: FolderKanban },
  { href: "/health",   label: "Health",     icon: Activity },
];

function NavItem({ href, label, Icon }: { href: string; label: string; Icon: typeof LayoutDashboard }) {
  const [location] = useLocation();
  const active = href === "/" ? location === "/" : location.startsWith(href);
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer select-none",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
        {active && <ChevronRight className="h-3 w-3 ml-auto opacity-60" aria-hidden="true" />}
      </div>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-border flex flex-col sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tracking-tight">Claytara</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Command</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV.map(({ href, label, icon: Icon }) => (
            <NavItem key={href} href={href} label={label} Icon={Icon} />
          ))}
        </nav>

        {/* Version */}
        <div className="px-5 py-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground">Mission Control v0.1</p>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-border">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
