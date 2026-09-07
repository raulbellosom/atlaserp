import { useEffect, useState } from "react";

// Pointer/hover capability detection — the right axis for "should hover-only
// affordances be revealed?" and "is this a touch device?". Width alone
// (useIsMobile) misclassifies tablets and touch laptops as desktops, so
// hover menus and swipe gestures never show up there.

function useMediaQuery(query, initial = false) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return initial;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// True on devices whose primary pointer is imprecise (finger / stylus):
// phones AND tablets AND touch laptops in tablet mode. Use this — not a width
// breakpoint — to decide whether to always-show a hover affordance, enable a
// swipe gesture, or open a bottom sheet instead of a cursor-anchored menu.
export function useCoarsePointer() {
  return useMediaQuery("(pointer: coarse)");
}

// True when the primary pointer can hover (desktop mouse / trackpad). The
// inverse is the common case for "reveal this control that's otherwise
// opacity-0 until :hover".
export function useHasHover() {
  return useMediaQuery("(hover: hover) and (pointer: fine)", true);
}
