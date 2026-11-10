import * as THREE from 'three';
import { heightAt, PARK } from '../park/terrain';

/**
 * Scene, lys og grå testbakke. Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
export function createScene(root: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c4dc);
  scene.fog = new THREE.Fog(0xa9c4dc, 60, 260);

  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x8899aa, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(30, 60, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 200;
  scene.add(sun, sun.target);

  // preparert bakke: riller langs fallinja og korn som suser forbi, så farten synes
  const segX = 80, segZ = 600;
  const geo = new THREE.PlaneGeometry(PARK.width + 40, PARK.length, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, PARK.length / 2 - 20);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const tex = snowTexture(renderer);
  tex.repeat.set((PARK.width + 40) / TILE_M, PARK.length / TILE_M);
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xdde3ea, map: tex, roughness: 0.9 }));
  ground.receiveShadow = true;
  scene.add(ground);

  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));
  return { renderer, scene, sun };
}

/** Teksturen dekker så mange meter i hver retning. */
const TILE_M = 4;

/**
 * Preparert snø laget i kode (ingen bildefil): riller langs bakken (ca. 25 cm brede),
 * fint korn og svake flekker. Mønsteret går sømløst i alle retninger.
 */
function snowTexture(renderer: THREE.WebGLRenderer) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;

  // fast "tilfeldighet", så snøen ser lik ut hver gang
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // riller: lys topp og svak skygge, langs fallinja (v-retningen i teksturen)
  const RIDGES = 16;
  for (let x = 0; x < S; x++) {
    const phase = (x / S) * RIDGES * Math.PI * 2;
    const shade = 0.5 + 0.5 * Math.cos(phase);
    const v = Math.round(255 - 16 * shade);
    g.fillStyle = `rgb(${v - 4},${v - 2},${v})`;
    g.fillRect(x, 0, 1, S);
  }

  // svake, store flekker som gir noe å se forbi seg i fart (tegnes på tvers av kantene så det blir sømløst)
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S, r = 10 + rnd() * 34;
    const dark = rnd() < 0.5;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grad.addColorStop(0, dark ? 'rgba(150,170,195,0.10)' : 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }

  // fint korn
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
    const a = 0.08 + rnd() * 0.14;
    g.fillStyle = rnd() < 0.5 ? `rgba(120,140,170,${a})` : `rgba(255,255,255,${a + 0.2})`;
    g.fillRect(x, y, 1, 1 + Math.floor(rnd() * 2));
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  return t;
}
