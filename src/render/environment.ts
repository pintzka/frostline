import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FINE } from './groundGrid';
import { glowStrength, hiddenByFog, ringCenter, type Vec3 } from './envMath';
import { LOOK } from './look';
import { forestCount, spreadOrder } from './quality';
import { forestChunks, GROUND_HALF, groundAt, planMarkers, planTrees, ridgeProfile, WORLD } from './sceneryLayout';

/**
 * Miljøet rundt bakken: himmel, fjell i dis, terrenget utenfor løypa, skog og lykter ved hoppene.
 * Stil: kald nordisk skumring. Blå himmel og fjell, rosa bånd i horisonten foran,
 * varm glød mot sola bak, og varme lykter som lysflekker.
 * Plasseringen ligger i sceneryLayout.ts (ren logikk med tester).
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */

/** Disen i horisonten. Tåka bruker samme farge, så alt langt unna glir over i det samme. */
export const HAZE = 0xc3cfe0;

const SKY = {
  zenith: 0x1f3864,
  mid: 0x587aae,
  warm: 0xf4c49c, // glød mot sola
  belt: 0xe6b4c2, // rosa bånd motsatt av sola, rett foran deg
  cloud: 0x8e93b8,
  cloudLit: 0xf2c6b0,
};

export function createEnvironment(scene: THREE.Scene, sunDir: THREE.Vector3) {
  const sky = createSky(sunDir);
  const mountains = createMountains();
  const forest = createForest();
  const markers = createMarkers();
  scene.add(sky.mesh, ...mountains.map((m) => m.mesh), createOuterGround(), ...forest.map((f) => f.mesh), markers.group);
  // fast punkt i verden (starten) som den nærmeste fjellringen glir rundt
  const anchor: Vec3 = [0, 0, 0];
  const c: Vec3 = [0, 0, 0];
  // synsavstanden (tåka) fra kvalitetsnivået
  let far: number = LOOK.fog.far;

  return {
    /** Himmel og fjell flytter seg med kameraet, så de alltid er langt unna og aldri kan nås. */
    follow(cam: THREE.Vector3, time: number) {
      c[0] = cam.x; c[1] = cam.y; c[2] = cam.z;
      sky.mesh.position.copy(cam);
      sky.uniforms.uTime.value = time;
      // den nærmeste ringen står litt fast i verden, så den glir sakte forbi (dybde)
      for (const m of mountains) m.mesh.position.set(...ringCenter(c, anchor, m.parallax));
      // skog-biter som er helt i tåka trenger ikke tegnes (de er uansett bare tåkefarge)
      for (const f of forest) f.mesh.visible = f.mesh.count > 0 && !hiddenByFog(c, f.min, f.max, far);
      // lyktegløden blekner med avstanden, så den ikke lyser gjennom tett dis
      for (const g of markers.glows) g.sprite.material.opacity = LOOK.glow.opacity * glowStrength(g.at.distanceTo(cam), far);
    },

    /** Kvalitetsnivået: hvor stor del av skogen som tegnes (0–1), og hvor langt tåka slipper deg å se (m). */
    setQuality(forestDensity: number, fogFar: number) {
      far = fogFar;
      // trærne ligger i blandet rekkefølge, så de første n er spredt utover hele biten
      for (const f of forest) f.mesh.count = forestCount(f.total, forestDensity);
    },
  };
}

