import { Check } from "lucide-react";

/**
 * A labelled checkbox in the accent (primitives.css `.checkbox`), like the installer's "Open
 * RankDB": a rounded box that fills with the accent and a tick when checked. The label is part of
 * the control, so clicking it toggles too.
 */
export function Checkbox({
  checked,
  label,
  disabled,
  onChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className="checkbox"
      onClick={() => onChange(!checked)}
    >
      <span className="checkbox-box" aria-hidden="true">
        {checked && <Check size={12} strokeWidth={3.2} />}
      </span>
      {label}
    </button>
  );
}
