import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  ComboboxField,
  ConfirmDialog,
  CreatableComboboxField,
  DateField,
  MarkdownField,
  SelectField,
  Skeleton,
  TextField,
  cn,
} from "@atlas/ui";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Hash,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldBan,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { AdvancedFileViewer } from "../../atlas.files/components/AdvancedFileViewer";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "vacation", label: "Vacaciones" },
  { value: "terminated", label: "Baja" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Tiempo completo" },
  { value: "part_time", label: "Medio tiempo" },
  { value: "contractor", label: "Contratista" },
  { value: "intern", label: "Practicante" },
];

const STATUS_VARIANT = {
  active: "success",
  vacation: "secondary",
  inactive: "outline",
  terminated: "destructive",
};

const STATUS_LABEL = {
  active: "Activo",
  vacation: "Vacaciones",
  inactive: "Inactivo",
  terminated: "Baja",
};

const STATUS_AVATAR = {
  active: {
    bg: "bg-emerald-500/20 dark:bg-emerald-400/20 ring-1 ring-emerald-500/50 dark:ring-emerald-400/30",
    text: "text-emerald-900 dark:text-emerald-300",
  },
  vacation: {
    bg: "bg-amber-500/20   dark:bg-amber-400/20   ring-1 ring-amber-500/50   dark:ring-amber-400/30",
    text: "text-amber-900   dark:text-amber-300",
  },
  inactive: {
    bg: "bg-slate-500/15   dark:bg-slate-400/20   ring-1 ring-slate-500/40   dark:ring-slate-400/30",
    text: "text-slate-700   dark:text-slate-300",
  },
  terminated: {
    bg: "bg-red-500/20     dark:bg-red-400/20     ring-1 ring-red-500/50     dark:ring-red-400/30",
    text: "text-red-900     dark:text-red-300",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseForm() {
  return {
    employeeCode: "",
    userProfileId: "",
    supervisorEmployeeId: "",
    departmentId: "",
    jobTitleId: "",
    profileImageFileId: "",
    firstName: "",
    lastName: "",
    workEmail: "",
    personalEmail: "",
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    jobTitle: "",
    department: "",
    managerName: "",
    employmentType: "",
    workLocation: "",
    hireDate: "",
    terminationDate: "",
    status: "active",
    notesMarkdown: "",
  };
}

function fromEmployee(row) {
  return {
    employeeCode: row?.employeeCode ?? "",
    userProfileId: row?.userProfileId ?? "",
    supervisorEmployeeId: row?.supervisorEmployeeId ?? "",
    departmentId: row?.departmentId ?? "",
    jobTitleId: row?.jobTitleId ?? "",
    profileImageFileId: row?.profileImageFileId ?? "",
    firstName: row?.firstName ?? "",
    lastName: row?.lastName ?? "",
    workEmail: row?.workEmail ?? "",
    personalEmail: row?.personalEmail ?? "",
    phone: row?.phone ?? "",
    emergencyContactName: row?.emergencyContactName ?? "",
    emergencyContactPhone: row?.emergencyContactPhone ?? "",
    jobTitle: row?.jobTitle ?? "",
    department: row?.department ?? "",
    managerName: row?.managerName ?? "",
    employmentType: row?.employmentType ?? "",
    workLocation: row?.workLocation ?? "",
    hireDate: row?.hireDate
      ? new Date(row.hireDate).toISOString().slice(0, 10)
      : "",
    terminationDate: row?.terminationDate
      ? new Date(row.terminationDate).toISOString().slice(0, 10)
      : "",
    status: row?.status ?? "active",
    notesMarkdown: row?.notesMarkdown ?? "",
  };
}

function normalizeForApi(form) {
  return {
    ...form,
    hireDate: form.hireDate ? `${form.hireDate}T00:00:00.000Z` : "",
    terminationDate: form.terminationDate
      ? `${form.terminationDate}T00:00:00.000Z`
      : "",
    employmentType: form.employmentType || undefined,
    userProfileId: form.userProfileId || null,
    supervisorEmployeeId: form.supervisorEmployeeId || null,
    departmentId: form.departmentId || null,
    jobTitleId: form.jobTitleId || null,
    profileImageFileId: form.profileImageFileId || null,
  };
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDateShort(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-MX", { dateStyle: "medium" });
}

function nameOfEmployee(employee) {
  return `${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`.trim();
}

// ── EmployeeMarkdown ──────────────────────────────────────────────────────────

function EmployeeMarkdown({ value }) {
  const source = String(value ?? "");
  if (!source.trim()) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin notas.</p>
    );
  }
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = escaped
    .replace(
      /^### (.*)$/gim,
      "<h3 class='text-base font-semibold mt-3 mb-1'>$1</h3>",
    )
    .replace(
      /^## (.*)$/gim,
      "<h2 class='text-lg font-semibold mt-3 mb-1'>$1</h2>",
    )
    .replace(
      /^# (.*)$/gim,
      "<h1 class='text-xl font-semibold mt-3 mb-1'>$1</h1>",
    )
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/^- (.*)$/gim, "<div class='ml-2'>• $1</div>")
    .replace(/\n/g, "<br />");
  return (
    <div
      className="text-sm leading-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DossierSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl border border-[hsl(var(--border))] p-6">
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ── Hero section ──────────────────────────────────────────────────────────────

function HeroSection({
  employee,
  profileImageUrl,
  profileImageUploading,
  onUploadProfileImage,
  isEditing,
  isNew,
  saveMutation,
  disableMutation,
  onEdit,
  onCancel,
}) {
  const initials =
    `${employee?.firstName?.[0] ?? ""}${employee?.lastName?.[0] ?? ""}`.toUpperCase();
  const colors = STATUS_AVATAR[employee?.status] ?? STATUS_AVATAR.inactive;
  const fullName = employee
    ? `${employee.firstName} ${employee.lastName}`.trim()
    : "Nuevo colaborador";
  const profileInputId = "hr-profile-image-input";

  return (
    <div className="glass rounded-2xl border border-[hsl(var(--border))] p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-5">
        {/* avatar */}
        <div className="relative">
          <div
            className={cn(
              "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold",
              colors.bg,
              colors.text,
            )}
          >
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={`Foto de ${fullName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              initials || <User className="h-8 w-8" />
            )}
          </div>
          {!isNew && isEditing && (
            <>
              <input
                id={profileInputId}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadProfileImage(file);
                  event.target.value = "";
                }}
              />
              <label
                htmlFor={profileInputId}
                className="absolute -bottom-2 -right-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-sm transition hover:text-[hsl(var(--foreground))]"
              >
                {profileImageUploading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
              </label>
            </>
          )}
        </div>

        {/* identity */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            {fullName}
          </h1>
          {employee?.jobTitle && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {employee.jobTitle}
            </p>
          )}
          {employee?.department && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {employee.department}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {employee?.status && (
              <Badge variant={STATUS_VARIANT[employee.status] ?? "outline"}>
                {STATUS_LABEL[employee.status] ?? employee.status}
              </Badge>
            )}
            {employee?.employmentType && (
              <Badge variant="outline" className="text-xs">
                {EMPLOYMENT_TYPE_OPTIONS.find(
                  (o) => o.value === employee.employmentType,
                )?.label ?? employee.employmentType}
              </Badge>
            )}
            {employee?.employeeCode && (
              <Badge variant="secondary" className="text-xs">
                <Hash className="mr-1 h-3 w-3" />
                {employee.employeeCode}
              </Badge>
            )}
          </div>
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={onEdit}
                disabled={isNew && !employee}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {employee && (
                <Button
                  variant="outline"
                  disabled={!employee?.enabled || disableMutation.isPending}
                  onClick={() => disableMutation.mutate()}
                >
                  <ShieldBan className="mr-2 h-4 w-4" />
                  Deshabilitar
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={saveMutation.isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── File helpers ──────────────────────────────────────────────────────────────

function getFileKind(mimeType = "") {
  const v = String(mimeType || "").toLowerCase();
  if (v.startsWith("image/")) return "image";
  if (v === "application/pdf") return "pdf";
  if (v.includes("spreadsheet") || v.includes("excel") || v.includes("csv"))
    return "sheet";
  if (v.includes("word") || v.includes("document")) return "doc";
  if (v.startsWith("text/") || v.includes("json")) return "text";
  return "generic";
}

function formatBytes(bytes = 0) {
  const n = Math.max(0, Number(bytes || 0));
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FileKindIcon({ mimeType, className = "h-8 w-8" }) {
  const kind = getFileKind(mimeType);
  const Icon =
    kind === "image"
      ? FileImage
      : kind === "pdf"
        ? FileType2
        : kind === "sheet"
          ? FileSpreadsheet
          : kind === "doc" || kind === "text"
            ? FileText
            : File;
  return <Icon className={className} />;
}

// ── Files panel ───────────────────────────────────────────────────────────────

const MAX_FILE_MB = 10;
const ACCEPT_HINT =
  "Imágenes, PDF, documentos de oficina · Máx 10 MB por archivo";

function FilesPanel({ employeeId, token, isNew, isEditing }) {
  const queryClient = useQueryClient();
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewMap, setPreviewMap] = useState(() => new Map());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const signedUrlCache = useRef(new Map());
  const dragCounter = useRef(0);
  const fileInputRef = useRef(null);

  const filesQuery = useQuery({
    queryKey: ["hr-employee-files", employeeId],
    queryFn: () =>
      atlas.files.list(
        {
          moduleKey: "atlas.hr",
          entityType: "HrEmployee",
          sourceEntityId: employeeId,
          pageSize: 100,
        },
        token,
      ),
    enabled: Boolean(token && employeeId && !isNew),
  });

  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload) => {
      for (const file of filesToUpload) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          throw new Error(
            `"${file.name}" supera el límite de ${MAX_FILE_MB} MB.`,
          );
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("moduleKey", "atlas.hr");
        fd.append("entityType", "HrEmployee");
        fd.append("entityId", employeeId);
        await atlas.files.upload(fd, token);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-employee-files", employeeId],
      });
      queryClient.invalidateQueries({
        queryKey: ["hr-employee-audit", employeeId],
      });
      toast.success("Archivo(s) subidos correctamente");
    },
    onError: (err) =>
      toast.error(err?.message || "No se pudieron subir los archivos"),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId) => atlas.files.delete(fileId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hr-employee-files", employeeId],
      });
      queryClient.invalidateQueries({
        queryKey: ["hr-employee-audit", employeeId],
      });
      toast.success("Archivo eliminado");
    },
    onError: () => toast.error("No se pudo eliminar el archivo"),
  });

  // window-level drag & drop
  useEffect(() => {
    if (!token || isNew) return;

    function onDragEnter(e) {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      dragCounter.current++;
      setIsDragOver(true);
    }
    function onDragLeave() {
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setIsDragOver(false);
    }
    function onDrop(e) {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragOver(false);
      const dropped = Array.from(e.dataTransfer?.files || []);
      if (dropped.length) uploadMutation.mutate(dropped);
    }
    function onDragOver(e) {
      e.preventDefault();
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
    };
  }, [token, isNew, uploadMutation]);

  // load signed URL previews for images
  useEffect(() => {
    if (!token) return;
    const files = filesQuery.data?.data ?? [];
    for (const file of files) {
      const kind = getFileKind(file.mimeType);
      if (kind !== "image") continue;
      if (previewMap.has(file.id) || signedUrlCache.current.has(file.id))
        continue;
      atlas.files.getSignedUrl(file.id, token).then((res) => {
        const url = res?.data?.signedUrl;
        if (!url) return;
        signedUrlCache.current.set(file.id, url);
        setPreviewMap((prev) => new Map(prev).set(file.id, url));
      });
    }
  }, [filesQuery.data, token]);

  const files = filesQuery.data?.data ?? [];

  async function resolveSignedUrl(file) {
    let url = signedUrlCache.current.get(file.id);
    if (!url) {
      const res = await atlas.files.getSignedUrl(file.id, token);
      url = res?.data?.signedUrl;
      if (url) signedUrlCache.current.set(file.id, url);
    }
    return url;
  }

  function openViewer(file) {
    const idx = files.findIndex((f) => f.id === file.id);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerOpen(true);
  }

  function handleInputChange(e) {
    const picked = Array.from(e.target.files || []);
    if (picked.length) uploadMutation.mutate(picked);
    e.target.value = "";
  }

  if (isNew) {
    return (
      <SectionCard title="Documentos">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Guarda el colaborador para adjuntar archivos.
        </p>
      </SectionCard>
    );
  }

  return (
    <>
      {/* full-screen drag overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--background))]/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary bg-[hsl(var(--card))] px-16 py-12 shadow-2xl">
              <Upload className="h-12 w-12 text-primary" />
              <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
                Suelta los archivos aquí
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {ACCEPT_HINT}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionCard title="Documentos">
        {/* upload zone */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className={cn(
            "w-full rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
            "border-[hsl(var(--border))] hover:border-primary/60 hover:bg-[hsl(var(--muted))]/30",
            uploadMutation.isPending && "pointer-events-none opacity-60",
          )}
        >
          <Upload className="mx-auto mb-2 h-6 w-6 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {uploadMutation.isPending
              ? "Subiendo archivos..."
              : "Haz clic o arrastra archivos aquí"}
          </p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {ACCEPT_HINT}
          </p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={handleInputChange}
          accept="image/*,application/pdf,text/*,application/vnd.*,application/msword,application/json"
        />

        {/* file list */}
        {filesQuery.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        )}

        {!filesQuery.isLoading && files.length === 0 && (
          <p className="text-center text-xs text-[hsl(var(--muted-foreground))] py-2">
            Sin archivos adjuntos.
          </p>
        )}

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file) => {
              const kind = getFileKind(file.mimeType);
              const previewUrl = previewMap.get(file.id);
              return (
                <div
                  key={file.id}
                  className="group flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 transition-colors hover:bg-[hsl(var(--muted))]/20"
                >
                  {/* thumbnail — clickable to preview */}
                  <button
                    type="button"
                    onClick={() => openViewer(file)}
                    className="shrink-0 h-10 w-10 rounded-lg overflow-hidden border border-[hsl(var(--border))]/60 flex items-center justify-center bg-[hsl(var(--muted))] transition-opacity hover:opacity-80"
                  >
                    {kind === "image" && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileKindIcon
                        mimeType={file.mimeType}
                        className="h-5 w-5 text-[hsl(var(--muted-foreground))]"
                      />
                    )}
                  </button>

                  {/* info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-[hsl(var(--foreground))]">
                      {file.originalName}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {formatBytes(file.sizeBytes)} ·{" "}
                      {file.mimeType?.split("/")[1] ?? "archivo"}
                    </p>
                  </div>

                  {/* actions */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Ver archivo"
                      onClick={() => openViewer(file)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <a
                      href="#"
                      title="Descargar"
                      onClick={async (e) => {
                        e.preventDefault();
                        const res = await atlas.files.getSignedUrl(
                          file.id,
                          token,
                        );
                        const url = res?.data?.signedUrl;
                        if (url) {
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = file.originalName;
                          a.click();
                        }
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    {isEditing && (
                      <button
                        type="button"
                        title="Eliminar archivo"
                        disabled={deleteMutation.isPending}
                        onClick={() => setDeleteTarget(file)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="¿Eliminar archivo?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() =>
          toast.promise(
            deleteMutation
              .mutateAsync(deleteTarget.id)
              .then(() => setDeleteTarget(null)),
            {
              loading: "Eliminando...",
              success: "Archivo eliminado",
              error: "No se pudo eliminar el archivo",
            },
          )
        }
        loading={deleteMutation.isPending}
      >
        {deleteTarget && (
          <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-3 py-2.5">
            {/* thumbnail */}
            <div className="shrink-0 h-12 w-12 rounded-lg overflow-hidden border border-[hsl(var(--border))]/60 flex items-center justify-center bg-[hsl(var(--muted))]">
              {getFileKind(deleteTarget.mimeType) === "image" &&
              previewMap.get(deleteTarget.id) ? (
                <img
                  src={previewMap.get(deleteTarget.id)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <FileKindIcon
                  mimeType={deleteTarget.mimeType}
                  className="h-6 w-6 text-[hsl(var(--muted-foreground))]"
                />
              )}
            </div>
            {/* info */}
            <div className="min-w-0">
              <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                {deleteTarget.originalName}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {formatBytes(deleteTarget.sizeBytes)} ·{" "}
                {deleteTarget.mimeType?.split("/")[1] ?? "archivo"}
              </p>
            </div>
          </div>
        )}
      </ConfirmDialog>

      <AdvancedFileViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        files={files}
        activeIndex={viewerIndex}
        onIndexChange={setViewerIndex}
        onResolveSignedUrl={resolveSignedUrl}
      />
    </>
  );
}

// ── Audit diff helpers ─────────────────────────────────────────────────────────

const FIELD_LABELS = {
  employeeCode: "Código",
  userProfileId: "Cuenta de usuario",
  firstName: "Nombre(s)",
  lastName: "Apellidos",
  workEmail: "Correo laboral",
  personalEmail: "Correo personal",
  phone: "Teléfono",
  emergencyContactName: "Contacto de emergencia",
  emergencyContactPhone: "Tel. emergencia",
  jobTitle: "Puesto",
  department: "Departamento",
  managerName: "Supervisor",
  employmentType: "Tipo de empleo",
  workLocation: "Ubicación",
  hireDate: "Fecha de ingreso",
  terminationDate: "Fecha de baja",
  status: "Estado",
  notesMarkdown: "Notas",
  enabled: "Habilitado",
};

const ACTION_LABELS = {
  "hr.employee.create": "Colaborador creado",
  "hr.employee.update": "Campos actualizados",
  "hr.employee.enable": "Colaborador habilitado",
  "hr.employee.disable": "Colaborador deshabilitado",
  "hr.employee.file.attach": "Archivo adjuntado",
  "hr.employee.file.delete": "Archivo eliminado",
};

function computeDiff(before, after) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  for (const key of keys) {
    const oldVal = before[key];
    const newVal = after[key];
    const oldStr = oldVal == null ? "—" : String(oldVal);
    const newStr = newVal == null ? "—" : String(newVal);
    if (oldStr !== newStr) {
      changes.push({
        key,
        label: FIELD_LABELS[key] ?? key,
        oldVal: oldStr,
        newVal: newStr,
      });
    }
  }
  return changes;
}

function fmtFieldValue(val) {
  if (val === "—") return val;
  if (val === "true") return "Sí";
  if (val === "false") return "No";
  // ISO date
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try {
      return new Date(val).toLocaleString("es-MX", { dateStyle: "medium" });
    } catch {
      return val;
    }
  }
  const ET = {
    full_time: "Tiempo completo",
    part_time: "Medio tiempo",
    contractor: "Contratista",
    intern: "Practicante",
  };
  const ST = {
    active: "Activo",
    inactive: "Inactivo",
    vacation: "Vacaciones",
    terminated: "Baja",
  };
  return ET[val] ?? ST[val] ?? val;
}

// ── Audit detail modal ─────────────────────────────────────────────────────────

function AuditDetailModal({ log, onClose }) {
  if (!log) return null;
  const diff = computeDiff(log.before, log.after);
  const actionLabel = ACTION_LABELS[log.action] ?? log.action;
  const actor = log.actor?.displayName || log.actor?.email || "Sistema";
  const isFileEvent =
    log.action === "hr.employee.file.attach" ||
    log.action === "hr.employee.file.delete";
  const fileMeta = isFileEvent ? log.metadata : null;
  const isDelete = log.action === "hr.employee.file.delete";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--background))]/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
      >
        {/* header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[hsl(var(--border))]">
          <div>
            <p className="font-semibold text-[hsl(var(--foreground))]">
              {actionLabel}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {actor} · {fmtDate(log.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="max-h-96 overflow-auto px-5 py-4 space-y-3">
          {/* file event detail */}
          {fileMeta && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-3",
                isDelete
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5",
              )}
            >
              <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]">
                <FileKindIcon
                  mimeType={fileMeta.mimeType}
                  className={cn(
                    "h-5 w-5",
                    isDelete ? "text-red-500/70" : "text-emerald-600/70",
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                  {fileMeta.originalName ?? "Archivo desconocido"}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {fileMeta.mimeType?.split("/")[1] ?? "archivo"}
                  {fileMeta.fileId && (
                    <span className="ml-2 opacity-50 font-mono text-[10px]">
                      {fileMeta.fileId.slice(0, 8)}…
                    </span>
                  )}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full",
                  isDelete
                    ? "bg-red-500/10 text-red-500"
                    : "bg-emerald-500/10 text-emerald-600",
                )}
              >
                {isDelete ? "Eliminado" : "Adjuntado"}
              </span>
            </div>
          )}

          {/* field diff */}
          {!fileMeta && diff.length === 0 && !log.before && !log.after && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
              Sin detalle de cambios disponible para este evento.
            </p>
          )}
          {!fileMeta && diff.length === 0 && (log.before || log.after) && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
              Sin campos modificados registrados.
            </p>
          )}
          {diff.map((change, i) => (
            <div
              key={change.key}
              className={cn(
                "py-3 grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 text-sm",
                i < diff.length - 1 &&
                  "border-b border-[hsl(var(--border))]/50",
              )}
            >
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] pt-0.5">
                {change.label}
              </span>
              <div className="space-y-1 min-w-0">
                {change.oldVal !== "—" && (
                  <div className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 h-2 w-2 rounded-full bg-red-400/70" />
                    <span className="text-xs text-[hsl(var(--muted-foreground))] line-through wrap-break-word">
                      {fmtFieldValue(change.oldVal)}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 h-2 w-2 rounded-full bg-emerald-400/70" />
                  <span className="text-xs text-[hsl(var(--foreground))] wrap-break-word font-medium">
                    {fmtFieldValue(change.newVal)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ── Audit panel ───────────────────────────────────────────────────────────────

function AuditPanel({ employeeId, token, isNew }) {
  const [selectedLog, setSelectedLog] = useState(null);

  const auditQuery = useQuery({
    queryKey: ["hr-employee-audit", employeeId],
    queryFn: () => atlas.hr.getEmployeeAudit(employeeId, token, { limit: 50 }),
    enabled: Boolean(token && employeeId && !isNew),
  });

  const logs = auditQuery.data?.data ?? [];

  if (isNew) return null;

  return (
    <>
      <AnimatePresence>
        {selectedLog && (
          <AuditDetailModal
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
          />
        )}
      </AnimatePresence>

      <SectionCard title="Historial de cambios">
        <div className="space-y-1.5 max-h-80 overflow-auto pr-0.5">
          {auditQuery.isLoading && (
            <>
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </>
          )}
          {logs.map((log) => {
            const isFileEvent =
              log.action === "hr.employee.file.attach" ||
              log.action === "hr.employee.file.delete";
            const hasDiff = Boolean(log.before || log.after) || isFileEvent;
            const actionLabel = ACTION_LABELS[log.action] ?? log.action;
            const actor =
              log.actor?.displayName || log.actor?.email || "Sistema";
            return (
              <button
                key={log.id}
                type="button"
                onClick={() => hasDiff && setSelectedLog(log)}
                className={cn(
                  "w-full rounded-xl border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/20 px-3 py-2.5 text-left transition-colors",
                  hasDiff
                    ? "hover:bg-[hsl(var(--muted))]/50 hover:border-[hsl(var(--border))] cursor-pointer"
                    : "cursor-default",
                )}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">
                      {actionLabel}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {actor} · {fmtDate(log.createdAt)}
                    </p>
                  </div>
                  {hasDiff && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                  )}
                </div>
              </button>
            );
          })}
          {!auditQuery.isLoading && logs.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">
              Sin cambios registrados.
            </p>
          )}
        </div>
      </SectionCard>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HrEmployeeDetail({ employeeId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isNew = employeeId === "new";
  const [isEditing, setIsEditing] = useState(isNew);
  const [form, setForm] = useState(baseForm());
  const prevIdRef = useRef(null);

  const employeeQuery = useQuery({
    queryKey: ["hr-employee", employeeId],
    queryFn: () => atlas.hr.getEmployee(employeeId, token),
    enabled: Boolean(token && employeeId && !isNew),
  });

  const selected = employeeQuery.data?.data ?? null;

  const userOptionsQuery = useQuery({
    queryKey: ["hr-user-options"],
    queryFn: () => atlas.hr.listUserOptions(token, { limit: 100 }),
    enabled: Boolean(token),
  });
  const employeesQuery = useQuery({
    queryKey: ["hr-employees-all"],
    queryFn: () => atlas.hr.listEmployees(token, { limit: 500, enabled: true }),
    enabled: Boolean(token),
  });
  const departmentsQuery = useQuery({
    queryKey: ["hr-departments"],
    queryFn: () =>
      atlas.hr.listDepartments(token, { limit: 200, enabled: true }),
    enabled: Boolean(token),
  });
  const jobTitlesQuery = useQuery({
    queryKey: ["hr-job-titles"],
    queryFn: () => atlas.hr.listJobTitles(token, { limit: 200, enabled: true }),
    enabled: Boolean(token),
  });
  const profileImageQuery = useQuery({
    queryKey: ["hr-profile-image-url", selected?.profileImageFileId],
    queryFn: async () => {
      const res = await atlas.files.getSignedUrl(
        selected.profileImageFileId,
        token,
      );
      return res?.data?.signedUrl ?? "";
    },
    enabled: Boolean(token && selected?.profileImageFileId),
    staleTime: 2 * 60 * 1000,
  });

  const userOptions = (userOptionsQuery.data?.data ?? []).map((r) => ({
    value: r.id,
    label: `${r.label} (${r.email})`,
  }));
  const departmentOptions = (departmentsQuery.data?.data ?? []).map((row) => ({
    value: row.id,
    label: row.name,
  }));
  const jobTitleOptions = (jobTitlesQuery.data?.data ?? []).map((row) => ({
    value: row.id,
    label: row.name,
  }));
  const supervisorOptions = (employeesQuery.data?.data ?? [])
    .filter((row) => row.id !== selected?.id)
    .map((row) => ({
      value: row.id,
      label: nameOfEmployee(row),
    }));

  // sync form when employee first loads
  useEffect(() => {
    if (selected && selected.id !== prevIdRef.current) {
      prevIdRef.current = selected.id;
      setForm(fromEmployee(selected));
    }
  }, [selected]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = normalizeForApi(form);
      if (isNew) return atlas.hr.createEmployee(payload, token);
      return atlas.hr.updateEmployee(selected.id, payload, token);
    },
    onSuccess: (res) => {
      const createdId = res?.data?.id;
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      if (isNew && createdId) {
        navigate(`/app/m/atlas.hr/hr/employees/${createdId}`);
      } else {
        queryClient.invalidateQueries({
          queryKey: ["hr-employee", employeeId],
        });
        queryClient.invalidateQueries({
          queryKey: ["hr-employee-audit", employeeId],
        });
        setIsEditing(false);
      }
      toast.success("Colaborador guardado");
    },
    onError: (err) =>
      toast.error(err?.message || "No se pudo guardar el colaborador"),
  });

  const disableMutation = useMutation({
    mutationFn: () => atlas.hr.setEmployeeEnabled(selected.id, false, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-employee", employeeId] });
      toast.success("Colaborador deshabilitado");
    },
    onError: () => toast.error("No se pudo deshabilitar el colaborador"),
  });

  const createDepartmentMutation = useMutation({
    mutationFn: (name) =>
      atlas.hr.createDepartment({ name: name.trim() }, token),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["hr-departments"] });
      const created = res?.data;
      if (created?.id) {
        setForm((prev) => ({
          ...prev,
          departmentId: created.id,
          department: created.name ?? prev.department,
        }));
      }
      toast.success("Departamento creado");
    },
    onError: (err) =>
      toast.error(err?.message || "No se pudo crear el departamento"),
  });

  const createJobTitleMutation = useMutation({
    mutationFn: (name) => atlas.hr.createJobTitle({ name: name.trim() }, token),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["hr-job-titles"] });
      const created = res?.data;
      if (created?.id) {
        setForm((prev) => ({
          ...prev,
          jobTitleId: created.id,
          jobTitle: created.name ?? prev.jobTitle,
        }));
      }
      toast.success("Puesto creado");
    },
    onError: (err) => toast.error(err?.message || "No se pudo crear el puesto"),
  });

  const uploadProfileImageMutation = useMutation({
    mutationFn: async (file) => {
      if (!selected?.id) {
        throw new Error("Primero guarda el colaborador para cargar la foto.");
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("moduleKey", "atlas.hr");
      fd.append("entityType", "HrEmployee");
      fd.append("entityId", selected.id);
      const upload = await atlas.files.upload(fd, token);
      const fileId = upload?.data?.id;
      if (!fileId) {
        throw new Error("No se pudo procesar la foto de perfil.");
      }
      await atlas.hr.updateEmployee(
        selected.id,
        normalizeForApi({
          ...fromEmployee(selected),
          profileImageFileId: fileId,
        }),
        token,
      );
      return fileId;
    },
    onSuccess: (fileId) => {
      setForm((prev) => ({ ...prev, profileImageFileId: fileId }));
      queryClient.invalidateQueries({ queryKey: ["hr-employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["hr-profile-image-url"] });
      queryClient.invalidateQueries({
        queryKey: ["hr-employee-files", employeeId],
      });
      toast.success("Foto de perfil actualizada");
    },
    onError: (err) =>
      toast.error(err?.message || "No se pudo actualizar la foto"),
  });

  function startEdit() {
    if (selected) setForm(fromEmployee(selected));
    setIsEditing(true);
  }

  function cancelEdit() {
    if (selected) setForm(fromEmployee(selected));
    else setForm(baseForm());
    setIsEditing(false);
  }

  function field(key) {
    return isEditing ? form[key] : (selected?.[key] ?? "");
  }

  function set(key) {
    return (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  if (!isNew && employeeQuery.isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        <DossierSkeleton />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* back button */}
      <button
        type="button"
        onClick={() => navigate("/app/m/atlas.hr/hr/employees")}
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" />
        Colaboradores
      </button>

      {/* hero */}
      <HeroSection
        employee={selected}
        profileImageUrl={profileImageQuery.data}
        profileImageUploading={uploadProfileImageMutation.isPending}
        onUploadProfileImage={(file) => uploadProfileImageMutation.mutate(file)}
        isEditing={isEditing}
        isNew={isNew}
        saveMutation={saveMutation}
        disableMutation={disableMutation}
        onEdit={startEdit}
        onCancel={cancelEdit}
      />

      {/* two-column body */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* left: form sections */}
        <div className="space-y-4">
          {/* identidad */}
          <SectionCard title="Identidad">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <TextField
                label="Código"
                value={field("employeeCode")}
                onChange={set("employeeCode")}
                disabled={!isEditing}
              />
              <ComboboxField
                label="Cuenta de usuario"
                value={field("userProfileId") || "__none__"}
                options={[
                  { value: "__none__", label: "Sin vincular" },
                  ...userOptions,
                ]}
                onChange={(v) => {
                  if (!isEditing) return;
                  setForm((p) => ({
                    ...p,
                    userProfileId: v === "__none__" ? "" : v,
                  }));
                }}
                placeholder="Seleccionar cuenta..."
                searchPlaceholder="Buscar usuario..."
                className={cn(
                  "md:col-span-2",
                  !isEditing && "pointer-events-none opacity-70",
                )}
              />
              <SelectField
                label="Estado"
                value={field("status") || "active"}
                options={STATUS_OPTIONS}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
                disabled={!isEditing}
              />
              <TextField
                label="Nombre(s)"
                value={field("firstName")}
                onChange={set("firstName")}
                disabled={!isEditing}
              />
              <TextField
                label="Apellidos"
                value={field("lastName")}
                onChange={set("lastName")}
                disabled={!isEditing}
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
              Vinculación opcional con cuenta de usuario para trazabilidad y
              permisos.
              <button
                type="button"
                onClick={() =>
                  navigate("/app/m/atlas.identity/identity/users/new")
                }
                className="ml-2 font-medium text-[hsl(var(--primary))] hover:underline"
              >
                Ir a crear usuario
              </button>
            </div>
          </SectionCard>

          {/* datos laborales */}
          <SectionCard title="Datos laborales">
            <div className="grid gap-3 sm:grid-cols-2">
              <CreatableComboboxField
                label="Puesto"
                value={field("jobTitleId") || "__none__"}
                options={[
                  { value: "__none__", label: "Sin asignar" },
                  ...jobTitleOptions,
                ]}
                onChange={(v) => {
                  if (!isEditing) return;
                  const selectedOption = jobTitleOptions.find(
                    (opt) => opt.value === v,
                  );
                  setForm((p) => ({
                    ...p,
                    jobTitleId: v === "__none__" ? "" : v,
                    jobTitle:
                      v === "__none__"
                        ? ""
                        : (selectedOption?.label ?? p.jobTitle),
                  }));
                }}
                onCreate={(name) => {
                  if (!isEditing) return;
                  createJobTitleMutation.mutate(name);
                }}
                isCreating={createJobTitleMutation.isPending}
                placeholder="Seleccionar puesto..."
                searchPlaceholder="Buscar o crear puesto..."
                className={!isEditing ? "pointer-events-none opacity-70" : ""}
              />
              <CreatableComboboxField
                label="Departamento"
                value={field("departmentId") || "__none__"}
                options={[
                  { value: "__none__", label: "Sin asignar" },
                  ...departmentOptions,
                ]}
                onChange={(v) => {
                  if (!isEditing) return;
                  const selectedOption = departmentOptions.find(
                    (opt) => opt.value === v,
                  );
                  setForm((p) => ({
                    ...p,
                    departmentId: v === "__none__" ? "" : v,
                    department:
                      v === "__none__"
                        ? ""
                        : (selectedOption?.label ?? p.department),
                  }));
                }}
                onCreate={(name) => {
                  if (!isEditing) return;
                  createDepartmentMutation.mutate(name);
                }}
                isCreating={createDepartmentMutation.isPending}
                placeholder="Seleccionar departamento..."
                searchPlaceholder="Buscar o crear departamento..."
                className={!isEditing ? "pointer-events-none opacity-70" : ""}
              />
              <ComboboxField
                label="Supervisor"
                value={field("supervisorEmployeeId") || "__none__"}
                options={[
                  { value: "__none__", label: "Sin supervisor" },
                  ...supervisorOptions,
                ]}
                onChange={(v) => {
                  if (!isEditing) return;
                  const selectedOption = supervisorOptions.find(
                    (opt) => opt.value === v,
                  );
                  setForm((p) => ({
                    ...p,
                    supervisorEmployeeId: v === "__none__" ? "" : v,
                    managerName:
                      v === "__none__"
                        ? ""
                        : (selectedOption?.label ?? p.managerName),
                  }));
                }}
                placeholder="Seleccionar supervisor..."
                searchPlaceholder="Buscar colaborador..."
                className={cn(
                  "sm:col-span-2",
                  !isEditing && "pointer-events-none opacity-70",
                )}
              />
              <SelectField
                label="Tipo de empleo"
                value={field("employmentType") || "__none__"}
                options={[
                  { value: "__none__", label: "Sin especificar" },
                  ...EMPLOYMENT_TYPE_OPTIONS,
                ]}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    employmentType: v === "__none__" ? "" : v,
                  }))
                }
                disabled={!isEditing}
              />
              <TextField
                label="Ubicacion de trabajo"
                value={field("workLocation")}
                onChange={set("workLocation")}
                disabled={!isEditing}
              />
              <DateField
                label="Fecha de ingreso"
                value={
                  isEditing
                    ? form.hireDate
                    : selected?.hireDate
                      ? new Date(selected.hireDate).toISOString().slice(0, 10)
                      : ""
                }
                onChange={set("hireDate")}
                disabled={!isEditing}
              />
              <DateField
                label="Fecha de baja"
                value={
                  isEditing
                    ? form.terminationDate
                    : selected?.terminationDate
                      ? new Date(selected.terminationDate)
                          .toISOString()
                          .slice(0, 10)
                      : ""
                }
                onChange={set("terminationDate")}
                disabled={!isEditing}
              />
            </div>
          </SectionCard>

          {/* contacto */}
          <SectionCard title="Contacto">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Correo laboral"
                value={field("workEmail")}
                onChange={set("workEmail")}
                disabled={!isEditing}
              />
              <TextField
                label="Correo personal"
                value={field("personalEmail")}
                onChange={set("personalEmail")}
                disabled={!isEditing}
              />
              <TextField
                label="Telefono"
                value={field("phone")}
                onChange={set("phone")}
                disabled={!isEditing}
              />
              <TextField
                label="Contacto de emergencia"
                value={field("emergencyContactName")}
                onChange={set("emergencyContactName")}
                disabled={!isEditing}
              />
              <TextField
                label="Telefono de emergencia"
                value={field("emergencyContactPhone")}
                onChange={set("emergencyContactPhone")}
                disabled={!isEditing}
              />
            </div>
          </SectionCard>

          {/* notas */}
          <SectionCard title="Notas">
            {isEditing ? (
              <MarkdownField
                label="Observaciones"
                value={form.notesMarkdown}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notesMarkdown: e.target.value }))
                }
                maxLength={10000}
              />
            ) : (
              <MarkdownField readOnly value={selected?.notesMarkdown || ""} />
            )}
          </SectionCard>
        </div>

        {/* right: files + audit */}
        <div className="space-y-4">
          <FilesPanel
            employeeId={isNew ? null : employeeId}
            token={token}
            isNew={isNew}
            isEditing={isEditing}
          />
          <AuditPanel
            employeeId={isNew ? null : employeeId}
            token={token}
            isNew={isNew}
          />
        </div>
      </div>
    </motion.div>
  );
}
