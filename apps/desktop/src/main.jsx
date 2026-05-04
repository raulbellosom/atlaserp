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
import { AtlasApp } from "./app/AtlasApp";
import { HomeScreen } from "./app/HomeScreen";
import { ModuleOutlet } from "./app/ModuleOutlet";
import { atlas } from "./lib/atlas";
import { applyBrandTheme } from "./lib/brandTheme";
import { AppLoader } from "./components/AppLoader";
import "./styles.css";

const queryClient = new QueryClient();

function InitGuard() {
  const navigate = useNavigate();
  const { data, isPending, isError } = useQuery({
    queryKey: ["instance-status"],
    queryFn: atlas.instance.status,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (isPending || !data) return;
    navigate(data.initialized ? "/login" : "/setup", {
      replace: true,
      state: data.initialized ? { branding: data.branding } : undefined,
    });
  }, [data, isPending, navigate]);

  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-red-500">
        No se pudo conectar con el servidor. Verifica que la API este corriendo.
      </div>
    );
  }

  return <AppLoader message="Verificando instancia..." />;
}

function ProfilePlaceholder() {
  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        Proximamente
      </p>
    </div>
  );
}

function App() {
  const [brandReady, setBrandReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    atlas.instance
      .status()
      .then((data) => applyBrandTheme(data?.branding?.primaryColor))
      .catch(() => applyBrandTheme())
      .finally(() => {
        if (mounted) setBrandReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
                  <Route path="profile" element={<ProfilePlaceholder />} />
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

createRoot(document.getElementById("root")).render(<App />);
