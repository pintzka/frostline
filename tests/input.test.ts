import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { createSkier, stepSkier } from '../src/physics/skier';
import { buttonsLeftEdge } from '../src/ui/touchControls';
import { createEdge, createKeyLatch, createSteerTouches, padInUse, stickSteer, isSteerZone, mergeSteer, PAD, readPad, readPadTricks, shapeAxis, shapeTrigger, touchSteer, type PadButton } from '../src/input/logic';

const dz = CONFIG.padDeadzone, outer = CONFIG.padOuterEdge, curve = CONFIG.padCurve;

function buttons(pressed: Partial<Record<number, number>>): PadButton[] {
  return Array.from({ length: 17 }, (_, i) => ({ pressed: (pressed[i] ?? 0) > 0.5, value: pressed[i] ?? 0 }));
}

describe('dødsone og responskurve', () => {
  it('små utslag i dødsonen gir 0 (stikka kryper ikke)', () => {
    expect(shapeAxis(0.1, dz, outer, curve)).toBe(0);
    expect(shapeAxis(-dz, dz, outer, curve)).toBe(0);
  });

  it('fullt utslag allerede ved ytterkanten, og aldri mer enn 1', () => {
    expect(shapeAxis(outer, dz, outer, curve)).toBeCloseTo(1);
    expect(shapeAxis(1, dz, outer, curve)).toBe(1);
    expect(shapeAxis(-1, dz, outer, curve)).toBe(-1);
  });

  it('ingen hopp: like utenfor dødsonen er styringen nesten 0', () => {
    expect(Math.abs(shapeAxis(dz + 0.001, dz, outer, curve))).toBeLessThan(0.01);
  });

  it('jevn og økende hele veien, uten sprang', () => {
    let last = 0;
    for (let i = 0; i <= 1000; i++) {
      const v = shapeAxis(i / 1000, dz, outer, curve);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v - last).toBeLessThan(0.02);
      last = v;
    }
  });

  it('kurven gjør halvt utslag mykere enn rett linje', () => {
    const linear = (0.5 - dz) / (outer - dz);
    expect(shapeAxis(0.5, dz, outer, curve)).toBeLessThan(linear);
    expect(shapeAxis(0.5, dz, outer, curve)).toBeGreaterThan(0.15);
  });

  it('venstre og høyre er speilvendt', () => {
    expect(shapeAxis(-0.6, dz, outer, curve)).toBeCloseTo(-shapeAxis(0.6, dz, outer, curve));
  });

  it('tåler rare verdier fra nettleseren', () => {
    expect(shapeAxis(NaN, dz, outer, curve)).toBe(0);
    expect(shapeTrigger(NaN)).toBe(0);
  });

  it('trigger: hvilende finger bremser ikke, helt inne er full brems', () => {
    expect(shapeTrigger(0.03)).toBe(0);
    expect(shapeTrigger(1)).toBe(1);
    expect(shapeTrigger(0.5)).toBeGreaterThan(0.4);
  });
});

describe('gamepad', () => {
  it('venstre stikke styrer analogt', () => {
    const p = readPad([0.6, 0], buttons({}));
    expect(p.steer).toBeGreaterThan(0.2);
    expect(p.steer).toBeLessThan(0.8);
  });

  it('LT er analog brems, B er full brems', () => {
    expect(readPad([0, 0], buttons({ [PAD.LT]: 0.5 })).brake).toBeCloseTo(shapeTrigger(0.5));
    expect(readPad([0, 0], buttons({ [PAD.B]: 1 })).brake).toBe(1);
  });

  it('A = pop, Y eller Back = restart, Start = pause', () => {
    expect(readPad([], buttons({ [PAD.A]: 1 })).pop).toBe(true);
    expect(readPad([], buttons({ [PAD.Y]: 1 })).restart).toBe(true);
    expect(readPad([], buttons({ [PAD.BACK]: 1 })).restart).toBe(true);
    expect(readPad([], buttons({ [PAD.START]: 1 })).pause).toBe(true);
    const idle = readPad([0, 0], buttons({}));
    expect(idle).toEqual({ steer: 0, brake: 0, pop: false, restart: false, pause: false });
  });

  it('piltastene på padden styrer helt av/på', () => {
    expect(readPad([0, 0], buttons({ [PAD.LEFT]: 1 })).steer).toBe(-1);
    expect(readPad([0, 0], buttons({ [PAD.RIGHT]: 1 })).steer).toBe(1);
  });

  it('padder med færre knapper krasjer ikke', () => {
    expect(readPad([0.9], []).steer).toBeGreaterThan(0.8);
    expect(readPadTricks([0.9], [])).toEqual({ flip: 0, grab: 0 });
  });

  it('i lufta: stikka opp er frontflip, ned er backflip, og rett opp styrer ikke', () => {
    expect(readPadTricks([0, -0.9], buttons({})).flip).toBe(1);
    expect(readPadTricks([0, 0.9], buttons({})).flip).toBe(-1);
    expect(readPadTricks([0, 0.3], buttons({})).flip).toBe(0);
    expect(readPadTricks([0, 0], buttons({ [PAD.UP]: 1 })).flip).toBe(1);
    expect(readPadTricks([0, 0], buttons({ [PAD.DOWN]: 1 })).flip).toBe(-1);
    expect(readPad([0, -0.9], buttons({})).steer).toBe(0);
  });

  it('grabs: X = Nordlys (J), RB = Isbit (K), LB = Snøugle (L)', () => {
    expect(readPadTricks([0, 0], buttons({ [PAD.X]: 1 })).grab).toBe(1);
    expect(readPadTricks([0, 0], buttons({ [PAD.RB]: 1 })).grab).toBe(2);
    expect(readPadTricks([0, 0], buttons({ [PAD.LB]: 1 })).grab).toBe(3);
    expect(readPadTricks([0, 0], buttons({})).grab).toBe(0);
    // uten standard-oppsett stemmer ikke knappenumrene, så de brukes ikke
    expect(readPadTricks([0, 0], buttons({ [PAD.X]: 1 }), false).grab).toBe(0);
  });
});

