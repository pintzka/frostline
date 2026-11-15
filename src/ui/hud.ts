import { CONFIG } from '../core/config';
import { comboMult, type ScoreState, type TrickResult } from '../tricks/score';
import { grabName, type GrabKind } from '../tricks/grabs';

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
  /** poeng, kombo og siste triks med poeng */
  score: ScoreState;
  /** beste poengsum i en tidligere runde (0 = ingen ennå) */
  best: number;
  /** grabben du holder nå i lufta, og hvor lenge */
  grab: GrabKind;
  grabTime: number;
  /** hva spilleren styrer med nå, så hjelpeteksten viser riktige knapper */
  controls?: 'keyboard' | 'gamepad' | 'touch';
  /** Hvor mye skjermen er bleket etter et fall (0–1). */
  fade: number;
}

/** Fartsmåleren følger den ekte farten mykt, så tallet aldri hopper (f.eks. når du settes tilbake etter et fall). */
export function smoothSpeed(shown: number, actual: number, dt: number): number {
  return shown + (actual - shown) * (1 - Math.exp(-CONFIG.hudSpeedFollow * dt));
}

const LANDING_TEXT = { ren: 'Ren landing', slurvete: 'Slurvete landing', fall: 'Fall' } as const;
const LANDING_COLOR = { ren: '#7fe3ff', slurvete: '#ffd166', fall: '#ff6b6b' } as const;

