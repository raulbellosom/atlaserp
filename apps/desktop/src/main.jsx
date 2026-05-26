import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
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
import { AppLoader } from "./components/AppLoader";
import { ApiErrorScreen } from "./components/ApiErrorScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useBrandingStore } from "./stores/branding";
import { PublicShell } from "./shell/PublicShell.jsx";
import { PublicModuleOutlet } from "./shell/PublicModuleOutlet.jsx";
import "./styles.css";

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

function resolveNextPath({ initialized, session }) {
  if (!initialized) return "/setup";
  return session ? "/app" : "/login";
}

function InitGuard() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { data, isPending, isError, error, refetch } = useInstanceStatus();

  useEffect(() => {
    if (isPending || authLoading || !data) return;
    const nextPath = resolveNextPath({ initialized: data.initialized, session });
    navigate(nextPath, {
      replace: true,
      state: nextPath === "/login" ? { branding: data.branding } : undefined,
    });
  }, [authLoading, data, isPending, navigate, session]);

  if (isError) {
    return (
      <ApiErrorScreen
        error={error}
        onRetry={() => refetch()}
        context="Verificacion de instancia"
      />
    );
  }

  return <AppLoader message="Verificando instancia..." />;
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
    const nextPath = session ? "/app" : "/login";
    return (
      <Navigate
        to={nextPath}
        replace
        state={nextPath === "/login" ? { branding: data.branding } : undefined}
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
    return <Navigate to="/setup" replace />;
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
    return <Navigate to="/setup" replace />;
  }

  if (!session) {
    return (
      <Navigate to="/login" replace state={{ branding: data.branding }} />
    );
  }

  return <Outlet />;
}

function App() {
  const [brandReady, setBrandReady] = useState(false);
  const setBranding = useBrandingStore((s) => s.setBranding);

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

  if (!brandReady) {
    return <AppLoader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<InitGuard />} />
              <Route path="/setup" element={<SetupRouteGuard />} />
              <Route path="/login" element={<LoginRouteGuard />} />
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
              <Route path="*" element={<Navigate to="/" replace />} />
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
