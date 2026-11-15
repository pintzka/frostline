import { CONFIG } from '../core/config';
import { saveParkChoice, searchWithPark } from '../park/choice';
import { CURRENT_PARK_ID, PARK_IDS, PARKS } from '../park/parks';
import { CONTROLS } from './controlsText';
import { fade, resultLines, scoreLines, type Flow, type FlowEvent, type Game, type Phase } from './flow';

/**
 * Startskjerm, resultatskjerm og et kort slør ved ny runde. Bare visning; logikken ligger i flow.ts.
 * Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 */
const FONT = 'system-ui,sans-serif';

function overlay(root: HTMLElement, bg: string, top = false): HTMLDivElement {
  const el = document.createElement('div');
  // top: innholdet ligger øverst, så skiløperen midt på skjermen synes
  el.style.cssText = `position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;gap:22px;`
    + (top ? 'justify-content:flex-start;padding-top:9vh;' : 'justify-content:safe center;')
    // lave skjermer (mobil, laptop): menyen kan rulles i stedet for å bli kuttet
    + 'box-sizing:border-box;padding-bottom:16px;overflow-y:auto;overscroll-behavior:contain;'
    + `background:${bg};color:#fff;font:600 18px/1.35 ${FONT};text-shadow:0 1px 4px #0009;cursor:pointer;user-select:none;opacity:0;pointer-events:none;`;
  root.appendChild(el);
  return el;
}

/** To kolonner: hva til venstre, verdi til høyre. */
function table(rows: [string, string][], size: number): HTMLDivElement {
  const t = document.createElement('div');
  t.style.cssText = `display:grid;grid-template-columns:auto auto;gap:6px 18px;font-size:${size}px;max-width:92vw;`;
  for (const [a, b] of rows) {
    const l = document.createElement('div');
    l.style.cssText = 'text-align:right;color:#fffb;';
    l.textContent = a;
    const r = document.createElement('div');
    r.textContent = b;
    t.append(l, r);
  }
  return t;
}

function text(content: string, css: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = css;
  el.textContent = content;
  return el;
}

/**
 * Bytter park. Parken bygges når spillet lastes (bakke, fysikk, trær og fall-respawn leser den da),
 * så valget huskes i localStorage og siden lastes på nytt med parken i adressen (?park=). Adressen er
 * reserven når localStorage er blokkert, så knappen virker alltid.
 */
function switchPark(id: string): void {
  if (id === CURRENT_PARK_ID) return;
  saveParkChoice(id);
  location.search = searchWithPark(location.search, id);
}

/** Knappene for å velge park. Tastene 1, 2, … velger også (bare på start- og resultatskjermen). */
function parkPicker(enabled: () => boolean): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;max-width:92vw;';
  row.append(text('Bakke:', 'color:#fffb;font-size:17px;'));
  PARK_IDS.forEach((id, i) => {
    const on = id === CURRENT_PARK_ID;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${i + 1}  ${PARKS[id].name}`;
    b.style.cssText = `font:700 17px ${FONT};padding:8px 16px;border-radius:999px;cursor:pointer;color:#fff;`
      + (on ? 'background:#3a8fd9;border:2px solid #fff;' : 'background:#ffffff22;border:2px solid #ffffff55;');
    // trykket på en knapp skal ikke også starte runden (det gjør et klikk ellers på skjermen).
    // click (ikke pointerdown), og på resultatskjermen først etter resultMinTime, så et trykk inn i mål ikke bytter park
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); if (enabled()) switchPark(id); });
    row.append(b);
  });
  return row;
}

