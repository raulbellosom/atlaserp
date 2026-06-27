import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Button } from "@atlas/ui";
import {
  Send, Paperclip, Smile, X, Loader2, AlertCircle, Mic,
  Play, FileText, FileType2, FileSpreadsheet, FileImage, FileVideo, FileAudio,
  FileArchive, FileCode, File as FileIcon,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { useChatUpload } from "../hooks/useChatUpload";
import { formatFileSize } from "../lib/chatUtils";

// Preferred audio MIME type for recording — safe for iOS (audio/mp4 only) and Android
function getRecordingMime() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];
  return candidates.find((m) => {
    try { return MediaRecorder.isTypeSupported(m); }
    catch { return false; }
  }) ?? "audio/mp4"; // audio/mp4 is the iOS fallback (Safari 14.3+)
}

function mimeToExt(mimeType) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function fileTypeIcon(mimeType) {
  const m = String(mimeType ?? "").toLowerCase();
  if (m.startsWith("image/"))   return <FileImage className="h-5 w-5 text-blue-400" />;
  if (m.startsWith("video/"))   return <FileVideo className="h-5 w-5 text-orange-400" />;
  if (m.startsWith("audio/"))   return <FileAudio className="h-5 w-5 text-emerald-400" />;
  if (m === "application/pdf")  return <FileText className="h-5 w-5 text-red-400" />;
  if (m.includes("spreadsheet") || m.includes("excel")) return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
  if (m.includes("word") || m.includes("document"))     return <FileType2 className="h-5 w-5 text-blue-400" />;
  if (m.includes("zip") || m.includes("archive") || m.includes("compressed")) return <FileArchive className="h-5 w-5 text-yellow-400" />;
  if (m.startsWith("text/"))    return <FileCode className="h-5 w-5 text-purple-400" />;
  return <FileIcon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />;
}

function RemoveBtn({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors touch-manipulation z-10"
      aria-label="Quitar"
    >
      <X className="h-3 w-3 text-white" />
    </button>
  );
}

function StatusOverlay({ uploading, error }) {
  if (uploading) return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl pointer-events-none">
      <Loader2 className="h-4 w-4 animate-spin text-white" />
    </div>
  );
  if (error) return (
    <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center rounded-xl pointer-events-none">
      <AlertCircle className="h-4 w-4 text-white" />
    </div>
  );
  return null;
}