describe('sammenslåing av kilder', () => {
  it('størst utslag vinner', () => {
    expect(mergeSteer([0, -0.7, 0.3], -1).value).toBe(-0.7);
    expect(mergeSteer([1, 0.4, 0], -1)).toEqual({ value: 1, source: 0 });
  });

  it('ingen styring gir 0', () => {
    expect(mergeSteer([0, 0, 0], 1)).toEqual({ value: 0, source: -1 });
  });

  it('bare tastatur virker som før', () => {
    for (const k of [-1, 0, 1]) expect(mergeSteer([k, 0, 0], -1).value).toBe(k);
  });

  it('to nesten like kilder bytter ikke fram og tilbake', () => {
    let src = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) {
      // to kilder som vipper litt rundt hverandre
      const a = 0.5 + 0.03 * Math.sin(i), b = -0.5 - 0.03 * Math.cos(i);
      const r = mergeSteer([a, b], src);
      src = r.source;
      seen.add(src);
    }
    expect(seen.size).toBe(1);
  });

  it('en tydelig større kilde tar over', () => {
    expect(mergeSteer([0.4, 0.9], 0).source).toBe(1);
  });

  it('slipper du den som styrer, tar den andre over', () => {
    expect(mergeSteer([0, 0.4], 0)).toEqual({ value: 0.4, source: 1 });
  });
});

describe('tommel-styring', () => {
  const R = CONFIG.touchSteerRadius;

  it('ingen rykk når tommelen settes ned', () => {
    expect(touchSteer(200, 200).steer).toBe(0);
  });

  it('dra høyre gir høyre, dra venstre gir venstre, analogt', () => {
    const half = touchSteer(200, 200 + R / 2).steer;
    expect(half).toBeGreaterThan(0.2);
    expect(half).toBeLessThan(0.8);
    expect(touchSteer(200, 200 - R).steer).toBe(-1);
    expect(touchSteer(200, 200 + R).steer).toBe(1);
  });

  it('drar du forbi kanten, følger midtpunktet etter, så du kan snu med en gang', () => {
    const r = touchSteer(200, 200 + R + 50);
    expect(r.steer).toBe(1);
    expect(r.anchor).toBe(200 + 50);
    // drar du litt tilbake, svinger du mindre med en gang (ikke 50 px dødgang)
    expect(touchSteer(r.anchor, 200 + R + 30).steer).toBeLessThan(1);
  });

  it('jevn styring når tommelen glir sakte', () => {
    let anchor = 100, last = 0;
    for (let x = 100; x <= 100 + R; x += 0.5) {
      const r = touchSteer(anchor, x);
      anchor = r.anchor;
      expect(r.steer - last).toBeLessThan(0.05);
      last = r.steer;
    }
  });

  it('venstre halvdel av skjermen styrer', () => {
    expect(isSteerZone(100, 800)).toBe(true);
    expect(isSteerZone(500, 800)).toBe(false);
  });
});

describe('restart og pause skjer én gang per trykk', () => {
  it('å holde knappen inne gir bare én restart', () => {
    const edge = createEdge();
    let restarts = 0;
    // knappen holdes i 2 sekunder (240 steg i sekundet)
    for (let i = 0; i < 480; i++) if (edge(true)) restarts++;
    expect(restarts).toBe(1);
  });

  it('slipp og trykk igjen gir en ny restart', () => {
    const edge = createEdge();
    const presses = [false, true, true, false, false, true, true, true, false].filter((d) => edge(d)).length;
    expect(presses).toBe(2);
  });

  it('gamepad: Y holdt inne over mange bilder gir én restart', () => {
    const edge = createEdge();
    let restarts = 0;
    for (let i = 0; i < 120; i++) if (edge(readPad([0, 0], buttons({ [PAD.Y]: 1 })).restart)) restarts++;
    expect(restarts).toBe(1);
  });
});

