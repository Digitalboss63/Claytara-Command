import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProtocols, fetchProtocol, createProtocol, updateProtocol } from "@/lib/api";
import type { InsertProtocol } from "../../shared/schema";

export function useProtocols() {
  return useQuery({
    queryKey: ["protocols"],
    queryFn: fetchProtocols,
    select: (data) => data.protocols,
  });
}

export function useProtocol(id: number) {
  return useQuery({
    queryKey: ["protocol", id],
    queryFn: () => fetchProtocol(id),
    enabled: !!id,
  });
}

export function useCreateProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InsertProtocol>) => createProtocol(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocols"] }),
  });
}

export function useUpdateProtocol(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InsertProtocol>) => updateProtocol(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocols"] }),
  });
}
