import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDetectionRules, fetchIssues, fetchActivity, fetchReadiness,
  fetchProjectReadiness, resolveIssue, runDetection,
} from "@/lib/api";

export function useDetectionRules() {
  return useQuery({ queryKey: ["detection-rules"], queryFn: fetchDetectionRules, staleTime: 60_000 });
}

export function useIssues(resolved = false) {
  return useQuery({ queryKey: ["issues", resolved], queryFn: () => fetchIssues(resolved), staleTime: 30_000 });
}

export function useActivity(limit = 50) {
  return useQuery({ queryKey: ["activity", limit], queryFn: () => fetchActivity(limit), staleTime: 30_000 });
}

export function useReadiness() {
  return useQuery({ queryKey: ["readiness"], queryFn: fetchReadiness, staleTime: 60_000 });
}

export function useProjectReadiness(projectId: number) {
  return useQuery({
    queryKey: ["readiness", projectId],
    queryFn: () => fetchProjectReadiness(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useRunDetection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runDetection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      qc.invalidateQueries({ queryKey: ["readiness"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useResolveIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => resolveIssue(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}
