import { useLayoutEffect, useRef, useState } from "react";

/**
 * Edits a row cell in place: opens focused with its text selected; Enter or leaving the field
 * saves, Escape cancels.
 */
export function InlineEdit({
  initial,
  label,
  className,
  inputMode,
  maxLength,
  onCommit,
  onDone,
}: {
  readonly initial: string;
  readonly label: string;
  readonly className?: string;
  readonly inputMode?: "text" | "numeric";
  readonly maxLength?: number;
  readonly onCommit: (value: string) => void;
  /** Called after a save or a cancel, to leave edit mode. */
  readonly onDone: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  // Escape ends editing before the blur it causes, so that blur must not save.
  const finished = useRef(false);

  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (save) onCommit(value);
    onDone();
  };

  return (
    <input
      ref={ref}
      className={["inline-edit", className].filter(Boolean).join(" ")}
      aria-label={label}
      value={value}
      inputMode={inputMode}
      maxLength={maxLength}
      spellCheck={false}
      autoComplete="off"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          // The dialogs and the picker also listen for Escape; this one is only for the field.
          event.stopPropagation();
          finish(false);
        }
      }}
      // Clicks inside the field must not reach the row (or start a drag later).
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}

/**
 * Reads an amount as typed: "1234", "1,234", "1.2k" or "3m". Null when it isn't one, so a stray
 * typo cancels instead of zeroing the value.
 */
export function parseAmount(text: string): number | null {
  const match = /^\s*(\d+(?:[.,]\d+)?|\d{1,3}(?:[,. ]\d{3})+)\s*([km])?\s*$/i.exec(text);
  if (!match) return null;
  const [, digits = "", suffix] = match;
  const thousands = /^\d{1,3}(?:[,. ]\d{3})+$/.test(digits);
  const number = thousands ? Number(digits.replace(/[,. ]/g, "")) : Number(digits.replace(",", "."));
  if (!Number.isFinite(number)) return null;
  const scale = suffix?.toLowerCase() === "m" ? 1_000_000 : suffix?.toLowerCase() === "k" ? 1_000 : 1;
  return Math.round(number * scale);
}
