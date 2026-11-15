import { AUDIO } from './config';
import { changedEnough, detectEvents, skidAmount, soundLevels, type SoundLevels } from './mix';
import { speedOf, type SkierInput, type SkierState } from '../physics/skier';

/**
 * Lyden i spillet, laget i kode med Web Audio (ingen lydfiler).
 * Finnes ikke Web Audio (testmiljø, gamle nettlesere), gjør alt her ingenting.
 * Nettleseren krever et trykk før lyd kan starte. Vi prøver ved hvert tastetrykk/klikk/berøring
 * til lyden faktisk går (på mobil teller bare slipp av fingeren, ikke selve trykket).
 * M slår lyden av og på.
 */
export interface GameAudio {
  /** Kalles etter hvert fysikksteg. Husker tilstanden og finner pop og landing. */
  step(prev: SkierState, cur: SkierState, inp: SkierInput): void;
  /** Kalles én gang per bilde. Sender de nye nivåene mykt til lyden. */
  frame(): void;
  /** Ny runde: lyden dukkes kort, så den ikke faller brått. */
  newRun(): void;
  /** Pause: toner ned og stopper all lyd (brukes av pause senere). */
  suspend(): void;
  resume(): void;
  toggleMute(): void;
  readonly muted: boolean;
}

/** Det lyden trenger fra nettleseren. Tester kan sende inn en falsk utgave. */
export interface AudioEnv {
  AC?: new () => AudioContext;
  /** Her lyttes det etter taster og trykk (vanligvis window). */
  target: EventTarget;
  /** Siden: hidden og visibilitychange. */
  doc: EventTarget & { readonly hidden: boolean };
  note(text: string): void;
  loadMuted(): boolean;
  saveMuted(m: boolean): void;
}

const MUTE_KEY = 'frostline-lyd-av';
const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click'];

function browserEnv(): AudioEnv | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return {
    AC, target: window, doc: document, note: showNote,
    loadMuted() { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } },
    saveMuted(m) { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ikke viktig */ } },
  };
}

export function createAudio(env: AudioEnv | null = browserEnv()): GameAudio {
  let muted = env?.loadMuted() ?? false;
  let paused = false;
  let engine: Engine | null = null;
  // siste tilstand fra fysikken, og hendelser som venter på neste bilde
  let cur: SkierState | null = null;
  let brake = 0;
  let popQueue = 0, landQueue = 0, newRunQueued = false;
  let woken = false;

  const asleep = () => paused || !!env?.doc.hidden;
  const wake = () => { if (engine && !asleep()) { woken = true; engine.wake(muted); } };

  const api: GameAudio = {
    get muted() { return muted; },
    step(prev, s, inp) {
      cur = s;
      brake = inp.brake;
      const e = detectEvents(prev, s);
      // flere hendelser på ett bilde: behold den sterkeste
      if (e.pop !== null) popQueue = Math.max(popQueue, e.pop);
      if (e.landing !== null) landQueue = Math.max(landQueue, e.landing);
    },
    frame() {
      if (engine && cur) {
        // regnes bare én gang per bilde, ikke for hvert fysikksteg
        engine.apply(soundLevels({
          speed: speedOf(cur), grounded: cur.grounded, edge: cur.edge, brake, skid: cur.grounded ? skidAmount(cur) : 0,
        }));
        if (newRunQueued && !muted && !asleep()) engine.duck();
        if (popQueue > AUDIO.minEvent) engine.pop(popQueue);
        if (landQueue > AUDIO.minEvent) engine.landing(landQueue);
      }
      popQueue = 0; landQueue = 0; newRunQueued = false;
    },
    newRun() { newRunQueued = true; },
    suspend() { paused = true; engine?.sleep(); },
    resume() { paused = false; wake(); },
    toggleMute() {
      muted = !muted;
      env?.saveMuted(muted);
      if (engine && !asleep()) engine.setMaster(muted);
      env?.note(muted ? 'Lyd av (M)' : 'Lyd på (M)');
    },
  };

  const AC = env?.AC;
  if (!env || !AC) return api;

  // prøv å starte lyden ved hvert trykk, helt til den faktisk går
  const unlock = (e: Event) => {
    if (!engine) {
      try { engine = buildEngine(new AC()); } catch { return; }
      // M som første tast: ikke vis «Lyd på» rett før «Lyd av»
      if (!muted && (e as KeyboardEvent).code !== 'KeyM') env.note('Lyd på · M slår av');
    }
    if (asleep()) return;
    const ctx = engine.ctx;
    // første gang: ton inn rolig; senere forsøk prøver bare å få nettleseren til å starte lyden
    if (!woken) { woken = true; engine.wake(muted); }
    ctx.resume().then(() => {
      if (ctx.state === 'running') for (const t of UNLOCK_EVENTS) env.target.removeEventListener(t, unlock);
    }).catch(() => {});
  };
  for (const t of UNLOCK_EVENTS) env.target.addEventListener(t, unlock);

  env.target.addEventListener('keydown', (e) => {
    const k = e as KeyboardEvent;
    if (k.code === 'KeyM' && !k.repeat) api.toggleMute();
  });
  // skjult fane: ingen lyd i bakgrunnen
  env.doc.addEventListener('visibilitychange', () => {
    if (env.doc.hidden) engine?.sleep();
    else wake();
  });

  return api;
}

