/**
 * Enkel HUD. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 */
export function createHud(root: HTMLElement) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:16px;top:16px;color:#fff;font:600 18px/1.3 system-ui,sans-serif;text-shadow:0 1px 3px #0008;pointer-events:none;';
  root.appendChild(el);
  const help = document.createElement('div');
  help.style.cssText = 'position:fixed;left:16px;bottom:16px;color:#fffc;font:14px system-ui,sans-serif;pointer-events:none;';
  help.textContent = 'Styr: ← → / A D · Brems: ↓ / S · Start på nytt: R · Mobil: trykk venstre/høyre';
  root.appendChild(help);
  return {
    /** airTime: sekunder i lufta i siste (eller pågående) hopp. Vises når hoppet var mer enn et lite hopp. */
    update(speedMs: number, distance: number, airTime = 0, inAir = false) {
      let text = `${Math.round(speedMs * 3.6)} km/t · ${Math.round(distance)} m`;
      if (airTime > 0.3) text += ` · ${inAir ? 'I lufta' : 'Lufttid'} ${airTime.toFixed(1).replace('.', ',')} s`;
      el.textContent = text;
    },
  };
}