/** 4200 → «4 200». Samme resultat på alle maskiner (bruker ikke språkinnstillingene). */
export function formatPoints(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 1.5 → «x1,5» */
export function formatMult(m: number): string {
  return 'x' + String(Math.round(m * 100) / 100).replace('.', ',');
}

/** Teksten etter et triks med poeng: «720 + Backflip + Nordlys · 4 200» og en linje under. */
export function resultText(r: TrickResult): { title: string; sub: string } {
  // et fall vises alltid, også uten triksnavn, så du ser hvorfor komboen forsvant
  if (r.quality === 'fall') {
    if (r.name === '') return { title: 'Fall', sub: r.comboLost ? 'Kombo tapt' : '' };
    return { title: r.name, sub: r.comboLost ? 'Fall · kombo tapt' : 'Fall' };
  }
  const title = r.points > 0 ? `${r.name} · ${formatPoints(r.points)}` : r.name;
  const parts: string[] = [LANDING_TEXT[r.quality]];
  if (r.landedGrabbing) parts.push('slipp grabben før landing');
  if (r.tooSmall) parts.push('for lite for poeng');
  if (r.smallJump) parts.push('lite hopp');
  if (r.points > 0 && r.combo > 1) parts.push(`kombo ${formatMult(r.combo)}`);
  if (r.points > 0 && r.repeat < 1) parts.push(`gjentatt ${Math.round(r.repeat * 100)} %`);
  return { title, sub: parts.join(' · ') };
}

/** Myk inn og ut: 0 → 1 de første hudFadeIn sekundene, og ned til 0 de siste hudFadeOut sekundene. */
export function fadeInOut(age: number, showTime: number): number {
  if (age < 0 || age >= showTime) return 0;
  const inn = Math.min(1, age / CONFIG.hudFadeIn);
  const out = Math.min(1, (showTime - age) / CONFIG.hudFadeOut);
  return Math.min(inn * inn * (3 - 2 * inn), out);
}

/**
 * Tallet som vises for totalen: teller seg mykt opp til riktig tall i stedet for å hoppe.
 * Går totalen ned (ny runde), settes det rett dit uten synlig nedtelling.
 */
export function countUp(shown: number, total: number, dt: number): number {
  if (total < shown) return total;
  const next = shown + (total - shown) * (1 - Math.exp(-CONFIG.hudCountUp * dt));
  return total - next < 1 ? total : next;
}

const HELP = {
  keyboard: 'Styr: ← → / A D · Brems: ↓ / S · Pop: hold og slipp mellomrom · I lufta: ← → spinn, ↑ / W frontflip, ↓ / S backflip, hold J / K / L grab · Start på nytt: R · Pause: P / Esc · Lyd: M',
  gamepad: 'Styr: venstre stikke · Brems: LT / B · Pop: hold og slipp A · I lufta: stikke sidelengs spinn, opp/ned flip, hold X / RB / LB grab · Start på nytt: Y · Pause: Start',
  touch: 'Styr: dra tommelen sidelengs på venstre side · POP: hold og slipp · BREMS: hold · I lufta: dra sidelengs for å spinne',
} as const;

export function createHud(parent: HTMLElement) {
  // myk bleking over spillet etter et fall; lagt først, så teksten ligger oppå
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#eef3f8;pointer-events:none;opacity:0;';
  parent.appendChild(fade);
  // alt annet i HUD-en ligger i én boks, så hele HUD-en kan blekne bort bak start- og resultatskjermen
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
  parent.appendChild(root);

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
  trick.style.cssText = 'position:fixed;left:0;right:0;top:38%;text-align:center;color:#fff;font:800 44px system-ui,sans-serif;text-shadow:0 0 3px #000c,0 2px 12px #000a;pointer-events:none;opacity:0;';
  const trickName = document.createElement('div');
  const trickSub = document.createElement('div');
  trickSub.style.cssText = 'font:700 22px system-ui,sans-serif;';
  trick.append(trickName, trickSub);
  root.appendChild(trick);

  // poeng og kombo, oppe til høyre
  const scoreBox = document.createElement('div');
  scoreBox.style.cssText = 'position:fixed;right:16px;top:60px;text-align:right;color:#fff;text-shadow:0 1px 3px #0008;pointer-events:none;';
  const total = document.createElement('div');
  total.style.cssText = 'font:800 34px system-ui,sans-serif;font-variant-numeric:tabular-nums;';
  total.textContent = '0';
  const combo = document.createElement('div');
  combo.style.cssText = 'opacity:0;transition:opacity .4s;';
  const comboText = document.createElement('div');
  comboText.style.cssText = 'font:700 20px system-ui,sans-serif;color:#7fe3ff;';
  const comboBar = document.createElement('div');
  comboBar.style.cssText = 'margin:4px 0 0 auto;width:110px;height:4px;border-radius:2px;background:#0005;overflow:hidden;';
  const comboFill = document.createElement('div');
  comboFill.style.cssText = 'height:100%;width:100%;background:#7fe3ff;';
  comboBar.appendChild(comboFill);
  combo.append(comboText, comboBar);
  const bestEl = document.createElement('div');
  bestEl.style.cssText = 'font:600 14px system-ui,sans-serif;color:#fffc;';
  scoreBox.append(total, bestEl, combo);
  root.appendChild(scoreBox);
  let shownTotal = 0;
  let trickAlpha = 0;

  // grabben du holder, over ladestolpen
  const grab = document.createElement('div');
  grab.style.cssText = 'position:fixed;left:0;right:0;bottom:84px;text-align:center;color:#fff;font:700 24px system-ui,sans-serif;text-shadow:0 0 3px #000c,0 2px 8px #000a;pointer-events:none;opacity:0;transition:opacity .15s;';
  root.appendChild(grab);

  const help = document.createElement('div');
  help.style.cssText = 'position:fixed;left:16px;bottom:16px;color:#fffc;font:14px system-ui,sans-serif;pointer-events:none;';
  root.appendChild(help);
  let shownHelp = '';

  let shown = 0;
  return {
    /** 0 = skjult, 1 = synlig */
    setOpacity(o: number) { root.style.opacity = String(o); },
    /** dt = sekunder siden forrige bilde */
    update(h: HudInfo, dt: number) {
      // bytter bare tekst når du bytter kontroller, ikke hvert bilde
      const helpText = HELP[h.controls ?? 'keyboard'];
      if (helpText !== shownHelp) {
        help.textContent = shownHelp = helpText;
        // på mobil skal teksten ikke gå inn under knappene nede til høyre
        help.style.maxWidth = h.controls === 'touch' ? 'calc(100vw - 150px)' : '';
      }

      fade.style.opacity = h.fade.toFixed(3);
      shown = smoothSpeed(shown, h.speed, dt);
      let text = `${Math.round(shown * 3.6)} km/t · ${Math.round(h.distance)} m`;
      if (h.airTime > CONFIG.hudAirTimeMin) text += ` · ${h.inAir ? 'I lufta' : 'Lufttid'} ${h.airTime.toFixed(1).replace('.', ',')} s`;
      el.textContent = text;

      bar.style.opacity = h.popCharge > 0 ? '1' : '0';
      fill.style.width = `${Math.round(h.popCharge * 100)}%`;
      fill.style.background = h.popCharge >= 1 ? '#7fe3ff' : '#fff';

      // vises i litt over et sekund og blekner bort
      const show = h.lastPop === 'perfekt' && h.popAge < CONFIG.popFlashTime;
      flash.style.opacity = show ? String(Math.min(1, (CONFIG.popFlashTime - h.popAge) / CONFIG.popFlashFade)) : '0';

      // triksnavn og poeng: glir inn ovenfra og blekner mykt bort (ingen blinking).
      // Forsvinner trikset plutselig (ny runde), blekner teksten som står der bort i stedet for å bli borte på ett bilde
      const r = h.score.last;
      const a = r ? fadeInOut(h.score.lastAge, CONFIG.trickShowTime) : Math.max(0, trickAlpha - dt / CONFIG.hudFadeOut);
      trickAlpha = a;
      if (r && a > 0) {
        const t = resultText(r);
        if (trickName.textContent !== t.title) trickName.textContent = t.title;
        if (trickSub.textContent !== t.sub) trickSub.textContent = t.sub;
        trickSub.style.color = LANDING_COLOR[r.quality];
        const slide = Math.max(0, 1 - h.score.lastAge / CONFIG.hudSlideTime);
        trick.style.transform = `translateY(${(-CONFIG.hudSlidePx * slide * slide).toFixed(1)}px)`;
      }
      trick.style.opacity = a.toFixed(3);

      shownTotal = countUp(shownTotal, h.score.total, dt);
      total.textContent = formatPoints(shownTotal);
      bestEl.textContent = h.best > 0 ? `Beste runde ${formatPoints(h.best)}` : '';
      const m = comboMult(h.score);
      combo.style.opacity = m > 1 ? '1' : '0';
      if (m > 1) {
        comboText.textContent = `Kombo ${formatMult(m)}`;
        comboFill.style.width = `${Math.max(0, 1 - h.score.comboIdle / CONFIG.comboTimeout) * 100}%`;
      }

      // grabben du holder: svak før den teller (0,3 s), tydelig når den teller
      if (h.grab) {
        grab.textContent = `${grabName(h.grab)} ${h.grabTime.toFixed(1).replace('.', ',')} s`;
        grab.style.opacity = h.grabTime >= CONFIG.grabMinHold ? '1' : '0.45';
      } else grab.style.opacity = '0';
    },
  };
}
