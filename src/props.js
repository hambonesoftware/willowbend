import { artNoise, storyMaterial, lampPoolMaterial } from './art-materials.js';
import { villageCottage, tiledRoof } from './storybook-architecture.js';
// Scenery pieces. Each builder returns a Group placed on the terrain and, where it should block
// walking, registers a solid circle.
import * as THREE from 'three';
import { mesh, hard, ball, box, cyl, cap, cone, torus, flat, at, hipRoof, textTex } from './gfx.js';
import { rand, rng, pick } from './util.js';
import { height, addSolid } from './layout.js';

const WOOD = 0xa9794a, DARK_WOOD = 0x8a5e3c, CREAM = 0xfff6e2, STONE = 0xb9b3ad;
const woodSurface = storyMaterial(WOOD, 'wood');
const darkWoodSurface = storyMaterial(DARK_WOOD, 'wood');
const place = (g, x, z, ry = 0, y = null) => { g.position.set(x, y ?? height(x, z), z); g.rotation.y = ry; return g; };
// rotation that turns a prop's front (+z) toward a point
export const facing = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

export const cottage = villageCottage;

// A plot with a house going up: the village grows as you help build.
export function frame(x, z, ry, sign = 'NEEDS: PLANKS', solid = true) {
  const g = new THREE.Group(), w = 2.6, d = 2.0, h = 1.8, T = 0.028;
  g.add(at(box(w + 0.4, 0.22, d + 0.4, STONE, 0.03, 0.06), 0, 0.11, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.16, h, 0.16, storyMaterial(0xe0b06a, 'wood'), T, 0.03), sx * w / 2, 0.2 + h / 2, sz * d / 2));
  for (const sz of [-1, 1]) g.add(at(box(w + 0.3, 0.16, 0.16, storyMaterial(0xe0b06a, 'wood'), T, 0.03), 0, 0.2 + h, sz * d / 2));
  for (const sx of [-1, 1]) g.add(at(box(0.16, 0.16, d + 0.3, storyMaterial(0xe0b06a, 'wood'), T, 0.03), sx * w / 2, 0.2 + h, 0));
  for (const sz of [-1, 0, 1]) for (const sx of [-1, 1]) {
    const r = box(1.72, 0.13, 0.13, storyMaterial(0xe0b06a, 'wood'), T, 0.03); r.rotation.z = -sx * 0.63;
    g.add(at(r, sx * 0.66, 0.2 + h + 0.5, sz * d / 2));
  }
  g.add(at(box(0.14, 0.14, d + 0.34, storyMaterial(0xe0b06a, 'wood'), T, 0.03), 0, 0.2 + h + 0.98, 0));
  for (let i = 0; i < 3; i++) g.add(at(box(w - 0.1, 0.3, 0.07, 0xf4e2bd, 0.022, 0.02), 0, 0.42 + i * 0.34, -d / 2));
  for (const [lx, ly] of [[-0.19, 0.17], [0.19, 0.17], [0, 0.47]]) { const log = cyl(0.17, 0.17, 1.7, storyMaterial(0xb8824e, 'wood'), T, 12); log.rotation.x = Math.PI / 2; g.add(at(log, -w / 2 - 0.8 + lx, ly, 0.5)); }
  // a little sign: what it needs
  g.add(signboard(sign, 0.4, w / 2 + 0.9, 0.6));
  place(g, x, z, ry);
  if (solid) addSolid(x, z, 1.9);
  return g;
}

export function signboard(text, ry = 0, x = 0, z = 0) {
  const g = new THREE.Group();
  g.add(at(cyl(0.05, 0.06, 1.1, darkWoodSurface, 0.022, 8), 0, 0.55, 0));
  g.add(at(box(1.2, 0.42, 0.07, 0xf0cf96, 0.024, 0.03), 0, 1.0, 0.05));
  g.add(at(flat(new THREE.PlaneGeometry(1.12, 0.36), 0xffffff, { map: textTex(text, { size: 48 }), transparent: true }), 0, 1.0, 0.09));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}

