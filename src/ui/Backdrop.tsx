import { useEffect, useRef, useState } from "react";
import type { AmbientField } from "../glass/ambientField";
import { blobCss, dotsCss, resolveBackdrop } from "../glass/backdrops";
import { localViewport } from "../glass/engine";
import { useSettings } from "../data/settingsStore";
import { labStore, useLab } from "../lab/store";
import { startAmbientField } from "../glass/ambientField";
import { startSmokeField } from "../glass/smokeField";
import { dragRegion } from "../platform/window";

/**
 * Ambient depth layers for parallax (ambientField.ts). Parallax is a lab experiment, off by
 * request in releases, which draw the field on one canvas.
 */
const AMBIENT_LAYERS = import.meta.env.DEV ? 3 : 1;

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
  // re-rendering React. Ambient draws on its depth layers (parallax), back to front.
  const field = useRef<HTMLCanvasElement>(null);
  const layers = useRef<HTMLCanvasElement[]>([]);
  const ambientField = useRef<AmbientField | null>(null);
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
      const ambient = startAmbientField(layers.current, labStore.get().ambient, base());
      ambientField.current = ambient;
      update = () => ambient.set(labStore.get().ambient, base());
      destroy = () => {
        ambientField.current = null;
        ambient.destroy();
      };
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

  useListScrollRange(ambientField, zoom, fieldKind);

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
      {fieldKind === "ambient"
        ? Array.from({ length: AMBIENT_LAYERS }, (_, index) => (
            <canvas
              key={`ambient-${index}`}
              ref={(canvas) => {
                if (canvas) layers.current[index] = canvas;
                if (index === 0) field.current = canvas;
              }}
              className={AMBIENT_LAYERS > 1 ? "backdrop-field backdrop-layer" : "backdrop-field"}
            />
          ))
        : fieldKind && <canvas key={fieldKind} ref={field} className="backdrop-field" />}
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

/**
 * Tells the ambient field the list's scroll range (and the UI scale) whenever it changes: rows
 * added or removed, groups opening, the window resized. Never on scroll itself.
 */
function useListScrollRange(field: { readonly current: AmbientField | null }, zoom: number, fieldKind: string | null) {
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".list-scroller");
    const content = scroller?.firstElementChild;
    if (AMBIENT_LAYERS === 1 || fieldKind !== "ambient" || !scroller || !content) return;
    const measure = () => field.current?.setScroll(Math.max(0, scroller.scrollHeight - scroller.clientHeight));
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, [field, zoom, fieldKind]);
}
