import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchServices } from "@/lib/api";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 60_000, // re-check every 60s
  });
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    select: (data) => data.services,
    refetchInterval: 120_000,
  });
}
