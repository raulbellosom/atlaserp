import { MessageSquare, MonitorUp, Video } from "lucide-react";

const TABS = [
  { key: "video", label: "Video", Icon: Video },
  { key: "screen", label: "Pantalla", Icon: MonitorUp },
  { key: "chat", label: "Chat", Icon: MessageSquare },
];

// Mobile-only segmented control for the call room. "Pantalla" only appears
// while a screen share is live. A dot on "Chat" flags unread messages while
// another view is active.
export function CallViewSwitcher({ view, onChange, hasScreenShare, chatUnread = 0 }) {
  const tabs = TABS.filter((tab) => tab.key !== "screen" || hasScreenShare);

  return (
    <div className="mx-auto my-2 flex w-fit items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur">
      {tabs.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={[
              "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-white text-slate-900" : "text-white/80 hover:text-white",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === "chat" && !active && chatUnread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-violet-400 ring-2 ring-slate-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
