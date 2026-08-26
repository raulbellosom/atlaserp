const MAX_VISIBLE = 4;

export function MemberAvatarStack({ members = [], onClick }) {
  if (!members.length) return null;
  const visible = members.slice(0, MAX_VISIBLE);
  const extra = members.length - visible.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center -space-x-2 hover:opacity-80 transition-opacity"
      title={`${members.length} ${members.length === 1 ? "miembro" : "miembros"}`}
    >
      {visible.map((m) => (
        <span
          key={m.userId ?? m.id}
          className="h-6 w-6 rounded-full ring-2 ring-[hsl(var(--background))] overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center shrink-0"
        >
          {m.avatarUrl ? (
            <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
              {(m.displayName ?? "?")[0]?.toUpperCase()}
            </span>
          )}
        </span>
      ))}
      {extra > 0 && (
        <span className="h-6 w-6 rounded-full ring-2 ring-[hsl(var(--background))] bg-[hsl(var(--muted-foreground))] text-[hsl(var(--background))] flex items-center justify-center shrink-0 text-[10px] font-semibold">
          +{extra}
        </span>
      )}
    </button>
  );
}
