import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, ConfirmDialog, DistDropZone, LoadingState } from "@atlas/ui";
import {
  Upload,
  FileArchive,
  Trash2,
  CheckCircle2,
  Download,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const MAX_SIZE_MB = 100;

// ---- Framework SVG icons ----
function ReactIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="2.2" fill="#61DAFB" />
      <ellipse
        cx="12"
        cy="12"
        rx="10.5"
        ry="4"
        stroke="#61DAFB"
        strokeWidth="1.4"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="10.5"
        ry="4"
        stroke="#61DAFB"
        strokeWidth="1.4"
        transform="rotate(60 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="10.5"
        ry="4"
        stroke="#61DAFB"
        strokeWidth="1.4"
        transform="rotate(120 12 12)"
      />
    </svg>
  );
}

function AstroIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FF5D01"
        d="M17 5.5C15.3 3.2 12 2.5 9.5 3.8L5.8 6C3.3 7.4 2.4 10.6 3.8 13l.2.4C3.5 14.3 3.4 15.2 3.7 16l.3 1.2c.5 1.8 1.8 3.2 3.6 3.8l3.8 2.2c2.6 1.5 6 .5 7.6-2 1.6-2.4 1-5.6-1.3-7.2.6-1 .7-2.2.3-3.3L17.7 9C17 7.5 17 6.3 17 5.5z"
      />
    </svg>
  );
}

function NextJsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="currentColor"
        className="text-foreground"
      />
      <path
        d="M7.5 8.5h2.2L17 16.5h-2.2V10.5L8.8 16.5H7.5V8.5z"
        fill="white"
        style={{ fill: "var(--nextjs-icon-fg, white)" }}
      />
    </svg>
  );
}

function SvelteKitIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FF3E00"
        d="M19.7 4.6c-1.8-2.6-5.4-3.4-8.1-1.9L7.5 5.1C4.9 6.6 3.9 10 5.3 12.7c-.6 1-.8 2.2-.5 3.3l.3 1.2c.5 1.8 1.9 3.3 3.7 3.9l4.1 2.4c2.7 1.5 6.1.6 7.9-2 1.7-2.5 1.3-5.8-1-7.6.6-1 .7-2.3.3-3.4L19.8 9C19 7.4 19 5.8 19.7 4.6z"
      />
      <path
        fill="#FFA500"
        d="M11.5 7c1.5-.5 3.2.2 3.8 1.6.5 1.2.1 2.5-.9 3.2.8.3 1.4 1 1.5 1.9.2 1.4-.7 2.8-2.1 3.2-1.5.5-3.2-.2-3.8-1.6-.5-1.2-.1-2.5.9-3.2-.8-.3-1.4-1-1.5-1.9-.2-1.4.7-2.8 2.1-3.2z"
      />
    </svg>
  );
}

function ViteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="#BD34FE" d="M13.5 2L4 13.5h5.5L8 22l12-12h-5.5L13.5 2z" />
      <path fill="#646CFF" d="M21 3L13.5 2l-1 8h5.5L21 3z" />
    </svg>
  );
}

const FRAMEWORKS = [
  { name: "React", Icon: ReactIcon },
  { name: "Astro", Icon: AstroIcon },
  { name: "Next.js", Icon: NextJsIcon },
  { name: "SvelteKit", Icon: SvelteKitIcon },
  { name: "Vite", Icon: ViteIcon },
];

