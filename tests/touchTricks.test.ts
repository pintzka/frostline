import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSteerTouches, pickGrab, touchFlip } from '../src/input/logic';
import { createLatch, splitControls } from '../src/tricks/controls';
import { buttonsLeftEdge, touchLayout, type ButtonSpot } from '../src/ui/touchControls';

/**
 * Flip og grab på mobil: dra tommelen opp/ned i lufta for flip, hold en grab-knapp til høyre.
 * Skjermen teller y nedover, så å dra opp gir minus.
 */

const T = CONFIG.touchFlipThreshold;
const W = 800;

/** Setter en tommel ned på venstre side og gir tilbake fingrene. */
function thumb(x = 150, y = 400) {
  const t = createSteerTouches();
  t.down(1, x, y, W);
  return t;
}

describe('tommel opp/ned = flip', () => {
  it('dra tydelig opp er frontflip, ned er backflip (som W og S)', () => {
    const up = thumb();
    up.move(1, 150, 400 - T - 5);
    expect(up.flip()).toBe(1);
    const down = thumb();
    down.move(1, 150, 400 + T + 5);
    expect(down.flip()).toBe(-1);
  });

  it('litt drift opp eller ned gir ingen flip', () => {
    const t = thumb();
    for (const dy of [-T * 0.8, T * 0.8, -10, 20]) {
      t.move(1, 150, 400 + dy);
      expect(t.flip()).toBe(0);
    }
  });

  it('tommel som sakte glir nedover mens du styrer, gir aldri flip', () => {
    const t = thumb();
    const dt = 1 / 60;
    // 20 px i sekundet i 6 sekunder (120 px til sammen), mens du svinger fram og tilbake
    for (let i = 0; i < 360; i++) {
      t.tick(dt);
      t.move(1, 150 + 50 * Math.sin(i / 20), 400 + i * 20 * dt);
      expect(t.flip()).toBe(0);
    }
    // men et tydelig drag etterpå gir flip med en gang
    t.move(1, 150, 520 + T + 5);
    expect(t.flip()).toBe(-1);
  });

  it('holder du tommelen stille i et flip, fortsetter flippen', () => {
    const t = thumb();
    t.move(1, 150, 400 - T - 10);
    for (let i = 0; i < 240; i++) t.tick(1 / 60);
    expect(t.flip()).toBe(1);
  });

  it('flippen slipper ikke rett på terskelen (ingen blinking), men når du drar tilbake', () => {
    const t = thumb();
    t.move(1, 150, 400 - T - 2);
    expect(t.flip()).toBe(1);
    t.move(1, 150, 400 - T + 3);
    expect(t.flip()).toBe(1);
    t.move(1, 150, 400 - CONFIG.touchFlipRelease + 2);
    expect(t.flip()).toBe(0);
  });

  it('flip styrer ikke, og styring flipper ikke', () => {
    const t = thumb();
    t.move(1, 150, 400 - T - 20);
    expect(t.value()).toBe(0);
    const s = thumb();
    s.move(1, 150 + CONFIG.touchSteerRadius, 400 + 15);
    expect(s.value()).toBe(1);
    expect(s.flip()).toBe(0);
  });

  it('dro du langt ned, snur du til frontflip uten å dra hele veien tilbake', () => {
    const t = thumb();
    t.move(1, 150, 400 + 250);
    expect(t.flip()).toBe(-1);
    // fra bunnen: bare båndet + terskelen opp, ikke 250 px
    t.move(1, 150, 650 - CONFIG.touchFlipLeash - T - 2);
    expect(t.flip()).toBe(1);
  });

  it('løfter du tommelen, stopper flippen; en ny tommel starter uten flip', () => {
    const t = createSteerTouches();
    t.down(1, 150, 400, W);
    t.down(2, 100, 200, W);
    t.move(1, 150, 400 - T - 10);
    expect(t.flip()).toBe(1);
    t.up(1);
    expect(t.flip()).toBe(0);
    t.move(2, 100, 210);
    expect(t.flip()).toBe(0);
    t.up(2);
    expect(t.flip()).toBe(0);
  });

  it('clear() (f.eks. app i bakgrunnen) stopper flippen', () => {
    const t = thumb();
    t.move(1, 150, 400 + T + 10);
    t.clear();
    expect(t.flip()).toBe(0);
  });

  it('touchFlip: terskel og slipp', () => {
    const R = CONFIG.touchFlipRelease;
    expect(touchFlip(0, -T, T, R)).toBe(1);
    expect(touchFlip(0, T - 1, T, R)).toBe(0);
    expect(touchFlip(-1, R, T, R)).toBe(-1);
    expect(touchFlip(-1, R - 1, T, R)).toBe(0);
    // bytter du retning, gjelder den nye retningen med en gang den er over terskelen
    expect(touchFlip(-1, -T, T, R)).toBe(1);
  });

  it('terskelen er et tydelig drag', () => {
    expect(T).toBeGreaterThanOrEqual(40);
    expect(CONFIG.touchFlipRelease).toBeLessThan(T);
    expect(CONFIG.touchFlipLeash).toBeGreaterThan(T);
  });
});

