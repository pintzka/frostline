import { ShaderChunk } from 'three';
import { describe, expect, it } from 'vitest';
import {
  distanceToBox, fogAmount, glowStrength, hiddenByFog, lightPlaneCoords, ringCenter, shadowTexel, snapShadowTarget, type Vec3,
} from '../src/render/envMath';
import { LOOK } from '../src/render/look';
import { useRadialFog } from '../src/render/radialFog';
import { forestChunks, planTrees } from '../src/render/sceneryLayout';

describe('tåke', () => {
  it('shaderen bruker ekte avstand, ikke dybde, så tåka ikke endrer seg når du svinger', () => {
    useRadialFog();
    useRadialFog(); // to ganger skal ikke ødelegge noe
    expect(ShaderChunk.fog_vertex).toContain('length( mvPosition.xyz )');
    expect(ShaderChunk.fog_vertex).not.toContain('- mvPosition.z');
  });
  it('et tre 200 m unna har like mye tåke uansett hvor i bildet det er', () => {
    const cam: Vec3 = [0, 0, 0];
    const amounts = [-40, -12, 0, 12, 40].map((deg) => {
      const a = (deg * Math.PI) / 180;
      const tree: Vec3 = [Math.sin(a) * 200, 0, Math.cos(a) * 200];
      return fogAmount(Math.hypot(tree[0] - cam[0], tree[1] - cam[1], tree[2] - cam[2]));
    });
    for (const f of amounts) expect(f).toBeCloseTo(amounts[0], 9);
  });
  it('er 0 nært og 1 ved fog far', () => {
    expect(fogAmount(LOOK.fog.near - 1)).toBe(0);
    expect(fogAmount(LOOK.fog.far)).toBe(1);
  });
});

describe('lykteglød', () => {
  it('full nært, svakere lenger unna, borte i tett dis', () => {
    expect(glowStrength(20)).toBe(1);
    expect(glowStrength(200)).toBeLessThan(glowStrength(100));
    expect(glowStrength(400)).toBe(0);
  });
});

describe('skog i tåka', () => {
  const chunks = forestChunks(planTrees());
  it('alle trærne er med i en bit, og ligger inne i boksen sin', () => {
    expect(chunks.reduce((s, c) => s + c.trees.length, 0)).toBe(planTrees().length);
    for (const c of chunks) for (const t of c.trees) {
      expect(t.x).toBeGreaterThanOrEqual(c.min[0]); expect(t.x).toBeLessThanOrEqual(c.max[0]);
      expect(t.y + t.height).toBeLessThanOrEqual(c.max[1] + 1e-9);
      expect(t.z).toBeGreaterThanOrEqual(c.min[2]); expect(t.z).toBeLessThanOrEqual(c.max[2]);
    }
  });
  it('biter helt i tåka skjules, biter med noe synlig vises', () => {
    const cam: Vec3 = [0, 0, 300];
    let hidden = 0;
    for (const c of chunks) {
      const d = distanceToBox(cam, c.min, c.max);
      expect(hiddenByFog(cam, c.min, c.max)).toBe(d >= LOOK.fog.far);
      if (d >= LOOK.fog.far) hidden++;
    }
    // midt i bakken er mange biter langt nok unna til å skjules
    expect(hidden).toBeGreaterThan(chunks.length / 4);
  });
});

describe('skygger', () => {
  const toSun: Vec3 = [30, 60, -20];
  it('skyggemidten står på hele skyggepiksler sett fra sola', () => {
    const tx = shadowTexel();
    for (const p of [[0, 0, 0], [3.21, -40.7, 123.456], [-37.9, -150.2, 470.03]] as Vec3[]) {
      const [a, b] = lightPlaneCoords(snapShadowTarget(p, toSun), toSun);
      expect(Math.abs(a / tx - Math.round(a / tx))).toBeLessThan(1e-6);
      expect(Math.abs(b / tx - Math.round(b / tx))).toBeLessThan(1e-6);
    }
  });
  it('flytter midten høyst en halv piksel, og en bitteliten bevegelse gir samme midtpunkt', () => {
    const tx = shadowTexel();
    const p: Vec3 = [5.0, -50, 150];
    const s = snapShadowTarget(p, toSun);
    expect(Math.hypot(s[0] - p[0], s[1] - p[1], s[2] - p[2])).toBeLessThanOrEqual(tx * Math.SQRT1_2 + 1e-9);
    const s2 = snapShadowTarget([p[0] + tx * 0.01, p[1], p[2]], toSun);
    // samme piksel, eller en hel piksel videre: aldri et sted midt imellom
    const [a1] = lightPlaneCoords(s, toSun), [a2] = lightPlaneCoords(s2, toSun);
    expect(Math.abs((a2 - a1) / tx - Math.round((a2 - a1) / tx))).toBeLessThan(1e-6);
  });
});

describe('nærmeste fjellring', () => {
  it('hopper lite ved restart (fra slutten til starten av bakken)', () => {
    const anchor: Vec3 = [0, 0, 0];
    const r = LOOK.mountains.layers[0].r;
    const end = ringCenter([0, -180, 560], anchor, LOOK.mountains.parallax);
    const start = ringCenter([0, 0, 0], anchor, LOOK.mountains.parallax);
    // hvor mye ringen flytter seg i forhold til kameraet, sett som vinkel
    const shift = Math.abs((end[2] - 560) - (start[2] - 0));
    expect((Math.atan(shift / r) * 180) / Math.PI).toBeLessThan(1.5);
  });
});
