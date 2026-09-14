export function TypingIndicator({ names = [] }) {
  if (!names.length) return null;

  const label =
    names.length === 1
      ? `${names[0]} está escribiendo`
      : `${names.slice(0, 2).join(" y ")} están escribiendo`;

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-[hsl(var(--muted-foreground))] italic">{label}</span>
    </div>
  );
}
