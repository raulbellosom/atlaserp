import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  X,
  Check,
  ChevronDown,
  Phone,
  Tag,
} from "lucide-react";
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

function parseCurrencyRaw(str) {
  const n = parseFloat(String(str).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? "" : n;
}

function formatCurrency(value, locale, currency) {
  if (value === "" || value === null || value === undefined) return "";
  const n = parseFloat(value);
  if (isNaN(n)) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function CurrencyField({
  label,
  error: externalError,
  hint,
  required,
  id,
  onBlur,
  icon,
  value,
  onChange,
  locale = "es-MX",
  currency = "MXN",
  symbol = "$",
  className,
  ...props
}) {
  const [display, setDisplay] = useState(() =>
    formatCurrency(value, locale, currency),
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDisplay(formatCurrency(value, locale, currency));
  }, [value, focused, locale, currency]);

  function handleFocus() {
    setFocused(true);
    setDisplay(value != null && value !== "" ? String(value) : "");
  }

  function handleChange(e) {
    const raw = e.target.value.replace(/[^0-9.,-]/g, "");
    setDisplay(raw);
    onChange?.(parseCurrencyRaw(raw));
  }

  function handleBlur(e) {
    setFocused(false);
    setDisplay(formatCurrency(value, locale, currency));
    onBlur?.(e);
  }

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      error={externalError}
      hint={hint}
      required={required}
    >
      <div className="relative flex items-center">
        {icon ? (
          <InputIcon icon={icon} />
        ) : (
          <span className="absolute left-3.5 text-sm text-muted-foreground/60 select-none pointer-events-none">
            {symbol}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={
            focused
              ? display
              : display || formatCurrency(value, locale, currency)
          }
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={fieldCls(externalError, cn("pl-9", className))}
          placeholder="0.00"
          {...props}
        />
      </div>
    </FieldWrapper>
  );
}

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
    onBlur,
    id,
    icon,
    options = [],
    placeholder,
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
        <select
          ref={ref}
          id={id}
          onBlur={handleBlur}
          className={fieldCls(
            error,
            cn(
              icon && "pl-9",
              "pr-9 appearance-none cursor-pointer",
              className,
            ),
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value;
            const lbl = typeof opt === "string" ? opt : opt.label;
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            );
          })}
        </select>
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none">
          <ChevronDown size={14} strokeWidth={1.75} />
        </span>
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
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              htmlFor={id}
              className="text-sm font-medium text-foreground/80 cursor-pointer select-none"
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
          onClick={() => onChange?.(!checked)}
          className={cn(
            "relative w-10 h-6 rounded-full transition-all duration-200 shrink-0",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
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