// ---- Helpers ----
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Main component ----
export function DistUploadPanel({
  site,
  token,
  siteId,
  onUpload,
  onDelete,
  isUploading,
  uploadError,
}) {
  const [file, setFile] = useState(null);
  const [showDeleteActive, setShowDeleteActive] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState("react");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deletingBuild, setDeletingBuild] = useState(null);
  const queryClient = useQueryClient();

  const hasExistingDist = Boolean(site?.distUploadedAt);
  const previewUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Build history query — only fetches when panel is opened
  const buildsQuery = useQuery({
    queryKey: ["website-builds", siteId],
    queryFn: async () => {
      const res = await fetch(
        `${getApiUrl()}/website/sites/${siteId}/dist/builds`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: Boolean(token) && Boolean(siteId) && historyOpen,
    staleTime: 30_000,
  });

  const GUIDE_TABS = [
    { key: "react",   label: "React" },
    { key: "astro",   label: "Astro" },
    { key: "nextjs",  label: "Next.js" },
    { key: "svelte",  label: "SvelteKit" },
    { key: "vite",    label: "Vite" },
    { key: "manual",  label: "Manual" },
  ];

  const GUIDE_SNIPPETS = {
    react: `// 1. Agrega en el <head> de tu index.html:
// <script src="/atlas-sdk.js"></script>

// 2. Hook para detectar sesion existente
import { useEffect, useState, useRef } from 'react'

export function useAtlasSession() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    window.AtlasERP.auth.getSession().then(setSession)
    return window.AtlasERP.auth.onAuthStateChange((_, s) => setSession(s))
  }, [])
  return session  // undefined=cargando, null=no logeado, objeto=logeado
}

// 3. Login embebido
export function Login() {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) {
      window.AtlasERP.renderLogin(ref.current, {
        onSuccess: (session) => console.log('logeado', session.user.email),
      })
    }
  }, [])
  return <div ref={ref} />
}`,

    astro: `<!-- 1. Agrega en <head> de tu layout base -->
<script src="/atlas-sdk.js"></script>

<!-- 2. Login embebido en cualquier pagina -->
<div id="atlas-login"></div>
<script>
  window.AtlasERP.renderLogin('#atlas-login', {
    onSuccess: () => { window.location.href = '/dashboard' }
  })
</script>

<!-- 3. Leer sesion en scripts de cliente -->
<script>
  const session = await window.AtlasERP.auth.getSession()
  if (session) console.log('usuario:', session.user.email)
</script>`,

    nextjs: `// 1. Agrega en app/layout.tsx (static export)
import Script from 'next/script'
// Dentro del layout:
// <Script src="/atlas-sdk.js" strategy="beforeInteractive" />

// 2. Pagina de login (client component)
'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const ref = useRef(null)
  const router = useRouter()
  useEffect(() => {
    if (ref.current) {
      window.AtlasERP.renderLogin(ref.current, {
        onSuccess: () => router.push('/'),
      })
    }
  }, [])
  return <div ref={ref} />
}`,

    svelte: `<!-- 1. Agrega en src/app.html <head> -->
<script src="/atlas-sdk.js"></script>

<!-- 2. src/routes/login/+page.svelte -->
<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  let container

  onMount(() => {
    window.AtlasERP.renderLogin(container, {
      onSuccess: () => goto('/')
    })
  })
</script>

<div bind:this={container} />`,

    vite: `// 1. Agrega en index.html <head>:
// <script src="/atlas-sdk.js"></script>

// 2. main.js — detectar sesion y mostrar login si es necesario
window.AtlasERP.auth.getSession().then((session) => {
  if (session) {
    initApp(session)
  } else {
    window.AtlasERP.renderLogin('#login-container', {
      onSuccess: (s) => {
        document.getElementById('login-container').remove()
        initApp(s)
      },
    })
  }
})

function initApp(session) {
  console.log('App lista para', session.user.email)
}`,

    manual: `// window.ATLAS_CONFIG se inyecta automaticamente por Atlas
// cuando sirve tu dist. Puedes usarlo con tu propio cliente Supabase.

// Opcion A — Usar @supabase/supabase-js directamente
import { createClient } from '@supabase/supabase-js'

const { supabaseUrl, supabaseAnonKey } = window.ATLAS_CONFIG
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// La sesion se comparte con Atlas ERP (misma localStorage key)
const { data: { session } } = await supabase.auth.getSession()

// Opcion B — Leer token raw (avanzado)
const { storageKey } = window.ATLAS_CONFIG
const raw   = JSON.parse(localStorage.getItem(storageKey) || '{}')
const token = raw.access_token ?? null`,
  };

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copiado"));
  }

  function handleUpload() {
    if (!file || isUploading) return;
    onUpload(file);
    setFile(null);
  }

  async function handleDeleteBuildFromHistory(build) {
    try {
      const res = await fetch(
        `${getApiUrl()}/website/sites/${siteId}/dist/builds/${encodeURIComponent(build.name)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al eliminar");
      }
      toast.success("Build eliminado del historial");
      queryClient.invalidateQueries({ queryKey: ["website-builds", siteId] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingBuild(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* Framework compatibility strip */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">
            Compatible:
          </span>
          {FRAMEWORKS.map(({ name, Icon }) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-border bg-muted/40 text-foreground"
            >
              <Icon />
              {name}
            </span>
          ))}
        </div>

        {/* Preview / sandbox URL bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              Vista previa (sandbox)
            </p>
            <p className="text-xs font-mono truncate text-foreground">
              {previewUrl}
            </p>
          </div>
          <button
            type="button"
            title="Abrir en nueva pestana"
            onClick={() =>
              window.open(previewUrl, "_blank", "noopener,noreferrer")
            }
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Copiar URL"
            onClick={() => {
              navigator.clipboard.writeText(previewUrl);
              toast.success("URL copiada");
            }}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Active build card */}
        {hasExistingDist && (
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
            <CheckCircle2 className="w-4.5 h-4.5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">
                  Build activo
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-medium">
                  {site.distHasPrerender ? "SSG / Prerenderizado" : "SPA"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(site.distUploadedAt)} &middot;{" "}
                {site.distFileCount ?? 0} archivo
                {(site.distFileCount ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteActive(true)}
              disabled={isUploading}
              className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>
        )}

        {/* Drop zone */}
        <DistDropZone
          accept=".zip"
          maxSizeMB={MAX_SIZE_MB}
          fullScreenOverlay
          overlayLabel="Suelta tu build aqui"
          overlayHint={`Archivo .zip · max ${MAX_SIZE_MB} MB`}
          isUploading={isUploading}
          file={file}
          onFile={setFile}
          onClear={() => setFile(null)}
          error={uploadError}
          emptyLabel="Arrastra tu .zip aqui"
          emptyHint={`o haz clic para seleccionar · max ${MAX_SIZE_MB} MB`}
          dragActiveLabel="Suelta el archivo aqui"
        />

        {/* Upload action */}
        {file && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? "Subiendo..." : `Subir ${file.name}`}
          </Button>
        )}

        {/* Build history */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen((h) => !h)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Historial de builds
            </div>
            {historyOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {historyOpen && (
            <div className="border-t border-border">
              {buildsQuery.isPending ? (
                <LoadingState message="Cargando historial..." />
              ) : !buildsQuery.data?.data?.length ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No hay builds guardados
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Los proximos uploads se guardaran aqui para descarga
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {buildsQuery.data.data.map((build) => (
                    <div
                      key={build.key}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <FileArchive className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate text-foreground">
                          {build.displayName || build.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDate(build.uploadedAt)}
                          {build.size ? ` · ${formatBytes(build.size)}` : ""}
                        </p>
                      </div>
                      <a
                        href={build.downloadUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                        title="Descargar .zip"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setDeletingBuild(build)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                        title="Eliminar del historial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Integration guide */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <span className="text-foreground">Integracion de auth</span>
          {guideOpen
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>

        {guideOpen && (
          <div className="border-t border-border">
            <p className="px-4 pt-3 pb-2 text-xs text-muted-foreground leading-relaxed">
              Agrega{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">
                &lt;script src="/atlas-sdk.js"&gt;&lt;/script&gt;
              </code>{" "}
              al <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">&lt;head&gt;</code> de tu
              frontend. Atlas inyecta{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">window.ATLAS_CONFIG</code>{" "}
              automaticamente con las credenciales de Supabase — la sesion se comparte con Atlas ERP a traves del mismo{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">localStorage</code>.
            </p>

            {/* Tab strip */}
            <div className="flex gap-1 px-4 pb-2 overflow-x-auto">
              {GUIDE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setGuideTab(tab.key)}
                  className={[
                    "shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                    guideTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Code block */}
            <div className="mx-4 mb-4 relative">
              <pre className="text-[11px] font-mono bg-muted/60 border border-border rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground">
                {GUIDE_SNIPPETS[guideTab]}
              </pre>
              <button
                type="button"
                onClick={() => copyToClipboard(GUIDE_SNIPPETS[guideTab])}
                className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Copiar"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm: delete active build */}
      <ConfirmDialog
        open={showDeleteActive}
        onOpenChange={setShowDeleteActive}
        title="Eliminar build activo"
        description="Se eliminaran todos los archivos del build. El sitio volvera al constructor de paginas hasta que subas un nuevo build. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          setShowDeleteActive(false);
          onDelete();
        }}
      />

      {/* Confirm: delete individual build from history */}
      <ConfirmDialog
        open={Boolean(deletingBuild)}
        onOpenChange={(open) => {
          if (!open) setDeletingBuild(null);
        }}
        title="Eliminar build del historial"
        description={`Se eliminara ${deletingBuild?.displayName || deletingBuild?.name || "este build"} del historial de forma permanente.`}
        confirmLabel="Eliminar"
        onConfirm={() =>
          deletingBuild && handleDeleteBuildFromHistory(deletingBuild)
        }
      />
    </>
  );
}