describe('tommel-flip sammen med triks-sperren', () => {
  const dt = 1 / CONFIG.physicsHz;

  it('tommel dratt ned på bakken gir ikke backflip når du letter, bare et nytt drag i lufta gjør det', () => {
    const t = thumb();
    const latch = createLatch();
    t.move(1, 150, 400 + T + 10);
    const raw = () => ({ steer: t.value(), brake: 0, flip: t.flip(), pop: false, grab: 0 as const });
    // på bakken gjør flippen ingenting, og den bremser ikke
    const g = splitControls(raw(), true, latch, dt);
    expect(g.flip).toBe(0);
    expect(g.skier.brake).toBe(0);
    // i lufta: fortsatt samme tommel, ingen flip
    for (let i = 0; i < 100; i++) expect(splitControls(raw(), false, latch, dt).flip).toBe(0);
    // dra tilbake og ned igjen: nå er det et nytt, tydelig drag
    t.move(1, 150, 400);
    splitControls(raw(), false, latch, dt);
    t.move(1, 150, 400 + T + 10);
    expect(splitControls(raw(), false, latch, dt).flip).toBe(-1);
  });
});

describe('grab-knappene', () => {
  it('hver knapp har sin grab: Nordlys, Isbit, Snøugle', () => {
    expect(pickGrab([false, false, false])).toBe(0);
    expect(pickGrab([true, false, false])).toBe(1);
    expect(pickGrab([false, true, false])).toBe(2);
    expect(pickGrab([false, false, true])).toBe(3);
  });

  it('flere knapper samtidig: den første vinner, som J før K før L', () => {
    expect(pickGrab([false, true, true])).toBe(2);
    expect(pickGrab([true, true, true])).toBe(1);
  });
});

describe('knappene på skjermen', () => {
  const widths = [320, 340, 360, 375, 390, 414, 430, 480, 568, 600, 667, 740, 800, 844, 932];
  const spots = (w: number): ButtonSpot[] => {
    const l = touchLayout(w);
    return [l.pop, l.brake, ...l.grabs];
  };

  it('ingen knapp dekker styresonen (venstre halvdel), på alle bredder', () => {
    for (let w = 320; w <= 932; w += 2) expect(buttonsLeftEdge(w), `bredde ${w}`).toBeGreaterThan(w / 2);
  });

  it('knappene overlapper ikke hverandre og er store nok for en tommel', () => {
    for (const w of widths) {
      const s = spots(w);
      for (const b of s) expect(b.size).toBeGreaterThanOrEqual(48);
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          const a = s[i], b = s[j];
          const apart = a.right >= b.right + b.size || b.right >= a.right + a.size
            || a.bottom >= b.bottom + b.size || b.bottom >= a.bottom + a.size;
          expect(apart, `bredde ${w}: knapp ${i} og ${j}`).toBe(true);
        }
      }
    }
  });

  it('alle knappene får plass i høyden på telefon, både liggende og stående', () => {
    // [bredde, høyde] for vanlige telefoner
    const phones = [[568, 320], [667, 375], [740, 360], [844, 390], [932, 430], [320, 568], [360, 640], [375, 667], [414, 896]];
    for (const [w, h] of phones) {
      const top = Math.max(...spots(w).map((b) => b.bottom + b.size));
      expect(top, `${w}x${h}`).toBeLessThan(h * 0.75);
    }
  });

  it('grabbene står i rekkefølge: Nordlys øverst, Snøugle nederst', () => {
    for (const w of widths) {
      const [n, i, s] = touchLayout(w).grabs;
      expect(n.bottom).toBeGreaterThan(i.bottom);
      expect(i.bottom).toBeGreaterThan(s.bottom);
    }
  });
});
