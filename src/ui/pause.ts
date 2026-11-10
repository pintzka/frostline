/**
 * Pauseknapp og pauseskjerm. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 * P eller Esc bytter, og spillet går på pause av seg selv når vinduet eller fanen mister fokus.
 */
export interface Pausable {
  pause(): void;
  resume(): void;
  toggle(): boolean;
  isPaused(): boolean;
}

export function createPauseUi(root: HTMLElement, game: Pausable) {
  const button = document.createElement('button');
  button.type = 'button';
  button.style.cssText =
    'position:fixed;right:16px;top:16px;z-index:2;padding:8px 14px;border:0;border-radius:8px;' +
    'background:#0008;color:#fff;font:600 16px system-ui,sans-serif;cursor:pointer;';
  root.appendChild(button);

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:1;display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px;' +
    'background:#0d162099;color:#fff;font:600 32px system-ui,sans-serif;text-shadow:0 1px 3px #0008;';
  overlay.innerHTML = '<div>Pause</div><div style="font:16px system-ui,sans-serif;opacity:.85">Trykk P, Esc eller Fortsett</div>';
  root.appendChild(overlay);

  const show = () => {
    const p = game.isPaused();
    button.textContent = p ? '▶ Fortsett' : '❚❚ Pause';
    overlay.style.display = p ? 'flex' : 'none';
  };
  const set = (paused: boolean) => { if (paused) game.pause(); else game.resume(); show(); };

  button.addEventListener('click', () => { game.toggle(); show(); button.blur(); });
  overlay.addEventListener('click', () => set(false));
  addEventListener('keydown', (e) => {
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) { game.toggle(); show(); }
  });
  // ikke la spillet gå for seg selv når du er et annet sted
  addEventListener('blur', () => set(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) set(true); });

  show();
}
