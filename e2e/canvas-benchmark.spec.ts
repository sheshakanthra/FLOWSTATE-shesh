import { expect, test } from "@playwright/test";

const STORY_URL = "http://localhost:6006/iframe.html?id=features-agents-canvas--benchmark&viewMode=story";

/**
 * B1 gate items 1-3: 300 nodes / 400 edges, sustained pan+zoom, >=55fps at
 * p95, zero node re-renders while panning, and virtualization above the
 * 100-node threshold. Drives the "300 nodes / 400 edges" story
 * (features/agents/canvas/canvas.stories.tsx) directly through Storybook's
 * iframe rather than the real app -- there's no in-product way to seed a
 * synthetic 300-node graph, nor should there be one.
 *
 * The fps figure below is an automated proxy (rAF frame-interval sampling
 * across the scripted pan/zoom sequence), not a human reading the Chrome
 * DevTools Performance panel the gate calls for -- see PROGRESS.md's B1
 * decisions for why, and for the actual number the gate asks to be recorded.
 */
test("300 nodes / 400 edges: virtualizes, never re-renders nodes on pan, holds frame rate under sustained pan+zoom", async ({
  page,
}) => {
  await page.goto(STORY_URL);

  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();

  // Gate item 3: above the 100-node threshold, off-viewport nodes are
  // absent from the DOM -- 300 were seeded, but only a viewport's worth
  // (plus React Flow's overscan) should ever be mounted.
  const nodeLocator = page.locator(".react-flow__node");
  await expect(nodeLocator.first()).toBeVisible();
  const mountedNodeCount = await nodeLocator.count();
  expect(mountedNodeCount).toBeGreaterThan(0);
  // Generous bound (observed: ~36 at the default 1280x720 viewport) --
  // comfortably under even the 100-node virtualization threshold itself,
  // not just under the 300 seeded.
  expect(mountedNodeCount).toBeLessThan(100);

  const paneBox = await pane.boundingBox();
  if (!paneBox) throw new Error("Canvas pane has no layout box");
  // A point guaranteed to land on empty pane space, not a node: the
  // benchmark grid places nodes at columns spaced 220px apart (each node
  // ~168px wide) and rows 140px apart (each node 44px tall), so flow (200,
  // 100) always falls in the gap between cells regardless of which cell it
  // lands in mod the spacing. Starting a drag anywhere else risks grabbing
  // whatever node happens to render at that point and dragging it instead
  // of panning the canvas.
  const originX = paneBox.x + 200;
  const originY = paneBox.y + 100;

  // Gate item 2, isolated from zoom: a node visible at the default
  // viewport, instrumented with a render counter (generic-node.tsx's
  // data-render-count). A short pan that returns to the exact starting
  // viewport -- no zoom involved, so nothing can drift and virtualize the
  // node out from under the check -- must leave its render count
  // unchanged. The full pan+zoom sequence below drifts the viewport by
  // design (that's the realistic scenario the fps figure needs), which can
  // legitimately virtualize bench-node-0 in and out of the DOM -- a correct
  // remount, not a same-instance re-render, so it can't be read the same
  // way and isn't asserted on there.
  const firstNode = page.locator('.react-flow__node[data-id="bench-node-0"] [data-render-count]');
  await expect(firstNode).toBeVisible();
  const renderCountBeforePan = await firstNode.getAttribute("data-render-count");
  await page.mouse.move(originX, originY);
  await page.mouse.down();
  await page.mouse.move(originX + 150, originY + 80, { steps: 10 });
  await page.mouse.move(originX, originY, { steps: 10 });
  await page.mouse.up();
  const renderCountAfterPan = await firstNode.getAttribute("data-render-count");
  expect(renderCountAfterPan).toBe(renderCountBeforePan);

  // In-page rAF sampler, installed before the sustained interaction starts
  // so it captures real frame-delivery timing across the whole window.
  await page.evaluate(() => {
    const w = window as unknown as { __frameTimes: number[]; __rafHandle: number };
    w.__frameTimes = [];
    let last = performance.now();
    const loop = (now: number) => {
      w.__frameTimes.push(now - last);
      last = now;
      w.__rafHandle = requestAnimationFrame(loop);
    };
    w.__rafHandle = requestAnimationFrame(loop);
  });

  // Gate item 1: 10 seconds of continuous pan + zoom.
  const durationMs = 10_000;
  const start = Date.now();
  let direction = 1;
  while (Date.now() - start < durationMs) {
    await page.mouse.move(originX, originY);
    await page.mouse.down();
    await page.mouse.move(originX + 120 * direction, originY + 60 * direction, { steps: 8 });
    await page.mouse.move(originX, originY, { steps: 8 });
    await page.mouse.up();
    await page.mouse.wheel(0, direction * -120);
    direction *= -1;
  }

  const frameTimes = await page.evaluate(() => {
    const w = window as unknown as { __frameTimes: number[]; __rafHandle: number };
    cancelAnimationFrame(w.__rafHandle);
    return w.__frameTimes;
  });

  const samples = frameTimes.slice(5).filter((duration) => duration > 0);
  samples.sort((a, b) => a - b);
  const p95Index = Math.floor(0.95 * (samples.length - 1));
  const p95DurationMs = samples[p95Index] as number;
  const p95Fps = 1000 / p95DurationMs;

  test.info().annotations.push({
    type: "canvas-benchmark-p95-fps",
    description: `p95 frame time ${p95DurationMs.toFixed(2)}ms -> ${p95Fps.toFixed(1)}fps over ${samples.length} sampled frames`,
  });

  expect(p95Fps).toBeGreaterThanOrEqual(55);
});
