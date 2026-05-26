import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  Tag,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Strikethrough,
  Undo2,
  Redo2,
  Code,
  Quote,
  ListChecks,
  Link2,
  Link2Off,
  Minus,
  Type,
  Search,
  Plus,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "../lib/utils.js";

// ─── Base styles ──────────────────────────────────────────────────────────────

const FIELD_BASE = [
  "h-11 w-full rounded-lg border px-3.5 text-sm glass-subtle",
  "bg-card text-foreground placeholder:text-muted-foreground",
  "transition-all duration-150 outline-none",
  "focus:ring-2 focus:ring-primary/20 focus:border-primary",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

const FIELD_NORMAL = "border-border";
const FIELD_ERROR =
  "border-destructive focus:ring-destructive/20 focus:border-destructive";

function fieldCls(error, extra) {
  return cn(FIELD_BASE, error ? FIELD_ERROR : FIELD_NORMAL, extra);
}

// ─── InputIcon ────────────────────────────────────────────────────────────────

function InputIcon({ icon: Icon }) {
  if (!Icon) return null;
  return (
    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none z-10">
      <Icon size={14} strokeWidth={1.75} />
    </span>
  );
}

// ─── FieldWrapper ─────────────────────────────────────────────────────────────

export function FieldWrapper({
  label,
  labelFor,
  required,
  error,
  hint,
  children,
  className,
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={labelFor}
          className="text-[13px] font-medium leading-none text-foreground/80 select-none cursor-default"
        >
          {label}
          {required && (
            <span
              className="text-destructive ml-1 text-[11px]"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive leading-none"
        >
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

// ─── TextField ────────────────────────────────────────────────────────────────

export const TextField = forwardRef(function TextField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    id,
    icon,
    className,
    ...props
  },
  ref,
) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;

  function handleBlur(e) {
    if (validate) setLocalError(validate(e.target.value) || "");
    onBlur?.(e);
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative">
        <input
          ref={ref}
          id={id}
          className={fieldCls(error, cn(icon && "pl-9", className))}
          onBlur={handleBlur}
          {...props}
        />
        <InputIcon icon={icon} />
      </div>
    </FieldWrapper>
  );
});

// ─── PasswordField ────────────────────────────────────────────────────────────

function calcStrength(pw) {
  if (!pw || pw.length < 1) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

const STRENGTH_META = [
  null,
  {
    label: "Muy débil",
    color: "bg-destructive",
    tip: "Agrega más caracteres para mejorar la seguridad.",
  },
  {
    label: "Débil",
    color: "bg-warning",
    tip: "Agrega una mayúscula o un número.",
  },
  {
    label: "Buena",
    color: "bg-primary/70",
    tip: "Agrega un símbolo para hacerla más fuerte.",
  },
  {
    label: "Fuerte",
    color: "bg-success",
    tip: "Excelente. Tu contraseña es segura.",
  },
];

const STRENGTH_CRITERIA = [
  { label: "Al menos 8 caracteres", test: (pw) => pw.length >= 8 },
  { label: "Al menos 12 caracteres", test: (pw) => pw.length >= 12 },
  { label: "Una letra mayúscula", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Un número", test: (pw) => /[0-9]/.test(pw) },
  { label: "Un símbolo (!@#$…)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function PasswordField({
  label,
  error: externalError,
  hint,
  required,
  validate,
  onBlur,
  id,
  icon,
  showStrength = false,
  value,
  onChange,
  className,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState("");
  const [focused, setFocused] = useState(false);
  const error = externalError || localError;
  const strength = showStrength ? calcStrength(value || "") : 0;
  const meta = STRENGTH_META[strength];

  function handleBlur(e) {
    setFocused(false);
    if (validate) setLocalError(validate(e.target.value) || "");
    onBlur?.(e);
  }

  const showBar = showStrength && value && value.length > 0;

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          className={fieldCls(error, cn(icon && "pl-9", "pr-11", className))}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          autoComplete="new-password"
          {...props}
        />
        <InputIcon icon={icon} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 z-10"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>

      {showBar && (
        <div className="mt-3 space-y-2.5">
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-300",
                    i <= strength ? meta?.color : "bg-muted",
                  )}
                />
              ))}
            </div>
            {meta && (
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    strength === 1 && "text-destructive",
                    strength === 2 && "text-warning",
                    strength === 3 && "text-primary/80",
                    strength === 4 && "text-success",
                  )}
                >
                  {meta.label}
                </span>
                <span className="text-[11px] text-muted-foreground text-right leading-snug">
                  {meta.tip}
                </span>
              </div>
            )}
          </div>
          {(focused || strength < 4) && (
            <ul className="grid grid-cols-1 gap-1 pt-2 border-t border-border/40">
              {STRENGTH_CRITERIA.map(({ label, test }) => {
                const met = test(value || "");
                return (
                  <li
                    key={label}
                    className={cn(
                      "flex items-center gap-2 text-[11px] transition-colors duration-200",
                      met ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                        met ? "bg-success/15" : "bg-muted",
                      )}
                    >
                      {met && (
                        <Check
                          size={8}
                          strokeWidth={3}
                          className="text-success"
                        />
                      )}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </FieldWrapper>
  );
}

// ─── TextareaField ────────────────────────────────────────────────────────────

export const TextareaField = forwardRef(function TextareaField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    id,
    maxLength,
    value,
    onChange,
    className,
    rows = 4,
    ...props
  },
  ref,
) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;
  const charCount = typeof value === "string" ? value.length : 0;

  function handleBlur(e) {
    if (validate) setLocalError(validate(e.target.value) || "");
    onBlur?.(e);
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        onBlur={handleBlur}
        className={cn(
          "w-full rounded-lg border px-3.5 py-3 text-sm glass-subtle bg-card resize-y",
          "min-h-25 text-foreground placeholder:text-muted-foreground",
          "transition-all duration-150 outline-none",
          "focus:ring-2 focus:ring-primary/20 focus:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? FIELD_ERROR : FIELD_NORMAL,
          className,
        )}
        {...props}
      />
      {maxLength && (
        <p className="text-right text-[11px] text-muted-foreground -mt-0.5">
          {charCount} / {maxLength}
        </p>
      )}
    </FieldWrapper>
  );
});

// ─── WYSIWYG Markdown toolbar button ─────────────────────────────────────────

function ToolbarBtn({ onClick, active, disabled, icon: Icon, title }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        disabled && "pointer-events-none opacity-30",
      )}
    >
      <Icon size={13} />
    </button>
  );
}

