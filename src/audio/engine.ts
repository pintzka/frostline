import { AUDIO } from './config';
import { detectEvents, skidAmount, soundLevels, type SoundLevels } from './mix';
import { speedOf, type SkierInput, type SkierState } from '../physics/skier';

/**
 * Lyden i spillet, laget i kode med Web Audio (ingen lydfiler).
 * Finnes ikke Web Audio (testmiljø, gamle nettlesere), gjør alt her ingenting.
 * Nettleseren krever et klikk eller tastetrykk før lyd kan starte, så vi starter ved første keydown/pointerdown.
 * M slår lyden av og på.
 */
export interface GameAudio {
  /** Kalles etter hvert fysikksteg. Husker tilstanden og finner pop og landing. */
  step(prev: SkierState, cur: SkierState, inp: SkierInput): void;
  /** Kalles én gang per bilde. Sender de nye nivåene mykt til lyden. */
  frame(): void;
  /** Pause: stopper all lyd (brukes av pause senere). */
  suspend(): void;
  resume(): void;
  toggleMute(): void;
  readonly muted: boolean;
}

const MUTE_KEY = 'frostline-lyd-av';

function loadMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
function saveMuted(m: boolean): void {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ikke viktig */ }
}

export function createAudio(): GameAudio {
  const AC: typeof AudioContext | undefined = typeof window === 'undefined' ? undefined
    : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  let muted = loadMuted();
  let paused = false;
  let engine: Engine | null = null;
  // siste tilstand fra fysikken, og hendelser som venter på neste bilde
  let levels: SoundLevels = soundLevels({ speed: 0, grounded: true, edge: 0, brake: 0, skid: 0 });
  let popQueue = 0, landQueue = 0;

  const api: GameAudio = {
    get muted() { return muted; },
    step(prev, cur, inp) {
      levels = soundLevels({ speed: speedOf(cur), grounded: cur.grounded, edge: cur.edge, brake: inp.brake, skid: cur.grounded ? skidAmount(cur) : 0 });
      const e = detectEvents(prev, cur);
      // flere hendelser på ett bilde: behold den sterkeste
      if (e.pop !== null) popQueue = Math.max(popQueue, e.pop);
      if (e.landing !== null) landQueue = Math.max(landQueue, e.landing);
    },
    frame() {
      if (engine) {
        engine.apply(levels);
        if (popQueue > 0.02) engine.pop(popQueue);
        if (landQueue > 0.02) engine.landing(landQueue);
      }
      popQueue = 0; landQueue = 0;
    },
    suspend() { paused = true; engine?.ctx.suspend().catch(() => {}); },
    resume() { paused = false; if (engine && !document.hidden) engine.ctx.resume().catch(() => {}); },
    toggleMute() {
      muted = !muted;
      saveMuted(muted);
      engine?.setMuted(muted);
      showNote(muted ? 'Lyd av (M)' : 'Lyd på (M)');
    },
  };

  if (!AC || typeof document === 'undefined') return api;

  // start lyden ved første klikk eller tastetrykk
  const start = () => {
    if (engine) return;
    try {
      engine = buildEngine(new AC());
    } catch {
      return;
    }
    engine.setMuted(muted, true);
    if (paused || document.hidden) engine.ctx.suspend().catch(() => {});
    else engine.ctx.resume().catch(() => {});
    removeEventListener('keydown', start);
    removeEventListener('pointerdown', start);
    if (!muted) showNote('Lyd på · M slår av');
  };
  addEventListener('keydown', start);
  addEventListener('pointerdown', start);

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) api.toggleMute();
  });
  // skjult fane: ingen lyd i bakgrunnen
  document.addEventListener('visibilitychange', () => {
    if (!engine) return;
    if (document.hidden) engine.ctx.suspend().catch(() => {});
    else if (!paused) engine.ctx.resume().catch(() => {});
  });

  return api;
}

/** Liten beskjed oppe til høyre som blekner bort. */
let noteEl: HTMLDivElement | null = null;
let noteTimer = 0;
function showNote(text: string): void {
  if (typeof document === 'undefined') return;
  if (!noteEl) {
    noteEl = document.createElement('div');
    noteEl.style.cssText = 'position:fixed;right:16px;top:16px;color:#fff;font:600 15px system-ui,sans-serif;text-shadow:0 1px 3px #0008;pointer-events:none;opacity:0;transition:opacity .3s;';
    document.body.appendChild(noteEl);
  }
  noteEl.textContent = text;
  noteEl.style.opacity = '1';
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => { if (noteEl) noteEl.style.opacity = '0'; }, 1800);
}

type Engine = ReturnType<typeof buildEngine>;

/** Lager støy som kan gå i loop uten klikk i skjøten. brown = mørk, rumlende støy (vind). */
function noiseBuffer(ctx: AudioContext, brown: boolean): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * 4);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last; } else d[i] = white;
  }
  if (brown) {
    // dra slutten ned til starten, så loopen ikke gir et lite klikk
    const drift = d[n - 1] - d[0];
    let peak = 0;
    for (let i = 0; i < n; i++) { d[i] -= (drift * i) / (n - 1); peak = Math.max(peak, Math.abs(d[i])); }
    for (let i = 0; i < n; i++) d[i] /= peak || 1;
  }
  return buf;
}

