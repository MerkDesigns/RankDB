import { useEffect, useRef, useState } from "react";
import { blobCss, dotsCss, resolveBackdrop } from "../glass/backdrops";
import { localViewport } from "../glass/engine";
import { useSettings } from "../data/settingsStore";
import { labStore, useLab } from "../lab/store";
import { startAmbientField } from "../glass/ambientField";
import { startSmokeField } from "../glass/smokeField";
import { dragRegion } from "../platform/window";

/** The scene glass sits on. Rendered with plain CSS so it costs nothing until glass samples it. */
export function Backdrop() {
  const backdrop = useLab((state) => state.backdrop);
  const backdropColor = useLab((state) => state.backdropColor);
  const zoom = useSettings((settings) => settings.uiScale);
  const chrome = useLab((state) => state.chrome);
  const spec = resolveBackdrop(backdrop, backdropColor);
  const [viewport, setViewport] = useState(() => localViewport(zoom));

  useEffect(() => {
    const update = () => setViewport(localViewport(zoom));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [zoom]);

  // WebGL fields (smoke, ambient) draw themselves; tuning reaches them from the store without
  // re-rendering React.
  const field = useRef<HTMLCanvasElement>(null);
  const fieldKind = spec.field;
  useEffect(() => {
    const canvas = field.current;
    if (!fieldKind || !canvas) return;
    const base = () => resolveBackdrop(labStore.get().backdrop, labStore.get().backdropColor).base;
    let update: () => void;
    let destroy: () => void;
    if (fieldKind === "smoke") {
      const smoke = startSmokeField(canvas, labStore.get().smoke, base());
      update = () => smoke.set(labStore.get().smoke, base());
      destroy = smoke.destroy;
    } else {
      const ambient = startAmbientField(canvas, labStore.get().ambient, base());
      update = () => ambient.set(labStore.get().ambient, base());
      destroy = ambient.destroy;
    }
    // Only changes the field cares about reach it (the store also changes for panel moves etc.).
    let last = labStore.get();
    const unsubscribe = labStore.subscribe(() => {
      const next = labStore.get();
      if (next.smoke === last.smoke && next.ambient === last.ambient && next.backdropColor === last.backdropColor) return;
      last = next;
      update();
    });
    return () => {
      unsubscribe();
      destroy();
    };
  }, [fieldKind]);

  const longSide = Math.max(viewport.width, viewport.height);
  return (
    <div
      className="backdrop"
      data-animated={spec.animated || undefined}
      style={{
        backgroundColor: spec.base,
        backgroundImage: spec.dots ? dotsCss(spec.dots) : undefined,
        backgroundSize: spec.dots ? `${spec.dots.spacing}px ${spec.dots.spacing}px` : undefined,
      }}
      aria-hidden="true"
      {...dragRegion(chrome)}
    >
      {fieldKind && <canvas key={fieldKind} ref={field} className="backdrop-field" />}
      {spec.blobs.map((blob, index) => {
        const radius = blob.r * longSide;
        return (
          <span
            key={index}
            className="backdrop-blob"
            data-drift={index % 4}
            style={{
              left: blob.x * viewport.width - radius,
              top: blob.y * viewport.height - radius,
              width: radius * 2,
              height: radius * 2,
              backgroundImage: blobCss(blob),
            }}
          />
        );
      })}
    </div>
  );
}
