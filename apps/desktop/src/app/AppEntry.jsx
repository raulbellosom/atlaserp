import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  QueryClient,
  useQuery,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AtlasOfflineDatabase, createDexiePersister } from "@atlas/offline";
import { Toaster, TooltipProvider } from "@atlas/ui";
import { SetupWizard } from "../setup/SetupWizard";
import { AuthProvider } from "../auth/AuthProvider";
import { LoginScreen } from "../auth/LoginScreen";
import { useAuth } from "../auth/AuthProvider";
import { AtlasApp } from "./AtlasApp";
import { HomeScreen } from "./HomeScreen";
import { ModuleOutlet } from "./ModuleOutlet";
import { ProfileScreen } from "./ProfileScreen";
import { GoogleCalendarCallbackScreen } from "./GoogleCalendarCallbackScreen";
import { atlas } from "../lib/atlas";
import { applyBrandTheme } from "../lib/brandTheme";
import { registerServiceWorker } from "../lib/webPush";
import { AppLoader } from "../components/AppLoader";
import { ApiErrorScreen } from "../components/ApiErrorScreen";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useBrandingStore } from "../stores/branding";
import { useThemeStore } from "../stores/theme";
import { PublicShell } from "../shell/PublicShell.jsx";
import { PublicModuleOutlet } from "../shell/PublicModuleOutlet.jsx";
import { PublicWebsiteEntry } from "../shell/PublicWebsiteEntry.jsx";
import { PublicClientLogin } from "../shell/PublicClientLogin.jsx";
import { ServerSetup } from "./ServerSetup.jsx";
import "../styles.css";

useThemeStore.getState().init();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const _offlineDb = new AtlasOfflineDatabase()
const _persister = createDexiePersister(_offlineDb)

function useInstanceStatus() {
  return useQuery({
    queryKey: ["instance-status"],
    queryFn: atlas.instance.status,
    retry: 1,
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

function SetupRouteGuard() {
  const { session, loading: authLoading } = useAuth();
  const { data, isPending, isError, error, refetch } = useInstanceStatus();

  if (isPending || authLoading) {
    return <AppLoader message="Verificando instancia..." />;
  }

  if (isError) {
    return (
      <ApiErrorScreen
        error={error}
        onRetry={() => refetch()}
        context="Verificacion de instancia"
      />
    );
  }

  if (data?.initialized) {
    const nextPath = session ? "/app" : "/app/login";
    return (
      <Navigate
        to={nextPath}
        replace
        state={nextPath === "/app/login" ? { branding: data.branding } : undefined}
      />
    );
  }

  return <SetupWizard />;
}

function LoginRouteGuard() {
  const { session, loading: authLoading } = useAuth();
  const { data, isPending, isError, error, refetch } = useInstanceStatus();

  if (isPending || authLoading) {
    return <AppLoader message="Verificando instancia..." />;
  }

  if (isError) {
    return (
      <ApiErrorScreen
        error={error}
        onRetry={() => refetch()}
        context="Verificacion de instancia"
      />
    );
  }

  if (!data?.initialized) {
    return <Navigate to="/app/setup" replace />;
  }

  if (session) {
    return <Navigate to="/app" replace />;
  }

  return <LoginScreen />;
}

function AppAccessGuard() {
  const { session, loading: authLoading } = useAuth();
  const location = useLocation();
  const { data, isPending, isError, error, refetch } = useInstanceStatus();

  if (isPending || authLoading) {
    return <AppLoader message="Verificando instancia..." />;
  }

  if (isError) {
    return (
      <ApiErrorScreen
        error={error}
        onRetry={() => refetch()}
        context="Verificacion de instancia"
      />
    );
  }

  if (!data?.initialized) {
    return <Navigate to="/app/setup" replace />;
  }

  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <LoginScreen returnTo={returnTo} />;
  }

  return <Outlet />;
}

function isAtlasInternalPath(pathname) {
  return pathname.startsWith("/app");
}

function App({ initialServerUrl = null, requiresServerSetup = false, bootstrapError = '' }) {
  const [brandReady, setBrandReady] = useState(false);
  const setBranding = useBrandingStore((s) => s.setBranding);
  const skipBrandWait = typeof window === 'undefined'
    ? false
    : !isAtlasInternalPath(window.location.pathname);

  useEffect(() => {
    if (requiresServerSetup) return undefined

    let mounted = true;
    atlas.instance
      .status()
      .then((data) => {
        applyBrandTheme(data?.branding?.primaryColor);
        if (mounted) setBranding(data?.branding ?? null);
      })
      .catch(() => applyBrandTheme())
      .finally(() => {
        if (mounted) setBrandReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [requiresServerSetup, setBranding]);

  useEffect(() => {
    if (requiresServerSetup) return undefined
    registerServiceWorker().catch(() => {});
    return undefined
  }, [requiresServerSetup]);

  if (requiresServerSetup) {
    return (
      <TooltipProvider>
        <ServerSetup defaultUrl={initialServerUrl ?? ''} initialError={bootstrapError} />
        <Toaster />
      </TooltipProvider>
    )
  }

  if (!brandReady && !skipBrandWait) {
    return <AppLoader />;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: _persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: import.meta.env.VITE_APP_VERSION ?? '1',
      }}
    >
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<PublicWebsiteEntry />} />
              <Route path="/app/setup" element={<SetupRouteGuard />} />
              <Route path="/app/login" element={<LoginRouteGuard />} />
              <Route path="/app/acceso" element={<PublicClientLogin />} />
              <Route
                path="/app/google/calendar/callback"
                element={<GoogleCalendarCallbackScreen />}
              />
              <Route element={<AppAccessGuard />}>
                <Route path="/app" element={<AtlasApp />}>
                  <Route index element={<Navigate to="home" replace />} />
                  <Route path="home" element={<HomeScreen />} />
                  <Route path="m/:moduleKey/*" element={<ModuleOutlet />} />
                  <Route path="profile" element={<ProfileScreen />} />
                </Route>
              </Route>
              <Route path="/p" element={<PublicShell />}>
                <Route path="*" element={<PublicModuleOutlet />} />
              </Route>
              <Route path="*" element={<PublicWebsiteEntry />} />
            </Routes>
          </AuthProvider>
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}

export function renderApp(props = {}) {
  createRoot(document.getElementById("root")).render(
    <ErrorBoundary>
      <App {...props} />
    </ErrorBoundary>,
  );
}
