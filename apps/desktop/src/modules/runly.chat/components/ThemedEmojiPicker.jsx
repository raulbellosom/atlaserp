import { useEffect, useState } from "react";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";

// emoji-picker-react ships its own light/dark palette that clashes with the
// Atlas theme (a hard #1c1c1c panel next to a glass sheet, a white-ish search
// box, etc.). This wrapper repaints every --epr-* variable — both the light and
// the dark set, since the Atlas tokens themselves already flip with the theme —
// so the picker reads as part of whatever surface it sits on.
const EPR_VARS = {
  "--epr-bg-color": "hsl(var(--popover, var(--background)))",
  "--epr-dark-bg-color": "hsl(var(--popover, var(--background)))",
  "--epr-category-label-bg-color": "hsl(var(--popover, var(--background)))",
  "--epr-dark-category-label-bg-color": "hsl(var(--popover, var(--background)))",
  "--epr-category-label-text-color": "hsl(var(--muted-foreground))",
  "--epr-text-color": "hsl(var(--foreground))",
  "--epr-dark-text-color": "hsl(var(--foreground))",
  "--epr-hover-bg-color": "hsl(var(--muted))",
  "--epr-dark-hover-bg-color": "hsl(var(--muted))",
  "--epr-focus-bg-color": "hsl(var(--muted))",
  "--epr-dark-focus-bg-color": "hsl(var(--muted))",
  "--epr-highlight-color": "hsl(var(--primary))",
  "--epr-dark-highlight-color": "hsl(var(--primary))",
  "--epr-category-icon-active-color": "hsl(var(--primary))",
  "--epr-dark-category-icon-active-color": "hsl(var(--primary))",
  "--epr-search-input-bg-color": "hsl(var(--muted))",
  "--epr-dark-search-input-bg-color": "hsl(var(--muted))",
  "--epr-search-input-bg-color-active": "hsl(var(--muted))",
  "--epr-dark-search-input-bg-color-active": "hsl(var(--muted))",
  "--epr-search-input-text-color": "hsl(var(--foreground))",
  "--epr-search-input-placeholder-color": "hsl(var(--muted-foreground))",
  "--epr-search-border-color": "hsl(var(--border))",
  "--epr-search-border-color-active": "hsl(var(--primary))",
  "--epr-picker-border-color": "transparent",
  "--epr-preview-border-color": "hsl(var(--border))",
};

function useIsDark() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function ThemedEmojiPicker({ onEmojiClick, width = "100%", height = 360, className = "", style }) {
  const isDark = useIsDark();
  return (
    <div className={className} style={{ ...EPR_VARS, ...style }}>
      <EmojiPicker
        onEmojiClick={onEmojiClick}
        theme={isDark ? "dark" : "light"}
        emojiStyle={EmojiStyle.NATIVE}
        width={width}
        height={height}
        searchPlaceholder="Buscar emoji..."
        lazyLoadEmojis
        skinTonesDisabled
        autoFocusSearch={false}
        previewConfig={{ showPreview: false }}
      />
    </div>
  );
}
