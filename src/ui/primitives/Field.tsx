import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * TaskMap's form controls (src/ui/primitives/Field.tsx, forms.css): a label over the control, with
 * an optional description below. Inputs are dark inset fields that brighten their border on focus.
 */
export function Field({
  label,
  description,
  children,
}: {
  readonly label: string;
  readonly description?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {description && <span className="field-description">{description}</span>}
    </label>
  );
}

/** A text input; `trailing` sits inside its right end (e.g. a show-password button). */
export function TextInput({
  trailing,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { readonly trailing?: ReactNode }) {
  return (
    <span className="input-shell">
      <input {...props} className={["input", className].filter(Boolean).join(" ")} spellCheck={false} />
      {trailing && <span className="input-trailing">{trailing}</span>}
    </span>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={["input", "textarea", className].filter(Boolean).join(" ")} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={["input", "select", className].filter(Boolean).join(" ")}>
      {children}
    </select>
  );
}
