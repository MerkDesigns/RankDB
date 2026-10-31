import type { ButtonHTMLAttributes } from "react";

/**
 * TaskMap's buttons (src/ui/primitives/Button.tsx, controls.css): secondary (faint fill and
 * border), primary (the accent) and danger (red tint).
 */
export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: "primary" | "secondary" | "danger" }) {
  return <button {...props} type={type} className={["button", className].filter(Boolean).join(" ")} data-variant={variant} />;
}