export function signpost(x, z, ry, rows) {
  const g = new THREE.Group();
  g.add(at(cyl(0.075, 0.095, 2.1, storyMaterial(0x9a6a44, 'wood'), 0.028, 10), 0, 1.05, 0));
  rows.forEach(([text, dx, rz], i) => {
    const b = new THREE.Group();
    b.add(box(1.5, 0.4, 0.09, 0xf0cf96, 0.028, 0.04));
    b.add(at(flat(new THREE.PlaneGeometry(1.4, 0.35), 0xffffff, { map: textTex(text), transparent: true }), 0, 0, 0.052));
    const back = flat(new THREE.PlaneGeometry(1.4, 0.35), 0xffffff, { map: textTex(text), transparent: true }); back.rotation.y = Math.PI;
    b.add(at(back, 0, 0, -0.052));
    b.position.set(dx, 1.75 - i * 0.48, 0.09); b.rotation.z = rz;
    g.add(b);
  });
  place(g, x, z, ry);
  addSolid(x, z, 0.25);
  return g;
}

function canopyMaterial(color, shade = 0) {
  const tint = new THREE.Color(color).lerp(new THREE.Color(0x87946c), .55);
  tint.multiplyScalar(1 + shade);
  return storyMaterial(tint.getHex(), 'foliage');
}

export function roundTree(x, z, s = 1, col = 0x6cc45e, fruit = 0) {
  const g = new THREE.Group();
  const bark = storyMaterial(0x8c7154, 'wood');
  const trunk = cyl(.15, .24, 1.8, bark, 0, 10);
  trunk.rotation.z = (artNoise(x + z) - .5) * .12;
  g.add(at(trunk, 0, .9, 0));
  for (const side of [-1, 1]) {
    const branch = cyl(.06, .12, 1.05, bark, 0, 8);
    branch.rotation.z = side * -.62;
    g.add(at(branch, side * .25, 1.53, .02));
  }
  const lobes = [[0, 2.16, 0, .92], [.62, 1.98, .13, .72], [-.60, 1.99, -.06, .72],
    [.12, 2.75, -.02, .61], [0, 2.05, .52, .64], [0, 2.09, -.5, .66]];
  for (const [index, [bx, by, bz, radius]] of lobes.entries()) {
    const crown = ball(radius, canopyMaterial(col, (index % 3 - 1) * .035), 0, 16, 11);
    crown.scale.set(1.07, .89 + artNoise(index + x) * .12, .98);
    g.add(at(crown, bx, by, bz));
  }
  if (fruit) for (const [fx, fy, fz] of [[-.45, 2.3, .78], [.3, 2.05, .92], [.78, 1.55, .72], [-.2, 1.55, 1.05],
    [.5, 2.75, .5], [-.85, 1.6, .5], [.4, 1.9, -.9], [-.6, 2.2, -.7]]) {
    g.add(at(ball(.12, storyMaterial(fruit), 0, 10, 8), fx, fy, fz));
    const leaf = ball(.055, canopyMaterial(col), 0, 7, 5);
    leaf.scale.set(.5, .3, 1.8);
    g.add(at(leaf, fx + .03, fy + .13, fz));
  }
  g.scale.setScalar(s);
  place(g, x, z, rand(0, 6.28));
  addSolid(x, z, .32 * s);
  return g;
}

export function pine(x, z, s = 1, col = 0x3f9d74) {
  const g = new THREE.Group();
  g.add(at(cyl(.12, .21, 1.3, storyMaterial(0x826b51, 'wood'), 0, 9), 0, .65, 0));
  // Overlapping bent boughs break the perfect cone silhouette.
  for (let tier = 0; tier < 4; tier++) {
    const radius = 1 - tier * .18;
    const y = 1.05 + tier * .52;
    for (let branch = 0; branch < 4; branch++) {
      const angle = branch * Math.PI * 2 / 4 + tier * .75;
      const bough = ball(radius * .57, canopyMaterial(col, tier * .015 - .03), 0, 8, 5);
      bough.scale.set(.8, .55, 1.4);
      bough.rotation.y = angle;
      g.add(at(bough, Math.sin(angle) * radius * .45, y - .08, Math.cos(angle) * radius * .45));
    }
  }
  g.add(at(cone(.24, .83, canopyMaterial(col, .06), 0, 10), .02, 3.02, 0));
  g.scale.setScalar(s);
  place(g, x, z, rand(0, 6.28));
  addSolid(x, z, .28 * s);
  return g;
}