/** Himmelkuppel med myk gradient og malte skystriper, laget i en shader. */
function createSky(sunDir: THREE.Vector3) {
  const c = (hex: number) => ({ value: new THREE.Color(hex) });
  const uniforms = {
    uZenith: c(SKY.zenith), uMid: c(SKY.mid), uHaze: c(HAZE), uWarm: c(SKY.warm), uBelt: c(SKY.belt),
    uCloud: c(SKY.cloud), uCloudLit: c(SKY.cloudLit),
    uSun: { value: new THREE.Vector2(sunDir.x, sunDir.z).normalize() },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uMid, uHaze, uWarm, uBelt, uCloud, uCloudLit;
      uniform vec2 uSun;
      uniform float uTime;
      varying vec3 vDir;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        // gradient: dis nede, blått i midten, mørkt blått øverst
        vec3 col = mix(uHaze, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uZenith, smoothstep(0.25, 0.95, h));

        float az = dot(normalize(d.xz + 1e-5), uSun);
        // varm glød lavt mot sola, og et rosa bånd på motsatt side
        col = mix(col, uWarm, pow(max(az, 0.0), 3.0) * exp(-h * 7.0) * 0.85);
        float belt = exp(-pow((h - 0.07) / 0.06, 2.0)) * (0.35 + 0.65 * max(-az, 0.0));
        col = mix(col, uBelt, belt * 0.5);

        // skystriper: støy på et "tak" over oss, strukket ut så de blir lange og malte
        vec2 p = d.xz / (h + 0.12);
        p = vec2(p.x * 0.55 + uTime * 0.004, p.y * 1.6);
        float n = fbm(p * 1.3);
        float cloud = smoothstep(0.52, 0.72, n) * smoothstep(0.03, 0.14, h) * (1.0 - smoothstep(0.35, 0.7, h));
        vec3 cc = mix(uCloud, uCloudLit, clamp(0.35 + 0.65 * max(az, 0.0) + (n - 0.6) * 1.5, 0.0, 1.0));
        col = mix(col, cc, cloud * 0.75);

        // under horisonten: bare dis, samme farge som tåka
        col = mix(uHaze, col, smoothstep(-0.02, 0.0, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), mat);
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/**
 * Tre ringer av fjell rundt hele horisonten. Jo lenger unna, jo mer forsvinner de i disen.
 * Fargen er bakt inn i hjørnene, så fjellene ikke trenger tåka (de er lenger unna enn den).
 */
/** Blander to farger slik øyet ser dem (sRGB), så disen ikke blir for blek. */
function mix(a: number, b: number, t: number): THREE.Color {
  const ca = new THREE.Color(a).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  const cb = new THREE.Color(b).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  return new THREE.Color().setRGB(
    ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t, THREE.SRGBColorSpace,
  );
}

function createMountains() {
  const haze = new THREE.Color(HAZE);
  const N = 320;
  const BASE = -10 * (Math.PI / 180);
  const ROWS = 4;

  return LOOK.mountains.layers.map((L, i) => {
    const ridge = ridgeProfile(L.seed, N, L.low, L.high);
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const push = (a: number, elev: number, c: THREE.Color) => {
      pos.push(Math.sin(a) * L.r, Math.tan(elev) * L.r, Math.cos(a) * L.r);
      col.push(c.r, c.g, c.b);
    };
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const top = ridge[i % N] * (Math.PI / 180);
      const u = (ridge[i % N] - L.low) / (L.high - L.low); // 0 = skar, 1 = topp
      // snø på de høyeste toppene, og varm kveldsglød på de fjerneste
      const snowy = mix(L.body, 0xe8eef7, THREE.MathUtils.smoothstep(u, 0.35, 0.8) * 0.85);
      const peak = mix(snowy.getHex(), 0xf0c4b8, L.glow * u);
      // fire rader: dis nederst, fjellside, snøgrense og topp (snøen ligger bare øverst)
      push(a, BASE, haze);
      push(a, top * 0.5, mix(L.body, HAZE, L.haze + (1 - L.haze) * 0.6));
      push(a, top * 0.85, mix(L.body, HAZE, L.haze));
      push(a, top, mix(peak.getHex(), HAZE, L.haze));
      if (i < N) {
        const b = i * ROWS;
        for (const row of [0, 1, 2]) {
          const p = b + row, q = b + ROWS + row;
          // innsiden av ringen vender mot kameraet
          idx.push(p, p + 1, q, p + 1, q + 1, q);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    return { mesh, parallax: i === 0 ? LOOK.mountains.parallax : 0 };
  });
}

/**
 * Snøen utenfor løypa: lier opp til en rygg på hver side, og bakken videre opp og ned.
 * Der den preparerte bakken ligger, ligger denne litt under, så de aldri flimrer mot hverandre.
 */
function createOuterGround() {
  // tett mellom punktene nær løypa, glissent langt ute
  const half: number[] = [];
  for (let x = 0; x <= GROUND_HALF; x += 4) half.push(x);
  for (let x = GROUND_HALF + 4; x <= 120; x += 4) half.push(x);
  for (let x = 130; x <= 200; x += 10) half.push(x);
  for (let x = 215; x <= WORLD.halfWidth; x += 15) half.push(x);
  const xs = [...half.slice(1).map((x) => -x).reverse(), ...half];
  const zs: number[] = [];
  for (let z = WORLD.zMin; z <= WORLD.zMax; z += 4) zs.push(z);

  const fineZ0 = FINE.zMin, fineZ1 = FINE.zMax; // der den preparerte bakken går (se groundGrid.ts)
  const pos = new Float32Array(xs.length * zs.length * 3);
  let n = 0;
  for (const z of zs) for (const x of xs) {
    const under = (1 - THREE.MathUtils.smoothstep(Math.abs(x), GROUND_HALF - 4, GROUND_HALF))
      * THREE.MathUtils.smoothstep(z, fineZ0, fineZ0 + 8) * (1 - THREE.MathUtils.smoothstep(z, fineZ1 - 8, fineZ1));
    pos[n++] = x; pos[n++] = groundAt(x, z) - 3 * under; pos[n++] = z;
  }
  const idx: number[] = [];
  const W = xs.length;
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < W - 1; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd3dae4, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

/** Ett stilisert grantre med høyde 1: stamme og fire lag med greiner, snø på tuppene. */
function treeGeometry() {
  const trunkC = new THREE.Color(0x4b3a33);
  const needle = new THREE.Color(0x1e3b3a);
  const needleLight = new THREE.Color(0x2f5550);
  const snowC = new THREE.Color(0xe4ecf4);
  const paint = (g: THREE.BufferGeometry, colorAt: (y: number) => THREE.Color) => {
    const p = g.attributes.position as THREE.BufferAttribute;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = colorAt(p.getY(i));
      c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5, 1);
  trunk.translate(0, 0.15, 0);
  parts.push(paint(trunk, () => trunkC));
  const tiers = [[0.14, 0.5, 0.3], [0.32, 0.7, 0.24], [0.5, 0.87, 0.17], [0.66, 1, 0.1]];
  for (const [y0, y1, r] of tiers) {
    const cone = new THREE.ConeGeometry(r, y1 - y0, 7, 2);
    cone.translate(0, (y0 + y1) / 2, 0);
    // mørkt grønt nederst, lysere opp mot tuppen, og snø helt øverst på hvert lag
    parts.push(paint(cone, (y) => {
      const t = (y - y0) / (y1 - y0);
      return t > 0.9 ? snowC : t > 0.4 ? needleLight : needle;
    }));
  }
  return mergeGeometries(parts)!;
}

/**
 * Skogen: ett InstancedMesh per bit av bakken, så kameraet bare tegner bitene som er i bildet
 * og ikke helt i tåka. Trærne kaster ikke skygge: skyggene finnes bare i en liten boks rundt
 * skiløperen, og treskygger ville kommet og gått med en hard kant.
 */
function createForest() {
  const geo = treeGeometry();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  return forestChunks(planTrees()).map((chunk, k) => {
    const mesh = new THREE.InstancedMesh(geo, mat, chunk.trees.length);
    // fast blandet rekkefølge, så lavere skogtetthet tynner jevnt (quality.ts)
    spreadOrder(chunk.trees, LOOK.forest.seed + k).forEach((t, i) => {
      p.set(t.x, t.y, t.z);
      q.setFromAxisAngle(Y, t.turn);
      s.set(t.height * t.girth, t.height, t.height * t.girth);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      // litt ulik farge: noen trær blåere, noen varmere
      tint.setRGB(0.88 + 0.2 * t.tint, 0.92 + 0.12 * t.tint, 1.05 - 0.15 * t.tint);
      mesh.setColorAt(i, tint);
    });
    mesh.computeBoundingSphere();
    return { mesh, min: chunk.min, max: chunk.max, total: chunk.trees.length };
  });
}

/** Stolper med oransje flagg og en varm lykt ved kanten av hvert hopp. */
function createMarkers() {
  const group = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6);
  postGeo.translate(0, 1.6, 0);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 2.9, 0, 0, 2.3, 0, 0.9, 2.6, 0], 3));
  flagGeo.computeVertexNormals();
  const flagMat = new THREE.MeshLambertMaterial({ color: 0xff6a2a, side: THREE.DoubleSide, emissive: 0x401000 });
  const lampGeo = new THREE.SphereGeometry(0.16, 10, 8);
  lampGeo.translate(0, 3.3, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  // myk glød rundt lykta som syns gjennom disen (tegnet i kode)
  const glowMap = glowTexture();
  const glows: { sprite: THREE.Sprite; at: THREE.Vector3 }[] = [];
  for (const mk of planMarkers()) {
    const post = new THREE.Group();
    post.position.set(mk.x, mk.y, mk.z);
    const flag = new THREE.Mesh(flagGeo, flagMat);
    // flagget peker utover, bort fra hoppet
    flag.rotation.y = mk.x > 0 ? 0 : Math.PI;
    // hver glød har sitt eget materiale, så den kan blekne for seg selv med avstanden
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowMap, color: 0xffb36b, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false, opacity: LOOK.glow.opacity,
    }));
    glow.position.y = 3.3;
    glow.scale.setScalar(LOOK.glow.size);
    glows.push({ sprite: glow, at: new THREE.Vector3(mk.x, mk.y + 3.3, mk.z) });
    post.add(new THREE.Mesh(postGeo, postMat), flag, new THREE.Mesh(lampGeo, lampMat), glow);
    group.add(post);
  }
  return { group, glows };
}

function glowTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
