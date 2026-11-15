import * as THREE from 'three';
import { heightAt } from '../park/terrain';
import { createSpray, type SprayFrame } from './spray';

/**
 * Tegner snøsprutet som myke, gjennomsiktige snøfnugg-skyer (THREE.Points).
 * Én buffer som gjenbrukes hvert bilde; logikken ligger i spray.ts.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
const VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute float seed;
  uniform float scale;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // størrelsen er i meter: jo lenger unna, jo mindre på skjermen
    gl_PointSize = min(size * scale / max(0.2, -mv.z), 400.0);
    vAlpha = alpha;
    vSeed = seed;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 light;
  uniform vec3 shade;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    // hver sky vris ulikt, så de ikke ser like ut
    float a = vSeed * 43.0;
    vec2 p = gl_PointCoord - 0.5;
    p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p + 0.5;
    vec4 t = texture2D(map, p);
    float alpha = t.a * vAlpha;
    if (alpha < 0.004) discard;
    // lys topp og blåaktig skygge i bunnen og kantene, litt ulik for hver sky
    float lit = t.r * (0.85 + 0.15 * vSeed);
    gl_FragColor = vec4(mix(shade, light, lit), alpha);
    #include <colorspace_fragment>
  }
`;

/** Et mykt snøfnugg-sprite laget på canvas: flere runde, uskarpe klumper oppå hverandre. */
function puffTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blob = (x: number, y: number, r: number, a: number) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.5, `rgba(235,235,235,${a * 0.55})`);
    grad.addColorStop(1, 'rgba(200,200,200,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  };
  blob(S / 2, S / 2, S * 0.48, 0.55);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * S * 0.16;
    blob(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (0.14 + rnd() * 0.14), 0.35);
  }
  // litt fint korn, så det ser ut som snø og ikke røyk
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * S * 0.3;
    g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.4})`;
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 0.6 + rnd() * 0.9, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function createSnowSpray(scene: THREE.Scene) {
  const spray = createSpray({ seed: 1, groundAt: heightAt });
  const geo = new THREE.BufferGeometry();
  const attr = (arr: Float32Array, n: number) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
  const pos = attr(spray.positions, 3), size = attr(spray.sizes, 1), alpha = attr(spray.alphas, 1), seed = attr(spray.seeds, 1);
  geo.setAttribute('position', pos);
  geo.setAttribute('size', size);
  geo.setAttribute('alpha', alpha);
  geo.setAttribute('seed', seed);
  geo.setDrawRange(0, 0);

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      map: { value: puffTexture() },
      scale: { value: 1 },
      light: { value: new THREE.Color(0xf4f8ff) },
      shade: { value: new THREE.Color(0x9fb6d2) },
    },
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);

  const buf = new THREE.Vector2();
  // ett gjenbrukt objekt, så det ikke lages noe nytt hvert bilde
  const f: SprayFrame = { dt: 0, x: 0, y: 0, z: 0, heading: 0, vx: 0, vy: 0, vz: 0, edge: 0, brake: 0,
    grounded: true, sinceLanding: 99, popAge: 99, airTime: 0, nx: 0, ny: 1, nz: 0 };
  type Skier = Pick<SprayFrame, 'vx' | 'vy' | 'vz' | 'edge' | 'grounded' | 'sinceLanding' | 'popAge' | 'airTime'>;
  type V3 = { x: number; y: number; z: number };
  return {
    /** at: der skiløperen tegnes nå. normal: bakkens normal under skiene. */
    update(s: Skier, at: V3, heading: number, brake: number, normal: V3, dt: number,
      camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
      f.dt = dt; f.x = at.x; f.y = at.y; f.z = at.z; f.heading = heading; f.brake = brake;
      f.vx = s.vx; f.vy = s.vy; f.vz = s.vz; f.edge = s.edge; f.grounded = s.grounded;
      f.sinceLanding = s.sinceLanding; f.popAge = s.popAge; f.airTime = s.airTime;
      f.nx = normal.x; f.ny = normal.y; f.nz = normal.z;
      spray.update(f);
      // meter til piksler: skjermhøyden delt på hvor mye kameraet ser
      renderer.getDrawingBufferSize(buf);
      mat.uniforms.scale.value = buf.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
      pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = seed.needsUpdate = true;
      geo.setDrawRange(0, spray.count);
    },
  };
}
