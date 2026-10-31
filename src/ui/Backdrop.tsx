import { useEffect, useState } from "react";
import { blobCss, dotsCss, resolveBackdrop } from "../glass/backdrops";
import { localViewport } from "../glass/engine";
import { useSettings } from "../data/settingsStore";
import { useLab } from "../lab/store";
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
