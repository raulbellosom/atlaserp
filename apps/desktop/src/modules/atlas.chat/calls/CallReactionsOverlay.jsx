// Floating call reactions — each entry rises from the bottom of the video area
// up ~70vh with a small horizontal drift and a fade, TikTok-style. Purely
// presentational; the list is managed by useCallEphemeral.
export function CallReactionsOverlay({ reactions = [] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <style>{`
        @keyframes call-reaction-float {
          0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
          12%  { transform: translate(calc(var(--drift) * 0.2), -8vh) scale(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate(var(--drift), -70vh) scale(1); opacity: 0; }
        }
      `}</style>
      {reactions.map((r) => {
        // Deterministic pseudo-random offset/drift from the entry id so it
        // doesn't jump between renders.
        const n = Number(String(r.id).replace(/\D/g, "").slice(-4)) || 0;
        const leftPct = 50 + ((n % 56) - 28);
        const drift = ((Math.floor(n / 7) % 80) - 40);
        return (
          <span
            key={r.id}
            className="absolute bottom-14 -translate-x-1/2 select-none text-[28px] will-change-transform"
            style={{ left: `${leftPct}%`, "--drift": `${drift}px`, animation: "call-reaction-float 4s ease-out forwards" }}
          >
            {r.emoji}
          </span>
        );
      })}
    </div>
  );
}