export function birch(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(at(cyl(.10, .16, 2.4, storyMaterial(0xe2dfcb, 'wood'), 0, 10), 0, 1.2, 0));
  for (const y of [.5, 1, 1.5, 2]) g.add(at(box(.16, .025, .025, 0x6d6557, 0), .03, y, .11));
  for (const [index, [bx, by, bz, radius]] of [[0, 2.5, 0, .65], [.4, 2.2, .1, .5],
    [-.38, 2.25, -.1, .5], [0, 2.95, 0, .46]].entries()) {
    const foliage = ball(radius, canopyMaterial(0xa7b874, index * .015), 0, 14, 10);
    foliage.scale.set(1.2, .8, 1);
    g.add(at(foliage, bx, by, bz));
  }
  g.scale.setScalar(s);
  place(g, x, z, rand(0, 6.28));
  addSolid(x, z, .22 * s);
  return g;
}

export function bush(x, z, s = 1, col = 0x58b05c, bloom = 0) {
  const g = new THREE.Group();
  for (const [bx, by, bz, radius] of [[0, .32, 0, .5], [.45, .24, .1, .36], [-.42, .26, .05, .38]]) {
    g.add(at(ball(radius, canopyMaterial(col), 0, 12, 8), bx, by, bz));
  }
  if (bloom) for (const [fx, fy, fz] of [[-.2, .62, .36], [.22, .5, .42], [.55, .36, .36],
    [-.5, .36, .34], [.3, .74, .16], [-.34, .74, .1]]) {
    g.add(at(ball(.07, bloom, 0, 8, 6), fx, fy, fz));
  }
  g.scale.setScalar(s);
  place(g, x, z, rand(0, 6.28));
  addSolid(x, z, .45 * s);
  return g;
}
export function rock(x, z, s = 1, col = 0xbdb6c8, solid = true) {
  const g = new THREE.Group();
  const r = box(1.2, 0.8, 1.0, storyMaterial(new THREE.Color(col).lerp(new THREE.Color(0xa6a38b), .4).getHex(), 'masonry'), 0, 0.3); r.rotation.set(rand(-0.2, 0.2), rand(0, 3), rand(-0.15, 0.15)); g.add(at(r, 0, 0.3, 0));
  if (rng() < 0.6) { const r2 = box(0.7, 0.5, 0.6, storyMaterial(col, 'masonry'), 0, 0.18); r2.rotation.y = rand(0, 3); g.add(at(r2, 0.6, 0.2, 0.3)); }
  g.scale.setScalar(s);
  place(g, x, z, 0, height(x, z) - 0.08 * s);
  if (solid) addSolid(x, z, 0.6 * s);
  return g;
}
export function flower(x, z, c) {
  const f = new THREE.Group(), hd = new THREE.Group();
  const stem = cyl(0.016, 0.02, 0.26, 0x4fa04a, 0, 5); stem.castShadow = false; f.add(at(stem, 0, 0.13, 0));
  for (let k = 0; k < 5; k++) { const p = ball(0.058, c, 0.012, 6, 4); p.castShadow = false; hd.add(at(p, Math.cos(k * 1.257) * 0.075, Math.sin(k * 1.257) * 0.075, 0)); }
  hd.add(at(ball(0.045, c === 0xffd166 ? 0xff7a59 : 0xffd166, 0, 6, 4), 0, 0, 0.035));
  hd.position.y = 0.3; hd.rotation.x = -0.5;
  f.add(hd);
  f.scale.setScalar(rand(0.9, 1.35));
  return place(f, x, z, rand(0, 6.28));
}
const grassShape = new THREE.Shape();
grassShape.moveTo(-.025, 0);
grassShape.quadraticCurveTo(-.03, .17, .065, .31);
grassShape.quadraticCurveTo(.02, .10, .025, 0);
grassShape.closePath();
const grassBlade = new THREE.ShapeGeometry(grassShape, 3);
export function tuft(x, z, col = 0x5fb24f) {
  const g = new THREE.Group();
  const material = canopyMaterial(col);
  for (let k = 0; k < 3; k++) {
    const blade = new THREE.Mesh(grassBlade, material);
    blade.scale.y = rand(.18, .32) / .31;
    blade.rotation.set(0, k * 1.7, (k - 1) * .35);
    g.add(at(blade, (k - 1) * .07, 0, 0));
  }
  return place(g, x, z, rand(0, 6.28));
}
export function mushroom(x, z, s = 1, cap0 = 0xe8554e) {
  const g = new THREE.Group();
  g.add(at(cyl(0.07, 0.09, 0.3, CREAM, 0.02, 8), 0, 0.15, 0));
  const c = mesh(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap0, 0.022); g.add(at(c, 0, 0.27, 0));
  for (const [a, r] of [[0, 0.1], [2.1, 0.12], [4.2, 0.09]]) g.add(at(ball(0.035, 0xffffff, 0, 6, 4), Math.cos(a) * r, 0.42, Math.sin(a) * r));
  g.scale.setScalar(s);
  return place(g, x, z, rand(0, 6.28));
}

