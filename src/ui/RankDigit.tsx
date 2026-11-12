import type { CSSProperties } from "react";
import { DIVISION_DIGITS } from "../data/assets";

/**
 * A division number (1–5) in the rank font, drawn from an image (src/data/assets.ts). It takes the
 * box the text did (sized by the parent's font-size) and its colour (`currentColor`), so it sits
 * and recolours exactly like the text it replaces. Decorative: the badge or tab carries the label.
 */
export function RankDigit({ value }: { value: number }) {
  return <span className="rank-digit" aria-hidden="true" style={{ "--digit": `url("${DIVISION_DIGITS[value]}")` } as CSSProperties} />;
}
