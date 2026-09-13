import { Circle } from "lucide-react";

// Persistent, non-dismissible consent notice — shown to every participant
// (member or guest) while a call recording is ACTIVE.
export function RecordingBanner({ active }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-red-600/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
        <Circle className="h-2.5 w-2.5 animate-pulse fill-current" />
        Esta llamada se está grabando
      </div>
    </div>
  );
}