export function fence(x0, z0, x1, z1, col = CREAM) {
  const g = new THREE.Group();
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.85)), ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    g.add(at(box(0.13, 0.72, 0.13, col, 0.024, 0.04), x, height(x, z) + 0.36, z));
    if (i % 2 === 0) addSolid(x, z, 0.3);
  }
  const y = height((x0 + x1) / 2, (z0 + z1) / 2);
  for (const ry of [0.26, 0.52]) { const r = box(len, 0.09, 0.07, col, 0.02, 0.02); r.rotation.y = -ang; g.add(at(r, (x0 + x1) / 2, y + ry, (z0 + z1) / 2)); }
  return g;
}

export function well(x, z) {
  const g = new THREE.Group();
  g.add(at(cyl(0.58, 0.64, 0.6, storyMaterial(0xafa894, 'masonry'), 0, 18), 0, 0.3, 0));
  g.add(at(flat(new THREE.CircleGeometry(0.46, 20), 0x58b8e8), 0, 0.605, 0).rotateX(-Math.PI / 2));
  for (const sx of [-1, 1]) g.add(at(box(0.11, 1.3, 0.11, storyMaterial(0x9a6a44, 'wood'), 0.024, 0.03), sx * 0.52, 1.0, 0));
  const r = tiledRoof(1.55, 1.2, .55, 0xb0765c); g.add(at(r, 0, 1.85, 0));
  const axle = cyl(0.05, 0.05, 1.0, darkWoodSurface, 0.02, 8); axle.rotation.z = Math.PI / 2; g.add(at(axle, 0, 1.45, 0));
  g.add(at(cyl(0.1, 0.12, 0.18, 0x8d98b0, 0.02, 10), 0, 1.0, 0));
  place(g, x, z, 0.4);
  addSolid(x, z, 0.75);
  return g;
}
export function lamp(x, z) {
  const g = new THREE.Group();
  g.add(at(cyl(0.06, 0.09, 2.0, 0x5a5068, 0.024, 8), 0, 1.0, 0));
  g.add(at(mesh(new THREE.SphereGeometry(0.17, 12, 10), storyMaterial(0xd8c69e, 'glass'), 0), 0, 2.1, 0));
  g.add(at(cone(0.26, 0.2, 0x5a5068, 0.024, 12), 0, 2.33, 0));
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), lampPoolMaterial());
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, .14, 0);
  g.add(pool);
  place(g, x, z);
  addSolid(x, z, 0.15);
  return g;
}
export function bench(x, z, ry) {
  const g = new THREE.Group();
  g.add(at(box(1.5, 0.1, 0.45, storyMaterial(WOOD, 'wood'), .008, .03), 0, 0.45, 0));
  g.add(at(box(1.5, 0.35, 0.08, storyMaterial(WOOD, 'wood'), .008, .03), 0, 0.72, -0.2));
  for (const sx of [-1, 1]) g.add(at(box(0.1, 0.45, 0.4, 0x5a5068, 0.022, 0.02), sx * 0.62, 0.22, 0));
  place(g, x, z, ry);
  addSolid(x, z, 0.7);
  return g;
}
export function noticeBoard(x, z, ry) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) g.add(at(cyl(0.07, 0.08, 1.8, darkWoodSurface, 0.024, 8), sx * 0.75, 0.9, 0));
  g.add(at(box(1.7, 1.05, 0.1, storyMaterial(0xc98e5a, 'wood'), 0.028, 0.04), 0, 1.15, 0));
  g.add(at(hipRoof(2.1, 0.5, 0.3, 0x3fa7a0, 1.08), 0, 1.86, 0));
  for (const [px, py, c, rz] of [[-0.45, 1.3, 0xfff6e2, 0.06], [0.1, 1.2, 0xffe59a, -0.04], [0.5, 1.35, 0xcfe8ff, 0.08], [-0.15, 0.85, 0xffd6e0, -0.05]]) {
    const p = box(0.42, 0.34, 0.02, c, 0.012, 0.005); p.rotation.z = rz; g.add(at(p, px, py, 0.06));
    g.add(at(flat(new THREE.SphereGeometry(0.025, 6, 4), 0xe8554e), px, py + 0.14, 0.08));
  }
  place(g, x, z, ry);
  addSolid(x, z, 0.9);
  return g;
}
export function stall(x, z, ry) {
  const g = new THREE.Group();
  g.add(at(box(2.4, 0.9, 1.0, woodSurface, 0.03, 0.06), 0, 0.45, 0));
  g.add(at(box(2.5, 0.08, 1.1, storyMaterial(0xe0b06a, 'wood'), 0.024, 0.02), 0, 0.92, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(0.05, 0.05, 2.2, darkWoodSurface, 0.022, 8), sx * 1.15, 1.1, sz * 0.45));
  for (let i = 0; i < 6; i++) {
    const s = box(0.42, 0.06, 1.5, storyMaterial(i % 2 ? 0xece0bf : 0xb78065, 'cloth'), 0, 0.02); s.rotation.x = -0.3;
    g.add(at(s, -1.05 + i * 0.42, 2.25, 0.15));
  }
  for (const [c, px] of [[0xe8463c, -0.8], [0xffb347, -0.25], [0x8fd16a, 0.3], [0xf2c14e, 0.8]]) {
    g.add(at(box(0.48, 0.18, 0.4, storyMaterial(0xc98e5a, 'wood'), 0.02, 0.03), px, 1.04, 0.15));
    for (let k = 0; k < 3; k++) g.add(at(ball(0.09, c, 0.016, 8, 6), px + (k - 1) * 0.12, 1.18, 0.15 + (k % 2) * 0.08));
  }
  g.add(signboard('SHOP', 0, 1.6, 0.7));
  place(g, x, z, ry);
  addSolid(x, z, 1.4);
  return g;
}
export function crops(x, z, w, d) {
  const g = new THREE.Group();
  const soil = box(w, 0.18, d, storyMaterial(0x9a6a44, 'wood'), 0.03, 0.06);
  soil.receiveShadow = true;
  g.add(at(soil, 0, 0.05, 0));
  const rows = Math.floor(d / 1.2);
  for (let r = 0; r < rows; r++) {
    const rz = -d / 2 + 0.6 + r * 1.2;
    g.add(at(box(w - 0.4, 0.14, 0.5, 0x7d5232, 0.02, 0.06), 0, 0.16, rz));
    const kind = r % 3;
    for (let px = -w / 2 + 0.6; px < w / 2 - 0.4; px += 0.75) {
      if (kind === 0) { // carrots
        g.add(at(cone(0.09, 0.2, 0xff8a3c, 0.016, 8).rotateX(Math.PI), px, 0.28, rz));
        for (const a of [-0.3, 0.3]) g.add(at(cone(0.04, 0.3, 0x5fb24f, 0, 5).rotateZ(a), px + a * 0.1, 0.46, rz));
      } else if (kind === 1) { // pumpkins
        const p = ball(0.2, 0xff9a2a, 0.022, 12, 8); p.scale.y = 0.75; g.add(at(p, px, 0.32, rz));
        for (let rib = 0; rib < 5; rib++) {
          const angle = rib * Math.PI * 2 / 5;
          const lobe = ball(.11, storyMaterial(0xc99556), 0, 8, 6);
          lobe.scale.y = 1.05;
          g.add(at(lobe, px + Math.sin(angle) * .12, .32, rz + Math.cos(angle) * .12));
        }
        g.add(at(cyl(0.025, 0.03, 0.1, 0x6b8a3a, 0, 5), px, 0.5, rz));
      } else { // lettuces
        g.add(at(ball(0.18, canopyMaterial(0x8fd16a), 0, 10, 8), px, 0.3, rz));
        g.add(at(ball(0.11, canopyMaterial(0xb9e88a), 0, 8, 6), px, 0.4, rz + 0.05));
      }
    }
  }
  return place(g, x, z, 0);
}
export function scarecrow(x, z, ry) {
  const g = new THREE.Group();
  g.add(at(cyl(0.05, 0.05, 2.2, darkWoodSurface, 0.022, 8), 0, 1.1, 0));
  const arms = cyl(0.04, 0.04, 1.6, darkWoodSurface, 0.02, 8); arms.rotation.z = Math.PI / 2; g.add(at(arms, 0, 1.55, 0));
  g.add(at(box(0.7, 0.75, 0.35, 0x5c7fc2, 0.026, 0.12), 0, 1.45, 0));
  g.add(at(ball(0.3, 0xf2d9a2, 0.026), 0, 2.15, 0));
  g.add(at(cyl(0.5, 0.5, 0.05, storyMaterial(0xe0b06a, 'wood'), 0.022, 16), 0, 2.38, 0));
  g.add(at(cyl(0.24, 0.28, 0.3, storyMaterial(0xe0b06a, 'wood'), 0.022, 16), 0, 2.55, 0));
  place(g, x, z, ry);
  addSolid(x, z, 0.3);
  return g;
}