function AttachmentPreviewCard({ entry, onRemove }) {
  const mime = entry.file.type;
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");

  // ── Image thumbnail ──────────────────────────────────────────────────────
  if (isImage && entry.objectUrl) {
    return (
      <div className="relative h-20 w-20 rounded-xl overflow-hidden shrink-0 bg-[hsl(var(--muted))]">
        <img src={entry.objectUrl} alt="" className="h-full w-full object-cover" />
        <StatusOverlay uploading={entry.uploading} error={entry.error} />
        <RemoveBtn onClick={() => onRemove(entry.localId)} />
      </div>
    );
  }

  // ── Video thumbnail ──────────────────────────────────────────────────────
  if (isVideo) {
    return (
      <div className="relative h-20 w-20 rounded-xl overflow-hidden shrink-0 bg-black/25">
        {entry.objectUrl && (
          <video
            src={`${entry.objectUrl}#t=0.001`}
            preload="auto"
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-7 w-7 rounded-full bg-black/55 flex items-center justify-center">
            <Play className="h-3.5 w-3.5 text-white fill-white ml-0.5" />
          </div>
        </div>
        <StatusOverlay uploading={entry.uploading} error={entry.error} />
        <RemoveBtn onClick={() => onRemove(entry.localId)} />
      </div>
    );
  }

  // ── Audio / voice note ───────────────────────────────────────────────────
  if (isAudio) {
    return (
      <div className="relative flex items-center gap-2.5 bg-[hsl(var(--muted))] rounded-xl px-3 py-2.5 shrink-0 pr-8" style={{ maxWidth: 200 }}>
        <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Mic className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-tight">Nota de voz</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
            {formatFileSize(entry.file.size)}
            {entry.uploading && " · Subiendo..."}
            {entry.error && <span className="text-red-500"> · Error</span>}
          </p>
        </div>
        <RemoveBtn onClick={() => onRemove(entry.localId)} />
      </div>
    );
  }

  // ── Generic file ─────────────────────────────────────────────────────────
  return (
    <div className="relative flex items-center gap-2.5 bg-[hsl(var(--muted))] rounded-xl px-3 py-2.5 shrink-0 pr-8" style={{ maxWidth: 200 }}>
      <div className="h-8 w-8 rounded-full bg-[hsl(var(--border))] flex items-center justify-center shrink-0">
        {fileTypeIcon(mime)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate leading-tight">{entry.file.name}</p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
          {formatFileSize(entry.file.size)}
          {entry.uploading && " · Subiendo..."}
          {entry.error && <span className="text-red-500"> · Error</span>}
        </p>
      </div>
      <RemoveBtn onClick={() => onRemove(entry.localId)} />
    </div>
  );
}

export const MessageComposer = forwardRef(function MessageComposer(
  {
    onSend,
    onTyping,
    disabled,
    placeholder = "Escribe un mensaje...",
    compact = false,
    conversationId,
  },
  ref,
) {
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState(null);

  const textareaRef = useRef(null);
  const emojiContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeout = useRef(null);
  const isTypingRef = useRef(false);
  const uploadingRef = useRef({});
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const voiceAutoSendRef = useRef(false);
  const handleSendRef = useRef(null);

  const { uploadFile } = useChatUpload(conversationId);

  useImperativeHandle(ref, () => ({
    addFiles: (files) => addFilesToQueue(files),
  }));

  function addFilesToQueue(files) {
    const entries = Array.from(files).map((file) => ({
      localId: `${Date.now()}-${Math.random()}`,
      file,
      objectUrl: (file.type.startsWith("image/") || file.type.startsWith("video/")) ? URL.createObjectURL(file) : null,
      uploading: Boolean(conversationId),
      done: !conversationId,
      error: null,
      attachmentId: null,
    }));
    setPendingFiles((prev) => [...prev, ...entries]);
    if (conversationId) {
      for (const entry of entries) startUpload(entry);
    }
  }

  function startUpload(entry) {
    const promise = uploadFile(entry.file)
      .then((attachmentId) => {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.localId === entry.localId ? { ...f, uploading: false, done: true, attachmentId } : f,
          ),
        );
        return attachmentId;
      })
      .catch((err) => {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.localId === entry.localId
              ? { ...f, uploading: false, error: err?.message ?? "Error al subir" }
              : f,
          ),
        );
        return null;
      });
    uploadingRef.current[entry.localId] = promise;
  }

  useEffect(() => {
    return () => {
      for (const f of pendingFiles) {
        if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Voice recording ──────────────────────────────────────────────────────
  async function startRecording() {
    setRecordingError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecordingError("Grabacion de audio no disponible en este dispositivo.");
      return;
    }
    const mimeType = getRecordingMime();
    if (!mimeType) {
      setRecordingError("Formato de audio no soportado en este dispositivo.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordTimerRef.current);
        const ext = mimeToExt(mimeType);
        const baseMime = mimeType.split(";")[0];
        const blob = new Blob(audioChunksRef.current, { type: baseMime });
        const now = new Date();
        const ts = `${now.getHours().toString().padStart(2,"0")}-${now.getMinutes().toString().padStart(2,"0")}-${now.getSeconds().toString().padStart(2,"0")}`;
        const file = new File([blob], `nota_de_voz_${ts}.${ext}`, { type: baseMime });
        setRecording(false);
        setRecordSeconds(0);
        voiceAutoSendRef.current = true;
        addFilesToQueue([file]);
      };

      recorder.start(100);
      recorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      const msg = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
        ? "Permiso de microfono denegado."
        : "No se pudo iniciar la grabacion.";
      setRecordingError(msg);
    }
  }

  function stopRecording(discard = false) {
    clearInterval(recordTimerRef.current);
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (discard) {
      recorder.ondataavailable = null;
      recorder.onstop = () => {
        recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setRecordSeconds(0);
      };
    }
    recorder.stop();
  }

  useEffect(() => {
    return () => {
      clearInterval(recordTimerRef.current);
      if (recorderRef.current?.state !== "inactive") {
        recorderRef.current?.stop();
      }
    };
  }, []);

  // ── File queue ───────────────────────────────────────────────────────────
  function removeFile(localId) {
    setPendingFiles((prev) => {
      const entry = prev.find((f) => f.localId === localId);
      if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
      return prev.filter((f) => f.localId !== localId);
    });
    delete uploadingRef.current[localId];
  }

  // ── Emoji ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showEmoji) return;
    function handlePointerDown(e) {
      if (!emojiContainerRef.current?.contains(e.target)) setShowEmoji(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showEmoji]);

  const insertEmoji = useCallback(
    (emojiData) => {
      const emoji = emojiData.emoji;
      const textarea = textareaRef.current;
      if (!textarea) { setBody((prev) => prev + emoji); return; }
      const start = textarea.selectionStart ?? body.length;
      const end = textarea.selectionEnd ?? body.length;
      setBody(body.slice(0, start) + emoji + body.slice(end));
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + emoji.length;
        textarea.setSelectionRange(pos, pos);
      });
    },
    [body],
  );

  // ── Typing ───────────────────────────────────────────────────────────────
  const handleChange = useCallback(
    (e) => {
      setBody(e.target.value);
      if (!isTypingRef.current) { isTypingRef.current = true; onTyping?.(true); }
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => { isTypingRef.current = false; onTyping?.(false); }, 2000);
    },
    [onTyping],
  );

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    const hasFiles = pendingFiles.length > 0;
    if ((!trimmed && !hasFiles) || isSending) return;

    clearTimeout(typingTimeout.current);
    isTypingRef.current = false;
    onTyping?.(false);
    setIsSending(true);
    setShowEmoji(false);

    try {
      const results = await Promise.allSettled(
        pendingFiles.map((f) => uploadingRef.current[f.localId]).filter(Boolean),
      );
      const attachmentIds = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value);

      await onSend({
        body: trimmed || null,
        messageType: hasFiles && !trimmed ? "file" : "text",
        attachmentIds,
      });

      setBody("");
      setPendingFiles([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [body, isSending, onSend, onTyping, pendingFiles]);

  // Keep ref in sync so the auto-send effect never holds a stale closure
  handleSendRef.current = handleSend;

  // ── Voice auto-send ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!voiceAutoSendRef.current) return;
    if (pendingFiles.length === 0) return;
    voiceAutoSendRef.current = false;
    handleSendRef.current();
  }, [pendingFiles]);

  const handleKeyDown = useCallback(
    (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } },
    [handleSend],
  );

  function handleFileInputChange(e) {
    if (e.target.files?.length) addFilesToQueue(Array.from(e.target.files));
    e.target.value = "";
  }

  function handleDragOver(e) { e.preventDefault(); setIsDragOver(true); }
  function handleDragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }
  function handleDrop(e) {
    e.preventDefault(); setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFilesToQueue(files);
  }

  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const btnSize = compact ? "h-6 w-6" : "h-8 w-8";

  return (
    <div
      className={[
        "border-t border-[hsl(var(--border))] relative shrink-0 transition-colors",
        compact ? "px-2 py-1.5" : "px-3 py-2 sm:px-4 sm:py-3 safe-bottom",
        isDragOver ? "bg-[hsl(var(--primary)/0.05)]" : "",
      ].join(" ")}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-[hsl(var(--primary))] rounded-lg bg-[hsl(var(--primary)/0.08)] pointer-events-none">
          <p className="text-xs font-medium text-[hsl(var(--primary))]">Suelta los archivos aqui</p>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div
          ref={emojiContainerRef}
          className={[
            "absolute bottom-full mb-2 z-50 shadow-xl rounded-xl overflow-hidden",
            compact ? "left-2" : "left-3 sm:left-4",
          ].join(" ")}
        >
          <EmojiPicker
            onEmojiClick={insertEmoji}
            theme="dark"
            width={compact ? 230 : 300}
            height={compact ? 280 : 360}
            searchPlaceholder="Buscar emoji..."
            lazyLoadEmojis
            skinTonesDisabled
          />
        </div>
      )}

      {/* Recording error */}
      {recordingError && (
        <div className="flex items-center gap-1.5 mb-1.5 text-red-500 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{recordingError}</span>
        </div>
      )}

      {/* Attachment previews */}
      {pendingFiles.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1 mb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {pendingFiles.map((entry) => (
            <AttachmentPreviewCard key={entry.localId} entry={entry} onRemove={removeFile} />
          ))}
        </div>
      )}

      {/* ── Recording mode ── */}
      {recording ? (
        <div className="flex items-center gap-2 bg-[hsl(var(--muted))] rounded-2xl px-3 py-2">
          {/* Cancel */}
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="shrink-0 flex items-center justify-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:border-red-400 transition-colors touch-manipulation h-8 w-8"
            title="Cancelar nota de voz"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Red pulse dot + timer */}
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm font-mono tabular-nums flex-1 text-center">
            {formatDuration(recordSeconds)}
          </span>

          {/* Send */}
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="shrink-0 flex items-center justify-center rounded-full bg-(--brand-primary) text-(--brand-primary-foreground) hover:opacity-90 active:scale-95 transition-all touch-manipulation h-8 w-8"
            title="Enviar nota de voz"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-2xl px-2 py-1.5">
          {/* Paperclip */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,audio/*,video/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.*,application/zip"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={[
              "shrink-0 flex items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))] transition-colors touch-manipulation",
              btnSize,
            ].join(" ")}
            title="Adjuntar archivo"
            disabled={disabled}
          >
            <Paperclip className={iconSize} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className={[
              "flex-1 bg-transparent resize-none outline-none placeholder:text-[hsl(var(--muted-foreground))] leading-tight",
              compact ? "text-xs min-h-7 max-h-20 py-1" : "text-sm min-h-9 max-h-32 py-2",
            ].join(" ")}
            rows={1}
            placeholder={placeholder}
            value={body}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSending}
            style={{ height: compact ? "28px" : "36px" }}
            onInput={(e) => {
              const base = compact ? "28px" : "36px";
              const max = compact ? 80 : 128;
              e.target.style.height = base;
              e.target.style.height = `${Math.min(e.target.scrollHeight, max)}px`;
            }}
          />

          {/* Emoji */}
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            disabled={disabled}
            className={[
              "shrink-0 flex items-center justify-center rounded-full transition-colors touch-manipulation",
              btnSize,
              showEmoji
                ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))]",
            ].join(" ")}
            title="Emojis"
          >
            <Smile className={iconSize} />
          </button>

          {/* Mic — only shown when nothing typed and no pending files */}
          {!body.trim() && !pendingFiles.length && (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              className={[
                "shrink-0 flex items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))] transition-colors touch-manipulation",
                btnSize,
              ].join(" ")}
              title="Nota de voz"
            >
              <Mic className={iconSize} />
            </button>
          )}

          {/* Send */}
          <Button
            size="sm"
            className={["shrink-0 rounded-full p-0 touch-manipulation", btnSize].join(" ")}
            onClick={handleSend}
            disabled={(!body.trim() && !pendingFiles.length) || isSending || disabled}
          >
            {isSending ? (
              <Loader2 className={compact ? "h-3 w-3 animate-spin" : "h-3.5 w-3.5 animate-spin"} />
            ) : (
              <Send className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            )}
          </Button>
        </div>
      )}

      {!compact && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 ml-1 hidden sm:block">
          Intro para enviar · Shift+Intro para nueva linea
        </p>
      )}
    </div>
  );
});
