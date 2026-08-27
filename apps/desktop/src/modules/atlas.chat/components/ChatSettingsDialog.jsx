// apps/desktop/src/modules/atlas.chat/components/ChatSettingsDialog.jsx
// Personal chat display preferences: message text size, an optional accent
// color override for own-message bubbles, and whether the wallpaper pattern
// shows behind the message list. Purely a local rendering choice (see
// useChatPreferences.jsx) — nothing here is sent to the API besides the
// preference blob itself.
//
// Edits are staged in local draft state and only committed to the shared
// (server-persisted) preferences on "Aceptar" — the preview below renders
// straight off the draft, so you can see the effect of a change before it
// actually applies anywhere else in the app. Closing the dialog any other
// way (X, Escape, backdrop click) discards the draft; "Restablecer" resets
// the draft to the default preferences (still needs "Aceptar" to persist).
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, RadioGroupField, SwitchField } from "@atlas/ui";
import { Check } from "lucide-react";
import {
  useChatPreferences, ACCENT_PRESETS, FONT_SCALE_OPTIONS, DEFAULT_PREFS, chatPreferencesStyle,
} from "../hooks/useChatPreferences";

function ChatPreview({ draft }) {
  const wallpaperClass = draft.wallpaper ? "chat-wallpaper" : "";

  // Dialog content renders through a Radix Portal straight to document.body
  // (see Dialog.jsx) — outside ChatScreen's own .chat-glass-theme wrapper in
  // the actual DOM, even though it's still inside it in the React tree. The
  // .chat-glass-theme .chat-wallpaper / .chat-scale-target rules are scoped
  // by DOM ancestry, so without re-establishing that scope locally here,
  // neither would ever match inside the portaled dialog. Two nested divs:
  // the outer carries the scope class + the draft's CSS variable overrides,
  // the inner is the thing those scoped rules actually target.
  return (
    <div className="chat-glass-theme" style={chatPreferencesStyle(draft)}>
      <div
        className={["chat-scale-target", wallpaperClass, "rounded-xl border border-[hsl(var(--border))] overflow-hidden p-3 space-y-1.5"].join(" ")}
        data-accent={draft.accentColorKey}
      >
        <div className="flex justify-start">
          <div className="max-w-[75%] rounded-2xl rounded-bl-md px-3 py-1.5 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] text-sm">
            Hola! Asi se ve un mensaje recibido.
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-md px-3 py-1.5 text-sm bg-(--brand-primary) text-(--brand-primary-foreground)">
            Y asi se ve uno enviado por ti.
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatSettingsDialog({ open, onOpenChange }) {
  const { prefs, update } = useChatPreferences();
  const [draft, setDraft] = useState(prefs);

  // Re-sync the draft to whatever's actually persisted every time the
  // dialog opens — discards unsaved edits left over from a previous
  // open/close that never hit "Aceptar".
  useEffect(() => {
    if (open) setDraft(prefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync on the open transition, not on every prefs change while open
  }, [open]);

  function handleAccept() {
    update(draft);
    onOpenChange(false);
  }

  function handleReset() {
    setDraft(DEFAULT_PREFS);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuracion del chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <RadioGroupField
            label="Tamano del texto"
            name="chat-font-scale"
            value={FONT_SCALE_OPTIONS.find((o) => o.value === draft.fontScale)?.key ?? "md"}
            onChange={(key) => {
              const opt = FONT_SCALE_OPTIONS.find((o) => o.key === key);
              if (opt) setDraft((d) => ({ ...d, fontScale: opt.value }));
            }}
            options={FONT_SCALE_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground/80">Color de acento</p>
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = draft.accentColorKey === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    title={preset.label}
                    onClick={() => setDraft((d) => ({ ...d, accentColorKey: preset.key }))}
                    className={[
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0 ring-2 ring-offset-2 ring-offset-[hsl(var(--card))] transition-all",
                      isSelected ? "ring-[hsl(var(--foreground))]" : "ring-transparent",
                    ].join(" ")}
                    style={{ backgroundColor: preset.primary ?? "hsl(var(--brand-primary))" }}
                  >
                    {isSelected && <Check className="h-4 w-4" style={{ color: preset.foreground ?? "hsl(var(--brand-primary-foreground))" }} />}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              "Marca de la empresa" usa el color configurado para toda la organizacion.
            </p>
          </div>

          <SwitchField
            label="Fondo con patron"
            description="Muestra un patron decorativo detras de los mensajes."
            checked={draft.wallpaper}
            onChange={(checked) => setDraft((d) => ({ ...d, wallpaper: checked }))}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground/80">Vista previa</p>
            <ChatPreview draft={draft} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleReset}>
            Restablecer
          </Button>
          <Button type="button" onClick={handleAccept}>
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
