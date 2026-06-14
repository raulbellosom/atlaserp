import { useEffect, useRef, useState } from "react";

export function createPwaInstallController({
  moduleKey = null,
  onAvailabilityChange,
}) {
  let activeModuleKey = moduleKey;
  let capturedModuleKey = null;
  let deferredPrompt = null;

  function clear() {
    deferredPrompt = null;
    capturedModuleKey = null;
    onAvailabilityChange(false);
  }

  return {
    capture(event) {
      event.preventDefault();
      deferredPrompt = event;
      capturedModuleKey = activeModuleKey;
      onAvailabilityChange(Boolean(activeModuleKey));
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
      if (
        !deferredPrompt ||
        !activeModuleKey ||
        capturedModuleKey !== activeModuleKey
      ) {
        return null;
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
  const controllerRef = useRef(null);

  if (!controllerRef.current) {
    controllerRef.current = createPwaInstallController({
      moduleKey,
      onAvailabilityChange: setCanInstall,
    });
  }

  useEffect(() => {
    controllerRef.current.setModuleKey(moduleKey);
  }, [moduleKey]);

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
    install: () => controllerRef.current.install(),
  };
}
