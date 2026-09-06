import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Merge several refs (callback or object) into one callback ref, so a component
 * can keep its own internal ref while still forwarding a caller-provided ref.
 */
export function mergeRefs(...refs) {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(node)
      else ref.current = node
    }
  }
}

export function formatTableDate(value, includeTime = false) {
  if (!value) return "—";
  const str = String(value);
  const hasTime = str.includes("T");
  const datePart = hasTime ? str.slice(0, 10) : str;
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return str;
  const dateFmt = `${day}/${month}/${year}`;
  if (!includeTime || !hasTime) return dateFmt;
  const timePart = str.slice(11, 16);
  if (!timePart || timePart === "00:00") return dateFmt;
  const [hStr, mStr] = timePart.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${dateFmt} ${h12}:${m} ${ampm}`;
}
