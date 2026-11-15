/**
 * Knappen «Se reprise» på resultatskjermen, og skiltet mens reprisen går. Bare visning og taster;
 * logikken ligger i replay.ts og camera/replayCam.ts. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 * Taster: V = se reprise, C (eller 1–3) = bytt kamera, mellomrom eller Esc = tilbake til resultatet.
 */
const FONT = 'system-ui,sans-serif';

export interface ReplayUiState {
  /** Reprisen kan startes nå (resultatskjermen, og runden kom i mål). */
  available: boolean;
  active: boolean;
  camName: string;
  /** 0–1 */
  progress: number;
}

function button(label: string, css: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = `border:0;border-radius:10px;background:#0d1620cc;color:#fff;font:700 18px ${FONT};`
    + `padding:10px 18px;cursor:pointer;text-shadow:none;box-shadow:0 2px 8px #0006;${css}`;
  return b;
}

export function createReplayUi(root: HTMLElement) {
  let wantStart = false, wantExit = false;
  let wantCam: number | 'neste' | null = null;
  let active = false, available = false;

  // trykk på knappene skal ikke telle som klikk i menyen eller i spillet
  const press = (b: HTMLElement, fn: () => void) => {
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); fn(); });
  };

  const start = button('▶ Se reprise (V)', 'position:fixed;left:50%;bottom:14vh;transform:translateX(-50%);z-index:3;display:none;');
  press(start, () => { if (available) wantStart = true; });
  root.appendChild(start);

  // skiltet under reprisen
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;inset:0;z-index:3;display:none;pointer-events:none;color:#fff;font:600 16px ${FONT};text-shadow:0 1px 4px #000a;`;
  const label = document.createElement('div');
  label.style.cssText = 'position:absolute;left:16px;top:16px;display:flex;flex-direction:column;gap:4px;';
  const title = document.createElement('div');
  title.style.cssText = `font:800 22px ${FONT};letter-spacing:.12em;`;
  title.textContent = '● REPRISE';
  const cam = document.createElement('div');
  const help = document.createElement('div');
  help.style.cssText = 'font-size:14px;opacity:.85;';
  help.textContent = 'C eller 1–3: bytt kamera · Mellomrom eller Esc: tilbake';
  label.append(title, cam, help);
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;left:16px;right:16px;bottom:10px;height:4px;border-radius:2px;background:#fff3;overflow:hidden;';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:0;background:#fff;';
  bar.appendChild(fill);
  const buttons = document.createElement('div');
  buttons.style.cssText = 'position:absolute;right:16px;bottom:26px;display:flex;gap:10px;pointer-events:auto;';
  const camButton = button('🎥 Kamera', '');
  const backButton = button('↩ Tilbake', '');
  press(camButton, () => { wantCam = 'neste'; });
  press(backButton, () => { wantExit = true; });
  buttons.append(camButton, backButton);
  box.append(label, bar, buttons);
  root.appendChild(box);

  // fanges før pausen (Esc) og spillet ser tastene
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (!active) {
      if (e.code === 'KeyV' && available) wantStart = true;
      return;
    }
    if (e.code === 'KeyC') wantCam = 'neste';
    else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') wantCam = Number(e.code.slice(5)) - 1;
    else if (e.code === 'Escape') {
      // Esc går ut av reprisen i stedet for å sette spillet på pause
      wantExit = true;
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);

  return {
    /** Sant én gang etter V eller trykk på knappen. */
    takeStart(): boolean { const s = wantStart; wantStart = false; return s; },
    /** Sant én gang etter Esc eller «Tilbake». (Mellomrom leses fra vanlig input i main.ts.) */
    takeExit(): boolean { const x = wantExit; wantExit = false; return x; },
    /** Kameraet som ble valgt (nummer), 'neste', eller null. */
    takeCam(): number | 'neste' | null { const c = wantCam; wantCam = null; return c; },

    /** Kalles hvert bilde. */
    update(s: ReplayUiState) {
      active = s.active;
      available = s.available;
      start.style.display = s.available && !s.active ? 'block' : 'none';
      box.style.display = s.active ? 'block' : 'none';
      cam.textContent = `Kamera: ${s.camName}`;
      fill.style.width = `${Math.round(s.progress * 1000) / 10}%`;
    },
  };
}
