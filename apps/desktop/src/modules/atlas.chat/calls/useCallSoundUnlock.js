import { useEffect } from "react";
import { preloadCallSounds, unlockCallSounds } from "./callSounds.js";

const UNLOCK_EVENTS = ["pointerdown", "touchend", "keydown"];

export function useCallSoundUnlock() {
  useEffect(() => {
    preloadCallSounds();
    let unlocked = false;
    let unlocking = false;

    async function unlock() {
      if (unlocked || unlocking) return;
      unlocking = true;
      unlocked = await unlockCallSounds().catch(() => false);
      unlocking = false;
      if (unlocked) {
        UNLOCK_EVENTS.forEach((eventName) => {
          document.removeEventListener(eventName, unlock, true);
        });
      }
    }

    UNLOCK_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, unlock, true);
    });
    return () => {
      UNLOCK_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, unlock, true);
      });
    };
  }, []);
}
