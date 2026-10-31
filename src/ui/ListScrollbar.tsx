import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { settingsStore } from "../data/settingsStore";

const MIN_THUMB = 32;

/**
 * A thin overlay scrollbar for the account list. It only shows while the pointer is over the
 * window, and its thumb widens when the pointer is on it.
 *
 * The thumb follows scrolling through a scroll-driven animation on `--list-scroll` (compositor,
 * no JS per scroll frame). JS only sizes it on resize, and moves the list when the thumb is dragged
 * or the track is clicked.
 */
export function ListScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const geometry = useRef({ travel: 0, maxScroll: 0, thumb: MIN_THUMB });
  const drag = useRef<{ pointerId: number; startY: number; startScroll: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const scroller = track?.parentElement?.querySelector<HTMLElement>(".list-scroller") ?? null;
    if (!track || !thumb || !scroller) return;
    scrollerRef.current = scroller;

    const measure = () => {
      const trackHeight = track.clientHeight;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const scrollable = maxScroll > 1 && trackHeight > 0;
      track.dataset.scrollable = String(scrollable);
      if (!scrollable) return;
      const size = Math.max(MIN_THUMB, (scroller.clientHeight / scroller.scrollHeight) * trackHeight);
      const travel = Math.max(0, trackHeight - size);
      geometry.current = { travel, maxScroll, thumb: size };
      thumb.style.height = `${size}px`;
      thumb.style.setProperty("--thumb-travel", `${travel}px`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(track);
    const content = scroller.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, []);

  /** Screen pixels to the app's UI pixels (the app is zoomed). */
  const toLocal = (pixels: number) => pixels / settingsStore.get().uiScale;

  const onThumbDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startScroll: scroller.scrollTop };
    trackRef.current!.dataset.dragging = "";
  };
  const onThumbMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    const active = drag.current;
    if (!scroller || !active || active.pointerId !== event.pointerId) return;
    const { travel, maxScroll } = geometry.current;
    if (travel <= 0) return;
    scroller.scrollTop = active.startScroll + (toLocal(event.clientY - active.startY) / travel) * maxScroll;
  };
  const onThumbUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    delete trackRef.current!.dataset.dragging;
  };

  // Clicking the track jumps so the thumb centres on the click.
  const onTrackDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track || event.button !== 0) return;
    const { travel, maxScroll, thumb } = geometry.current;
    if (travel <= 0) return;
    const clickY = toLocal(event.clientY - track.getBoundingClientRect().top);
    const progress = Math.min(1, Math.max(0, (clickY - thumb / 2) / travel));
    scroller.scrollTo({ top: progress * maxScroll, behavior: "smooth" });
  };

  return (
    <div ref={trackRef} className="list-scrollbar" aria-hidden="true" onPointerDown={onTrackDown}>
      <div
        ref={thumbRef}
        className="list-scrollbar-thumb"
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
      />
    </div>
  );
}
