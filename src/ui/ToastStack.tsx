import { uiText } from "../text/index";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "sonner";
import { Glass } from "../glass/Glass";

/** Sonner owns entrance, exit, measured stacking, swipe dismissal and hover/hidden timer pauses. */
export function ToastStack() {
  const root = useRef<HTMLDivElement>(null);
  const [surfaces, setSurfaces] = useState<HTMLElement[]>([]);
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    // Sonner owns its li and its motion. Portal only the existing Major material into that
    // surface; it adds no layout height and keeps the library's measuring/gesture logic intact.
    const sync = () => {
      const next = [...container.querySelectorAll<HTMLElement>("[data-sonner-toast]")];
      setSurfaces((old) => old.length === next.length && old.every((element, index) => element === next[index]) ? old : next);
    };
    const observer = new MutationObserver(sync);
    observer.observe(container, { childList: true, subtree: true });
    sync();
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className="notification-layer">
      <Toaster
        theme="dark"
        containerAriaLabel={uiText("notifications.region")}
        position="bottom-right"
        expand
        visibleToasts={3}
        gap={10}
        offset={{ bottom: 16, right: 16 }}
        mobileOffset={{ bottom: 16, right: 16, left: 16 }}
        closeButton
        className="rankdb-toaster"
        toastOptions={{ className: "rankdb-toast", closeButtonAriaLabel: uiText("notifications.dismiss") }}
        icons={{
          success: <CircleCheck size={18} />,
          info: <Info size={18} />,
          warning: <TriangleAlert size={18} />,
          error: <TriangleAlert size={18} />,
          close: <X size={14} />,
        }}
      />
      {surfaces.map((surface) => createPortal(
        <Glass role="major" floating className="sonner-major-material" aria-hidden="true" />,
        surface,
        surface.dataset.testid,
      ))}
    </div>
  );
}

