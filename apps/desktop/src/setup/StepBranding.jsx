import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Upload, X, Palette } from "lucide-react";

const TWO_MB_BYTES = 2 * 1024 * 1024;

// Fallback palette if logo has too few distinct colors
const FALLBACK_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

function formatBytes(bytes) {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function extractDominantColors(file, count = 6) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const SIZE = 64;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        URL.revokeObjectURL(url);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
        const freq = {};
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          const brightness = (r + g + b) / 3;
          if (brightness > 238 || brightness < 18) continue;
          const qr = Math.round(r / 28) * 28;
          const qg = Math.round(g / 28) * 28;
          const qb = Math.round(b / 28) * 28;
          const key = `${qr},${qg},${qb}`;
          freq[key] = (freq[key] || 0) + 1;
        }
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        const picked = [];
        for (const [key] of sorted) {
          const [r, g, b] = key.split(",").map(Number);
          const hex =
            "#" +
            [r, g, b]
              .map((v) => Math.min(255, v).toString(16).padStart(2, "0"))
              .join("");
          const tooClose = picked.some((p) => {
            const pr = parseInt(p.slice(1, 3), 16);
            const pg = parseInt(p.slice(3, 5), 16);
            const pb = parseInt(p.slice(5, 7), 16);
            return Math.abs(pr - r) + Math.abs(pg - g) + Math.abs(pb - b) < 55;
          });
          if (!tooClose) {
            picked.push(hex);
            if (picked.length >= count) break;
          }
        }
        resolve(picked);
      } catch {
        URL.revokeObjectURL(url);
        resolve([]);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve([]);
    };
    img.src = url;
  });
}

export const StepBranding = forwardRef(function StepBranding(
  { data, onChange },
  ref,
) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [suggestedColors, setSuggestedColors] = useState(FALLBACK_COLORS);
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    validate() {
      return true;
    },
  }));

  useEffect(() => {
    if (!data.logo) {
      setPreviewUrl(null);
      setSuggestedColors(FALLBACK_COLORS);
      return;
    }
    const url = URL.createObjectURL(data.logo);
    setPreviewUrl(url);
    extractDominantColors(data.logo).then((colors) => {
      setSuggestedColors(colors.length >= 3 ? colors : FALLBACK_COLORS);
    });
    return () => URL.revokeObjectURL(url);
  }, [data.logo]);

  const handleFile = useCallback(
    (file) => {
      setSizeError("");
      if (!file) return;
      if (file.size > TWO_MB_BYTES) {
        setSizeError(
          `Archivo demasiado grande. Máximo ${formatBytes(TWO_MB_BYTES)}`,
        );
        return;
      }
      onChange({ logo: file });
    },
    [onChange],
  );

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  }

  function removeLogo() {
    onChange({ logo: null });
    setSizeError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="space-y-6">
        {/* ── Logo upload ── */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium leading-none text-foreground/80 select-none">
            Logotipo
          </span>

          {!data.logo ? (
            /* Drop zone */
            <div
              role="button"
              tabIndex={0}
              aria-label="Zona de carga del logotipo"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={[
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 text-center",
                "transition-all duration-150 cursor-pointer select-none",
                isDragging
                  ? "border-primary bg-primary/5"
                  : sizeError
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/3",
              ].join(" ")}
            >
              <div
                className={[
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150",
                  isDragging ? "bg-primary/15" : "bg-muted",
                ].join(" ")}
              >
                <Upload
                  size={17}
                  className={
                    isDragging ? "text-primary" : "text-muted-foreground"
                  }
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground/80">
                  Arrastra tu logotipo aquí
                </p>
                <p className="text-xs text-muted-foreground">
                  Opcional · Máximo {formatBytes(TWO_MB_BYTES)}
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>
          ) : (
            /* Preview card */
            <div className="flex items-center gap-3.5 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
              <div className="w-14 h-14 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Vista previa del logotipo"
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {data.logo.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatBytes(data.logo.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={removeLogo}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors duration-150"
                aria-label="Eliminar logotipo"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {sizeError && <p className="text-xs text-destructive">{sizeError}</p>}
          <p className="text-xs text-muted-foreground">
            Se mostrará en el encabezado del sistema.
          </p>
        </div>

        {/* ── Color principal ── */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="primaryColor"
            className="text-[13px] font-medium leading-none text-foreground/80 select-none cursor-default"
          >
            Color principal
          </label>

          <div className="flex items-center gap-3">
            <div
              className="relative w-11 h-11 rounded-lg overflow-hidden border border-border cursor-pointer shrink-0"
              style={{ background: data.primaryColor }}
            >
              <input
                id="primaryColor"
                type="color"
                value={data.primaryColor}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Seleccionar color principal"
              />
            </div>
            <div>
              <span className="font-mono text-sm text-foreground">
                {data.primaryColor}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Haz clic para cambiar
              </p>
            </div>
          </div>

          {/* Color suggestions */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
              <Palette size={11} />
              {data.logo
                ? "Colores extraídos del logotipo"
                : "Colores sugeridos"}
            </p>
            <div className="flex gap-2 flex-wrap">
              {suggestedColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ primaryColor: color })}
                  className={[
                    "w-7 h-7 rounded-lg border-2 transition-all duration-150 hover:scale-110 active:scale-95",
                    data.primaryColor === color
                      ? "border-foreground ring-2 ring-foreground/20 scale-110"
                      : "border-border hover:border-foreground/40",
                  ].join(" ")}
                  style={{ background: color }}
                  aria-label={`Usar color ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
