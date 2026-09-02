// apps/desktop/src/modules/atlas.pfm/components/AssistantComposer.jsx
import { useState } from "react";
import { Textarea, Button } from "@atlas/ui";
import { Send } from "lucide-react";

export function AssistantComposer({ onSend, disabled }) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className="border-t border-[hsl(var(--border))] p-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Pregunta sobre tus finanzas..."
          className="max-h-32 min-h-[42px] flex-1 resize-none"
          disabled={disabled}
        />
        <Button
          size="icon"
          aria-label="Enviar"
          onClick={submit}
          disabled={disabled || !value.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
