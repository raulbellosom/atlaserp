import { useEffect } from "react";
import { preloadCallSounds, unlockCallSounds } from "./callSounds.js";

// Safari documents touchend/click/keydown as media activation events. Using
// pointerdown first can consume our in-flight guard before iOS reaches the
// qualifying touchend event.
const UNLOCK_EVENTS = ["touchend", "click", "keydown"];

export function useCallSoundUnlock() {
  useEffect(() => {
    preloadCallSounds();
    let unlocking = false;

    async function unlock() {
      if (unlocking) return;
      unlocking = true;
      await unlockCallSounds().catch(() => false);
      unlocking = false;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") unlock();
    }

    UNLOCK_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, unlock, true);
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      UNLOCK_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, unlock, true);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
