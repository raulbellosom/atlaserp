import { AtlasLogoLoader } from "./AtlasLogoLoader.jsx";

export function AppLoader({ message = "Iniciando Atlas ERP..." }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[hsl(var(--background))]">
      {/* Ambient radial glow behind everything */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 50% 50%, var(--brand-soft), transparent 70%)",
        }}
      />

      <AtlasLogoLoader size={172} message={message} className="relative z-10" />

      {/* Product name */}
      <p
        className="mt-5 text-[15px] font-semibold tracking-tight"
        style={{ color: "hsl(var(--foreground))" }}
      >
        Atlas ERP
      </p>
    </div>
  );
}
