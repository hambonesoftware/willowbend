import * as THREE from 'three';
import { at, bake, ball, box, cyl, cap } from './gfx.js';
import { artNoise, storyMaterial } from './art-materials.js';
import { groundAt, height, pathDist, hitSolid, WATER, POND } from './layout.js';

const stone = storyMaterial(0xb2aa91, 'masonry');
const timber = storyMaterial(0x947655, 'wood');
const moss = storyMaterial(0x7e8d64, 'foliage');
const terracotta = storyMaterial(0xb38467, 'plaster');
const leaf = storyMaterial(0xb49f6d);
const patches = new Map();

function patchTexture(kind) {
  if (patches.has(kind)) return patches.get(kind);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const pen = canvas.getContext('2d');
  const image = pen.createImageData(128, 128);
  const tint = { moss: [106, 123, 86], soil: [156, 132, 101], grass: [143, 153, 107], shore: [173, 169, 132] }[kind];
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const distance = Math.hypot((x - 64) / 64, (y - 64) / 64);
    const grain = artNoise(x * 19 + y * 151) * 14;
    const alpha = Math.max(0, Math.min(1, (1 - distance + Math.sin(x * .1) * .025) * 6));
    const index = (y * 128 + x) * 4;
    for (let channel = 0; channel < 3; channel++) image.data[index + channel] = tint[channel] + grain;
    image.data[index + 3] = alpha * 185;
  }
  pen.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1 });
  patches.set(kind, material);
  return material;
}

function groundPatch(x, z, rx, rz, kind) {
  const geometry = new THREE.PlaneGeometry(rx * 2, rz * 2, 12, 12);
  geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const px = x + vertices.getX(i), pz = z + vertices.getZ(i);
    vertices.setXYZ(i, px, groundAt(px, pz) + .105, pz);
  }
  geometry.computeVertexNormals();
  const patch = new THREE.Mesh(geometry, patchTexture(kind));
  patch.receiveShadow = true;
  patch.renderOrder = 1;
  return patch;
}

function planter(group, x, z, size, flowers) {
  const y = groundAt(x, z);
  group.add(at(cyl(size * .8, size * .6, size, terracotta, 0, 12), x, y + size / 2, z));
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4;
    const stem = cap(.018, size * 1.2, moss, 0);
    stem.rotation.z = Math.sin(angle) * .35;
    group.add(at(stem, x + Math.sin(angle) * size * .4, y + size * 1.3, z + Math.cos(angle) * size * .4));
    if (flowers) group.add(at(ball(size * .18, i % 2 ? 0xcba6a0 : 0xd6bd83, 0, 7, 5),
      x + Math.sin(angle) * size * .55, y + size * 1.9, z + Math.cos(angle) * size * .5));
  }
}

