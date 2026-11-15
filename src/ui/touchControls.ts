/**
 * Knapper og styre-ring for berøringsskjerm. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 * Selve lesingen av fingrene ligger i src/input/input.ts. Her er bare det du ser.
 */

/** Hvor tommelen styrer fra, og hvor den er nå (CSS-piksler). */
export interface TouchStickView { anchorX: number; y: number; x: number; radius: number }

const BTN = 'position:fixed;display:flex;align-items:center;justify-content:center;border-radius:50%;'
  + 'color:#fff;font:800 15px system-ui,sans-serif;letter-spacing:1px;background:#ffffff26;border:2px solid #fff9;'
  + 'text-shadow:0 1px 3px #0008;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;'
  + '-webkit-tap-highlight-color:transparent;transition:background .06s,transform .06s;';

/**
 * Plassering av knappene (CSS-piksler fra høyre og nederste kant). BREMS står over POP i en
 * smal kolonne helt til høyre, så knappene aldri dekker styresonen på venstre halvdel,
 * heller ikke på en smal telefon på høykant.
 */
export const BUTTONS = {
  pop: { size: 96, right: 20, bottom: 28 },
  brake: { size: 72, right: 32, bottom: 140 },
} as const;

/** Venstre kant (px) til den knappen som står lengst til venstre, på en skjerm så bred. */
export function buttonsLeftEdge(screenWidth: number): number {
  return Math.min(...Object.values(BUTTONS).map((b) => screenWidth - b.right - b.size));
}

const place = (b: { size: number; right: number; bottom: number }) =>
  `width:${b.size}px;height:${b.size}px;right:calc(${b.right}px + env(safe-area-inset-right));bottom:calc(${b.bottom}px + env(safe-area-inset-bottom));`;

export function createTouchControls(root: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:none;';
  root.appendChild(wrap);

  // POP er størst og nederst; BREMS sitter rett over
  const pop = document.createElement('div');
  pop.textContent = 'POP';
  pop.style.cssText = BTN + place(BUTTONS.pop);
  const brake = document.createElement('div');
  brake.textContent = 'BREMS';
  brake.style.cssText = BTN + place(BUTTONS.brake) + 'font-size:12px;';
  wrap.append(pop, brake);

  // ring der tommelen ble satt ned, og en prikk som viser hvor mye du svinger
  const ring = document.createElement('div');
  ring.style.cssText = 'position:fixed;border-radius:999px;border:2px solid #fff6;pointer-events:none;display:none;';
  const knob = document.createElement('div');
  knob.style.cssText = 'position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:#fff8;pointer-events:none;display:none;';
  wrap.append(ring, knob);

  for (const el of [pop, brake]) el.addEventListener('contextmenu', (e) => e.preventDefault());
  // iPhone zoomer med to fingre selv om siden sier nei; dette stopper det
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // stilen skrives bare når noe faktisk endres, ikke hvert bilde
  const isDown = new Map<HTMLElement, boolean>();
  let lastStick = '';
  const setDown = (el: HTMLElement, down: boolean) => {
    if (isDown.get(el) === down) return;
    isDown.set(el, down);
    el.style.background = down ? '#ffffff66' : '#ffffff26';
    el.style.transform = down ? 'scale(0.94)' : '';
  };

  return {
    pop,
    brake,
    /** Vis knappene (første gang noen tar på skjermen, eller med en gang på mobil). */
    show() { wrap.style.display = ''; },
    update(stick: TouchStickView | null, popDown: boolean, brakeDown: boolean) {
      setDown(pop, popDown);
      setDown(brake, brakeDown);
      const key = stick ? `${stick.anchorX}|${stick.x}|${stick.y}|${stick.radius}` : '';
      if (key === lastStick) return;
      lastStick = key;
      if (!stick) { ring.style.display = knob.style.display = 'none'; return; }
      ring.style.display = knob.style.display = '';
      const r = stick.radius + 22;
      ring.style.left = `${stick.anchorX - r}px`;
      ring.style.top = `${stick.y - 24}px`;
      ring.style.width = `${2 * r}px`;
      ring.style.height = '48px';
      knob.style.left = `${stick.x}px`;
      knob.style.top = `${stick.y}px`;
    },
  };
}

export type TouchControls = ReturnType<typeof createTouchControls>;