export function bridge(x0, x1, z, deck) {
  const g = new THREE.Group();
  const n = Math.round((x1 - x0) / 0.55);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, x2 = x0 + ((x1 - x0) * Math.min(n, i + 1)) / n;
    const y = deck(x), slope = Math.atan2(deck(x2) - y, x2 - x || 1);
    const p = box(0.5, 0.12, 3.2, storyMaterial(i % 2 ? 0xb79a71 : 0xa38760, 'wood'), .006, .03); p.rotation.z = slope;
    g.add(at(p, x, y - 0.06, z));
  }
  for (const sz of [-1, 1]) {
    for (let i = 0; i <= 8; i++) {
      const x = x0 + ((x1 - x0) * i) / 8;
      g.add(at(cyl(0.07, 0.08, 1.0, darkWoodSurface, 0.024, 8), x, deck(x) + 0.45, z + sz * 1.55));
    }
    const pts = [];
    for (let i = 0; i <= 24; i++) { const x = x0 + ((x1 - x0) * i) / 24; pts.push(new THREE.Vector3(x, deck(x) + 0.92, z + sz * 1.55)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.07, 6), storyMaterial(0xc98e5a, 'wood'), 0.022));
  }
  for (const sx of [x0, x1]) for (const sz of [-1, 1]) addSolid(sx, z + sz * 1.55, 0.2);
  return g;
}

