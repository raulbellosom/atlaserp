import { useEffect, useRef, useState } from "react";

// Captures the browser's beforeinstallprompt event so we can trigger
// "Add to Home Screen" from a custom UI button instead of the browser default.
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstall(true);
    }

    function handleAppInstalled() {
      deferredPromptRef.current = null;
      setCanInstall(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPromptRef.current) return;
    deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;
    if (outcome === "accepted") {
      deferredPromptRef.current = null;
      setCanInstall(false);
    }
  }

  return { canInstall, install };
}