/** extra: noe som skal stå på startskjermen over «Trykk mellomrom», f.eks. grafikkvalget. */
export function createMenu(root: HTMLElement, extra?: HTMLElement) {
  let clicked = false;
  const click = (e: Event) => { e.preventDefault(); clicked = true; };

  // startskjerm: spillet synes svakt bak
  const start = overlay(root, 'radial-gradient(ellipse at center,#0d1620aa,#0d1620dd)');
  const startPrompt = text('Trykk mellomrom eller klikk for å kjøre', `font:700 22px ${FONT};margin-top:8px;text-align:center;`);
  start.append(
    text('FROSTLINE', `font:800 clamp(44px,12vw,88px)/1 ${FONT};letter-spacing:.12em;`),
    parkPicker(() => shown === 'start'),
    table(CONTROLS, 16),
    ...(extra ? [extra] : []),
    startPrompt,
  );
  start.addEventListener('click', click);

  // resultatskjerm: lysere, så du ser skiløperen bremse inn bak
  const result = overlay(root, 'linear-gradient(#0d1620dd,#0d162055 60%,#0d162033)', true);
  const resultTitle = text('Ferdig!', `font:800 52px/1 ${FONT};`);
  const resultBody = document.createElement('div');
  const prompt = text('Mellomrom for ny runde', `font:700 22px ${FONT};text-align:center;transition:opacity .15s;`);
  result.append(resultTitle, resultBody, prompt, parkPicker(() => resultReady));
  result.addEventListener('click', click);

  // mørkt slør som skjuler at skiløperen og kameraet hopper tilbake til toppen
  const veil = document.createElement('div');
  veil.style.cssText = 'position:fixed;inset:0;background:#0d1620;opacity:0;pointer-events:none;';
  root.appendChild(veil);

  let startO = 1, resultO = 0, veilO = 0;
  let shown: Phase = 'start';
  /** Resultatskjermen har vist seg lenge nok (resultMinTime) til at parkvalget virker. */
  let resultReady = false;

  // tastene 1, 2, … velger park, men bare når en meny vises (ikke mens du kjører)
  addEventListener('keydown', (e) => {
    if (!(shown === 'start' || resultReady) || e.repeat || !/^Digit[1-9]$/.test(e.code)) return;
    const id = PARK_IDS[Number(e.code.slice(5)) - 1];
    if (id) switchPark(id);
  });

  return {
    /** Sant én gang etter et klikk eller trykk på en meny. */
    takeClick(): boolean { const c = clicked; clicked = false; return c; },

    /** Legger noe til på startskjermen og resultatskjermen, rett over teksten om å kjøre (f.eks. utfordringene). */
    addToStart(el: HTMLElement) { start.insertBefore(el, startPrompt); },
    addToResult(el: HTMLElement) { result.insertBefore(el, prompt); },

    onEvent(ev: FlowEvent, game: Game) {
      const flow = game.flow;
      // poengene først, så tid, fart og lufttid
      if (ev === 'mål') resultBody.replaceChildren(table([...scoreLines(game.score, flow.bestBefore), ...resultLines(flow.stats)], 22));
      // første start skjer der skiløperen alt står, så da trengs ikke sløret
      if (ev === 'ny-runde' && shown !== 'start') veilO = CONFIG.restartVeil;
    },

    /** Kalles hvert bilde. Gir hvor synlig HUD-en skal være (0–1). */
    update(flow: Flow, dt: number): number {
      shown = flow.phase;
      resultReady = flow.phase === 'resultat' && flow.phaseAge >= CONFIG.resultMinTime;
      startO = fade(startO, flow.phase === 'start' ? 1 : 0, dt, CONFIG.startFadeOut);
      const inResult = flow.phase === 'resultat';
      resultO = fade(resultO, inResult ? 1 : 0, dt, inResult ? CONFIG.resultFadeIn : CONFIG.resultFadeOut);
      veilO = fade(veilO, 0, dt, CONFIG.restartVeilTime / CONFIG.restartVeil);
      start.style.opacity = String(startO);
      start.style.pointerEvents = flow.phase === 'start' ? 'auto' : 'none';
      result.style.opacity = String(resultO);
      result.style.pointerEvents = inResult ? 'auto' : 'none';
      veil.style.opacity = String(veilO);
      // teksten «ny runde» lyser opp når mellomrom faktisk virker
      prompt.style.opacity = inResult && flow.phaseAge >= CONFIG.resultMinTime ? '1' : '0.35';
      return 1 - Math.max(startO, resultO);
    },
  };
}
