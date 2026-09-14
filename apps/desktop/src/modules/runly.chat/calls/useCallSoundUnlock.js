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
    let unlocked = false;

    async function unlock() {
      // Once the audio pipeline is unlocked for this page session there is
      // nothing left to do — re-running unlockCallSounds() on every click made
      // the browser re-request the four sound files on each interaction
      // (visible as repeated /sounds/*.mp3 fetches in the network panel).
      if (unlocked || unlocking) return;
      unlocking = true;
      const ok = await unlockCallSounds().catch(() => false);
      unlocking = false;
      if (ok) {
        unlocked = true;
        // Stop priming on every gesture. visibilitychange stays wired because
        // iOS drops the unlock when the tab is backgrounded.
        UNLOCK_EVENTS.forEach((eventName) => {
          document.removeEventListener(eventName, unlock, true);
        });
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        // The tab may have been backgrounded long enough for iOS to drop the
        // unlock; allow exactly one more attempt and re-arm the gesture
        // listeners so a later tap can retry if this pass fails.
        unlocked = false;
        UNLOCK_EVENTS.forEach((eventName) => {
          document.addEventListener(eventName, unlock, true);
        });
        unlock();
      }
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
