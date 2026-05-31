import { useRef, useEffect, useState, forwardRef } from "react";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  codeBlockPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  CodeToggle,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  InsertCodeBlock,
  Separator,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { AlertCircle } from "lucide-react";
import { cn } from "../lib/utils.js";

function FieldWrapper({ label, labelFor, required, error, hint, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={labelFor}
          className="text-[13px] font-medium leading-none text-foreground/80 select-none cursor-default"
        >
          {label}
          {required && (
            <span className="text-destructive ml-1 text-[11px]" aria-hidden="true">*</span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive leading-none">
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

function EditorToolbar() {
  return (
    <>
      <UndoRedo />
      <Separator />
      <BlockTypeSelect />
      <Separator />
      <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
      <StrikeThroughSupSubToggles options={["Strikethrough"]} />
      <CodeToggle />
      <Separator />
      <ListsToggle />
      <Separator />
      <CreateLink />
      <InsertTable />
      <InsertThematicBreak />
      <InsertCodeBlock />
    </>
  );
}

const PLUGINS = [
  headingsPlugin({ allowedHeadingLevels: [1, 2, 3] }),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
  markdownShortcutPlugin(),
];

const PLUGINS_WITH_TOOLBAR = [
  ...PLUGINS,
  toolbarPlugin({ toolbarContents: () => <EditorToolbar /> }),
];

export const MarkdownField = forwardRef(function MarkdownField(
  {
    label,
    error,
    hint,
    required,
    id,
    value,
    onChange,
    onBlur,
    maxLength = 5000,
    placeholder = "Escribe tus observaciones aquí...",
    disabled,
    readOnly,
    readOnlyPlain = false,
    className,
  },
  _ref,
) {
  const editorRef = useRef(null);
  const lastPushed = useRef(value ?? "");
  const [charCount, setCharCount] = useState((value ?? "").length);

  // Sync external value (e.g. form reset or initial load after data fetch)
  useEffect(() => {
    const incoming = value ?? "";
    if (incoming !== lastPushed.current && editorRef.current) {
      lastPushed.current = incoming;
      editorRef.current.setMarkdown(incoming);
      setCharCount(incoming.length);
    }
  }, [value]);

  function handleChange(md, isInitialNormalize) {
    if (isInitialNormalize) return;
    lastPushed.current = md;
    setCharCount(md.length);
    onChange?.({ target: { value: md } });
  }

  const isReadOnly = readOnly || disabled;

  if (readOnlyPlain || (readOnly && readOnlyPlain)) {
    return (
      <FieldWrapper label={label} labelFor={id} error={error} hint={hint} required={required}>
        <MDXEditor
          ref={editorRef}
          markdown={value ?? ""}
          readOnly
          plugins={PLUGINS}
          contentEditableClassName="mdx-prose"
          className={cn("mdx-viewer-plain", className)}
        />
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper label={label} labelFor={id} error={error} hint={hint} required={required} className={className}>
      <div
        className={cn(
          "rounded-lg border bg-card overflow-hidden transition-colors",
          error ? "border-destructive" : "border-border",
          !isReadOnly && "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
          disabled && "opacity-60 cursor-not-allowed pointer-events-none",
        )}
      >
        <MDXEditor
          ref={editorRef}
          markdown={value ?? ""}
          onChange={handleChange}
          onBlur={() => onBlur?.()}
          readOnly={isReadOnly}
          placeholder={placeholder}
          plugins={isReadOnly ? PLUGINS : PLUGINS_WITH_TOOLBAR}
          contentEditableClassName="mdx-prose"
          className="mdx-editor-root"
        />
      </div>
      {maxLength && !isReadOnly && (
        <p className="text-right text-[11px] text-muted-foreground -mt-0.5">
          {charCount} / {maxLength}
        </p>
      )}
    </FieldWrapper>
  );
});
