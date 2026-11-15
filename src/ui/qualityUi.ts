import { LOOK } from '../render/look';
import {
  CHOICE_NAME, CHOICES, createAutoQuality, createFpsMeter, parseChoice, settingsFor, startLevel,
  type Choice, type QualitySettings,
} from '../render/quality';

/**
 * Grafikkvalget (Auto / Lav / Middels / Høy) på startskjermen og pauseskjermen, og FPS-måleren i hjørnet (F).
 * Begge valgene huskes i nettleseren. Logikken (nivåer, snitt, Auto) ligger i render/quality.ts.
 * Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 */
const CHOICE_KEY = 'frostline-grafikk';
const FPS_KEY = 'frostline-fps';

function load(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ikke viktig */ }
}
function isMobile(): boolean {
  try { return matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

export function createQualityUi(root: HTMLElement) {
  const mobile = isMobile();
  let choice = parseChoice(load(CHOICE_KEY));
  let level = startLevel(choice, mobile);
  let auto = createAutoQuality(level);
  const meter = createFpsMeter();
  let fpsOn = load(FPS_KEY) === '1';
  let lastFps = 0;
  let waiting = false;

  // FPS-måleren: liten tekst nede til høyre, oppdateres én gang i sekundet
  const fps = document.createElement('div');
  fps.style.cssText = 'position:fixed;right:10px;bottom:calc(6px + env(safe-area-inset-bottom));z-index:3;'
    + 'color:#fffc;font:600 12px/1 ui-monospace,monospace;text-shadow:0 1px 2px #000a;pointer-events:none;';
  root.appendChild(fps);

  const pickers: Map<Choice, HTMLButtonElement>[] = [];
  // myke kanter (antialias) velges når rendereren lages, så de byttes først når siden lastes på nytt
  const startAntialias = settingsFor(level).antialias;
  const notes: HTMLElement[] = [];

  function refresh() {
    for (const buttons of pickers) {
      for (const [c, b] of buttons) {
        const on = c === choice;
        b.textContent = c === 'auto' && on ? `Auto (${CHOICE_NAME[level]})` : CHOICE_NAME[c];
        b.style.background = on ? '#fff' : '#0006';
        b.style.color = on ? '#0d1620' : '#fff';
      }
    }
    const reloadNote = settingsFor(level).antialias !== startAntialias;
    for (const n of notes) n.style.display = reloadNote ? 'block' : 'none';
    fps.style.display = fpsOn ? 'block' : 'none';
    const n = lastFps > 0 ? String(Math.round(lastFps)) : '–';
    fps.textContent = `${n} fps · ${CHOICE_NAME[level]}${choice === 'auto' ? ' (auto)' : ''}`;
  }

  function choose(c: Choice) {
    choice = c;
    save(CHOICE_KEY, c);
    level = startLevel(c, mobile);
    auto = createAutoQuality(level);
    meter.reset();
    refresh();
  }

  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    fpsOn = !fpsOn;
    save(FPS_KEY, fpsOn ? '1' : '0');
    refresh();
  });

  refresh();
  return {
    /** Innstillingene for nivået som gjelder nå. */
    get settings(): QualitySettings { return settingsFor(level); },

    /** Lager en rad med knapper for valget. Kan lages flere ganger (startskjerm og pause); de holdes like. */
    picker(): HTMLElement {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;'
        + 'font:600 15px system-ui,sans-serif;cursor:default;';
      const label = document.createElement('span');
      label.textContent = 'Grafikk';
      label.style.marginRight = '4px';
      row.appendChild(label);
      const buttons = new Map<Choice, HTMLButtonElement>();
      for (const c of CHOICES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'padding:6px 12px;border:1px solid #fff8;border-radius:8px;font:600 15px system-ui,sans-serif;cursor:pointer;';
        // klikket skal ikke også starte spillet eller avslutte pausen
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); choose(c); b.blur(); });
        buttons.set(c, b);
        row.appendChild(b);
      }
      const note = document.createElement('div');
      note.textContent = 'Myke kanter byttes først når siden lastes på nytt';
      note.style.cssText = 'flex-basis:100%;text-align:center;font-size:13px;opacity:.75;';
      row.appendChild(note);
      notes.push(note);
      row.addEventListener('pointerdown', (e) => e.stopPropagation());
      row.addEventListener('click', (e) => e.stopPropagation());
      pickers.push(buttons);
      refresh();
      return row;
    },

    /** Sier om deler av forrige nivåbytte fortsatt venter på å bli tatt i bruk (fra scene.applyQuality). */
    setWaiting(w: boolean) { waiting = w; },

    /**
     * Kalles hvert bilde med tiden siden forrige (0 på pause). Måler fps, lar Auto senke nivået,
     * og gir innstillingene som skal gjelde.
     */
    frame(dt: number): QualitySettings {
      if (!(dt > 0) || waiting) {
        // pause, eller et nivåbytte som ikke er tatt i bruk ennå (venter til pause/meny):
        // ikke mål, og vent litt etterpå før Auto måler igjen, så den ikke senker ett hakk til for tidlig
        meter.reset();
        auto.hold();
      } else {
        const v = meter.add(dt);
        if (v !== null) {
          lastFps = v;
          if (choice === 'auto') {
            const lower = auto.update(v, LOOK.quality.fpsWindow);
            if (lower) level = lower;
          }
          refresh();
        }
      }
      return settingsFor(level);
    },
  };
}