export function watchtower(x, z) {
  const g = new THREE.Group();
  g.add(at(cyl(1.5, 1.85, 6.2, storyMaterial(0xb6b09b, 'masonry'), .012, 20), 0, 3.1, 0));
  g.add(at(cyl(1.95, 1.95, 0.6, 0xb2b9cf, 0.04, 20), 0, 6.4, 0));
  for (let i = 0; i < 8; i++) if (i !== 3) g.add(at(box(0.7, 0.7, 0.7, 0xb2b9cf, 0.035, 0.08), Math.cos(i * 0.785) * 1.7, 7.0, Math.sin(i * 0.785) * 1.7));
  g.add(at(box(1.0, 1.6, 0.2, 0x4b3140, 0, 0.1), 0, 0.85, 1.72));
  const arch = cyl(0.5, 0.5, 0.2, 0x4b3140, 0, 16); arch.rotation.x = Math.PI / 2; g.add(at(arch, 0, 1.65, 1.72));
  for (const [y, a] of [[3.4, 0.6], [4.9, -0.8]]) g.add(at(box(0.4, 0.6, 0.2, 0x4b3140, 0, 0.06), Math.sin(a) * 1.62, y, Math.cos(a) * 1.62).rotateY(a));
  // ivy and fallen stones: nobody has been up here in years
  for (let i = 0; i < 9; i++) { const a = rand(-1.2, 1.4); g.add(at(ball(rand(0.25, 0.4), canopyMaterial(0x5fb86a), 0, 10, 8), Math.sin(a) * 1.7, rand(0.6, 4.5), Math.cos(a) * 1.7)); }
  for (let i = 0; i < 5; i++) { const s = box(0.5, 0.4, 0.45, 0xb2b9cf, 0.03, 0.08); s.rotation.y = rand(0, 3); g.add(at(s, rand(-3, 3), 0.15, rand(2.2, 3.6))); }
  g.add(at(cyl(0.05, 0.05, 2.0, 0x6b5a4a, 0.02, 6), 0, 7.6, 0));
  const flagG = new THREE.Group(); flagG.userData.keep = true; flagG.userData.flag = true;
  flagG.add(at(box(0.9, 0.5, 0.04, 0xff7a59, 0.024, 0.02), 0.45, 0, 0));
  g.add(at(flagG, 0, 8.3, 0));
  place(g, x, z, 0.2, height(x, z) - 0.1);
  addSolid(x, z, 2.0);
  return g;
}

