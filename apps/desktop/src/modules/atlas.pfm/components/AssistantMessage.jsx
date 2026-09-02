// apps/desktop/src/modules/atlas.pfm/components/AssistantMessage.jsx
import { renderRichText } from "../lib/assistant-format";

export function AssistantMessage({ role, content }) {
  const isUser = role === "USER";
  const isError = role === "ERROR";
  const lines = renderRichText(content);
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : isError
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
        ].join(" ")}
      >
        {lines.map((line, i) => (
          <p key={i} className={line.bullet ? "flex gap-1.5" : undefined}>
            {line.bullet && <span aria-hidden>·</span>}
            <span>
              {line.segments.map((seg, j) =>
                seg.bold ? <strong key={j}>{seg.text}</strong> : <span key={j}>{seg.text}</span>,
              )}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
