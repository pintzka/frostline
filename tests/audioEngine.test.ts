import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO } from '../src/audio/config';
import { changedEnough } from '../src/audio/mix';
import { createAudio, type AudioEnv } from '../src/audio/engine';
import { createSkier } from '../src/physics/skier';

// En liten falsk Web Audio, så vi kan sjekke hva lydmotoren gjør uten nettleser.
type Call = [string, ...number[]];
class FakeParam {
  value = 0;
  calls: Call[] = [];
  setTargetAtTime(v: number, t: number, tau: number) { this.calls.push(['target', v, t, tau]); }
  setValueAtTime(v: number, t: number) { this.calls.push(['set', v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.calls.push(['linear', v, t]); }
  exponentialRampToValueAtTime(v: number, t: number) { this.calls.push(['exp', v, t]); }
  cancelScheduledValues(t: number) { this.calls.push(['cancel', t]); }
  cancelAndHoldAtTime(t: number) { this.calls.push(['hold', t]); }
  targets() { return this.calls.filter((c) => c[0] === 'target'); }
}
class FakeNode {
  out: unknown = null;
  gain = new FakeParam(); frequency = new FakeParam(); Q = new FakeParam();
  threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam(); attack = new FakeParam(); release = new FakeParam();
  type = ''; buffer: unknown = null; loop = false;
  constructor(public kind: string, ctx: FakeCtx) { ctx.nodes.push(this); }
  connect<T>(n: T): T { this.out = n; return n; }
  start() {}
  stop() {}
}
let activation = false;
class FakeCtx {
  static last: FakeCtx;
  nodes: FakeNode[] = [];
  state = 'suspended';
  currentTime = 0;
  sampleRate = 3000;
  destination = {};
  resumes = 0;
  suspends = 0;
  constructor() { FakeCtx.last = this; }
  createGain() { return new FakeNode('gain', this); }
  createBiquadFilter() { return new FakeNode('filter', this); }
  createBufferSource() { return new FakeNode('source', this); }
  createOscillator() { return new FakeNode('osc', this); }
  createDynamicsCompressor() { return new FakeNode('limiter', this); }
  createBuffer(_c: number, n: number) { const d = new Float32Array(n); return { duration: n / this.sampleRate, getChannelData: () => d }; }
  resume() { this.resumes++; if (activation) this.state = 'running'; return Promise.resolve(); }
  suspend() { this.suspends++; this.state = 'suspended'; return Promise.resolve(); }
  master() { const lim = this.nodes.find((n) => n.kind === 'limiter'); return this.nodes.find((n) => n.out === lim)!.gain; }
}

function setup(muted = false) {
  const target = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const notes: string[] = [];
  const env: AudioEnv = {
    AC: FakeCtx as unknown as new () => AudioContext, target, doc,
    note: (t) => notes.push(t), loadMuted: () => muted, saveMuted: () => {},
  };
  const audio = createAudio(env);
  return { audio, target, doc, notes };
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const key = (code: string) => Object.assign(new Event('keydown'), { code, repeat: false });

beforeEach(() => { activation = false; vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
afterEach(() => { vi.useRealTimers(); });

describe('lydmotoren (falsk Web Audio)', () => {
  it('mobil: prøver igjen ved slipp av fingeren til lyden faktisk går, og slutter så å lytte', async () => {
    const { target } = setup();
    // touch-trykk gir ikke lov til lyd ennå
    target.dispatchEvent(new Event('pointerdown'));
    await flush();
    const ctx = FakeCtx.last;
    expect(ctx.state).toBe('suspended');
    // slipp av fingeren gir lov
    activation = true;
    target.dispatchEvent(new Event('touchend'));
    await flush();
    expect(ctx.state).toBe('running');
    const n = ctx.resumes;
    target.dispatchEvent(new Event('click'));
    await flush();
    expect(ctx.resumes).toBe(n);
  });

  it('pause og skjult fane: toner ned før lyden stoppes, og inn igjen etterpå', async () => {
    activation = true;
    const { audio, target } = setup();
    target.dispatchEvent(new Event('pointerup'));
    await flush();
    const ctx = FakeCtx.last, master = ctx.master();
    audio.suspend();
    expect(master.targets().at(-1)![1]).toBe(0);
    expect(ctx.suspends).toBe(0);
    vi.advanceTimersByTime(AUDIO.sleepFade * 1000 + 20);
    expect(ctx.suspends).toBe(1);
    audio.resume();
    await flush();
    expect(ctx.state).toBe('running');
    expect(master.targets().at(-1)![1]).toBe(AUDIO.masterVolume);
  });

  it('pause rett etter fortsett: stopper ikke lyden likevel', async () => {
    activation = true;
    const { audio, target } = setup();
    target.dispatchEvent(new Event('pointerup'));
    await flush();
    audio.suspend();
    audio.resume();
    vi.advanceTimersByTime(500);
    expect(FakeCtx.last.suspends).toBe(0);
  });

  it('ny runde: lyden dukkes kort og kommer tilbake', async () => {
    activation = true;
    const { audio, target } = setup();
    target.dispatchEvent(new Event('pointerup'));
    await flush();
    const s = createSkier();
    audio.step({ ...s }, s, { steer: 0, brake: 0 });
    audio.newRun();
    audio.frame();
    const t = FakeCtx.last.master().targets().slice(-2);
    expect(t[0][1]).toBe(0);
    expect(t[1][1]).toBe(AUDIO.masterVolume);
    expect(t[1][2]).toBeCloseTo(AUDIO.duck.hold, 9);
  });

  it('sender bare nye verdier når noe har endret seg', async () => {
    activation = true;
    const { audio, target } = setup();
    target.dispatchEvent(new Event('pointerup'));
    await flush();
    const ctx = FakeCtx.last;
    const s = createSkier();
    const count = () => ctx.nodes.reduce((n, x) => n + x.gain.targets().length + x.frequency.targets().length, 0);
    audio.step({ ...s }, s, { steer: 0, brake: 0 });
    audio.frame();
    const first = count();
    for (let i = 0; i < 10; i++) { audio.step({ ...s }, s, { steer: 0, brake: 0 }); audio.frame(); }
    expect(count()).toBe(first);
  });

  it('M som første tast viser bare «Lyd av»', async () => {
    const { target, notes } = setup();
    target.dispatchEvent(key('KeyM'));
    expect(notes).toEqual(['Lyd av (M)']);
  });

  it('limiteren tar bare toppene og slipper fort', async () => {
    activation = true;
    const { target } = setup();
    target.dispatchEvent(new Event('pointerup'));
    const lim = FakeCtx.last.nodes.find((n) => n.kind === 'limiter')!;
    expect(lim.threshold.value).toBe(AUDIO.limiter.threshold);
    expect(AUDIO.limiter.threshold).toBeGreaterThanOrEqual(-4);
    expect(lim.knee.value).toBe(0);
    expect(lim.release.value).toBeLessThanOrEqual(0.1);
  });
});

describe('changedEnough', () => {
  it('sender første gang og ved merkbar endring, ikke ved bittesmå', () => {
    expect(changedEnough(undefined, 0.5, 0.003)).toBe(true);
    expect(changedEnough(0.5, 0.501, 0.003)).toBe(false);
    expect(changedEnough(0.5, 0.51, 0.003)).toBe(true);
    expect(changedEnough(1000, 1005, 0.01, true)).toBe(false);
    expect(changedEnough(1000, 1020, 0.01, true)).toBe(true);
  });
});