/** Liten beskjed oppe til høyre som blekner bort. */
let noteEl: HTMLDivElement | null = null;
let noteTimer = 0;
function showNote(text: string): void {
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

/** Stopper planlagte endringer, men holder verdien der den er nå (ingen hopp). */
function holdNow(p: AudioParam, t: number): void {
  const withHold = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
  if (withHold.cancelAndHoldAtTime) withHold.cancelAndHoldAtTime(t);
  else { const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
}

function buildEngine(ctx: AudioContext) {
  const white = noiseBuffer(ctx, false);
  const brown = noiseBuffer(ctx, true);

  // alt går gjennom hovedvolum og en limiter som bare tar toppene
  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  const L = AUDIO.limiter;
  limiter.threshold.value = L.threshold;
  limiter.knee.value = L.knee;
  limiter.ratio.value = L.ratio;
  limiter.attack.value = L.attack;
  limiter.release.value = L.release;
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
  /** Langsomme bølger som får volumet til å svinge litt (vindkast, grov skrape). Sinus, så ingen klikk. */
  const wobbly = (waves: readonly (readonly [number, number])[]) => {
    const g = ctx.createGain();
    g.gain.value = 1;
    for (const [hz, depth] of waves) {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      const d = ctx.createGain();
      d.gain.value = depth;
      o.connect(d).connect(g.gain);
      o.start();
    }
    return g;
  };
  const Q = AUDIO.q;

  // vind: mørk støy gjennom et filter som åpner seg med farten, med rolige vindkast
  const windF = filter('lowpass', AUDIO.windHz[0], Q.wind);
  const wind = silent();
  loop(brown).connect(windF).connect(wind).connect(wobbly(AUDIO.gusts)).connect(master);

  // snø-sus: lys støy, uten den dypeste rumlingen
  const snowF = filter('lowpass', AUDIO.snowHz[0], Q.snow);
  const snow = silent();
  loop(white).connect(filter('highpass', AUDIO.snowHighpassHz, Q.snowHighpass)).connect(snowF).connect(snow).connect(master);

  // carve-hvisl: smalt, lyst bånd
  const carveF = filter('bandpass', AUDIO.carveHz[0], Q.carve);
  const carve = silent();
  loop(white).connect(carveF).connect(carve).connect(master);

  // skrape: lavere bånd som rister litt
  const scrapeF = filter('bandpass', AUDIO.scrapeHz[0], Q.scrape);
  const scrape = silent();
  loop(white).connect(scrapeF).connect(scrape).connect(wobbly(AUDIO.grit)).connect(master);

  const hz = (range: readonly [number, number], tone: number) => range[0] * Math.pow(range[1] / range[0], tone);

  // send bare når verdien har endret seg merkbart, så det ikke hoper seg opp planlagte endringer
  const sent = new Map<AudioParam, number>();
  const glide = (p: AudioParam, v: number, tau: number, isFreq = false) => {
    if (!changedEnough(sent.get(p), v, isFreq ? AUDIO.sendFreqStep : AUDIO.sendGainStep, isFreq)) return;
    sent.set(p, v);
    p.setTargetAtTime(v, ctx.currentTime, tau);
  };

  /** Hovedvolumet: holder der det er og glir mot målet. */
  const masterTo = (v: number, tau: number) => {
    const t = ctx.currentTime;
    holdNow(master.gain, t);
    master.gain.setTargetAtTime(v, t, tau);
  };

  let sleepTimer: ReturnType<typeof setTimeout> | undefined;
  let started = false;

  /** Kort lyd: starter fra 0, topper raskt og dør ut mykt. Stoppes når den er stille. */
  const envelope = (peak: number, tau: number) => {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + AUDIO.shotAttack);
    g.gain.setTargetAtTime(0, t + AUDIO.shotAttack, tau);
    g.connect(master);
    return { g, t, end: t + AUDIO.shotAttack + tau * AUDIO.shotStopTaus };
  };
  const tone = (fromHz: number, toHz: number, sweep: number, peak: number, tau: number) => {
    const { g, t, end } = envelope(peak, tau);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(fromHz, t);
    osc.frequency.exponentialRampToValueAtTime(toHz, t + sweep);
    osc.connect(g);
    osc.start(t);
    osc.stop(end);
  };
  const noiseShot = (buf: AudioBuffer, type: BiquadFilterType, f: number, q: number, peak: number, tau: number) => {
    const { g, t, end } = envelope(peak, tau);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(filter(type, f, q)).connect(g);
    // start et tilfeldig sted i støyen, så to like lyder ikke høres helt like ut
    src.start(t, Math.random() * (buf.duration - 1));
    src.stop(end);
  };

  return {
    ctx,
    /** M: glir mykt av eller på. */
    setMaster(muted: boolean) { masterTo(muted ? 0 : AUDIO.masterVolume, AUDIO.muteFade); },
    /** Start eller fortsett: lyden går igjen, og hovedvolumet tones mykt inn. */
    wake(muted: boolean) {
      clearTimeout(sleepTimer);
      sleepTimer = undefined;
      const fade = started ? AUDIO.sleepFade / 3 : AUDIO.startFade;
      started = true;
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      masterTo(muted ? 0 : AUDIO.masterVolume, fade);
    },
    /** Pause/skjult fane: ton ned først, og stopp lyden når den er stille (ellers klikker det). */
    sleep() {
      masterTo(0, AUDIO.sleepFade / 3);
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => { ctx.suspend().catch(() => {}); }, AUDIO.sleepFade * 1000 + 10);
    },
    /** Ny runde: ned kort, hold, og opp igjen, mens vind og sus glir til de nye nivåene. */
    duck() {
      const t = ctx.currentTime, D = AUDIO.duck;
      holdNow(master.gain, t);
      master.gain.setTargetAtTime(0, t, D.down);
      master.gain.setTargetAtTime(AUDIO.masterVolume, t + D.hold, D.up);
    },
    apply(l: SoundLevels) {
      const s = AUDIO.smooth, m = AUDIO.mix;
      glide(wind.gain, l.wind * m.wind, s.wind);
      glide(windF.frequency, hz(AUDIO.windHz, l.windTone), s.wind, true);
      glide(snow.gain, l.snow * m.snow, s.snow);
      glide(snowF.frequency, hz(AUDIO.snowHz, l.snowTone), s.snow, true);
      glide(carve.gain, l.carve * m.carve, s.carve);
      glide(carveF.frequency, hz(AUDIO.carveHz, l.carveTone), s.carve, true);
      glide(scrape.gain, l.scrape * m.scrape, s.scrape);
      glide(scrapeF.frequency, hz(AUDIO.scrapeHz, l.scrapeTone), s.scrape, true);
    },
    /** Landing: dyp tone som synker + mykt dunk + litt knas, alt kraftigere jo hardere. */
    landing(h: number) {
      const S = AUDIO.landSound, peak = AUDIO.mix.landing * h;
      tone(S.toneHz + S.toneHzPerHard * h, S.toneEndHz, S.toneSweep, peak * S.toneShare, S.toneTau + S.toneTauPerHard * h);
      noiseShot(brown, 'lowpass', S.thumpHz + S.thumpHzPerHard * h, S.thumpQ, peak, S.thumpTau + S.thumpTauPerHard * h);
      noiseShot(white, 'bandpass', S.crunchHz, S.crunchQ, peak * S.crunchShare * h, S.crunchTau);
    },
    /** Pop: kort, lett «tsjk» fra skiene som slipper snøen. */
    pop(p: number) {
      const S = AUDIO.popSound, peak = AUDIO.mix.pop * p;
      noiseShot(white, 'bandpass', S.hissHz, S.hissQ, peak, S.hissTau);
      tone(S.tockHz, S.tockEndHz, S.tockSweep, peak * S.tockShare, S.tockTau);
    },
  };
}
