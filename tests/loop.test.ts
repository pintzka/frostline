import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLoop } from '../src/core/loop';

// later som nettleseren: samler opp bilde-kall og kjører dem når testen sier fra
let queue: ((t: number) => void)[] = [];
beforeEach(() => {
  queue = [];
  (globalThis as any).requestAnimationFrame = (cb: (t: number) => void) => { queue.push(cb); return queue.length; };
  (globalThis as any).cancelAnimationFrame = () => { queue = []; };
});
afterEach(() => {
  delete (globalThis as any).requestAnimationFrame;
  delete (globalThis as any).cancelAnimationFrame;
});

/** Kjør neste bilde på tidspunktet ms. */
function frame(ms: number) {
  const cb = queue.shift();
  if (cb) cb(ms);
}

function setup() {
  let steps = 0, renders = 0;
  const loop = createLoop({ hz: 100, step: () => { steps++; }, render: () => { renders++; } });
  return { loop, steps: () => steps, renders: () => renders };
}

describe('spill-løkka', () => {
  it('kjører fysikken i fast takt', () => {
    const t = setup();
    t.loop.start();
    frame(0); frame(100);
    expect(t.steps()).toBe(10);
  });

  it('står helt stille på pause, men tegner fortsatt bildet', () => {
    const t = setup();
    t.loop.start();
    frame(0); frame(100);
    t.loop.pause();
    expect(t.loop.isPaused()).toBe(true);
    const before = t.steps(), renders = t.renders();
    frame(200); frame(5000);
    expect(t.steps()).toBe(before);
    expect(t.renders()).toBeGreaterThan(renders);
  });

  it('tar ikke igjen tiden som gikk på pause', () => {
    const t = setup();
    t.loop.start();
    frame(0); frame(100);
    t.loop.pause();
    frame(200); frame(60000);
    t.loop.resume();
    const before = t.steps();
    frame(60100); frame(60200);
    // bare de 100 ms etter at pausen sluttet (pluss ett bilde), ikke ett minutt
    expect(t.steps() - before).toBeLessThanOrEqual(20);
    expect(t.steps() - before).toBeGreaterThanOrEqual(10);
  });

  it('toggle bytter mellom pause og spill', () => {
    const t = setup();
    expect(t.loop.toggle()).toBe(true);
    expect(t.loop.toggle()).toBe(false);
  });
});
