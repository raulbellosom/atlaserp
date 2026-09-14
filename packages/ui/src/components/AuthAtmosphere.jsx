import { cn } from "../lib/utils.js";

// ─── AuthAtmosphere ───────────────────────────────────────────────────────────
// Full-bleed decorative backdrop shared by the setup wizard and the login
// screen: three slow-drifting color blobs, a faint grid, and a masked
// dot-target pattern. Purely presentational — sits at z-0 behind a glass card.
// Colors are fixed brand hex values (not semantic tokens): they're blurred
// past recognition and read fine on both the dark and light shell background,
// so there's no separate light/dark variant to maintain.
// Keyframes (authDriftA/B/C, authGridDrift) live in the app's global
// stylesheet — see apps/desktop/src/styles.css — following the same pattern
// as the `.glass*` utility classes this component's consumers rely on.

export function AuthAtmosphere({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 overflow-hidden z-0",
        className,
      )}
    >
      <div
        className="absolute -top-[18%] -left-[10%] w-[64vw] h-[64vw] rounded-full blur-[40px]"
        style={{
          background:
            "radial-gradient(circle at 40% 40%, rgba(29,62,134,.75), rgba(29,62,134,0) 68%)",
          animation: "authDriftA 26s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-[28%] left-[6%] w-[52vw] h-[52vw] rounded-full blur-[50px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(253,96,22,.34), rgba(253,96,22,0) 66%)",
          animation: "authDriftB 32s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-[12%] -right-[14%] w-[46vw] h-[46vw] rounded-full blur-[60px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(249,162,27,.20), rgba(249,162,27,0) 64%)",
          animation: "authDriftC 38s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse at 30% 40%, #000 10%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 30% 40%, #000 10%, transparent 72%)",
        }}
      />
      <div
        className="absolute -inset-[10%] opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, transparent 30%, rgba(249,162,27,.16) 31%, rgba(249,162,27,.16) 38%, transparent 39%), radial-gradient(circle at 50% 50%, rgba(253,96,22,.20) 0, rgba(253,96,22,.20) 9%, transparent 10%), radial-gradient(circle at 50% 50%, transparent 24%, rgba(249,162,27,.12) 25%, rgba(249,162,27,.12) 31%, transparent 32%)",
          backgroundSize: "220px 220px, 220px 220px, 148px 148px",
          backgroundPosition: "0 0, 34px 28px, 126px 112px",
          maskImage:
            "linear-gradient(112deg, #000 4%, rgba(0,0,0,.35) 34%, transparent 62%)",
          WebkitMaskImage:
            "linear-gradient(112deg, #000 4%, rgba(0,0,0,.35) 34%, transparent 62%)",
          animation: "authGridDrift 90s linear infinite",
        }}
      />
    </div>
  );
}
