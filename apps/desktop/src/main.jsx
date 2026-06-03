import { useState, useEffect, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Toaster, TooltipProvider } from "@atlas/ui";
import { SetupWizard } from "./setup/SetupWizard";
import { AuthProvider } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { useAuth } from "./auth/AuthProvider";
import { AtlasApp } from "./app/AtlasApp";
import { HomeScreen } from "./app/HomeScreen";
import { ModuleOutlet } from "./app/ModuleOutlet";
import { ProfileScreen } from "./app/ProfileScreen";
import { atlas } from "./lib/atlas";
import { applyBrandTheme } from "./lib/brandTheme";
import { registerNotificationServiceWorker } from "./lib/webPush";
import { AppLoader } from "./components/AppLoader";
import { ApiErrorScreen } from "./components/ApiErrorScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useBrandingStore } from "./stores/branding";
import { useThemeStore } from "./stores/theme";
import { PublicShell } from "./shell/PublicShell.jsx";
import { PublicModuleOutlet } from "./shell/PublicModuleOutlet.jsx";
import { PublicWebsiteEntry } from "./shell/PublicWebsiteEntry.jsx";
import { PublicClientLogin } from "./shell/PublicClientLogin.jsx";
import "./styles.css";

// Sync Zustand state with the class already applied by the inline HTML script.
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
    return <Navigate to="/app/login" replace state={{ branding: data.branding }} />;
  }

  return <Outlet />;
}

// Routes under /app are internal and get the brand loader.
// /login, /setup, /acceso are now mounted at /app/login, /app/setup, /app/acceso
// so they are all covered by the /app prefix check.
function isAtlasInternalPath(pathname) {
  return pathname.startsWith("/app");
}

function App() {
  const [brandReady, setBrandReady] = useState(false);
  const setBranding = useBrandingStore((s) => s.setBranding);

  const skipBrandWait = !isAtlasInternalPath(window.location.pathname);

  useEffect(() => {
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
  }, [setBranding]);

  useEffect(() => {
    registerNotificationServiceWorker().catch(() => {});
  }, []);

  if (!brandReady && !skipBrandWait) {
    return <AppLoader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<PublicWebsiteEntry />} />
              <Route path="/app/setup" element={<SetupRouteGuard />} />
              <Route path="/app/login" element={<LoginRouteGuard />} />
              <Route path="/app/acceso" element={<PublicClientLogin />} />
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
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
