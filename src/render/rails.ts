import * as THREE from 'three';
import { CONFIG } from '../core/config';
import { heightAt } from '../park/terrain';
import { railCenter, railTop, RAILS, type RailShape } from '../physics/rail';

/**
 * Tegner rails og bokser fra parkfila. Formen kommer fra physics/rail.ts, så det du ser er det du glir på.
 * Rail: et metallrør på stolper. Boks: en boks med glatt plasttopp. Alt laget i kode, ingen filer.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
const STEP = 0.5;
const RAIL_RADIUS = 0.045;

const metal = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.85, roughness: 0.3 });
const post = new THREE.MeshStandardMaterial({ color: 0x39424d, metalness: 0.5, roughness: 0.6 });
const plasticTop = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.25 });
const boxSide = new THREE.MeshStandardMaterial({ color: 0x2f6fb3, roughness: 0.55 });

/** Punkter langs railen (hver halve meter), med retningen ut til siden. */
function samples(r: RailShape): { x: number; y: number; z: number; ground: number }[] {
  const out = [];
  const n = Math.ceil(r.rail.length / STEP);
  for (let i = 0; i <= n; i++) {
    const u = Math.min(r.rail.length, i * STEP);
    const [x, z] = railCenter(r, u);
    out.push({ x, y: railTop(r, u), z, ground: heightAt(x, z) });
  }
  return out;
}

function makeRail(r: RailShape): THREE.Object3D {
  const g = new THREE.Group();
  const pts = samples(r).map((p) => new THREE.Vector3(p.x, p.y - RAIL_RADIUS, p.z));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, RAIL_RADIUS, 10, false), metal);
  g.add(tube);
  // stolper ned i snøen der railen er høy nok
  for (let u = CONFIG.railRampLength * 0.6; u <= r.rail.length + 0.01; u += 3) {
    const [x, z] = railCenter(r, Math.min(u, r.rail.length));
    const top = railTop(r, Math.min(u, r.rail.length)) - RAIL_RADIUS, base = heightAt(x, z) - 0.2;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, top - base, 8), post);
    m.position.set(x, (top + base) / 2, z);
    g.add(m);
  }
  return g;
}

function makeBox(r: RailShape): THREE.Object3D {
  const pts = samples(r);
  const half = CONFIG.boxWidth / 2;
  // ut til siden: vinkelrett på railen, vannrett
  const sx = r.dz * half, sz = -r.dx * half;
  const top: number[] = [], side: number[] = [];
  const quad = (arr: number[], a: number[], b: number[], c: number[], d: number[]) => arr.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    const pl = [p.x + sx, p.y, p.z + sz], pr = [p.x - sx, p.y, p.z - sz];
    const ql = [q.x + sx, q.y, q.z + sz], qr = [q.x - sx, q.y, q.z - sz];
    quad(top, pl, ql, qr, pr);
    const pb = p.ground - 0.2, qb = q.ground - 0.2;
    quad(side, [pl[0], pb, pl[2]], [ql[0], qb, ql[2]], ql, pl);
    quad(side, pr, qr, [qr[0], qb, qr[2]], [pr[0], pb, pr[2]]);
  }
  // enden
  const e = pts[pts.length - 1];
  quad(side, [e.x + sx, e.ground - 0.2, e.z + sz], [e.x - sx, e.ground - 0.2, e.z - sz], [e.x - sx, e.y, e.z - sz], [e.x + sx, e.y, e.z + sz]);
  const mesh = (arr: number[], mat: THREE.Material) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.material.side = THREE.DoubleSide;
    return m;
  };
  const g = new THREE.Group();
  g.add(mesh(top, plasticTop), mesh(side, boxSide));
  return g;
}

/** Alle rails og bokser i parken, klare til å legges i scenen. */
export function createRailMeshes(): THREE.Group {
  const g = new THREE.Group();
  for (const r of RAILS) g.add(r.rail.kind === 'box' ? makeBox(r) : makeRail(r));
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