// ─── WYSIWYG MarkdownField ────────────────────────────────────────────────────

export const MarkdownField = forwardRef(function MarkdownField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    id,
    maxLength = 5000,
    value,
    onChange,
    className,
    disabled,
    readOnly,
    readOnlyPlain = false,
    rows = 8,
    ...props
  },
  _ref,
) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;

  const [linkPopover, setLinkPopover] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const linkInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        code: true,
        link: false,
        horizontalRule: true,
      }),
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: "Escribe tus observaciones aquí...",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({
        html: false,
        tightLists: true,
        tightListClass: "tight",
        bulletListMarker: "-",
        linkify: false,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: value || "",
    contentType: "markdown",
    editable: !disabled && !readOnly,
    onUpdate({ editor }) {
      const md = editor.storage.markdown.getMarkdown();
      onChange?.({ target: { value: md } });
    },
    onBlur({ event }) {
      if (validate) {
        const md = editor.storage.markdown.getMarkdown();
        setLocalError(validate(md) || "");
      }
      onBlur?.(event);
    },
  });

  // Sync external value changes (e.g. form reset / load) without triggering onUpdate loop
  const lastPushed = useRef(value);
  useEffect(() => {
    if (!editor) return;
    const current = editor.storage.markdown.getMarkdown();
    const incoming = value ?? "";
    if (incoming !== current && incoming !== lastPushed.current) {
      lastPushed.current = incoming;
      try {
        editor.commands.setContent(incoming, {
          contentType: "markdown",
          emitUpdate: false,
        });
      } catch {
        editor.commands.setContent(incoming, false);
      }
    }
  }, [value, editor]);

  // Sync editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled && !readOnly);
  }, [disabled, readOnly, editor]);

  const charCount = typeof value === "string" ? value.length : 0;

  // heading dropdown state
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingRef = useRef(null);

  // close heading dropdown on outside click
  useEffect(() => {
    if (!headingOpen) return;
    function handler(e) {
      if (headingRef.current && !headingRef.current.contains(e.target)) {
        setHeadingOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [headingOpen]);

  // close link popover on outside click
  const linkPopoverRef = useRef(null);
  useEffect(() => {
    if (!linkPopover) return;
    function handler(e) {
      if (
        linkPopoverRef.current &&
        !linkPopoverRef.current.contains(e.target)
      ) {
        setLinkPopover(false);
        setLinkHref("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [linkPopover]);

  function applyLink() {
    if (!linkHref.trim()) {
      editor?.chain().focus().unsetLink().run();
    } else {
      const href = linkHref.trim().startsWith("http")
        ? linkHref.trim()
        : `https://${linkHref.trim()}`;
      editor?.chain().focus().setLink({ href }).run();
    }
    setLinkPopover(false);
    setLinkHref("");
  }

  function openLinkPopover() {
    const existing = editor?.getAttributes("link").href || "";
    setLinkHref(existing);
    setLinkPopover(true);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  }

  // current heading label
  function getHeadingLabel() {
    if (editor?.isActive("heading", { level: 1 })) return "H1";
    if (editor?.isActive("heading", { level: 2 })) return "H2";
    if (editor?.isActive("heading", { level: 3 })) return "H3";
    return "T";
  }

  const headingOptions = [
    {
      label: "Párrafo",
      icon: Type,
      active: !editor?.isActive("heading"),
      action: () => {
        editor?.chain().focus().setParagraph().run();
        setHeadingOpen(false);
      },
    },
    {
      label: "Título 1",
      icon: Heading1,
      active: editor?.isActive("heading", { level: 1 }),
      action: () => {
        editor?.chain().focus().toggleHeading({ level: 1 }).run();
        setHeadingOpen(false);
      },
    },
    {
      label: "Título 2",
      icon: Heading2,
      active: editor?.isActive("heading", { level: 2 }),
      action: () => {
        editor?.chain().focus().toggleHeading({ level: 2 }).run();
        setHeadingOpen(false);
      },
    },
    {
      label: "Título 3",
      icon: Heading3,
      active: editor?.isActive("heading", { level: 3 }),
      action: () => {
        editor?.chain().focus().toggleHeading({ level: 3 }).run();
        setHeadingOpen(false);
      },
    },
  ];

  const inlineItems = [
    {
      icon: Bold,
      title: "Negrita",
      active: editor?.isActive("bold"),
      action: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      title: "Cursiva",
      active: editor?.isActive("italic"),
      action: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      icon: Strikethrough,
      title: "Tachado",
      active: editor?.isActive("strike"),
      action: () => editor?.chain().focus().toggleStrike().run(),
    },
    {
      icon: Code,
      title: "Código",
      active: editor?.isActive("code"),
      action: () => editor?.chain().focus().toggleCode().run(),
    },
  ];

  const blockItems = [
    {
      icon: List,
      title: "Lista",
      active: editor?.isActive("bulletList"),
      action: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      title: "Lista numerada",
      active: editor?.isActive("orderedList"),
      action: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: ListChecks,
      title: "Lista de tareas",
      active: editor?.isActive("taskList"),
      action: () => editor?.chain().focus().toggleTaskList().run(),
    },
    {
      icon: Quote,
      title: "Cita",
      active: editor?.isActive("blockquote"),
      action: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: Minus,
      title: "Divisor",
      active: false,
      action: () => editor?.chain().focus().setHorizontalRule().run(),
    },
  ];

  const historyItems = [
    {
      icon: Undo2,
      title: "Deshacer",
      active: false,
      disabled: !editor?.can().undo(),
      action: () => editor?.chain().focus().undo().run(),
    },
    {
      icon: Redo2,
      title: "Rehacer",
      active: false,
      disabled: !editor?.can().redo(),
      action: () => editor?.chain().focus().redo().run(),
    },
  ];

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div
        className={cn(
          readOnlyPlain
            ? "bg-transparent border-0 rounded-none overflow-visible"
            : "rounded-lg border bg-card overflow-hidden transition-colors",
          !readOnlyPlain && (error ? "border-destructive" : "border-border"),
          !readOnlyPlain &&
            !disabled &&
            !readOnly &&
            "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
          disabled && "opacity-60 cursor-not-allowed",
          readOnly && "cursor-default select-text",
          className,
        )}
      >
        {/* toolbar */}
        {!disabled && !readOnly && (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5 bg-muted/20">
            {/* heading dropdown */}
            <div className="relative" ref={headingRef}>
              <button
                type="button"
                title="Estilo de texto"
                onClick={() => setHeadingOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-semibold transition-colors",
                  "text-muted-foreground hover:bg-accent hover:text-foreground",
                  editor?.isActive("heading") && "bg-accent text-foreground",
                )}
              >
                <span className="w-5 text-center font-mono">
                  {getHeadingLabel()}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {headingOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 min-w-35 rounded-lg border border-border bg-[hsl(var(--card))] shadow-lg overflow-hidden">
                  {headingOptions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={opt.action}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors text-left",
                        "hover:bg-accent hover:text-foreground text-foreground/80",
                        opt.active && "bg-accent text-foreground font-medium",
                      )}
                    >
                      <opt.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="mx-0.5 h-4 w-px bg-border shrink-0" />

            {/* inline formatting */}
            {inlineItems.map((item) => (
              <ToolbarBtn
                key={item.title}
                icon={item.icon}
                title={item.title}
                active={item.active}
                onClick={item.action}
              />
            ))}

            <span className="mx-0.5 h-4 w-px bg-border shrink-0" />

            {/* block elements */}
            {blockItems.map((item) => (
              <ToolbarBtn
                key={item.title}
                icon={item.icon}
                title={item.title}
                active={item.active}
                onClick={item.action}
              />
            ))}

            <span className="mx-0.5 h-4 w-px bg-border shrink-0" />

            {/* link */}
            <div className="relative" ref={linkPopoverRef}>
              <ToolbarBtn
                icon={editor?.isActive("link") ? Link2Off : Link2}
                title={
                  editor?.isActive("link") ? "Quitar enlace" : "Insertar enlace"
                }
                active={editor?.isActive("link")}
                onClick={() => {
                  if (editor?.isActive("link")) {
                    editor.chain().focus().unsetLink().run();
                  } else {
                    openLinkPopover();
                  }
                }}
              />
              {linkPopover && (
                <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-lg border border-border bg-[hsl(var(--card))] shadow-lg p-2.5 flex gap-2">
                  <input
                    ref={linkInputRef}
                    type="url"
                    value={linkHref}
                    onChange={(e) => setLinkHref(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyLink();
                      }
                      if (e.key === "Escape") {
                        setLinkPopover(false);
                        setLinkHref("");
                      }
                    }}
                    placeholder="https://..."
                    className="flex-1 min-w-0 h-7 rounded-md border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={applyLink}
                    className="shrink-0 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>

            <span className="mx-0.5 h-4 w-px bg-border shrink-0" />

            {/* history */}
            {historyItems.map((item) => (
              <ToolbarBtn
                key={item.title}
                icon={item.icon}
                title={item.title}
                active={item.active}
                disabled={item.disabled}
                onClick={item.action}
              />
            ))}
          </div>
        )}

        {/* editor area */}
        <EditorContent
          editor={editor}
          className={cn(
            "wysiwyg-editor text-sm text-foreground",
            readOnlyPlain ? "px-0 py-0 min-h-0" : "px-3.5",
            readOnly ? "min-h-0 py-2.5" : "min-h-40 py-3",
            readOnly
              ? "[&_.tiptap]:outline-none [&_.tiptap]:min-h-0"
              : "[&_.tiptap]:outline-none [&_.tiptap]:min-h-35",
            "[&_.tiptap_p]:leading-relaxed [&_.tiptap_p]:my-1",
            "[&_.tiptap_h1]:text-xl [&_.tiptap_h1]:font-bold [&_.tiptap_h1]:mt-3 [&_.tiptap_h1]:mb-1",
            "[&_.tiptap_h2]:text-lg [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:mt-2 [&_.tiptap_h2]:mb-1",
            "[&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:mt-2 [&_.tiptap_h3]:mb-1",
            "[&_.tiptap_strong]:font-semibold",
            "[&_.tiptap_em]:italic",
            "[&_.tiptap_s]:line-through",
            "[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ul]:my-1.5",
            "[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ol]:my-1.5",
            "[&_.tiptap_li]:leading-relaxed",
            "[&_.tiptap_a]:text-primary [&_.tiptap_a]:underline [&_.tiptap_a]:underline-offset-2",
            "[&_.tiptap_code]:bg-muted [&_.tiptap_code]:rounded [&_.tiptap_code]:px-1.5 [&_.tiptap_code]:py-0.5 [&_.tiptap_code]:text-xs [&_.tiptap_code]:font-mono [&_.tiptap_code]:text-foreground",
            "[&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-border [&_.tiptap_blockquote]:pl-3.5 [&_.tiptap_blockquote]:text-muted-foreground [&_.tiptap_blockquote]:italic [&_.tiptap_blockquote]:my-2",
            "[&_.tiptap_hr]:border-t [&_.tiptap_hr]:border-border [&_.tiptap_hr]:my-3",
            "[&_.tiptap_ul[data-type='taskList']]:list-none [&_.tiptap_ul[data-type='taskList']]:pl-0",
            "[&_.tiptap_li[data-type='taskItem']]:flex [&_.tiptap_li[data-type='taskItem']]:items-start [&_.tiptap_li[data-type='taskItem']]:gap-2 [&_.tiptap_li[data-type='taskItem']]:my-0.5",
            "[&_.tiptap_li[data-type='taskItem']>label]:flex [&_.tiptap_li[data-type='taskItem']>label]:items-center [&_.tiptap_li[data-type='taskItem']>label]:gap-2 [&_.tiptap_li[data-type='taskItem']>label]:mt-0.5",
            "[&_.tiptap_li[data-type='taskItem']>label>input]:h-3.5 [&_.tiptap_li[data-type='taskItem']>label>input]:w-3.5 [&_.tiptap_li[data-type='taskItem']>label>input]:accent-primary [&_.tiptap_li[data-type='taskItem']>label>input]:cursor-pointer",
            "[&_.tiptap_li[data-type='taskItem'][data-checked='true']>div]:line-through [&_.tiptap_li[data-type='taskItem'][data-checked='true']>div]:text-muted-foreground",
            "[&_.tiptap_.is-editor-empty_p:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.tiptap_.is-editor-empty_p:first-child::before]:text-muted-foreground",
            "[&_.tiptap_.is-editor-empty_p:first-child::before]:float-left",
            "[&_.tiptap_.is-editor-empty_p:first-child::before]:h-0",
            "[&_.tiptap_.is-editor-empty_p:first-child::before]:pointer-events-none",
          )}
        />
      </div>
      {maxLength && !readOnly && (
        <p className="text-right text-[11px] text-muted-foreground -mt-0.5">
          {charCount} / {maxLength}
        </p>
      )}
    </FieldWrapper>
  );
});

// ─── NumberField ──────────────────────────────────────────────────────────────

export const NumberField = forwardRef(function NumberField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    id,
    icon,
    prefix,
    suffix,
    className,
    ...props
  },
  ref,
) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;

  function handleBlur(e) {
    if (validate) setLocalError(validate(e.target.value) || "");
    onBlur?.(e);
  }

  const hasLeft = icon || prefix;

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative flex items-center">
        {icon && !prefix && <InputIcon icon={icon} />}
        {prefix && (
          <span className="absolute left-3.5 text-sm text-muted-foreground select-none pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type="number"
          onBlur={handleBlur}
          className={fieldCls(
            error,
            cn(
              hasLeft && "pl-9",
              suffix && "pr-9",
              "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              className,
            ),
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3.5 text-sm text-muted-foreground select-none pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </FieldWrapper>
  );
});

// ─── CurrencyField ────────────────────────────────────────────────────────────

export const CurrencyField = forwardRef(function CurrencyField(
  {
    label,
    error,
    hint,
    required,
    id,
    icon,
    value,
    onChange,
    locale = "es-MX",
    currency = "MXN",
    symbol = "$",
    className,
    min,
    max,
    allowNegative = false,
    allowDecimal: _allowDecimal,
    fractionDigits: _fractionDigits,
    ...props
  },
  ref,
) {
  function toCents(decimalValue) {
    if (decimalValue == null || decimalValue === "") return 0;
    return Math.round(Math.abs(Number(decimalValue)) * 100);
  }

  function toDecimal(cents) {
    return cents / 100;
  }

  function formatCents(cents) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toDecimal(cents));
  }

  const [cents, setCents] = useState(() => toCents(value));
  const [negative, setNegative] = useState(() => Number(value) < 0);

  useEffect(() => {
    setCents(toCents(value));
    setNegative(Number(value) < 0);
  }, [value]);

  function handleKeyDown(e) {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"];
    if (allowed.includes(e.key)) return;
    if (allowNegative && e.key === "-") {
      e.preventDefault();
      const nextNegative = !negative;
      setNegative(nextNegative);
      onChange?.(nextNegative ? -toDecimal(cents) : toDecimal(cents));
      return;
    }
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, "");
    const newCents = parseInt(digits, 10) || 0;
    const clamped =
      min != null || max != null
        ? Math.min(
            max != null ? toCents(max) : Infinity,
            Math.max(min != null ? toCents(min) : 0, newCents),
          )
        : newCents;
    setCents(clamped);
    onChange?.(negative ? -toDecimal(clamped) : toDecimal(clamped));
  }

  function handleFocus(e) {
    e.target.select();
  }

  const displayValue = (negative && cents > 0 ? "-" : "") + formatCents(cents);

  return (
    <FieldWrapper label={label} labelFor={id} error={error} hint={hint} required={required}>
      <div className="relative flex items-center">
        {icon ? (
          <InputIcon icon={icon} />
        ) : (
          <span className="absolute left-3.5 text-sm text-[hsl(var(--foreground))]/70 select-none pointer-events-none">
            {symbol}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          onFocus={handleFocus}
          className={fieldCls(error, cn("pl-9", className))}
          placeholder={formatCents(0)}
          {...props}
        />
      </div>
    </FieldWrapper>
  );
});

// ─── DateField ────────────────────────────────────────────────────────────────

export const DateField = forwardRef(function DateField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    id,
    icon,
    className,
    ...props
  },
  ref,
) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;

  function handleBlur(e) {
    if (validate) setLocalError(validate(e.target.value) || "");
    onBlur?.(e);
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative">
        <InputIcon icon={icon} />
        <input
          ref={ref}
          id={id}
          type="date"
          onBlur={handleBlur}
          className={fieldCls(
            error,
            cn(
              icon && "pl-9",
              "[&::-webkit-calendar-picker-indicator]:opacity-40",
              "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
              "[&::-webkit-calendar-picker-indicator]:hover:opacity-70",
              className,
            ),
          )}
          {...props}
        />
      </div>
    </FieldWrapper>
  );
});

// ─── DateTimeField ────────────────────────────────────────────────────────────

export const DateTimeField = forwardRef(function DateTimeField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    id,
    icon,
    className,
    ...props
  },
  ref,
) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;

  function handleBlur(e) {
    if (validate) setLocalError(validate(e.target.value) || "");
    onBlur?.(e);
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative">
        <InputIcon icon={icon} />
        <input
          ref={ref}
          id={id}
          type="datetime-local"
          onBlur={handleBlur}
          className={fieldCls(
            error,
            cn(
              icon && "pl-9",
              "[&::-webkit-calendar-picker-indicator]:opacity-40",
              "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
              "[&::-webkit-calendar-picker-indicator]:hover:opacity-70",
              className,
            ),
          )}
          {...props}
        />
      </div>
    </FieldWrapper>
  );
});

