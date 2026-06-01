const HINT_KEY = "atlas-public-site-hint";

export function storePublicSiteHint({ siteName, primaryColor, backgroundColor }) {
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify({ siteName, primaryColor, backgroundColor }));
  } catch {}
}

function loadHint() {
  try { return JSON.parse(localStorage.getItem(HINT_KEY)) ?? null; }
  catch { return null; }
}

function relativeLuminance(hex) {
  const parts = (hex.replace("#", "").match(/.{2}/g) ?? []).map((x) => {
    const n = parseInt(x, 16) / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  if (parts.length < 3) return 1;
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

function isDarkBackground(hex) {
  try { return relativeLuminance(hex) < 0.4; }
  catch { return false; }
}

const LOADER_CSS = `
  @keyframes _pl_spin {
    to { transform: rotate(360deg) }
  }
  @keyframes _pl_in {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  @keyframes _pl_glow {
    0%, 100% { opacity: 0.22 }
    50%       { opacity: 0.52 }
  }
  ._pl_in   { animation: _pl_in   0.55s cubic-bezier(.16,1,.3,1) both }
  ._pl_spin { animation: _pl_spin 0.9s linear infinite }
  ._pl_glow { animation: _pl_glow 2.8s ease-in-out infinite }
`;

/**
 * Minimal, brand-aware loader for public website routes.
 *
 * On first visit it shows a neutral spinner. On subsequent visits it reads the
 * last resolved site name and primary color from localStorage to render a
 * branded loader without any Atlas ERP references.
 *
 * Pair with storePublicSiteHint() called after a successful /public/website/resolve.
 */
export function PublicPageLoader() {
  const hint = loadHint();

  const siteName  = hint?.siteName  ?? null;
  const primary   = hint?.primaryColor   ?? "#6366f1";
  const bg        = hint?.backgroundColor ?? "#ffffff";
  const dark      = isDarkBackground(bg);

  const textColor  = dark ? "#f9fafb"               : "#111827";
  const mutedColor = dark ? "rgba(255,255,255,.32)"  : "rgba(0,0,0,.32)";
  const trackColor = dark ? "rgba(255,255,255,.09)"  : "rgba(0,0,0,.07)";

  return (
    <>
      <style>{LOADER_CSS}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Ambient radial glow */}
        <div
          className="_pl_glow"
          style={{
            position: "absolute",
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${primary}28 0%, transparent 68%)`,
            pointerEvents: "none",
          }}
        />

        {/* Content */}
        <div
          className="_pl_in"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          {siteName && (
            <p
              style={{
                margin: 0,
                fontSize: "clamp(17px, 2.8vw, 24px)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: textColor,
                maxWidth: 380,
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {siteName}
            </p>
          )}

          {/* Spinner */}
          <div style={{ position: "relative", width: 38, height: 38 }}>
            <div
              style={{
                position: "absolute",
                inset: -10,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${primary}30 0%, transparent 70%)`,
                filter: "blur(5px)",
              }}
            />
            <div
              className="_pl_spin"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: `2.5px solid ${trackColor}`,
                borderTopColor: primary,
                boxSizing: "border-box",
              }}
            />
          </div>

          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: mutedColor,
            }}
          >
            Cargando
          </span>
        </div>
      </div>
    </>
  );
}