export function cave(x, z, ry) {
  const g = new THREE.Group();
  const rocks = [[0, 2.2, -1.2, 3.4, 2.6, 2.6], [-2.6, 1.4, -0.6, 2.2, 2.0, 2.4], [2.7, 1.5, -0.5, 2.4, 2.2, 2.4], [0.4, 4.0, -1.6, 2.6, 1.6, 2.2], [-1.6, 3.3, -1.2, 1.6, 1.2, 1.8], [1.9, 3.4, -1.1, 1.7, 1.3, 1.7]];
  for (const [rx, ry2, rz, w, h, d] of rocks) { const b = box(w, h, d, storyMaterial(0x9f9f91, 'masonry'), .009, 0.5); b.rotation.set(rand(-0.15, 0.15), rand(-0.4, 0.4), rand(-0.12, 0.12)); g.add(at(b, rx, ry2, rz)); }
  const mouth = flat(new THREE.CircleGeometry(1.25, 24, 0, Math.PI), 0x1e1424); mouth.scale.y = 1.25;
  g.add(at(mouth, 0, 0.05, 0.12));
  g.add(at(flat(new THREE.PlaneGeometry(2.5, 0.08), 0x1e1424), 0, 0.05, 0.12));
  for (const sx of [-1, 1]) g.add(at(ball(0.07, 0xffe27a, 0, 8, 6).rotateY(0), sx * 0.3, 0.9, 0.14));
  for (let i = 0; i < 6; i++) g.add(at(ball(rand(0.2, 0.32), canopyMaterial(0x6fbf66), 0, 10, 8), rand(-3, 3), rand(3.8, 5), rand(-2, -0.5)));
  for (const [cx, c] of [[-1.7, 0x9fe3ff], [1.6, 0xc79bff], [-2.3, 0xc79bff]]) {
    const cr = cone(0.16, 0.6, c, 0.02, 6); cr.rotation.z = rand(-0.3, 0.3); g.add(at(cr, cx, 0.3, 0.9));
  }
  place(g, x, z, ry, height(x, z) - 0.2);
  for (const [dx, dz, r] of [[0, -1.2, 2.2], [-2.6, -0.6, 1.7], [2.7, -0.5, 1.8], [-1.4, 0.2, 0.6], [1.4, 0.2, 0.6]]) {
    const c = Math.cos(ry), s = Math.sin(ry);
    addSolid(x + dx * c + dz * s, z - dx * s + dz * c, r);
  }
  return g;
}

