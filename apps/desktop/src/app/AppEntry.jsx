import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AtlasOfflineDatabase, createDexiePersister } from "@atlas/offline";
import { Toaster, TooltipProvider } from "@atlas/ui";
import { AuthProvider } from "../auth/AuthProvider";
import { RealtimeProvider } from "../providers/RealtimeProvider";
import { CallsProvider } from "../modules/atlas.chat/calls/CallsProvider";
import { AtlasApp } from "./AtlasApp";
import { HomeScreen } from "./HomeScreen";
import { ModuleOutlet } from "./ModuleOutlet";
import { ProfileScreen } from "./ProfileScreen";
import { GoogleCalendarCallbackScreen } from "./GoogleCalendarCallbackScreen";
import { atlas } from "../lib/atlas";
import { applyBrandTheme } from "../lib/brandTheme";
import { registerServiceWorker } from "../lib/webPush";
import { AppLoader } from "../components/AppLoader";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useBrandingStore } from "../stores/branding";
import { useThemeStore } from "../stores/theme";
import { PublicShell } from "../shell/PublicShell.jsx";
import { PublicModuleOutlet } from "../shell/PublicModuleOutlet.jsx";
import { PublicWebsiteEntry } from "../shell/PublicWebsiteEntry.jsx";
import { PublicClientLogin } from "../shell/PublicClientLogin.jsx";
import { ServerSetup } from "./ServerSetup.jsx";
import { AppRouteGuard } from "./AppRouteGuard.jsx";
import PublicNoteScreen from "../modules/atlas.notes/PublicNoteScreen.jsx";
import { useCallSoundUnlock } from "../modules/atlas.chat/calls/useCallSoundUnlock.js";
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

function isAtlasInternalPath(pathname) {
  return pathname.startsWith("/app");
}

function App({ initialServerUrl = null, requiresServerSetup = false, bootstrapError = '' }) {
  const [brandReady, setBrandReady] = useState(false);
  const setBranding = useBrandingStore((s) => s.setBranding);
  const skipBrandWait = typeof window === 'undefined'
    ? false
    : !isAtlasInternalPath(window.location.pathname);

  useCallSoundUnlock();

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
              <Route path="/app/setup" element={<AppRouteGuard mode="setup" />} />
              <Route path="/app/login" element={<AppRouteGuard mode="login" />} />
              <Route path="/app/acceso" element={<PublicClientLogin />} />
              <Route
                path="/app/google/calendar/callback"
                element={<GoogleCalendarCallbackScreen />}
              />
              {/* Public notes under /app/p/ — accessible without auth, served by same SPA */}
              <Route path="/app/p" element={<PublicShell />}>
                <Route path="notes/:slug" element={<PublicNoteScreen />} />
              </Route>
              <Route element={<AppRouteGuard mode="access" />}>
                <Route path="/app" element={<RealtimeProvider><CallsProvider><AtlasApp /></CallsProvider></RealtimeProvider>}>
                  <Route index element={<Navigate to="home" replace />} />
                  <Route path="home" element={<HomeScreen />} />
                  <Route path="m/:moduleKey/*" element={<ModuleOutlet />} />
                  <Route path="profile" element={<ProfileScreen />} />
                </Route>
              </Route>
              <Route path="/p" element={<PublicShell />}>
                <Route path="notes/:slug" element={<PublicNoteScreen />} />
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
