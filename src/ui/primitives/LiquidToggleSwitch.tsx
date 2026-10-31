import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { Glass } from "../../glass/Glass";
import {
  advanceLiquidToggle,
  createLiquidToggleState,
  settledLiquidToggle,
  type LiquidToggleFrame,
} from "./motion/liquidToggleMotion";

/**
 * TaskMap's liquid toggle switch (src/ui/primitives/LiquidToggleSwitch.tsx), ported. A track with
 * a glass knob that springs across, stretching and thinning with its speed. The knob is Minor
 * glass; on a settings island it becomes a shell, exactly as in TaskMap.
 *
 * Motion writes the knob's style straight to the DOM each frame, never through React.
 */
export function LiquidToggleSwitch({
  checked,
  label,
  disabled,
  onCheckedChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  const knobRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(createLiquidToggleState(checked));
  const frameRef = useRef(0);

  useEffect(() => {
    const knob = knobRef.current;
    if (!knob) return;
    const write = (frame: LiquidToggleFrame) => {
      knob.style.width = `${frame.width}px`;
      knob.style.height = `${frame.height}px`;
      knob.style.transform = `translate3d(${frame.x}px, -50%, 0)`;
      knob.style.setProperty("--g-radius", `${frame.radius}px`);
      knob.dataset.settled = String(frame.settled);
    };
    cancelAnimationFrame(frameRef.current);
    let previous = performance.now();
    const step = (now: number) => {
      const frame = advanceLiquidToggle(stateRef.current, checked, now - previous);
      previous = now;
      stateRef.current = frame.state;
      write(frame);
      if (!frame.settled) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [checked]);

  const settled = settledLiquidToggle(checked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="liquid-toggle"
      onClick={(event: MouseEvent) => {
        // A toggle inside a clickable row must not toggle twice.
        event.stopPropagation();
        onCheckedChange(!checked);
      }}
    >
      <span className="liquid-toggle-track" data-checked={checked || undefined} aria-hidden="true">
        <Glass
          ref={knobRef}
          role="minor"
          live
          className="liquid-toggle-knob"
          data-switch-state={checked ? "on" : "off"}
          style={
            {
              width: settled.width,
              height: settled.height,
              transform: `translate3d(${settled.x}px, -50%, 0)`,
              "--g-radius": `${settled.radius}px`,
            } as CSSProperties
          }
        >
          <span className="liquid-toggle-knob-tint" />
        </Glass>
      </span>
    </button>
  );
}
