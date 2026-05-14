import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateNote } from "@/hooks/useProjects";
import { Plus, X } from "lucide-react";

interface NoteFormProps {
  projectId: number;
  onDone?: () => void;
}

export function NoteForm({ projectId, onDone }: NoteFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical" | "blocker">("info");

  const { mutate, isPending } = useCreateNote(projectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !note.trim()) return;
    mutate(
      { title: title.trim(), note: note.trim(), severity },
      {
        onSuccess: () => {
          setTitle(""); setNote(""); setSeverity("info");
          setOpen(false);
          onDone?.();
        },
      }
    );
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-3.5 w-3.5" />
        Add Note
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-xl p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">New Operational Note</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        required
      />
      <Textarea
        placeholder="Note details..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        required
      />
      <div className="flex items-center gap-3">
        <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="blocker">Blocker</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={isPending || !title.trim() || !note.trim()} className="ml-auto">
          {isPending ? "Saving..." : "Save Note"}
        </Button>
      </div>
    </form>
  );
}
