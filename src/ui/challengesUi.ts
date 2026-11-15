import { applyEvent, createRunProgress, gameEvents } from '../challenges/check';
import { CHALLENGE_CONFIG } from '../challenges/config';
import type { Challenge } from '../challenges/format';
import { isCleared, markCleared, parseProgress, serializeProgress, type Progress } from '../challenges/progress';
import type { ParkData } from '../park/format';
import { fadeInOut } from './hud';
import type { FlowEvent, Game } from './flow';

/**
 * Visningen av utfordringer: lista på startskjermen (med hake for klarte), en kort melding i HUD-en
 * når du klarer en for første gang, og hva du klarte denne runden på resultatskjermen.
 * Selve sjekken er ren logikk i src/challenges/. Fremgangen lagres i nettleseren (localStorage).
 */
const FONT = 'system-ui,sans-serif';

function load(): Progress {
  try { return parseProgress(localStorage.getItem(CHALLENGE_CONFIG.storageKey)); } catch { return {}; }
}
function save(p: Progress): void {
  try { localStorage.setItem(CHALLENGE_CONFIG.storageKey, serializeProgress(p)); } catch { /* privat modus o.l.: glemmes bare */ }
}

function row(done: boolean, label: string, extra = ''): HTMLDivElement[] {
  const mark = document.createElement('div');
  mark.textContent = done ? '✓' : '○';
  mark.style.cssText = `text-align:right;color:${done ? '#7fe3ff' : '#fff8'};`;
  const t = document.createElement('div');
  t.textContent = label + extra;
  t.style.color = done ? '#fff' : '#fffc';
  return [mark, t];
}

function box(): { el: HTMLDivElement; title: HTMLDivElement; grid: HTMLDivElement } {
  const el = document.createElement('div');
  el.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:6px;font:600 15px/1.3 ${FONT};max-width:92vw;`;
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:800;font-size:17px;';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:auto auto;gap:3px 10px;';
  el.append(title, grid);
  return { el, title, grid };
}

export function createChallengesUi(
  root: HTMLElement,
  menu: { addToStart(el: HTMLElement): void; addToResult(el: HTMLElement): void },
  parkKey: string,
  park: ParkData,
  list: readonly Challenge[],
) {
  let progress = load();
  const run = createRunProgress();
  /** id-ene som ble klart for første gang denne runden */
  const firstThisRun: string[] = [];
  const textOf = (id: string) => list.find((c) => c.id === id)?.text ?? id;
  const doneCount = () => list.filter((c) => isCleared(progress, parkKey, c.id)).length;

  // startskjermen: alle utfordringene, med hake for de du har klart
  const start = box();
  const drawStart = () => {
    start.title.textContent = `Utfordringer · ${doneCount()} av ${list.length} klart`;
    start.grid.replaceChildren(...list.flatMap((c) => row(isCleared(progress, parkKey, c.id), c.text)));
  };
  // resultatskjermen: det du klarte denne runden
  const result = box();
  const drawResult = () => {
    result.title.textContent = `Utfordringer denne runden · ${doneCount()} av ${list.length} totalt`;
    result.grid.replaceChildren(...(run.cleared.length === 0
      ? row(false, 'Ingen klart denne runden')
      : run.cleared.flatMap((id) => row(true, textOf(id), firstThisRun.includes(id) ? ' · ny!' : ''))));
  };
  if (list.length > 0) {
    drawStart();
    menu.addToStart(start.el);
    menu.addToResult(result.el);
  }

  // kort melding i HUD-en, én om gangen, myk inn og ut
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;left:0;right:0;top:17%;text-align:center;color:#ffd166;font:800 26px ${FONT};`
    + 'text-shadow:0 0 3px #000c,0 2px 10px #000a;pointer-events:none;opacity:0;padding:0 16px;';
  root.appendChild(toast);
  const queue: string[] = [];
  let toastAge = 99;

  return {
    /** Kalles etter hvert fysikksteg med det ui/flow.ts sin stepGame ga tilbake. */
    step(g: Game, ev: FlowEvent) {
      if (list.length === 0) return;
      if (ev === 'ny-runde') firstThisRun.length = 0;
      const now: string[] = [];
      for (const e of gameEvents(g, ev, park)) now.push(...applyEvent(run, list, e));
      if (now.length > 0) {
        const m = markCleared(progress, parkKey, now);
        if (m.added.length > 0) {
          progress = m.progress;
          save(progress);
          drawStart();
          firstThisRun.push(...m.added);
          queue.push(...m.added.map((id) => `Utfordring klart: ${textOf(id)}`));
        }
      }
      if (ev === 'mål') drawResult();
    },

    /** Kalles hvert bilde. hudOpacity = hvor synlig HUD-en er (meldingen blekner bort bak menyene). */
    update(dt: number, hudOpacity: number) {
      toastAge += dt;
      if (toastAge >= CHALLENGE_CONFIG.toastTime + CHALLENGE_CONFIG.toastGap && queue.length > 0) {
        toast.textContent = queue.shift()!;
        toastAge = 0;
      }
      toast.style.opacity = (fadeInOut(toastAge, CHALLENGE_CONFIG.toastTime) * hudOpacity).toFixed(3);
    },
  };
}
