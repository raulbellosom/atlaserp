import { useEffect, useRef, useState } from "react";

export function createPwaInstallReloadUrl(currentUrl) {
  const url = new URL(currentUrl);
  url.searchParams.set("pwa-install", "1");
  return url.toString();
}

export function clearPwaInstallMarker(currentUrl) {
  const url = new URL(currentUrl);
  url.searchParams.delete("pwa-install");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function createPwaInstallController({
  moduleKey = null,
  documentModuleKey = moduleKey,
  onAvailabilityChange = () => {},
  onManualReadyChange = () => {},
  navigateForInstall = () => {},
  currentUrl = "",
}) {
  let activeModuleKey = moduleKey;
  let capturedModuleKey = null;
  let deferredPrompt = null;

  function clear() {
    deferredPrompt = null;
    capturedModuleKey = null;
    onAvailabilityChange(false);
    onManualReadyChange(false);
  }

  return {
    capture(event) {
      event.preventDefault();
      deferredPrompt = event;
      capturedModuleKey = documentModuleKey;
      onAvailabilityChange(
        Boolean(
          activeModuleKey &&
            capturedModuleKey === activeModuleKey,
        ),
      );
    },
    setModuleKey(nextModuleKey) {
      if (nextModuleKey === activeModuleKey) return;
      activeModuleKey = nextModuleKey;
      clear();
    },
    clear,
    canInstall() {
      return Boolean(
        deferredPrompt &&
          activeModuleKey &&
          capturedModuleKey === activeModuleKey,
      );
    },
    async install() {
      if (!activeModuleKey) {
        return null;
      }

      if (documentModuleKey !== activeModuleKey) {
        navigateForInstall(createPwaInstallReloadUrl(currentUrl));
        return { outcome: "reload" };
      }

      if (!deferredPrompt || capturedModuleKey !== activeModuleKey) {
        onManualReadyChange(true);
        return { outcome: "manual" };
      }

      const prompt = deferredPrompt;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      clear();
      return choice;
    },
  };
}

export function usePwaInstall(moduleKey) {
  const [canInstall, setCanInstall] = useState(false);
  const bootstrap =
    typeof window === "undefined"
      ? null
      : (window.__ATLAS_PWA_BOOTSTRAP__ ?? null);
  const [manualInstallReady, setManualInstallReady] = useState(
    () =>
      Boolean(
        bootstrap?.installRequested &&
          bootstrap.moduleKey &&
          bootstrap.moduleKey === moduleKey,
      ),
  );
  const controllerRef = useRef(null);

  if (!controllerRef.current) {
    controllerRef.current = createPwaInstallController({
      moduleKey,
      documentModuleKey: bootstrap?.moduleKey ?? null,
      onAvailabilityChange: setCanInstall,
      onManualReadyChange: setManualInstallReady,
      navigateForInstall: (url) => window.location.assign(url),
      currentUrl: window.location.href,
    });
  }

  useEffect(() => {
    controllerRef.current.setModuleKey(moduleKey);
  }, [moduleKey]);

  useEffect(() => {
    if (
      !bootstrap?.installRequested ||
      !bootstrap.moduleKey ||
      bootstrap.moduleKey !== moduleKey
    ) {
      return;
    }

    window.history.replaceState(
      window.history.state,
      "",
      clearPwaInstallMarker(window.location.href),
    );
  }, [bootstrap, moduleKey]);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      controllerRef.current.capture(event);
    }

    function handleAppInstalled() {
      controllerRef.current.clear();
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return {
    canInstall,
    manualInstallReady,
    install: () => controllerRef.current.install(),
  };
}
