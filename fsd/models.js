// Loads the Blender-built vehicle models (models/v9/*.glb, Draco-compressed) and swaps in the game's shared materials by name.
import * as THREE from './vendor/three.module.min.js?v=r170';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js?v=r170';
import { DRACOLoader } from './vendor/loaders/DRACOLoader.js?v=r170';
const draco = new DRACOLoader().setDecoderPath(new URL('./vendor/draco/', import.meta.url).href); draco.setDecoderConfig({ type: 'wasm' });
const loader = new GLTFLoader().setDRACOLoader(draco);
export const MV = 'v9-1';
const base = new URL('./models/v9/', import.meta.url).href;
export const SHARED = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.08, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.5 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.6 }),
  tail: new THREE.MeshBasicMaterial({ color: 0xc81818 }),
  lamp: new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, roughness: 0.1, metalness: 0.4, clearcoat: 1 }),
  drl: new THREE.MeshBasicMaterial({ color: 0xf4f7ff }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.92 }),
  rim: new THREE.MeshPhysicalMaterial({ color: 0x2a2c30, roughness: 0.35, metalness: 0.7 }),
  spoke: new THREE.MeshPhysicalMaterial({ color: 0x55585e, roughness: 0.3, metalness: 0.8 }),
  paint: new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
};
const cache = {};
export function preload(name) { return cache[name] || (cache[name] = loader.loadAsync(base + name + '.glb?v=' + MV).then(gl => gl.scene)); }
// returns a clone; geometry shared; materials replaced from SHARED / overrides (e.g. { paint })
export async function loadModel(name, over = {}) {
  const src = await preload(name), g = src.clone(true);
  g.traverse(m => { if (!m.isMesh) return; const n = (m.material.name || '').replace(/\.\d+$/, ''); m.material = over[n] || SHARED[n] || m.material; m.castShadow = true; m.userData.part = n; });
  return g;
}

// sync access after preloadAll(): the game builds vehicles synchronously from pools
const ready = {};
export async function preloadAll(names) { await Promise.all(names.map(n => preload(n).then(sc => { ready[n] = sc; }).catch(e => console.warn('model', n, e)))); }
export function cloneModel(name, over = {}) {
  const src = ready[name]; if (!src) return null; const g = src.clone(true);
  g.traverse(m => { if (!m.isMesh) return; const n = (m.material.name || '').replace(/\.\d+$/, ''); m.userData.part = n; m.material = over[n] || SHARED[n] || m.material; m.castShadow = true; });
  return g;
}
