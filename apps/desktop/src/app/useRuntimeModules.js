import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { atlas } from "../lib/atlas";
import { getAvailableModules, mergeRuntimeModules } from "../lib/runtimeModules";

export function useRuntimeModules() {
  const modulesQuery = useQuery({
    queryKey: ["modules"],
    queryFn: atlas.modules.list,
    staleTime: 60000,
  });

  const runtimeModules = useMemo(
    () => mergeRuntimeModules(modulesQuery.data),
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
