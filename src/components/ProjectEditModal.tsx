/**
 * ProjectEditModal — Full project edit form
 * Covers all Phase 2 fields including healthEndpointUrl and nextAction.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateProject } from "@/hooks/useProjects";
import { X, Save } from "lucide-react";
import type { Project } from "../../shared/schema";

interface Props {
  project: Project;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
        checked ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-border/60"
      }`}
    >
      <span className={`h-3 w-3 rounded-full shrink-0 ${checked ? "bg-primary" : "bg-muted"}`} />
      {label}
    </button>
  );
}

export function ProjectEditModal({ project, onClose }: Props) {
  const { mutate, isPending } = useUpdateProject(project.id);

  const [form, setForm] = useState({
    name:              project.name,
    description:       project.description ?? "",
    status:            project.status,
    priority:          project.priority,
    productionStage:   project.productionStage,
    domain:            project.domain ?? "",
    githubUrl:         project.githubUrl ?? "",
    railwayUrl:        project.railwayUrl ?? "",
    healthEndpointUrl: (project as Project & { healthEndpointUrl?: string }).healthEndpointUrl ?? "",
    stripeConnected:   project.stripeConnected,
    clerkConnected:    project.clerkConnected,
    aiEnabled:         project.aiEnabled,
    notes:             project.notes ?? "",
    blockers:          project.blockers ?? "",
    nextAction:        (project as Project & { nextAction?: string }).nextAction ?? "",
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(
      {
        name:              form.name,
        description:       form.description || null,
        status:            form.status as Project["status"],
        priority:          form.priority as Project["priority"],
        productionStage:   form.productionStage as Project["productionStage"],
        domain:            form.domain || null,
        githubUrl:         form.githubUrl || null,
        railwayUrl:        form.railwayUrl || null,
        healthEndpointUrl: form.healthEndpointUrl || null,
        stripeConnected:   form.stripeConnected,
        clerkConnected:    form.clerkConnected,
        aiEnabled:         form.aiEnabled,
        notes:             form.notes || null,
        blockers:          form.blockers || null,
        nextAction:        form.nextAction || null,
      } as Parameters<typeof mutate>[0],
      { onSuccess: onClose }
    );
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-border bg-card z-10">
          <p className="font-semibold text-foreground">Edit Project</p>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Name */}
          <Field label="Project Name">
            <Input value={form.name} onChange={e => set("name", e.target.value)} required maxLength={120} />
          </Field>

          {/* Description */}
          <Field label="Description">
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} maxLength={1000} placeholder="What is this project?" />
          </Field>

          {/* Status + Priority + Stage */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Status">
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["active","building","paused","archived"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["critical","high","medium","low"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Stage">
              <Select value={form.productionStage} onValueChange={v => set("productionStage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["idea","prototype","beta","live","scaling"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* URLs */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Domain">
              <Input value={form.domain} onChange={e => set("domain", e.target.value)} placeholder="example.com" maxLength={200} />
            </Field>
            <Field label="Health Endpoint URL">
              <Input value={form.healthEndpointUrl} onChange={e => set("healthEndpointUrl", e.target.value)} placeholder="https://…/api/health/full" maxLength={300} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GitHub URL">
              <Input value={form.githubUrl} onChange={e => set("githubUrl", e.target.value)} placeholder="https://github.com/…" maxLength={300} />
            </Field>
            <Field label="Railway URL">
              <Input value={form.railwayUrl} onChange={e => set("railwayUrl", e.target.value)} placeholder="https://…railway.app" maxLength={300} />
            </Field>
          </div>

          {/* Integrations */}
          <Field label="Integrations">
            <div className="flex gap-2 flex-wrap">
              <Toggle label="Stripe" checked={form.stripeConnected} onChange={v => set("stripeConnected", v)} />
              <Toggle label="Clerk Auth" checked={form.clerkConnected} onChange={v => set("clerkConnected", v)} />
              <Toggle label="AI Enabled" checked={form.aiEnabled} onChange={v => set("aiEnabled", v)} />
            </div>
          </Field>

          {/* Next Action */}
          <Field label="Next Action">
            <Input value={form.nextAction} onChange={e => set("nextAction", e.target.value)} placeholder="What needs to happen next?" maxLength={1000} />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} maxLength={5000} placeholder="Operational notes…" />
          </Field>

          {/* Blockers */}
          <Field label="Blockers">
            <Textarea value={form.blockers} onChange={e => set("blockers", e.target.value)} rows={2} maxLength={2000} placeholder="What is blocked and why?" />
          </Field>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={isPending || !form.name.trim()} className="flex-1 gap-2">
              <Save className="h-4 w-4" />
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
