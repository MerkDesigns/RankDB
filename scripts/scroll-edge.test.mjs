import assert from "node:assert/strict";
import { test } from "node:test";
import { readScrollLayout, projectScrollSlices, scrollPlaneMask } from "../src/glass/scrollEdgeGeometry.ts";

function fixture(scale = 1) {
  let reads = 0;
  const element = (left, top, width, height, padding = {}) => ({
    scrollTop: 0, scrollLeft: 0,
    getBoundingClientRect() { reads++; return { left: 100 + left * scale, top: 50 + top * scale, width: width * scale, height: height * scale }; },
    style: { boxSizing: "border-box", width: `${width}px`, height: `${height}px`, borderTopLeftRadius: "13.5px", getPropertyValue: (key) => `${padding[key] ?? 0}px` },
  });
  const owner = element(0, 0, 400, 240);
  const viewport = element(-4, 0, 408, 240, { "padding-top": 16, "padding-bottom": 8, "padding-left": 4, "padding-right": 4 });
  const cards = [element(0, 16, 400, 181.5625), element(0, 209.5625, 400, 89)];
  viewport.querySelectorAll = () => cards;
  return { owner, viewport, cards, reads: () => reads };
}

test("TaskMap projection keeps fractional geometry local during presence scale and avoids scroll-time layout reads", (t) => {
  const f = fixture(0.96);
  let styleReads = 0;
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (e) => { styleReads++; return e.style; };
  t.after(() => {
    if (previous) globalThis.getComputedStyle = previous;
    else delete globalThis.getComputedStyle;
  });
  const layout = readScrollLayout(f.viewport, f.owner, ".card");
  assert.ok(Math.abs(layout.cards[0].height - 181.5625) < 0.00001);
  const before = { rects: f.reads(), styles: styleReads };
  for (const scroll of [0, 0.25, 4.5, 40.25, 49, 10.125, 0]) {
    f.viewport.scrollTop = scroll;
    const [slice] = projectScrollSlices(layout);
    assert.ok(Math.abs(slice.shape.top - 16) < 0.00001);
    assert.ok(Math.abs(slice.card.height - 181.5625) < 0.00001);
  }
  assert.deepEqual({ rects: f.reads(), styles: styleReads }, before);
});

test("thin slices narrow into TaskMap's pill and wholly invisible cards are hidden", () => {
  const viewport = { scrollTop: 0, scrollLeft: 0 };
  const card = { element: {}, left: 0, top: 92, width: 100, height: 40, radius: 12 };
  const layout = { viewport, scrollTop: 0, scrollLeft: 0, clip: { left: 0, top: 0, width: 100, height: 100 }, cards: [card] };
  const [slice] = projectScrollSlices(layout);
  assert.deepEqual(slice.insets, [0, 8, 32, 8]);
  assert.deepEqual(slice.shape, { left: 8, top: 92, width: 84, height: 8, radius: 12 });
  viewport.scrollTop = -20;
  assert.equal(projectScrollSlices(layout)[0].shape, null);
});

test("scrolling back and forth never accumulates geometry drift", () => {
  const viewport = { scrollTop: 0, scrollLeft: 0 };
  const card = { element: {}, left: 0, top: 16, width: 400, height: 181.5625, radius: 13.5 };
  const layout = { viewport, scrollTop: 0, scrollLeft: 0, clip: { left: 0, top: 16, width: 400, height: 216 }, cards: [card] };
  const initial = projectScrollSlices(layout);
  for (let i = 0; i < 2000; i++) {
    viewport.scrollTop = (i % 197) / 4;
    assert.equal(projectScrollSlices(layout)[0].shape.top, 16);
  }
  viewport.scrollTop = 0;
  assert.deepEqual(projectScrollSlices(layout), initial);
});

test("plane masks use reusable gradient caps and explicitly hide an empty batch", () => {
  const empty = scrollPlaneMask([], 15);
  assert.deepEqual(empty, { image: "linear-gradient(transparent, transparent)", position: "0 0", size: "100% 100%" });
  const mask = scrollPlaneMask([{ card: {}, insets: [0, 0, 0, 0], shape: { left: 4, top: 16, width: 400, height: 90.5, radius: 13.5 } }], 15);
  assert.ok(mask.image.includes("radial-gradient"));
  assert.ok(!mask.image.includes("url("));
  assert.ok(mask.position.startsWith("19px 31px"));
  assert.ok(!/NaN|Infinity/.test(mask.size));
});
