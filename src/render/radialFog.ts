import { ShaderChunk } from 'three';

/**
 * three.js regner tåka ut fra dybden (hvor langt fram i bildet noe er). Da får et tre på siden av
 * bildet mindre tåke enn et like langt unna tre midt i bildet, og trærne skifter farge når du svinger.
 * Her byttes det til ekte avstand fra kameraet (radial tåke) for alt som bruker tåke.
 * Kalles én gang før noe tegnes.
 * Arbeidsstrøm 6 (Grafikk og effekter) eier denne fila.
 */
const DEPTH = 'vFogDepth = - mvPosition.z;';
const RADIAL = 'vFogDepth = length( mvPosition.xyz );';

export function useRadialFog(): void {
  if (ShaderChunk.fog_vertex.includes(RADIAL)) return;
  if (!ShaderChunk.fog_vertex.includes(DEPTH)) throw new Error('fant ikke tåke-koden i three.js (ny versjon?)');
  ShaderChunk.fog_vertex = ShaderChunk.fog_vertex.replace(DEPTH, RADIAL);
}
