import { GRABS } from '../tricks/grabs';

/**
 * Knapper og styre-ring for berøringsskjerm. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 * Selve lesingen av fingrene ligger i src/input/input.ts. Her er bare det du ser.
 */

/** Hvor tommelen styrer fra, og hvor den er nå (CSS-piksler). flip: 1 = frontflip, -1 = backflip, 0 = ingen. */
export interface TouchStickView { anchorX: number; y: number; x: number; radius: number; flip?: number }

/** Hvilke knapper som er nede nå. grab: 0 = ingen, 1–3 = Nordlys, Isbit, Snøugle. */
export interface TouchPressed { pop: boolean; brake: boolean; grab: number }

const BTN = 'position:fixed;display:flex;align-items:center;justify-content:center;border-radius:50%;'
  + 'color:#fff;font:800 15px system-ui,sans-serif;letter-spacing:1px;background:#ffffff26;border:2px solid #fff9;'
  + 'text-shadow:0 1px 3px #0008;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;'
  + '-webkit-tap-highlight-color:transparent;transition:background .06s,transform .06s,border-color .06s;';

/** Én knapp: størrelse og avstand fra høyre og nederste kant (CSS-piksler). */
export interface ButtonSpot { size: number; right: number; bottom: number }

export interface TouchLayout { pop: ButtonSpot; brake: ButtonSpot; grabs: [ButtonSpot, ButtonSpot, ButtonSpot] }

/** POP nederst i hjørnet og BREMS rett over, som før. */
const POP: ButtonSpot = { size: 96, right: 20, bottom: 28 };
const BRAKE: ButtonSpot = { size: 72, right: 32, bottom: 140 };
const GRAB_SIZE = 56;
const GAP = 8;

/**
 * Hvor knappene står på en skjerm så bred. Grabbene står i en kolonne med Nordlys (fram) øverst,
 * Isbit i midten og Snøugle (bak) nederst.
 * - Bred skjerm (liggende telefon): grabbene står rett til venstre for POP, så høyre tommel
 *   når både POP og grabbene, og alt får plass i høyden på en lav skjerm.
 * - Smal skjerm (stående telefon): grabbene står over BREMS, så ingen knapp dekker styresonen
 *   på venstre halvdel.
 */
export function touchLayout(screenWidth: number): TouchLayout {
  const column = (right: number, bottom: number): [ButtonSpot, ButtonSpot, ButtonSpot] => {
    const at = (i: number) => ({ size: GRAB_SIZE, right, bottom: bottom + i * (GRAB_SIZE + GAP) });
    return [at(2), at(1), at(0)];
  };
  const besideRight = POP.right + POP.size + 12;
  const wideLeftEdge = screenWidth - besideRight - GRAB_SIZE;
  if (wideLeftEdge > screenWidth / 2 + 12) return { pop: POP, brake: BRAKE, grabs: column(besideRight, POP.bottom) };
  const overRight = POP.right + (POP.size - GRAB_SIZE) / 2;
  return { pop: POP, brake: BRAKE, grabs: column(overRight, BRAKE.bottom + BRAKE.size + 12) };
}

/** Venstre kant (px) til den knappen som står lengst til venstre, på en skjerm så bred. */
export function buttonsLeftEdge(screenWidth: number): number {
  const l = touchLayout(screenWidth);
  return Math.min(...[l.pop, l.brake, ...l.grabs].map((b) => screenWidth - b.right - b.size));
}

const place = (el: HTMLElement, b: ButtonSpot) => {
  Object.assign(el.style, {
    width: `${b.size}px`, height: `${b.size}px`,
    right: `calc(${b.right}px + env(safe-area-inset-right))`,
    bottom: `calc(${b.bottom}px + env(safe-area-inset-bottom))`,
  });
};

export function createTouchControls(root: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:none;';
  root.appendChild(wrap);

  // POP er størst og nederst; BREMS sitter rett over
  const pop = document.createElement('div');
  pop.textContent = 'POP';
  pop.style.cssText = BTN;
  const brake = document.createElement('div');
  brake.textContent = 'BREMS';
  brake.style.cssText = BTN + 'font-size:12px;';
  // tre grab-knapper, i samme rekkefølge som J / K / L
  const grabs = GRABS.map((g) => {
    const el = document.createElement('div');
    el.textContent = g.name.toUpperCase();
    el.style.cssText = BTN + 'font-size:11px;letter-spacing:0;white-space:nowrap;';
    return el;
  });
  wrap.append(pop, brake, ...grabs);

  // knappene flyttes bare når skjermen endrer bredde (f.eks. du snur telefonen)
  let laidOut = -1;
  const layout = () => {
    if (innerWidth === laidOut) return;
    laidOut = innerWidth;
    const l = touchLayout(innerWidth);
    place(pop, l.pop);
    place(brake, l.brake);
    grabs.forEach((el, i) => place(el, l.grabs[i]));
  };
  layout();
  addEventListener('resize', layout);

  // ring der tommelen ble satt ned, og en prikk som viser hvor mye du svinger (blå når du flipper)
  const ring = document.createElement('div');
  ring.style.cssText = 'position:fixed;border-radius:999px;border:2px solid #fff6;pointer-events:none;display:none;';
  const knob = document.createElement('div');
  knob.style.cssText = 'position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:#fff8;pointer-events:none;display:none;'
    + 'color:#fff;font:800 18px/44px system-ui,sans-serif;text-align:center;';
  wrap.append(ring, knob);

  for (const el of [pop, brake, ...grabs]) el.addEventListener('contextmenu', (e) => e.preventDefault());
  // iPhone zoomer med to fingre selv om siden sier nei; dette stopper det
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // stilen skrives bare når noe faktisk endres, ikke hvert bilde
  const isDown = new Map<HTMLElement, boolean>();
  let lastStick = '';
  const setDown = (el: HTMLElement, down: boolean, color = '#ffffff66') => {
    if (isDown.get(el) === down) return;
    isDown.set(el, down);
    el.style.background = down ? color : '#ffffff26';
    el.style.borderColor = down ? '#fff' : '#fff9';
    el.style.transform = down ? 'scale(0.92)' : '';
  };

  return {
    pop,
    brake,
    grabs,
    /** Vis knappene (første gang noen tar på skjermen, eller med en gang på mobil). */
    show() { layout(); wrap.style.display = ''; },
    update(stick: TouchStickView | null, pressed: TouchPressed) {
      setDown(pop, pressed.pop);
      setDown(brake, pressed.brake);
      grabs.forEach((el, i) => setDown(el, pressed.grab === i + 1, '#7fe3ff88'));
      const flip = stick?.flip ?? 0;
      const key = stick ? `${stick.anchorX}|${stick.x}|${stick.y}|${stick.radius}|${flip}` : '';
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
      knob.style.background = flip ? '#7fe3ffcc' : '#fff8';
      knob.textContent = flip > 0 ? '▲' : flip < 0 ? '▼' : '';
    },
  };
}

export type TouchControls = ReturnType<typeof createTouchControls>;
