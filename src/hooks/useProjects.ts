import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProjects, fetchProject, createProject, updateProject, createNote } from "@/lib/api";
import type { InsertProject, InsertProjectNote } from "../../shared/schema";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    select: (data) => data.projects,
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InsertProject>) => createProject(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InsertProject>) => updateProject(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
}

export function useCreateNote(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<InsertProjectNote, "projectId">) => createNote(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}
