import * as THREE from 'three';
import { at, ball, box, cyl, torus } from './gfx.js';
import { artNoise, storyMaterial } from './art-materials.js';
import { height, addSolid } from './layout.js';

const timber = storyMaterial(0x89684c, 'wood');
const paleTimber = storyMaterial(0xbe9f73, 'wood');
const stone = storyMaterial(0xaaa18b, 'masonry');
const cream = storyMaterial(0xeee1bf, 'plaster');
const glass = storyMaterial(0x6d8982, 'glass');

export function tiledRoof(w, d, h, color, offset = .12) {
  const group = new THREE.Group();
  const base = new THREE.Color(color);
  base.lerp(new THREE.Color(0x8f947b), .32);
  const colors = [.91, 1, 1.07].map(light => storyMaterial(base.clone().multiplyScalar(light).getHex(), 'roof'));
  const rows = 5, columns = 7;
  const depth = d / columns;
  for (const side of [-1, 1]) {
    const width = w / 2 - side * offset;
    const angle = Math.atan2(h, width);
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const t = (row + .5) / rows;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(width / rows / Math.cos(angle) + .06, .065, depth + .035),
        colors[(row + column) % 3]);
      tile.position.set(offset + side * width * t, h / 2 - t * h, -d / 2 + depth * (column + .5));
      tile.rotation.z = -side * angle;
      tile.castShadow = tile.receiveShadow = true;
      group.add(tile);
    }
  }
  const ridge = cyl(.065, .065, d + .05, timber, 0, 10);
  ridge.rotation.x = Math.PI / 2;
  group.add(at(ridge, offset, h / 2 + .055, 0));
  return group;
}

export function villageCottage(x, z, ry, { wall, roof, door, w = 2.8, h = 1.7, d = 2.4, solid = true }) {
  const group = new THREE.Group();
  const wallColor = new THREE.Color(wall).lerp(new THREE.Color(0xdfcfad), .34);
  const plaster = storyMaterial(wallColor.getHex(), 'plaster');
  const paint = storyMaterial(new THREE.Color(door).lerp(new THREE.Color(0x8b927b), .25).getHex(), 'wood');
  const bodyHeight = h + .22, eave = bodyHeight + .2, roofHeight = 1.15;
  const front = d / 2 + .045;
  group.add(at(box(w + .14, .32, d + .12, stone, 0, .08), 0, .16, 0),
    at(box(w, bodyHeight, d, plaster, 0, .11), 0, .2 + bodyHeight / 2, 0));
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(.12, roofHeight);
  shape.lineTo(w / 2, 0);
  shape.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }), plaster);
  group.add(at(gable, 0, eave, -d / 2));
  group.add(at(tiledRoof(w + .65, d + .65, roofHeight + .15, roof), 0, eave + roofHeight / 2 + .04, 0));
  for (const side of [-1, 1]) {
    group.add(at(box(.11, bodyHeight, .12, timber, 0), side * (w / 2 - .08), .2 + bodyHeight / 2, front),
      at(box(.1, .11, d, timber, 0), side * (w / 2 + .015), eave - .14, 0));
  }
  group.add(at(box(w, .12, .13, timber, 0), 0, eave, front));
  // Open shutters and a deep sill keep a home readable from a moving camera.
  for (const side of [-1, 1]) {
    const wx = side * w * .31, wy = .3 + bodyHeight * .56;
    group.add(at(box(.65, .83, .11, timber, 0, .055), wx, wy, front + .015),
      at(box(.51, .67, .065, glass, 0, .045), wx, wy, front + .08),
      at(box(.025, .68, .04, paleTimber, 0), wx, wy, front + .13),
      at(box(.53, .025, .04, paleTimber, 0), wx, wy, front + .13));
    const shutter = at(box(.25, .77, .06, paint, 0, .025), wx + side * .47, wy, front - .025);
    shutter.rotation.y = side * .3;
    group.add(shutter, at(box(.79, .11, .31, timber, 0, .025), wx, wy - .49, front + .1));
    for (let flower = 0; flower < 3; flower++) {
      group.add(at(ball(.072, flower % 2 ? 0xcba086 : 0xcab375, 0, 8, 6),
        wx - .22 + flower * .22, wy - .33, front + .13));
    }
    // Side glazing gives the streets and rear gardens the same level of finish.
    group.add(at(box(.06, .63, .53, glass, 0, .025), side * (w / 2 + .025), wy, 0),
      at(box(.09, .035, .55, paleTimber, 0), side * (w / 2 + .055), wy, 0));
  }
  group.add(at(box(.65, 1.35, .10, timber, 0, .08), 0, .89, front),
    at(box(.51, 1.18, .08, paint, 0, .075), 0, .88, front + .09),
    at(ball(.04, 0xc9aa6b, 0, 10, 8), .16, .85, front + .16),
    at(box(.83, .1, .4, stone, 0, .03), 0, .06, front + .22));
  group.add(at(torus(.19, .035, paleTimber, 0), .12, eave + .46, front + .025));
  const attic = new THREE.Mesh(new THREE.CircleGeometry(.16, 20), glass);
  group.add(at(attic, .12, eave + .46, front + .022));
  for (const side of [-1, 1]) {
    group.add(at(box(.51, .55, .05, glass, 0, .025), side * w * .25, 1.15, -d / 2 - .03),
      at(box(.58, .07, .16, paleTimber, 0), side * w * .25, .82, -d / 2 - .04));
  }
  const chimneyX = w * .28;
  group.add(at(box(.31, .78, .34, storyMaterial(0xab7f64, 'masonry'), 0, .03), chimneyX, eave + .62, -.25),
    at(box(.43, .09, .45, cream, 0, .02), chimneyX, eave + 1.04, -.25));
  for (let row = 0; row < 4; row++) group.add(at(box(.25, .022, .015, paleTimber, 0), chimneyX, eave + .35 + row * .16, -.07));
  // Small variations belong to the house rather than changing between visits.
  const vine = storyMaterial(0x76865c, 'foliage');
  for (let i = 0; i < 8; i++) {
    const leaf = ball(.085, vine, 0, 8, 6);
    leaf.scale.set(1.2, .7, .35);
    group.add(at(leaf, -w / 2 + .12 + Math.sin(i) * .12, .45 + i * .16, front + .085));
  }
  if (artNoise(x * 4 + z) > .45) {
    group.add(at(cyl(.15, .11, .25, storyMaterial(0xb77e5b, 'plaster'), 0, 12), w / 2 + .12, .13, front));
    group.add(at(ball(.22, vine, 0, 10, 7), w / 2 + .12, .38, front));
  }
  group.position.set(x, height(x, z), z);
  group.rotation.y = ry;
  if (solid) addSolid(x, z, Math.max(w, d) * .62);
  return group;
}
