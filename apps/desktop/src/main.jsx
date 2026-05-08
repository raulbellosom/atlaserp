import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Toaster, TooltipProvider } from "@atlas/ui";
import { SetupWizard } from "./setup/SetupWizard";
import { AuthProvider } from "./auth/AuthProvider";
import { AuthGuard } from "./auth/AuthGuard";
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
import "./styles.css";

const queryClient = new QueryClient();

function InitGuard() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["instance-status"],
    queryFn: atlas.instance.status,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (isPending || authLoading || !data) return;
    const nextPath = data.initialized
      ? (session ? "/app" : "/login")
      : "/setup";
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
              <Route path="/setup" element={<SetupWizard />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route element={<AuthGuard />}>
                <Route path="/app" element={<AtlasApp />}>
                  <Route index element={<Navigate to="home" replace />} />
                  <Route path="home" element={<HomeScreen />} />
                  <Route path="m/:moduleKey/*" element={<ModuleOutlet />} />
                  <Route path="profile" element={<ProfileScreen />} />
                </Route>
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