// ─── YearField ────────────────────────────────────────────────────────────────

export function YearField({
  label,
  error: externalError,
  hint,
  required,
  validate,
  onBlur,
  id,
  icon,
  value,
  onChange,
  min = 1900,
  max = 2100,
  className,
  ...props
}) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;

  function handleBlur(e) {
    if (validate) setLocalError(validate(e.target.value) || "");
    onBlur?.(e);
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative w-32">
        <InputIcon icon={icon} />
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          placeholder={String(new Date().getFullYear())}
          className={fieldCls(
            error,
            cn(
              "w-32",
              icon && "pl-9",
              "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              className,
            ),
          )}
          {...props}
        />
      </div>
    </FieldWrapper>
  );
}

// ─── SelectField ─────────────────────────────────────────────────────────────

export const SelectField = forwardRef(function SelectField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    id,
    icon,
    options = [],
    placeholder,
    value,
    onValueChange,
    disabled,
    className,
  },
  ref,
) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;

  function handleOpenChange(open) {
    if (!open && validate) {
      setLocalError(validate(value) || "");
    }
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative">
        <InputIcon icon={icon} />
        <SelectPrimitive.Root
          value={value || ""}
          onValueChange={onValueChange}
          onOpenChange={handleOpenChange}
          disabled={disabled}
        >
          <SelectPrimitive.Trigger
            id={id}
            ref={ref}
            className={cn(
              fieldCls(
                error,
                cn(
                  "flex items-center justify-between cursor-pointer text-left gap-2",
                  icon && "pl-9",
                  className,
                ),
              ),
            )}
            aria-label={label}
          >
            <span
              className={cn(
                "flex-1 truncate text-sm",
                !value && "text-muted-foreground/70",
              )}
            >
              <SelectPrimitive.Value
                placeholder={placeholder || "Seleccionar..."}
              />
            </span>
            <SelectPrimitive.Icon asChild>
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                className="text-muted-foreground/60 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={5}
              className={cn(
                "z-50 min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg",
                "border border-border bg-card shadow-xl",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
              )}
            >
              <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1 text-muted-foreground">
                <ChevronUp size={13} />
              </SelectPrimitive.ScrollUpButton>

              <SelectPrimitive.Viewport className="p-1 max-h-64 overflow-y-auto">
                {options.map((opt) => {
                  const val = typeof opt === "string" ? opt : opt.value;
                  const lbl = typeof opt === "string" ? opt : opt.label;
                  return (
                    <SelectPrimitive.Item
                      key={val}
                      value={val}
                      className={cn(
                        "relative flex w-full cursor-default select-none items-center",
                        "rounded-md py-2 pl-8 pr-3 text-sm outline-none",
                        "transition-colors duration-100",
                        "focus:bg-primary/8 focus:text-foreground",
                        "data-[state=checked]:text-primary data-[state=checked]:font-medium",
                        "data-disabled:pointer-events-none data-disabled:opacity-50",
                      )}
                    >
                      <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <Check
                            size={11}
                            strokeWidth={2.5}
                            className="text-primary"
                          />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                      <SelectPrimitive.ItemText>{lbl}</SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  );
                })}
              </SelectPrimitive.Viewport>

              <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1 text-muted-foreground">
                <ChevronDown size={13} />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </div>
    </FieldWrapper>
  );
});

