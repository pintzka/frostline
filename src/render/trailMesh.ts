import * as THREE from 'three';
import { CONFIG } from '../core/config';
import { heightAt, normalAt } from '../park/terrain';
import { createTrail } from './trail';

/**
 * Tegner to skispor i snøen bak skiløperen. Sporene blekner mot snøfargen bakover.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
const HALF_WIDTH = 0.05;
const LIFT = 0.02;
const FRESH = new THREE.Color(0xb3bfcc);
const FADED = new THREE.Color(0xdde3ea);

export function createSkiTrails(scene: THREE.Scene) {
  const trail = createTrail();
  const max = CONFIG.trailMaxPoints;
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  const index: number[] = [];
  for (let i = 0; i < max - 1; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const ribbons = [-1, 1].map((side) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3));
    geo.setIndex(index);
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { side, geo };
  });

  const c = new THREE.Color();
  return {
    update(x: number, y: number, z: number, heading: number) {
      if (!trail.update(x, y, z, heading)) return;
      const pts = trail.points();
      const n = pts.length;
      for (const { side, geo } of ribbons) {
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const col = geo.attributes.color as THREE.BufferAttribute;
        const nor = geo.attributes.normal as THREE.BufferAttribute;
        for (let i = 0; i < n; i++) {
          const p = pts[i];
          const cx = p.x + p.rx * side * CONFIG.skiGap / 2;
          const cz = p.z + p.rz * side * CONFIG.skiGap / 2;
          // de eldste 60 % av sporet blekner gradvis bort
          c.copy(FADED).lerp(FRESH, Math.min(1, i / Math.max(1, n * 0.6)));
          for (let e = 0; e < 2; e++) {
            const s = e === 0 ? -HALF_WIDTH : HALF_WIDTH;
            const ex = cx + p.rx * s, ez = cz + p.rz * s;
            pos.setXYZ(i * 2 + e, ex, heightAt(ex, ez) + LIFT, ez);
            col.setXYZ(i * 2 + e, c.r, c.g, c.b);
            // samme normal som bakken, så sporet får samme lys som snøen rundt
            const [nx, ny, nz] = normalAt(ex, ez);
            nor.setXYZ(i * 2 + e, nx, ny, nz);
          }
        }
        pos.needsUpdate = true;
        col.needsUpdate = true;
        nor.needsUpdate = true;
        geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
      }
    },
  };
}
