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

  // testbakke med rutenett så fart og helning synes
  const segX = 80, segZ = 600;
  const geo = new THREE.PlaneGeometry(PARK.width + 40, PARK.length, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, PARK.length / 2 - 20);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const tex = gridTexture();
  tex.repeat.set((PARK.width + 40) / 4, PARK.length / 4);
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xdde3ea, map: tex, roughness: 0.9 }));
  ground.receiveShadow = true;
  scene.add(ground);

  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));
  return { renderer, scene, sun };
}

function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#b8c2cc'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
