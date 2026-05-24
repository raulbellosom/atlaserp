import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { atlas } from "../lib/atlas";
import { getAvailableModules, mergeRuntimeModules } from "../lib/runtimeModules";
import { useAuth } from "../auth/AuthProvider";
import { useBrandingStore } from "../stores/branding.js";

export function useRuntimeModules() {
  const { session } = useAuth();
  const token = session?.access_token;
  const authUserId = session?.user?.id ?? "anonymous";
  const companyPrimaryColor = useBrandingStore((s) => s.branding?.primaryColor);

  const modulesQuery = useQuery({
    queryKey: ["runtime-modules", authUserId],
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

  // atlas.company's color is always the live company primary color so every
  // consumer (cards, sidebar, home screen, module outlet) stays in sync.
  const runtimeModulesResolved = useMemo(() => {
    if (!companyPrimaryColor) return runtimeModules;
    return runtimeModules.map((m) =>
      m.key === "atlas.company" ? { ...m, color: companyPrimaryColor } : m,
    );
  }, [runtimeModules, companyPrimaryColor]);

  const availableModules = useMemo(
    () => getAvailableModules(runtimeModulesResolved),
    [runtimeModulesResolved],
  );

  const moduleMap = useMemo(
    () => new Map(runtimeModulesResolved.map((module) => [module.key, module])),
    [runtimeModulesResolved],
  );

  return {
    ...modulesQuery,
    runtimeModules: runtimeModulesResolved,
    availableModules,
    moduleMap,
  };
}