export function villageScenery(scene) {
  const decor = new THREE.Group();
  // Hand-set paving and edge planting give the central square a human scale.
  for (let i = 0; i < 50; i++) {
    const angle = i * Math.PI * 2 / 50, r = 6.1 + Math.sin(i * 2.4) * .13;
    const x = Math.sin(angle) * r, z = Math.cos(angle) * r;
    const paving = box(.36, .055, .23, stone, 0, .025);
    paving.rotation.y = angle;
    decor.add(at(paving, x, groundAt(x, z) + .12, z));
  }
  // Nature layers are visual, leaving the established walking and gathering routes open.
  for (const [x, z, rx, rz, kind] of [[-5, 23, 4, 3, 'soil'], [-28, 4, 7, 7, 'soil'],
    [-34, 42, 14, 13, 'shore'], [-12, -88, 9, 8, 'moss'], [-85, -37, 8, 6, 'soil'],
    [-58, -24, 7, 5, 'grass'], [76, -38, 6, 6, 'soil'], [54, -26, 9, 8, 'grass']]) {
    scene.add(groundPatch(x, z, rx, rz, kind));
  }
  for (const [x, z] of [[-7.5, 24.2], [-14.5, 36.3], [-29.8, 2.9], [50.2, -20.6], [-4, 9.5]]) {
    planter(decor, x, z, .35, true);
  }
  // Tools and small domestic objects belong beside the buildings that use them.
  for (const [x, z, facing] of [[-23, 18, 1.1]]) {
    const y = groundAt(x, z);
    const board = box(.52, .09, .95, timber, 0, .025);
    board.rotation.y = facing;
    decor.add(at(board, x, y + .18, z));
    for (const offset of [-.18, .18]) decor.add(at(box(.09, .22, .75, timber, 0), x + offset, y + .11, z));
  }
  for (let i = 0; i < 240; i++) {
    const x = (artNoise(i * 3) - .5) * 145, z = (artNoise(i * 3 + 1) - .5) * 160 - 10;
    const y = height(x, z);
    if (y < WATER + .15 || y > 8 || hitSolid(x, z, .2)) continue;
    if (z > -28 && Math.hypot(x, z) > 26 && pathDist(x, z) > 3) continue;
    const fallen = flatLeaf();
    fallen.rotation.set(-Math.PI / 2, 0, i * 2.4);
    decor.add(at(fallen, x, y + .12, z));
  }

  // Cattails and grasses remain thin and irregular when seen from the dock.
  for (let i = 0; i < 44; i++) {
    const angle = i * 2.4, radius = POND.r + artNoise(i + 10) * 2.2;
    const x = POND.x + Math.sin(angle) * radius, z = POND.z + Math.cos(angle) * radius;
    if (height(x, z) < WATER || pathDist(x, z) < 2 || hitSolid(x, z, .25)) continue;
    const y = groundAt(x, z);
    for (let j = 0; j < 3; j++) {
      const stem = cyl(.012, .018, .75, storyMaterial(0x8c9467, 'reed'), 0, 5);
      stem.rotation.z = Math.sin(j * 2.4 + i) * .15;
      decor.add(at(stem, x + j * .08, y + .38, z));
      decor.add(at(cap(.035, .13, 0x81704f, 0), x + j * .08, y + .79, z));
    }
  }
  const frondShape = new THREE.Shape();
  frondShape.moveTo(0, 0);
  for (let i = 1; i <= 5; i++) {
    const y = i * .12, width = .14 * Math.sin(i / 6 * Math.PI);
    frondShape.lineTo(-width, y - .07);
    frondShape.lineTo(-width * .45, y);
  }
  frondShape.lineTo(0, .76);
  for (let i = 5; i >= 1; i--) {
    const y = i * .12, width = .14 * Math.sin(i / 6 * Math.PI);
    frondShape.lineTo(width * .45, y);
    frondShape.lineTo(width, y - .07);
  }
  frondShape.closePath();
  const frondGeometry = new THREE.ShapeGeometry(frondShape);
  const fernMaterial = storyMaterial(0x87966a, 'foliage');
  for (let i = 0; i < 85; i++) {
    const angle = i * 2.4;
    const pondSide = i < 30;
    const radius = pondSide ? 12.8 + artNoise(i + 70) * 2 : 5 + artNoise(i + 70) * 6;
    const x = (pondSide ? POND.x : -12) + Math.sin(angle) * radius;
    const z = (pondSide ? POND.z : -88) + Math.cos(angle) * radius;
    if (height(x, z) < WATER + .02 || pathDist(x, z) < 1.6 || hitSolid(x, z, .2)) continue;
    const fern = new THREE.Group();
    fern.position.set(x, groundAt(x, z) + .06, z);
    fern.scale.setScalar(.55 + artNoise(i + 90) * .5);
    for (let frond = 0; frond < 7; frond++) {
      const blade = new THREE.Mesh(frondGeometry, fernMaterial);
      blade.rotation.set(-.65, frond * Math.PI * 2 / 7, 0);
      fern.add(blade);
    }
    decor.add(fern);
  }
  const baked = bake(decor, 40);
  scene.add(baked);

  const wing = new THREE.Shape();
  wing.moveTo(-.16, 0);
  wing.quadraticCurveTo(-.10, .1, 0, .02);
  wing.quadraticCurveTo(.12, .1, .16, 0);
  const birdGeometry = new THREE.ShapeGeometry(wing, 8);
  const birdMaterial = new THREE.MeshBasicMaterial({ color: 0x665c4e, side: THREE.DoubleSide });
  const birds = Array.from({ length: 6 }, (_, index) => {
    const bird = new THREE.Mesh(birdGeometry, birdMaterial);
    scene.add(bird);
    return { bird, index };
  });
  // One shared mesh for ripple rings avoids extra lights and reflection passes.
  const ripple = new THREE.Mesh(new THREE.RingGeometry(.8, .825, 40),
    new THREE.MeshBasicMaterial({ color: 0xc4d9d2, transparent: true, opacity: .24, depthWrite: false }));
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.set(-29, WATER + .04, 41.5);
  scene.add(ripple);

  function update(t, day, reducedMotion) {
    for (const { bird, index } of birds) {
      const moving = !reducedMotion && day.phase !== 'Night';
      bird.visible = day.phase !== 'Night';
      const phase = (moving ? t * .12 : 0) + index * 1.05;
      bird.position.set(-32 + Math.cos(phase) * (9 + index), 8 + Math.sin(phase * .7) * 1.4 + index * .3, 34 + Math.sin(phase) * 12);
      bird.rotation.y = -phase;
      bird.rotation.z = moving ? Math.sin(t * 5 + index) * .18 : 0;
    }
    ripple.scale.setScalar(reducedMotion ? 1 : 1 + (t * .18 % 1) * 1.6);
    ripple.material.opacity = reducedMotion ? .14 : .28 * (1 - t * .18 % 1);
  }
  return { update };
}

const leafGeometry = new THREE.CircleGeometry(.075, 5);
function flatLeaf() {
  return new THREE.Mesh(leafGeometry, leaf);
}
