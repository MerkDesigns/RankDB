import { uiText } from "../text/index";
import { Minus, X } from "lucide-react";
import { windowActions } from "../platform/window";

/**
 * Minimise and close for a custom window frame. There is no maximise: the window is fixed-width
 * and not maximisable; its height is changed by dragging the top or bottom edge.
 * "row" reads left to right like Windows; "column" puts close at the top, nearest the corner.
 */
export function WindowControls({ layout }: { readonly layout: "row" | "column" }) {
  const buttons = [
    { key: "minimize", title: uiText("windowControls.minimize"), icon: <Minus size={16} strokeWidth={2} />, action: windowActions.minimize },
    { key: "close", title: uiText("common.close"), icon: <X size={17} strokeWidth={2} />, action: windowActions.close },
  ];
  const ordered = layout === "column" ? [...buttons].reverse() : buttons;
  return (
    <div className="window-controls" data-layout={layout}>
      {ordered.map((button) => (
        <button
          key={button.key}
          type="button"
          className="window-button"
          data-kind={button.key}
          aria-label={button.title}
          onClick={() => void button.action()}
        >
          {button.icon}
        </button>
      ))}
    </div>
  );
}
