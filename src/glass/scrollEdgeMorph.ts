import { useLayoutEffect, type RefObject } from "react";
import { labStore } from "../lab/store";
import { setRimSlice } from "./engine";
import { projectScrollSlices, readScrollLayout, scrollPlaneMask, type ScrollLayout } from "./scrollEdgeGeometry";

/**
 * TaskMap's SettingsIslandList: cached geometry, one frame transaction, a stationary Minor plane.
 *
 * The content sits in a sticky `stage` and is moved by `--stage-scroll` in the same frame as the
 * slices. Natively scrolled content is moved by the compositor a frame before the slices catch up,
 * so the islands' edges wobbled against the viewport while scrolling. Scrolling stays native: the
 * viewport scrolls over a spacer as tall as the content.
 */
export function useScrollEdgeMorph(
  viewportRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  spacerRef: RefObject<HTMLElement | null>,
  planeRef: RefObject<HTMLElement | null>,
  cardSelector: string,
) {
  useLayoutEffect(() => {
    const viewport = viewportRef.current, plane = planeRef.current;
    const stage = stageRef.current, content = contentRef.current, spacer = spacerRef.current;
    const owner = plane?.parentElement;
    if (!viewport || !plane || !owner || !stage || !content || !spacer) return;
    let applied = 0;
    let layout: ScrollLayout | null = null;
    let needsLayout = true;
    let frame = 0;
    let overscan = 0;
    const written = new Map<HTMLElement, string>();
    const sync = () => {
      frame = 0;
      if (needsLayout) {
        // Scroll range: the stage covers the viewport, the spacer adds whatever content exceeds it.
        spacer.style.height = Math.max(0, content.offsetHeight - stage.clientHeight + paddingY(stage)) + "px";
        layout = readScrollLayout(viewport, owner, cardSelector, stage, applied);
        overscan = parseFloat(getComputedStyle(plane).getPropertyValue("--minor-os")) || 0;
        needsLayout = !layout;
      }
      if (!layout) return;
      const top = viewport.scrollTop;
      if (top !== applied) {
        applied = top;
        content.style.setProperty("--stage-scroll", -top + "px");
      }
      // Read/projection phase, then commit slices, rims and plane together (TaskMap owner order).
      const slices = projectScrollSlices(layout);
      const mask = scrollPlaneMask(slices, overscan);
      for (const { card, insets } of slices) {
        const key = [card.width, card.height, card.radius, ...(insets ?? [])].join(",");
        if (written.get(card.element) === key) continue;
        written.set(card.element, key);
        if (!insets) { card.element.dataset.slice = "hidden"; continue; }
        // Zero insets stay applied too: no state/layer switch at the whole/sliced boundary.
        card.element.dataset.slice = "true";
        SIDES.forEach((side, i) => card.element.style.setProperty("--slice-" + side, insets[i] + "px"));
        setRimSlice(card.element, insets, card);
      }
      plane.style.setProperty("--island-mask", mask.image);
      plane.style.setProperty("--island-mask-position", mask.position);
      plane.style.setProperty("--island-mask-size", mask.size);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    const invalidate = () => { needsLayout = true; schedule(); };
    const resize = new ResizeObserver(invalidate);
    const observe = () => {
      resize.disconnect();
      resize.observe(owner);
      resize.observe(viewport);
      resize.observe(content);
      viewport.querySelectorAll(cardSelector).forEach((card) => resize.observe(card));
    };
    const mutations = new MutationObserver(() => { observe(); invalidate(); });
    observe();
    mutations.observe(viewport, { childList: true, subtree: true });
    viewport.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", invalidate);
    const unsubscribe = labStore.subscribe(invalidate);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      unsubscribe();
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", invalidate);
      written.forEach((_, card) => {
        delete card.dataset.slice;
        SIDES.forEach((side) => card.style.removeProperty("--slice-" + side));
        setRimSlice(card, null);
      });
      content.style.removeProperty("--stage-scroll");
      spacer.style.removeProperty("height");
    };
  }, [viewportRef, planeRef, cardSelector]);
}

const SIDES = ["top", "right", "bottom", "left"] as const;

function paddingY(element: HTMLElement) {
  const style = getComputedStyle(element);
  return (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
}