// ─── PhoneField ───────────────────────────────────────────────────────────────

export const PhoneField = forwardRef(function PhoneField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    id,
    className,
    ...props
  },
  ref,
) {
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;

  function handleBlur(e) {
    if (validate) setLocalError(validate(e.target.value) || "");
    onBlur?.(e);
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative">
        <InputIcon icon={Phone} />
        <input
          ref={ref}
          id={id}
          type="tel"
          inputMode="tel"
          onBlur={handleBlur}
          className={fieldCls(error, cn("pl-9", className))}
          {...props}
        />
      </div>
    </FieldWrapper>
  );
});

// ─── CheckboxField ────────────────────────────────────────────────────────────

export function CheckboxField({
  label,
  hint,
  required,
  error,
  id,
  checked,
  onChange,
  className,
  children,
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className="flex items-start gap-3 cursor-pointer select-none group"
      >
        <div
          className={cn(
            "mt-0.5 w-4 h-4 shrink-0 rounded border-2 transition-all duration-150",
            "flex items-center justify-center",
            checked
              ? "bg-primary border-primary"
              : "border-border group-hover:border-primary/50",
            error && !checked && "border-destructive",
          )}
        >
          {checked && (
            <Check size={10} strokeWidth={3} className="text-white" />
          )}
        </div>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          className="sr-only"
          required={required}
        />
        <div className="flex flex-col gap-0.5">
          {label && (
            <span className="text-sm font-medium text-foreground/80 leading-tight">
              {label}
              {required && (
                <span className="text-destructive ml-1 text-[11px]">*</span>
              )}
            </span>
          )}
          {children && (
            <span className="text-xs text-muted-foreground">{children}</span>
          )}
        </div>
      </label>
      {error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive leading-none ml-7"
        >
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-muted-foreground ml-7">{hint}</p>
      )}
    </div>
  );
}

