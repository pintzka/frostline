/**
 * Valget «Landingshjelp: På / Av» på startskjermen og pauseskjermen (som grafikkvalget).
 * Huskes i nettleseren, På som standard. Selve hjelpen ligger i tricks/rotation.ts; valget går inn i
 * spillet gjennom inputen hvert steg (GameInput.assist), så reprisen blir lik. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 */
const KEY = 'frostline-landingshjelp';

/** Lagret verdi → på/av. Ingenting lagret (eller noe rart) = På. */
export function parseAssist(v: string | null): boolean {
  return v !== '0';
}

export function createAssistUi() {
  let on = true;
  try { on = parseAssist(localStorage.getItem(KEY)); } catch { /* blokkert: På */ }
  const pickers: [HTMLButtonElement, HTMLButtonElement][] = [];

  function refresh() {
    for (const [yes, no] of pickers) {
      for (const [b, sel] of [[yes, on], [no, !on]] as const) {
        b.style.background = sel ? '#fff' : '#0006';
        b.style.color = sel ? '#0d1620' : '#fff';
      }
    }
  }

  function choose(v: boolean) {
    on = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ikke viktig */ }
    refresh();
  }

  return {
    /** Er landingshjelpen valgt nå? */
    get on(): boolean { return on; },

    /** En rad med På / Av. Kan lages flere ganger (startskjerm og pause); de holdes like. */
    picker(): HTMLElement {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;'
        + 'font:600 15px system-ui,sans-serif;cursor:default;';
      const label = document.createElement('span');
      label.textContent = 'Landingshjelp';
      label.title = 'Slipper du nesten rundt, fullfører spillet rolig resten så du lander rent';
      label.style.marginRight = '4px';
      row.appendChild(label);
      const make = (text: string, v: boolean) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.style.cssText = 'padding:6px 12px;border:1px solid #fff8;border-radius:8px;font:600 15px system-ui,sans-serif;cursor:pointer;';
        // klikket skal ikke også starte spillet eller avslutte pausen
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); choose(v); b.blur(); });
        row.appendChild(b);
        return b;
      };
      pickers.push([make('På', true), make('Av', false)]);
      row.addEventListener('pointerdown', (e) => e.stopPropagation());
      row.addEventListener('click', (e) => e.stopPropagation());
      refresh();
      return row;
    },
  };
}
