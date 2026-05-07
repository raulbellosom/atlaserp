import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { atlas } from "../lib/atlas";
import { getAvailableModules, mergeRuntimeModules } from "../lib/runtimeModules";
import { useAuth } from "../auth/AuthProvider";

export function useRuntimeModules() {
  const { session } = useAuth();
  const token = session?.access_token;

  const modulesQuery = useQuery({
    queryKey: ["runtime-modules", token],
    queryFn: () => atlas.runtime.modules(token),
    enabled: Boolean(token),
    staleTime: 60000,
  });

  const runtimeModules = useMemo(
    () =>
      mergeRuntimeModules(modulesQuery.data, {
        includeManifestFallback: false,
      }),
    [modulesQuery.data],
  );

  const availableModules = useMemo(
    () => getAvailableModules(runtimeModules),
    [runtimeModules],
  );

  const moduleMap = useMemo(
    () => new Map(runtimeModules.map((module) => [module.key, module])),
    [runtimeModules],
  );

  return {
    ...modulesQuery,
    runtimeModules,
    availableModules,
    moduleMap,
  };
}
