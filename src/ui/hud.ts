import { CONFIG } from '../core/config';
import type { Landing } from '../tricks/rotation';

/**
 * Enkel HUD. Arbeidsstrøm 8 (UI og flyt) eier denne fila.
 */
export interface HudInfo {
  /** m/s */
  speed: number;
  /** meter fra start */
  distance: number;
  /** sekunder i lufta i siste (eller pågående) hopp */
  airTime: number;
  inAir: boolean;
  /** hvor mye pop er ladet (0–1) */
  popCharge: number;
  /** siste pop, og hvor mange sekunder siden */
  lastPop: '' | 'pop' | 'perfekt';
  popAge: number;
  /** siste landing (triksnavn og ren/slurvete/fall), og hvor mange sekunder siden */
  landing: Landing | null;
  landingAge: number;
}

const LANDING_TEXT = { ren: 'Ren landing', slurvete: 'Slurvete landing', fall: 'Fall' } as const;
const LANDING_COLOR = { ren: '#7fe3ff', slurvete: '#ffd166', fall: '#ff6b6b' } as const;

/** Teksten som vises etter en landing. Tom når det ikke var noe å vise (et vanlig hopp uten triks). */
export function landingText(l: Landing | null): { title: string; sub: string } {
  if (!l || (l.name === '' && l.quality === 'ren')) return { title: '', sub: '' };
  return { title: l.name, sub: LANDING_TEXT[l.quality] };
}

export function createHud(root: HTMLElement) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:16px;top:16px;color:#fff;font:600 18px/1.3 system-ui,sans-serif;text-shadow:0 1px 3px #0008;pointer-events:none;';
  root.appendChild(el);

  // ladestolpe for pop, nede på midten
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:50%;bottom:56px;width:160px;height:10px;margin-left:-80px;border-radius:5px;background:#0006;overflow:hidden;pointer-events:none;opacity:0;transition:opacity .15s;';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:0;background:#fff;border-radius:5px;';
  bar.appendChild(fill);
  root.appendChild(bar);

  // stor tekst for perfekt pop
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;left:0;right:0;top:28%;text-align:center;color:#fff;font:800 40px system-ui,sans-serif;letter-spacing:1px;text-shadow:0 2px 8px #0009;pointer-events:none;opacity:0;';
  flash.textContent = 'PERFEKT POP!';
  root.appendChild(flash);

  // triksnavn og landing, litt under pop-teksten
  const trick = document.createElement('div');
  trick.style.cssText = 'position:fixed;left:0;right:0;top:38%;text-align:center;color:#fff;font:800 44px system-ui,sans-serif;text-shadow:0 2px 8px #0009;pointer-events:none;opacity:0;';
  const trickName = document.createElement('div');
  const trickSub = document.createElement('div');
  trickSub.style.cssText = 'font:700 22px system-ui,sans-serif;';
  trick.append(trickName, trickSub);
  root.appendChild(trick);

  const help = document.createElement('div');
  help.style.cssText = 'position:fixed;left:16px;bottom:16px;color:#fffc;font:14px system-ui,sans-serif;pointer-events:none;';
  help.textContent = 'Styr: ← → / A D · Brems: ↓ / S · Pop: hold og slipp mellomrom · I lufta: ← → spinn, ↑ / W frontflip, ↓ / S backflip · Start på nytt: R · Mobil: trykk venstre/høyre';
  root.appendChild(help);

  return {
    update(h: HudInfo) {
      let text = `${Math.round(h.speed * 3.6)} km/t · ${Math.round(h.distance)} m`;
      if (h.airTime > 0.3) text += ` · ${h.inAir ? 'I lufta' : 'Lufttid'} ${h.airTime.toFixed(1).replace('.', ',')} s`;
      el.textContent = text;

      bar.style.opacity = h.popCharge > 0 ? '1' : '0';
      fill.style.width = `${Math.round(h.popCharge * 100)}%`;
      fill.style.background = h.popCharge >= 1 ? '#7fe3ff' : '#fff';

      // vises i litt over et sekund og blekner bort
      const show = h.lastPop === 'perfekt' && h.popAge < CONFIG.popFlashTime;
      flash.style.opacity = show ? String(Math.min(1, (CONFIG.popFlashTime - h.popAge) * 2)) : '0';

      const t = landingText(h.landing);
      const left = CONFIG.trickShowTime - h.landingAge;
      if (t.sub && left > 0) {
        trickName.textContent = t.title;
        trickSub.textContent = t.sub;
        trickSub.style.color = LANDING_COLOR[h.landing!.quality];
        trick.style.opacity = String(Math.min(1, left * 2));
      } else trick.style.opacity = '0';
    },
  };
}