describe('raske tapp mellom to avlesninger', () => {
  it('ned og opp før avlesning: tasten er nede i nøyaktig én avlesning', () => {
    const keys = createKeyLatch();
    keys.down('Space');
    keys.up('Space');
    expect(keys.isDown('Space')).toBe(true);
    keys.endRead();
    expect(keys.isDown('Space')).toBe(false);
  });

  it('en tast som holdes, er nede helt til den slippes', () => {
    const keys = createKeyLatch();
    keys.down('KeyA');
    for (let i = 0; i < 10; i++) { expect(keys.isDown('KeyA')).toBe(true); keys.endRead(); }
    keys.up('KeyA');
    expect(keys.isDown('KeyA')).toBe(false);
  });

  it('raskt tapp på mellomrom gir en kort pop, ikke ingenting', () => {
    const keys = createKeyLatch();
    const s = createSkier();
    const dt = 1 / CONFIG.physicsHz;
    // kjør litt så skiløperen er i gang på bakken
    for (let i = 0; i < 240; i++) stepSkier(s, { steer: 0, brake: 0, pop: false }, dt);
    expect(s.grounded).toBe(true);
    // tapp mellom to fysikksteg
    keys.down('Space');
    keys.up('Space');
    let jumped = false;
    for (let i = 0; i < 10; i++) {
      stepSkier(s, { steer: 0, brake: 0, pop: keys.isDown('Space') }, dt);
      keys.endRead();
      if (!s.grounded) jumped = true;
    }
    expect(jumped).toBe(true);
    expect(s.lastPop).not.toBe('');
  });

  it('flere fingre: én slipper, den andre holder fortsatt knappen nede', () => {
    const fingers = createKeyLatch();
    fingers.down('1');
    fingers.down('2');
    fingers.endRead();
    fingers.up('1');
    expect(fingers.count()).toBe(1);
    fingers.up('2');
    expect(fingers.count()).toBe(0);
  });
});

describe('kvalitetsrettinger', () => {
  it('padder uten standard-oppsett: knapper ignoreres, stikka virker', () => {
    // en knapp som "alltid står på" på brems-plassen skal ikke bremse
    const p = readPad([0.9, 0], buttons({ [PAD.B]: 1, [PAD.LT]: 1, [PAD.A]: 1 }), false);
    expect(p.brake).toBe(0);
    expect(p.pop).toBe(false);
    expect(p.steer).toBeGreaterThan(0.8);
  });

  it('skrå stikke (45°) svinger fullt, rett opp svinger ikke', () => {
    const d = Math.SQRT1_2;
    expect(stickSteer(d, -d)).toBeCloseTo(1, 2);
    expect(stickSteer(-d, d)).toBeCloseTo(-1, 2);
    expect(stickSteer(0, -1)).toBe(0);
    // rett til siden er som før
    expect(stickSteer(0.6, 0)).toBeCloseTo(shapeAxis(0.6, dz, outer, curve));
  });

  it('skrå stikke: ingen hopp når du drar rundt kanten', () => {
    let last = stickSteer(1, 0);
    for (let a = 0; a <= Math.PI / 2; a += 0.01) {
      const v = stickSteer(Math.cos(a), -Math.sin(a));
      expect(Math.abs(v - last)).toBeLessThan(0.05);
      last = v;
    }
  });

  it('litt drift i stikka bytter ikke hjelpeteksten til gamepad', () => {
    expect(padInUse(readPad([0.25, 0], buttons({ [PAD.LT]: 0.2 })))).toBe(false);
    expect(padInUse(readPad([0.8, 0], buttons({})))).toBe(true);
    expect(padInUse(readPad([0, 0], buttons({ [PAD.A]: 1 })))).toBe(true);
  });

  it('løfter du styrefingeren, tar en annen finger på venstre side over uten hopp', () => {
    const t = createSteerTouches(60);
    t.down(1, 100, 500, 400);
    t.down(2, 150, 300, 400);
    t.move(1, 160, 500);
    expect(t.value()).toBe(1);
    // finger 2 har flyttet seg litt mens den lå der
    t.move(2, 170, 300);
    expect(t.value()).toBe(1); // finger 2 styrer ikke ennå
    t.up(1);
    expect(t.value()).toBe(0);
    expect(t.view()?.anchorX).toBe(170);
    t.move(2, 200, 300);
    expect(t.value()).toBeGreaterThan(0.3);
    t.up(2);
    expect(t.view()).toBeNull();
  });

  it('fingre på høyre side blir ikke styrefingre', () => {
    const t = createSteerTouches(60);
    expect(t.down(1, 300, 500, 400)).toBe(false);
    expect(t.view()).toBeNull();
  });

  it('knappene dekker ikke styresonen, heller ikke på smal telefon', () => {
    for (const w of [320, 360, 375, 414, 800]) expect(buttonsLeftEdge(w)).toBeGreaterThan(w / 2);
  });
});
