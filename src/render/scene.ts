import * as THREE from 'three';
import { buildGroundMesh } from './groundGrid';
import { createEnvironment, HAZE } from './environment';
import { shadowTexel, snapShadowTarget, type Vec3 } from './envMath';
import { LOOK } from './look';
import type { QualitySettings } from './quality';
import { useRadialFog } from './radialFog';

/**
 * Scene, lys og testbakken, med miljøet rundt (environment.ts). Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
export function createScene(root: HTMLElement, start: QualitySettings) {
  // myke kanter kan bare velges når rendereren lages, så de følger nivået spillet startet på
  const renderer = new THREE.WebGLRenderer({ antialias: start.antialias });
  renderer.setPixelRatio(Math.min(devicePixelRatio, start.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // tåka har samme farge som disen i horisonten, så bakken glir over i himmelen.
  // Den regnes ut fra avstanden til kameraet, så den ikke endrer seg når du svinger.
  useRadialFog();
  scene.background = new THREE.Color(HAZE);
  scene.fog = new THREE.Fog(HAZE, LOOK.fog.near, LOOK.fog.far);

  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x8899aa, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  const toSun: Vec3 = [30, 60, -20];
  sun.position.set(...toSun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOOK.shadow.mapSize, LOOK.shadow.mapSize);
  const sc = sun.shadow.camera;
  const S = LOOK.shadow.half;
  sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.near = 1; sc.far = 200;
  scene.add(sun, sun.target);

  // preparert bakke: riller langs fallinja og korn som suser forbi, så farten synes.
  // Punktene står tett der hoppene krummer (groundGrid.ts), så snøen ligger der fysikken er.
  const tex = snowTexture(renderer);
  let tolerance = start.groundTolerance;
  const ground = new THREE.Mesh(groundGeometry(tolerance), new THREE.MeshStandardMaterial({ color: 0xdde3ea, map: tex, roughness: 0.9 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // himmel, fjell, skog og lykter rundt bakken
  const env = createEnvironment(scene, sun.position.clone().normalize());

  /** Sola og skyggeboksen følger skiløperen, men bare i hele skyggepiksler, så skyggene ikke flimrer. */
  let texel = shadowTexel();
  function sunFollow(target: THREE.Vector3) {
    const [x, y, z] = snapShadowTarget([target.x, target.y, target.z], toSun, texel);
    sun.target.position.set(x, y, z);
    sun.position.set(x + toSun[0], y + toSun[1], z + toSun[2]);
  }

  /**
   * Bytter kvalitetsnivå. Kalles hvert bilde; gjør bare noe når noe er endret.
   * Oppløsning og skyggestørrelse byttes med en gang (det merkes knapt).
   * Resten venter til heavyOk er sant (pause, startskjermen eller resultatskjermen): skog og tåke
   * ville poppet midt i en runde, skygger av/på lager shaderne på nytt, og ny bakke tar ca. 0,3 s.
   */
  let pixelRatio = start.pixelRatio, shadowSize = -1, forest = -1, fogFar = -1;
  function applyQuality(q: QualitySettings, heavyOk: boolean) {
    if (q.pixelRatio !== pixelRatio) {
      pixelRatio = q.pixelRatio;
      renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatio));
      renderer.setSize(innerWidth, innerHeight);
    }
    if ((q.forest !== forest || q.fogFar !== fogFar) && heavyOk) {
      forest = q.forest; fogFar = q.fogFar;
      (scene.fog as THREE.Fog).far = fogFar;
      env.setQuality(forest, fogFar);
    }
    // skygger på/av endrer lysoppsettet, og three.js bygger shaderne på nytt
    const wantShadow = q.shadowMapSize > 0;
    if (wantShadow !== sun.castShadow && heavyOk) sun.castShadow = wantShadow;
    if (sun.castShadow && wantShadow && q.shadowMapSize !== shadowSize) {
      shadowSize = q.shadowMapSize;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      // kartet lages på nytt i riktig størrelse neste gang skyggene tegnes
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      texel = shadowTexel(shadowSize);
    }
    if (q.groundTolerance !== tolerance && heavyOk) {
      tolerance = q.groundTolerance;
      const old = ground.geometry;
      ground.geometry = groundGeometry(tolerance);
      old.dispose();
    }
  }
  applyQuality(start, true);

  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));
  return { renderer, scene, env, sunFollow, applyQuality };
}

/** Den preparerte bakken som three.js-geometri, med teksturkoordinater. */
function groundGeometry(tolerance: number) {
  const mesh = buildGroundMesh(tolerance);
  const uv = new Float32Array((mesh.positions.length / 3) * 2);
  for (let i = 0, j = 0; i < mesh.positions.length; i += 3) {
    // teksturen gjentas hver TILE_M meter; rillene går langs bakken
    uv[j++] = mesh.positions[i] / TILE_M; uv[j++] = -mesh.positions[i + 2] / TILE_M;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geo.computeVertexNormals();
  return geo;
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