// ─── SwitchField ─────────────────────────────────────────────────────────────

export function SwitchField({
  label,
  hint,
  required,
  error,
  id,
  checked,
  onChange,
  className,
  description,
  disabled = false,
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              htmlFor={id}
              className={cn(
                "text-sm font-medium select-none",
                disabled ? "text-muted-foreground cursor-not-allowed" : "text-foreground/80 cursor-pointer",
              )}
            >
              {label}
              {required && (
                <span className="text-destructive ml-1 text-[11px]">*</span>
              )}
            </label>
          )}
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          id={id}
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange?.(!checked)}
          className={cn(
            "relative w-10 h-6 rounded-full transition-all duration-200 shrink-0",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            disabled ? "opacity-50 cursor-not-allowed" : "",
            checked ? "bg-primary" : "bg-muted border border-border",
          )}
        >
          <span
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
              checked ? "left-5" : "left-1",
            )}
          />
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive leading-none"
        >
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ─── RadioGroupField ─────────────────────────────────────────────────────────

export function RadioGroupField({
  label,
  hint,
  required,
  error,
  name,
  value,
  onChange,
  options = [],
  className,
}) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <div className={cn("flex flex-col gap-2", className)}>
        {options.map((opt) => {
          const optValue = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt : opt.label;
          const optDesc = typeof opt === "object" ? opt.description : null;
          const isChecked = value === optValue;
          return (
            <label
              key={optValue}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all duration-150 select-none",
                isChecked
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 transition-all duration-150 flex items-center justify-center",
                  isChecked ? "border-primary" : "border-border",
                )}
              >
                {isChecked && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <input
                type="radio"
                name={name}
                value={optValue}
                checked={isChecked}
                onChange={() => onChange?.(optValue)}
                className="sr-only"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground/80 leading-tight">
                  {optLabel}
                </span>
                {optDesc && (
                  <span className="text-xs text-muted-foreground">
                    {optDesc}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </FieldWrapper>
  );
}

// ─── TagsField ────────────────────────────────────────────────────────────────

export function TagsField({
  label,
  hint,
  required,
  error: externalError,
  id,
  value = [],
  onChange,
  placeholder = "Escribe y presiona Enter",
  className,
}) {
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;
  const inputRef = useRef(null);

  function addTag() {
    const tag = input.trim();
    if (!tag) return;
    if (value.includes(tag)) {
      setLocalError("Etiqueta duplicada");
      return;
    }
    setLocalError("");
    onChange?.([...value, tag]);
    setInput("");
  }

  function removeTag(i) {
    onChange?.(value.filter((_, idx) => idx !== i));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !input && value.length > 0)
      removeTag(value.length - 1);
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex flex-wrap items-center gap-1.5 min-h-11 rounded-lg border px-2.5 py-2 glass-subtle bg-card",
          "transition-all duration-150 cursor-text",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
          error ? FIELD_ERROR : FIELD_NORMAL,
          className,
        )}
      >
        <Tag
          size={14}
          strokeWidth={1.75}
          className="text-muted-foreground/60 shrink-0"
        />
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="text-primary/60 hover:text-primary transition-colors"
              aria-label={`Eliminar ${tag}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-24 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
    </FieldWrapper>
  );
}

// ─── DropzoneField ────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function DropzoneField({
  label,
  error: externalError,
  hint,
  required,
  id,
  accept,
  maxSize,
  multiple = false,
  value,
  onChange,
  placeholder = "Arrastra tu archivo aquí o haz clic para seleccionar",
  className,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const inputRef = useRef(null);

  const files = value ? (Array.isArray(value) ? value : [value]) : [];
  const error = externalError || sizeError;

  const processFiles = useCallback(
    (newFiles) => {
      setSizeError("");
      if (maxSize) {
        const oversized = Array.from(newFiles).find((f) => f.size > maxSize);
        if (oversized) {
          setSizeError(
            `Archivo demasiado grande. Máximo ${formatBytes(maxSize)}`,
          );
          return;
        }
      }
      onChange?.(multiple ? Array.from(newFiles) : newFiles[0] || null);
    },
    [maxSize, multiple, onChange],
  );

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }

  function handleChange(e) {
    if (e.target.files?.length) processFiles(e.target.files);
  }

  function removeFile(index) {
    const updated = files.filter((_, i) => i !== index);
    onChange?.(multiple ? updated : null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={error}
      hint={hint}
      required={required}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de archivos"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3",
          "rounded-lg border-2 border-dashed px-6 py-8 text-center",
          "transition-all duration-150 cursor-pointer select-none",
          isDragging
            ? "border-primary bg-primary/5"
            : error
              ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60"
              : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/3",
          className,
        )}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150",
            isDragging ? "bg-primary/15" : "bg-muted",
          )}
        >
          <Upload
            size={17}
            className={cn(
              "transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground",
            )}
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground/80">
            {placeholder}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {accept && (
              <span>
                {accept
                  .replace(/image\//g, "")
                  .replace(/\*/g, "todos")
                  .toUpperCase()}
              </span>
            )}
            {accept && maxSize && <span>·</span>}
            {maxSize && <span>Máximo {formatBytes(maxSize)}</span>}
          </div>
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="sr-only"
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5 mt-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3.5 py-2.5"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-foreground truncate">
                  {file.name}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {formatBytes(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="ml-3 shrink-0 text-muted-foreground hover:text-destructive transition-colors duration-150"
                aria-label={`Eliminar ${file.name}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </FieldWrapper>
  );
}

// ─── ComboboxField ────────────────────────────────────────────────────────────

export function ComboboxField({
  label,
  id,
  required,
  error: externalError,
  hint,
  icon,
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  minSearchLength = 0,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered =
    search.length >= minSearchLength
      ? options
          .filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
          .slice(0, 200)
      : minSearchLength > 0
        ? []
        : options.slice(0, 200);

  useEffect(() => {
    function handleOutside(e) {
      if (!containerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleOpen() {
    const willOpen = !open;
    if (willOpen && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDropdownStyle({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
    }
    setOpen((o) => !o);
    if (willOpen && options.length === 0 && !loading) {
      // Lazy-load remote options when the dropdown opens for the first time.
      onSearchChange?.("");
    }
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function handleSelect(opt) {
    onChange(opt.value);
    setOpen(false);
    setSearch("");
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={externalError}
      hint={hint}
      required={required}
    >
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          type="button"
          id={id}
          onClick={handleOpen}
          className={cn(
            fieldCls(
              externalError,
              cn(
                "flex items-center justify-between text-left cursor-pointer",
                icon && "pl-9",
              ),
            ),
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <InputIcon icon={icon} />
          <span
            className={cn(
              "truncate",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={cn(
              "text-muted-foreground/60 shrink-0 ml-2 transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </button>

        {open && createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width, zIndex: 9999, pointerEvents: "auto" }}
            className="rounded-xl border border-border/80 bg-card shadow-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search size={13} className="text-muted-foreground/50 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="flex items-center justify-center h-4 w-4 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto" role="listbox">
              {search.length < minSearchLength ? (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Escribe al menos {minSearchLength} letras para buscar
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {emptyText}
                </p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors duration-100 flex items-center gap-2",
                      opt.value === value
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted/50",
                    )}
                  >
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.value === value && (
                      <Check size={13} className="shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </FieldWrapper>
  );
}

// ─── RelationSelectField ──────────────────────────────────────────────────────
// Combobox for relation fields loaded from a remote API or static list.
// Supports loading/error/clear states and remote search via onSearchChange.

export function RelationSelectField({
  label,
  id,
  required,
  error: externalError,
  hint,
  icon,
  options = [],
  value,
  onChange,
  loading = false,
  loadError = null,
  onRetry,
  onSearchChange,
  clearable = false,
  createActionLabel = "Crear nuevo",
  createActionMode = "always",
  createFromSearch = false,
  createDisabled = false,
  onCreate,
  placeholder = "Seleccionar...",
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  const selected = (value != null && value !== "")
    ? options.find((o) => String(o.value) === String(value))
    : undefined;

  useEffect(() => {
    function handleOutside(e) {
      const inContainer = containerRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inContainer && !inDropdown) {
        if (search) onSearchChange?.("");
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [search, onSearchChange]);

  function handleOpen() {
    if (!open && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDropdownStyle({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
      // If there are no options yet and we're not already loading, request a fresh load.
      // Covers the case where the form was just reset/remounted before the preload effect ran.
      if (options.length === 0 && !loading) {
        onSearchChange?.("");
      }
    }
    setOpen((o) => !o);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function handleSearchChange(e) {
    const term = e.target.value;
    setSearch(term);
    onSearchChange?.(term);
  }

  function handleSelect(opt) {
    if (opt.disabled) return;
    onChange?.(opt.value);
    setOpen(false);
    setSearch("");
  }

  function handleCreate() {
    if (createDisabled || typeof onCreate !== "function") return;
    const searchText = search.trim();
    onCreate(searchText);
    setOpen(false);
    setSearch("");
  }

  const displayLabel =
    value != null && value !== ""
      ? selected
        ? selected.label
        : !loading
        ? "Registro no disponible"
        : null
      : null;
  const selectedMeta = selected?.meta ?? null;

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const trimmedSearch = search.trim();
  const canShowCreate =
    typeof onCreate === "function" &&
    (createActionMode === "always" ||
      (createActionMode === "empty-search" && trimmedSearch.length === 0) ||
      (createActionMode === "has-search" && trimmedSearch.length > 0));
  const createLabel = (() => {
    if (createFromSearch && trimmedSearch.length > 0) return `Crear "${trimmedSearch}"`;
    return createActionLabel || "Crear nuevo";
  })();

  return (
    <FieldWrapper label={label} labelFor={id} error={externalError} hint={hint} required={required}>
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          type="button"
          id={id}
          onClick={handleOpen}
          className={cn(
            fieldCls(
              externalError,
              cn("flex items-center justify-between text-left cursor-pointer gap-2", icon && "pl-9"),
            ),
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <InputIcon icon={icon} />
          <span
            className={cn(
              "flex-1 truncate text-sm",
              !displayLabel && !loading && "text-muted-foreground",
              displayLabel === "Registro no disponible" && "text-muted-foreground italic",
            )}
          >
            {loading && value != null && value !== ""
              ? "Cargando opciones..."
              : displayLabel ?? placeholder}
          </span>
          <span className="flex items-center gap-0.5 shrink-0">
            {clearable && value != null && value !== "" && !loading && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpiar selección"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange?.(null);
                }}
                className="flex items-center justify-center h-4 w-4 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={10} />
              </span>
            )}
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className={cn(
                "text-muted-foreground/60 transition-transform duration-150",
                open && "rotate-180",
              )}
            />
          </span>
        </button>

        {open && createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width, zIndex: 9999, pointerEvents: "auto" }}
            className="rounded-xl border border-border/80 bg-card shadow-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search size={13} className="text-muted-foreground/50 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="Buscar..."
                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    onSearchChange?.("");
                  }}
                  className="flex items-center justify-center h-4 w-4 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto" role="listbox">
              {loading ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Cargando opciones...
                </p>
              ) : loadError ? (
                <div className="px-3 py-4 text-center space-y-2">
                  <p className="text-xs text-destructive">No se pudieron cargar las opciones</p>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {options.length === 0 ? "Sin opciones disponibles" : "Sin resultados"}
                </p>
              ) : (
                filtered.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt)}
                      disabled={opt.disabled}
                      className={cn(
                        "w-full text-left px-3 transition-colors duration-100 flex items-center gap-2",
                        opt.meta ? "py-2.5" : "py-2",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted/50",
                        opt.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
                      )}
                    >
                      {opt.meta ? (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {opt.meta.badge ? (
                              <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary shrink-0">
                                {opt.meta.badge}
                              </span>
                            ) : null}
                            {opt.meta.title ? (
                              <span className={cn("text-sm font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>
                                {opt.meta.title}
                              </span>
                            ) : null}
                          </div>
                          {opt.meta.subtitle ? (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                              {opt.meta.subtitle}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="flex-1 truncate text-sm">{opt.label}</span>
                      )}
                      {isSelected && (
                        <Check size={13} className="shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })
              )}
              {canShowCreate && (
                <>
                  <div className="mx-3 my-1 border-t border-border" />
                  <button
                    type="button"
                    role="option"
                    onClick={handleCreate}
                    disabled={createDisabled}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors duration-100 flex items-center gap-2",
                      "text-primary hover:bg-primary/5",
                      createDisabled && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Plus size={14} className="shrink-0" />
                    <span className="font-medium">{createLabel}</span>
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </FieldWrapper>
  );
}

// ─── CreatableComboboxField ───────────────────────────────────────────────────
// Same as ComboboxField but shows a "+ Crear «X»" option when the search term
// does not match any existing entry. Calls `onCreate(name)` when chosen.

export function CreatableComboboxField({
  label,
  id,
  required,
  error: externalError,
  hint,
  icon,
  options = [],
  value,
  onChange,
  onCreate,
  isCreating = false,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered = options
    .filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 200);

  const trimmed = search.trim();
  const showCreate =
    typeof onCreate === "function" &&
    trimmed.length > 0 &&
    !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleOpen() {
    setOpen((o) => !o);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function handleSelect(opt) {
    onChange(opt.value);
    setOpen(false);
    setSearch("");
  }

  function handleCreate() {
    if (!trimmed || isCreating) return;
    onCreate(trimmed);
    setOpen(false);
    setSearch("");
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={externalError}
      hint={hint}
      required={required}
    >
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          type="button"
          id={id}
          onClick={handleOpen}
          className={cn(
            fieldCls(
              externalError,
              cn(
                "flex items-center justify-between text-left cursor-pointer",
                icon && "pl-9",
              ),
            ),
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <InputIcon icon={icon} />
          <span
            className={cn(
              "truncate",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={cn(
              "text-muted-foreground/60 shrink-0 ml-2 transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showCreate) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder={searchPlaceholder}
                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto" role="listbox">
              {filtered.length === 0 && !showCreate && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {emptyText}
                </p>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm transition-colors duration-100",
                    opt.value === value
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted/50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {showCreate && (
                <>
                  {filtered.length > 0 && (
                    <div className="mx-3 my-1 border-t border-border" />
                  )}
                  <button
                    type="button"
                    role="option"
                    disabled={isCreating}
                    onClick={handleCreate}
                    className="w-full text-left px-3 py-2 text-sm transition-colors duration-100 flex items-center gap-2 text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-wait font-medium"
                  >
                    <span className="text-base leading-none">+</span>
                    {isCreating ? (
                      <span>Creando...</span>
                    ) : (
                      <span>
                        Crear{" "}
                        <span className="text-foreground font-semibold">
                          &ldquo;{trimmed}&rdquo;
                        </span>
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}

// ─── CarColorPickerField ──────────────────────────────────────────────────────
// Searchable color picker for vehicle colors.
// `colors` prop: [{ name, hex, group }]  — passed from the renderer.
// Stores the color NAME as value, not hex.

export function CarColorPickerField({
  label,
  id,
  required,
  error: externalError,
  hint,
  value,
  onChange,
  colors = [],
  clearable = true,
  placeholder = "Seleccionar color...",
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  const selected = colors.find((c) => c.name === value) ?? null;

  // resolve hex for any stored value (name or legacy #hex)
  function resolveHex(v) {
    if (!v) return null;
    if (String(v).startsWith("#")) return String(v);
    return colors.find((c) => c.name === v)?.hex ?? null;
  }
  const selectedHex = resolveHex(value);

  const groups = [...new Set(colors.map((c) => c.group))];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? colors.filter((c) => c.name.toLowerCase().includes(term) || c.group.toLowerCase().includes(term))
    : null;

  useEffect(() => {
    function handleOutside(e) {
      if (!containerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleOpen() {
    if (!open && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const dropH = 320;
      const top = spaceBelow >= dropH ? r.bottom + 4 : r.top - dropH - 4;
      setDropdownStyle({ top, left: r.left, width: Math.max(r.width, 260) });
    }
    setOpen((o) => !o);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function handleSelect(color) {
    onChange(color.name);
    setOpen(false);
    setSearch("");
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange(null);
  }

  function isSelected(color) {
    return color.name === value || color.hex === value;
  }

  return (
    <FieldWrapper label={label} labelFor={id} error={externalError} hint={hint} required={required}>
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          type="button"
          id={id}
          onClick={handleOpen}
          className={cn(
            fieldCls(externalError, "flex items-center gap-2.5 text-left cursor-pointer pr-3"),
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {selectedHex ? (
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-border/60 shadow-sm"
              style={{ backgroundColor: selectedHex }}
            />
          ) : (
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/30" />
          )}
          <span className={cn("flex-1 truncate text-sm", selected || value ? "text-foreground" : "text-muted-foreground")}>
            {selected ? selected.name : value && !value.startsWith("#") ? value : placeholder}
          </span>
          <span className="ml-auto flex items-center gap-1">
            {clearable && value && (
              <span
                role="button"
                tabIndex={-1}
                onClick={handleClear}
                className="flex items-center justify-center h-4 w-4 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Limpiar color"
              >
                <X size={10} />
              </span>
            )}
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className={cn("text-muted-foreground/60 transition-transform duration-150", open && "rotate-180")}
            />
          </span>
        </button>

        {open && createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width, zIndex: 9999 }}
            className="rounded-xl border border-border/80 bg-card shadow-xl overflow-hidden"
          >
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search size={13} className="text-muted-foreground/50 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar color..."
                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="flex items-center justify-center h-4 w-4 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X size={10} />
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto" role="listbox">
              {/* Clear option */}
              {clearable && value && !term && (
                <button
                  type="button"
                  role="option"
                  onClick={() => { onChange(null); setOpen(false); setSearch(""); }}
                  className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors flex items-center gap-2 border-b border-border/50"
                >
                  <X size={11} />
                  Sin color
                </button>
              )}

              {/* Filtered flat list */}
              {term ? (
                filtered.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">Sin resultados</p>
                ) : (
                  filtered.map((color) => (
                    <ColorOption key={color.name} color={color} selected={isSelected(color)} onSelect={handleSelect} />
                  ))
                )
              ) : (
                /* Grouped list */
                groups.map((group) => (
                  <div key={group}>
                    <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                      {group}
                    </p>
                    {colors.filter((c) => c.group === group).map((color) => (
                      <ColorOption key={color.name} color={color} selected={isSelected(color)} onSelect={handleSelect} />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </FieldWrapper>
  );
}

function ColorOption({ color, selected, onSelect }) {
  const isLight = isLightColor(color.hex);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(color)}
      className={cn(
        "w-full text-left px-3 py-1.5 text-sm transition-colors duration-100 flex items-center gap-2.5",
        selected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 shrink-0 rounded-full border shadow-sm",
          isLight ? "border-border/80" : "border-transparent",
        )}
        style={{ backgroundColor: color.hex }}
      />
      <span className="flex-1 truncate">{color.name}</span>
      {selected && <Check size={13} className="shrink-0 text-primary" />}
    </button>
  );
}

function isLightColor(hex) {
  if (!hex || !hex.startsWith("#")) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}