export function elderTree(x, z) {
  const g = new THREE.Group();
  g.add(at(cyl(0.9, 1.4, 4.5, storyMaterial(0x82664d, 'wood'), .014, 16), 0, 2.25, 0));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.257, root = cap(0.32, 1.4, storyMaterial(0x8a5e3c, 'wood'), 0.04); root.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
    g.add(at(root, Math.sin(a) * 1.3, 0.35, Math.cos(a) * 1.3));
  }
  for (const [bx, by, bz, r] of [[0, 6.2, 0, 3.0], [2.4, 5.4, 0.6, 2.2], [-2.5, 5.5, -0.3, 2.2], [0.4, 8.0, 0, 2.0], [-0.6, 5.6, 2.2, 2.0], [0.6, 5.7, -2.3, 2.1], [2.0, 7.2, -1.2, 1.6], [-1.9, 7.3, 1.0, 1.6]]) {
    g.add(at(ball(r, canopyMaterial(pick([0x5fb86a, 0x6cc45e, 0x58b05c])), 0, 18, 12), bx, by, bz));
  }
  for (let i = 0; i < 18; i++) {
    const a = rand(0, 6.28), r = rand(2.2, 3.4);
    g.add(at(ball(0.13, pick([0xff8fb0, 0xffd6e0, 0xffffff]), 0.016, 8, 6), Math.cos(a) * r, rand(5, 7.6), Math.sin(a) * r));
  }
  // a hollow with a little door: somebody lives in there
  g.add(at(box(0.7, 1.0, 0.2, 0x3fa7a0, 0.026, 0.06), 0, 0.75, 1.32));
  const arch = cyl(0.35, 0.35, 0.2, 0x3fa7a0, 0.026, 14); arch.rotation.x = Math.PI / 2; g.add(at(arch, 0, 1.25, 1.32));
  g.add(at(flat(new THREE.CircleGeometry(0.12, 14), 0xffe9a8), 0, 1.1, 1.43));
  place(g, x, z, 0.3);
  addSolid(x, z, 1.8);
  return g;
}
export function standingStone(x, z, s = 1) {
  const g = new THREE.Group();
  const st = box(0.8, 2.0, 0.55, 0xb2b9cf, 0.035, 0.2); st.rotation.set(rand(-0.06, 0.06), rand(0, 3), rand(-0.08, 0.08));
  g.add(at(st, 0, 0.9, 0));
  g.add(at(ball(0.18, canopyMaterial(0x6fbf66), 0, 8, 6), 0.2, 1.7, 0.22));
  g.scale.setScalar(s);
  place(g, x, z, 0, height(x, z) - 0.05);
  addSolid(x, z, 0.45 * s);
  return g;
}
export function lilyPad(x, z, y) {
  const g = new THREE.Group();
  const p = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 16, 1, false, 0.4, Math.PI * 1.8), canopyMaterial(0x5fb86a), 0);
  g.add(p);
  if (rng() < 0.4) { g.add(at(ball(0.12, 0xffb3d0, 0.016, 8, 6), 0.1, 0.1, 0)); g.add(at(ball(0.06, 0xffe27a, 0, 6, 4), 0.1, 0.18, 0)); }
  g.position.set(x, y + 0.03, z); g.rotation.y = rand(0, 6.28); g.scale.setScalar(rand(0.7, 1.3));
  return g;
}
export function dock(x, z, ry, y) {
  const g = new THREE.Group();
  for (let i = 0; i < 11; i++) g.add(at(box(2.0, 0.1, 0.5, storyMaterial(i % 2 ? 0xb79a71 : 0xa38760, 'wood'), .006, .03), 0, 0, i * 0.55));
  for (const sx of [-1, 1]) for (const k of [0, 2.75, 5.5]) g.add(at(cyl(0.09, 0.1, 1.6, darkWoodSurface, 0.022, 8), sx * 0.9, -0.35, k));
  g.position.set(x, y + 0.35, z); g.rotation.y = ry;
  return g;
}
export function logPile(x, z, ry, solid = true) {
  const g = new THREE.Group();
  for (const [lx, ly] of [[-0.19, 0.17], [0.19, 0.17], [0.57, 0.17], [-0.57, 0.17], [0, 0.47], [0.38, 0.47], [-0.38, 0.47], [0.19, 0.77], [-0.19, 0.77]]) {
    const l = cyl(0.17, 0.17, 1.6, storyMaterial(0xb8824e, 'wood'), 0.028, 10); l.rotation.x = Math.PI / 2; g.add(at(l, lx, ly, 0));
    g.add(at(flat(new THREE.CircleGeometry(0.13, 10), 0xf0cf96), lx, ly, 0.81));
  }
  place(g, x, z, ry);
  if (solid) addSolid(x, z, 0.9);
  return g;
}

export function balloon() {
  const g = new THREE.Group();
  const env = ball(3.2, 0xff7f6b, 0.14, 24, 16); env.scale.y = 1.15; g.add(env);
  for (const [th, c] of [[0.75, 0xfff3d6], [1.5, 0xffd166]]) { const band = mesh(new THREE.SphereGeometry(3.25, 24, 8, 0, Math.PI * 2, th, 0.36), c, 0); band.scale.y = 1.15; g.add(band); }
  g.add(at(box(1.3, 1.0, 1.3, 0xa9794a, 0.12, 0.15), 0, -5.2, 0));
  for (const sx of [-1, 1]) g.add(at(cyl(0.04, 0.04, 2.2, 0x6b5a4a, 0, 6), sx * 0.55, -4.0, 0));
  g.traverse(o => { o.castShadow = false; });
  return g;
}

export { toon } from './gfx.js';
