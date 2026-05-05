import { motion, useReducedMotion } from "motion/react";

// ─── Logo geometry (SVG viewBox 0 0 100 100) ─────────────────────────────────
//
// The Atlas isotype is an isometric 3-face "A" arch:
//   TOP FACE   → dark navy flat roof/chevron
//   LEFT FACE  → dark navy vertical pillar
//   RIGHT FACE → cyan/blue bright pillar
//
// Paths traced from the actual isotype PNG to match real geometry.
// The hollow "A" arch opening is the natural gap between left/right pillars.

const TOP_FACE   = "M 18 38  L 50 10  L 82 38  L 66 46  L 50 26  L 34 46 Z";
const LEFT_FACE  = "M 12 44  L 34 48  L 34 90  L 12 86 Z";
const RIGHT_FACE = "M 66 48  L 88 44  L 88 86  L 66 90 Z";

const SPRING   = [0.16, 1, 0.3, 1];
const DURATION = 3.2;

function AtlasLogoSVG({ size = 140 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-label="Atlas ERP"
      role="img"
    >
      <path d={TOP_FACE}   fill="#0A1D44" />
      <path d={LEFT_FACE}  fill="#102A5E" />
      <path d={RIGHT_FACE} fill="#21C7FF" />
    </svg>
  );
}

/**
 * Animated Atlas ERP logo — 3 SVG faces fly in and assemble.
 *
 * @param {object}  props
 * @param {number}  props.size       Container size in px. Default 140.
 * @param {string}  props.className  Extra classes on the root element.
 * @param {string}  props.message    Loading label.
 * @param {boolean} props.showLabel  Show text label below. Default true.
 */
export function AtlasLogoLoader({
  size = 140,
  className = "",
  message = "Cargando...",
  showLabel = true,
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
        <AtlasLogoSVG size={size} />
        {showLabel && (
          <span
            className="text-xs font-medium tracking-[0.2em] uppercase"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-5 ${className}`}>
      {/* ── SVG Assembly ───────────────────────────────────────────────── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        aria-label="Atlas ERP logo animado"
        role="img"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Glow for the cyan face */}
          <filter id="atlas-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Drop shadow for depth */}
          <filter id="atlas-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* ① TOP FACE — drops in from above */}
        <motion.path
          d={TOP_FACE}
          fill="#0A1D44"
          filter="url(#atlas-shadow)"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0,    0,    1,    1,    1,    1,    0.95, 0   ],
            y:       [-28, -28,   0,    0,    0,   -1,   -2,   -4  ],
            scale:   [0.9,  0.9,  1,    1,    1,    1.02, 1.01, 0.95],
          }}
          transition={{
            duration: DURATION,
            times:    [0,   0.06, 0.20, 0.50, 0.70, 0.78, 0.88, 1.0],
            repeat: Infinity,
            ease: SPRING,
          }}
          style={{ originX: "50px", originY: "28px" }}
        />

        {/* ② LEFT FACE (navy) — slides from bottom-left */}
        <motion.path
          d={LEFT_FACE}
          fill="#102A5E"
          filter="url(#atlas-shadow)"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0,    0,    0,    1,    1,    1,    0.95, 0   ],
            x:       [-26, -26,  -26,   0,    0,    0,   -0.5, -2  ],
            y:       [ 20,  20,   20,   0,    0,    0,   -0.5, -2  ],
            scale:   [0.9,  0.9,  0.9,  1,    1,    1.02, 1.01, 0.95],
          }}
          transition={{
            duration: DURATION,
            times:    [0,   0.14, 0.24, 0.34, 0.50, 0.70, 0.82, 1.0],
            repeat: Infinity,
            ease: SPRING,
          }}
          style={{ originX: "23px", originY: "69px" }}
        />

        {/* ③ RIGHT FACE (cyan) — slides from bottom-right, glows */}
        <motion.path
          d={RIGHT_FACE}
          fill="#21C7FF"
          filter="url(#atlas-glow)"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0,    0,    0,    0,    1,    1,    0.95, 0   ],
            x:       [ 26,  26,   26,   26,   0,    0,    0.5,  2  ],
            y:       [ 20,  20,   20,   20,   0,    0,   -0.5, -2  ],
            scale:   [0.9,  0.9,  0.9,  0.9,  1,    1,    1.02, 0.95],
          }}
          transition={{
            duration: DURATION,
            times:    [0,   0.16, 0.28, 0.38, 0.50, 0.70, 0.82, 1.0],
            repeat: Infinity,
            ease: SPRING,
          }}
          style={{ originX: "77px", originY: "69px" }}
        />

        {/* ④ Cyan glow burst — fires once fully assembled */}
        <motion.ellipse
          cx="77" cy="67" rx="16" ry="20"
          fill="#21C7FF"
          style={{ filter: "blur(14px)" }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0,    0,    0,    0,    0,    0.5,  0.18, 0  ],
            scale:   [0.4,  0.4,  0.4,  0.4,  0.4,  1.3,  1.7,  2.0],
          }}
          transition={{
            duration: DURATION,
            times:    [0,   0.16, 0.28, 0.38, 0.52, 0.64, 0.76, 0.90],
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      </svg>

      {/* ── Loading label ───────────────────────────────────────────────── */}
      {showLabel && (
        <motion.span
          className="text-xs font-medium tracking-[0.22em] uppercase"
          style={{ color: "hsl(var(--muted-foreground))" }}
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {message}
        </motion.span>
      )}
    </div>
  );
}
