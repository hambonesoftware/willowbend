// Cel-shading kit: a 4-step toon ramp, inverted-hull ink lines, and shape helpers.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const INK = 0x4b3140;

const ramp = new THREE.DataTexture(new Uint8Array([112, 112, 112, 255, 156, 156, 156, 255, 226, 226, 226, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;
export const RAMP = ramp;

const toonCache = new Map();
export function toon(color, opts) {
  if (opts) return new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...opts });
  if (!toonCache.has(color)) toonCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: ramp }));
  return toonCache.get(color);
}

// The hull is pushed out along the view-space normal, so the line keeps one weight whatever the
// mesh's scale. Works for plain, merged and instanced meshes.
const inkCache = new Map();
export function inkMat(thick) {
  const k = Math.round(thick * 1000);
  if (inkCache.has(k)) return inkCache.get(k);
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.thick = { value: thick };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float thick;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        vec3 inkN = normal;
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          inkN = mat3(instanceMatrix) * inkN;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        mvPosition.xyz += normalize(normalMatrix * inkN) * thick;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'ink';
  inkCache.set(k, m);
  return m;
}
// Hard-edged shapes (roofs) get a uniformly scaled hull so the line doesn't split at the corners.
export const HULL = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

export function mesh(geo, c, t = 0.032) {
  const m = new THREE.Mesh(geo, typeof c === 'number' ? toon(c) : c);
  m.castShadow = m.receiveShadow = true;
  if (t > 0) {
    const o = new THREE.Mesh(geo, inkMat(t));
    o.castShadow = o.receiveShadow = false;
    o.userData.ink = true;
    m.add(o);
  }
  return m;
}
export function hard(geo, c, k = 1.07) {
  const m = new THREE.Mesh(geo, toon(c));
  m.castShadow = m.receiveShadow = true;
  const o = new THREE.Mesh(geo, HULL);
  o.scale.setScalar(k);
  o.castShadow = false;
  o.userData.ink = true;
  m.add(o);
  return m;
}
export const at = (m, x, y, z = 0) => { m.position.set(x, y, z); return m; };

// Low segment counts on purpose: scenery is merged by material, and toon bands hide the facets.
const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
export const ball = (r, c, t, ws = 20, hs = 14) => mesh(cached(`s${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs)), c, t);
// Rounded boxes cost ~600 triangles at 3 corner segments; 2 reads the same under toon bands,
// and tiny trim pieces only need a chamfer.
export const box = (w, h, d, c, t, r) => {
  const rr = r ?? Math.min(w, h, d) * 0.2;
  return mesh(cached(`b${w}|${h}|${d}|${rr}`, () => new RoundedBoxGeometry(w, h, d, rr < 0.06 ? 1 : 2, rr)), c, t);
};
export const cyl = (rt, rb, h, c, t, seg = 16) => mesh(cached(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), c, t);
export const cap = (r, len, c, t) => mesh(cached(`p${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14)), c, t);
export const cone = (r, h, c, t, seg = 16) => mesh(cached(`o${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)), c, t);
export const torus = (r, tube, c, t, arc = Math.PI * 2) => mesh(cached(`t${r}|${tube}|${arc}`, () => new THREE.TorusGeometry(r, tube, 8, 20, arc)), c, t);
export const flat = (geo, color, opts = {}) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, ...opts }));

// Flat-shaded, but re-indexed so it merges with everything else.
export const hipRoofGeo = (() => { const g = new THREE.ConeGeometry(1, 1, 4).toNonIndexed(); g.computeVertexNormals(); return mergeVertices(g); })();
export function hipRoof(w, d, h, color, k = 1.06) {
  const g = new THREE.Group();
  const r = hard(hipRoofGeo, color, k);
  r.rotation.y = Math.PI / 4;
  g.add(r);
  g.scale.set(w / Math.SQRT2, h, d / Math.SQRT2);
  return g;
}

// Static scenery would be thousands of draw calls (every shape plus its ink hull), so once the
// world is built it is merged into one mesh per material per map cell. Cells keep frustum culling
// useful. Anything with userData.keep (and its children) stays live for animation.
export function bake(root, cell = 40) {
  root.updateMatrixWorld(true);
  const buckets = new Map(), v = new THREE.Vector3(), keep = [];
  const visit = o => {
    if (o !== root && o.userData.keep) { keep.push(o); return; }
    if (o.isMesh && !o.isInstancedMesh && o.visible) {
      o.getWorldPosition(v);
      const key = `${o.material.uuid}|${Math.floor(v.x / cell)},${Math.floor(v.z / cell)}|${o.castShadow ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, b = { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, order: o.renderOrder, geos: [] });
      b.geos.push(prep(o.geometry, o.matrixWorld));
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(b.geos, false), b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv; m.renderOrder = b.order;
    m.matrixAutoUpdate = false;
    out.add(m);
  }
  for (const k of keep) { const w = new THREE.Matrix4().copy(k.matrixWorld); k.removeFromParent(); w.decompose(k.position, k.quaternion, k.scale); out.add(k); }
  out.userData.stats = { meshes: buckets.size, live: keep.length };
  return out;
}
function prep(geo, matrix) {
  let g = geo.index ? geo.clone() : mergeVertices(geo.clone());
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.morphAttributes = {};
  g.clearGroups();
  g.applyMatrix4(matrix);
  return g;
}

export function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function textTex(text, { w = 512, h = 128, size = 68, color = '#5a3a2a', font = 'Fredoka' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = `700 ${size}px ${font}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + size * 0.06);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