function buildEngine(ctx: AudioContext) {
  const white = noiseBuffer(ctx, false);
  const brown = noiseBuffer(ctx, true);

  // alt går gjennom hovedvolum og en limiter, så summen aldri blir for høy
  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(ctx.destination);

  /** Støy som går hele tiden, hver med eget startpunkt så de ikke låter likt. */
  const loop = (buf: AudioBuffer) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start(0, Math.random() * buf.duration);
    return src;
  };
  const filter = (type: BiquadFilterType, hz: number, q: number) => {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = hz; f.Q.value = q;
    return f;
  };
  const silent = () => { const g = ctx.createGain(); g.gain.value = 0; return g; };
  /** Langsom bølge som får volumet til å svinge litt (vindkast, grov skrape). Sinus, så ingen klikk. */
  const wobble = (target: AudioParam, hz: number, depth: number) => {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
  };

  // vind: mørk støy gjennom et filter som åpner seg med farten, med rolige vindkast
  const windF = filter('lowpass', AUDIO.windHz[0], 0.8);
  const wind = silent();
  const windGust = ctx.createGain();
  windGust.gain.value = 1;
  wobble(windGust.gain, 0.13, 0.18);
  wobble(windGust.gain, 0.37, 0.08);
  loop(brown).connect(windF).connect(wind).connect(windGust).connect(master);

  // snø-sus: lys støy, uten den dypeste rumlingen
  const snowF = filter('lowpass', AUDIO.snowHz[0], 0.5);
  const snow = silent();
  loop(white).connect(filter('highpass', 250, 0.5)).connect(snowF).connect(snow).connect(master);

  // carve-hvisl: smalt, lyst bånd
  const carveF = filter('bandpass', AUDIO.carveHz[0], 1.6);
  const carve = silent();
  loop(white).connect(carveF).connect(carve).connect(master);

  // skrape: lavere bånd som rister litt (to bølger oppå hverandre gjør den grov)
  const scrapeF = filter('bandpass', AUDIO.scrapeHz[0], 0.9);
  const scrape = silent();
  const scrapeGrit = ctx.createGain();
  scrapeGrit.gain.value = 1;
  wobble(scrapeGrit.gain, 13, 0.25);
  wobble(scrapeGrit.gain, 21.7, 0.18);
  loop(white).connect(scrapeF).connect(scrape).connect(scrapeGrit).connect(master);

  const hz = (range: readonly [number, number], tone: number) => range[0] * Math.pow(range[1] / range[0], tone);
  const glide = (p: AudioParam, v: number, tau: number) => p.setTargetAtTime(v, ctx.currentTime, tau);

  /** Kort lyd som starter fra 0, topper raskt og dør ut mykt. Stoppes når den er stille. */
  const burst = (src: AudioScheduledSourceNode, chain: AudioNode, peak: number, tau: number) => {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.setTargetAtTime(0, t + 0.008, tau);
    chain.connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.01 + tau * 8);
  };
  const noiseShot = (buf: AudioBuffer, type: BiquadFilterType, f: number, q: number, peak: number, tau: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = filter(type, f, q);
    src.connect(flt);
    // start et tilfeldig sted i støyen, så to like lyder ikke høres helt like ut
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.setTargetAtTime(0, t + 0.008, tau);
    flt.connect(g).connect(master);
    src.start(t, Math.random() * (buf.duration - 1));
    src.stop(t + 0.01 + tau * 8);
  };

  return {
    ctx,
    /** Av/på glir mykt. Første gang tones lyden ekstra rolig inn, så det ikke smeller i gang. */
    setMuted(m: boolean, first = false) {
      glide(master.gain, m ? 0 : AUDIO.masterVolume, first ? 0.4 : AUDIO.muteFade);
    },
    apply(l: SoundLevels) {
      const s = AUDIO.smooth, m = AUDIO.mix;
      glide(wind.gain, l.wind * m.wind, s.wind);
      glide(windF.frequency, hz(AUDIO.windHz, l.windTone), s.wind);
      glide(snow.gain, l.snow * m.snow, s.snow);
      glide(snowF.frequency, hz(AUDIO.snowHz, l.snowTone), s.snow);
      glide(carve.gain, l.carve * m.carve, s.carve);
      glide(carveF.frequency, hz(AUDIO.carveHz, l.carveTone), s.carve);
      glide(scrape.gain, l.scrape * m.scrape, s.scrape);
      glide(scrapeF.frequency, hz(AUDIO.scrapeHz, l.scrapeTone), s.scrape);
    },
    /** Landing: dypt dump (synkende tone) + mykt snø-puff, alt kraftigere jo hardere. */
    landing(h: number) {
      const t = ctx.currentTime;
      const peak = AUDIO.mix.landing * h;
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(80 + 50 * h, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      burst(osc, osc, peak * 0.8, 0.07 + 0.08 * h);
      noiseShot(brown, 'lowpass', 300 + 900 * h, 0.7, peak, 0.06 + 0.06 * h);
      noiseShot(white, 'bandpass', 1600, 0.8, peak * 0.25 * h, 0.035);
    },
    /** Pop: kort, lett «tsjk» fra skiene som slipper snøen. */
    pop(p: number) {
      const t = ctx.currentTime;
      const peak = AUDIO.mix.pop * p;
      noiseShot(white, 'bandpass', 2400, 1.2, peak, 0.025);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(210, t);
      osc.frequency.exponentialRampToValueAtTime(130, t + 0.06);
      burst(osc, osc, peak * 0.4, 0.025);
    },
  };
}
