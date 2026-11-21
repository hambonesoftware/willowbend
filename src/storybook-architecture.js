import * as THREE from 'three';
import { at, ball, box, cyl, torus, textTex } from './gfx.js';
import { artNoise, storyMaterial } from './art-materials.js';
import { height, addSolid } from './layout.js';

const timber = storyMaterial(0x89684c, 'wood');
const paleTimber = storyMaterial(0xbe9f73, 'wood');
const stone = storyMaterial(0xaaa18b, 'masonry');
const cream = storyMaterial(0xeee1bf, 'plaster');
const glass = storyMaterial(0x6d8982, 'glass');

export function tiledRoof(w, d, h, color, offset = .12, handmade = false) {
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
      const tile = handmade ? box(width / rows / Math.cos(angle) + .06, .065, depth + .035, colors[(row + column) % 3], 0, .016) :
        new THREE.Mesh(new THREE.BoxGeometry(width / rows / Math.cos(angle) + .06, .065, depth + .035), colors[(row + column) % 3]);
      tile.position.set(offset + side * width * t, h / 2 - t * h + (handmade ? artNoise(row * 31 + column) * .015 : 0), -d / 2 + depth * (column + .5));
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

export function villageCottage(x, z, ry, { wall, roof, door, w = 2.8, h = 1.7, d = 2.4, solid = true, style, name }) {
  const group = new THREE.Group();
  const wallColor = new THREE.Color(wall).lerp(new THREE.Color(0xdfcfad), .34);
  const plaster = storyMaterial(wallColor.getHex(), 'plaster');
  const paint = storyMaterial(new THREE.Color(door).lerp(new THREE.Color(0x8b927b), .25).getHex(), 'wood');
  const profiles = { keepsakes: [1.4, .2], play: [1.1, -.12], rain: [1.0, .1], herbs: [1.25, -.16], stones: [1.2, .2], sewing: [1.42, -.1], carpenter: [1.32, .12] };
  const [roofHeight, ridge] = profiles[style] ?? [1.15, .12];
  const bodyHeight = h + .22, eave = bodyHeight + .2;
  const front = d / 2 + .045;
  group.add(at(box(w + .14, .32, d + .12, stone, 0, .08), 0, .16, 0),
    at(box(w, bodyHeight, d, plaster, 0, .11), 0, .2 + bodyHeight / 2, 0));
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(ridge, roofHeight);
  shape.lineTo(w / 2, 0);
  shape.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }), plaster);
  group.add(at(gable, 0, eave, -d / 2));
  group.add(at(tiledRoof(w + .65, d + .65, roofHeight + .15, roof, ridge, !!style), 0, eave + roofHeight / 2 + .04, 0));
  for (const side of [-1, 1]) {
    group.add(at(box(.11, bodyHeight, .12, timber, 0), side * (w / 2 - .08), .2 + bodyHeight / 2, front),
      at(box(.1, .11, d, timber, 0), side * (w / 2 + .015), eave - .14, 0));
  }
  group.add(at(box(w, .12, .13, timber, 0), 0, eave, front));
  if (style) {
    const beam = (a, b, width = .09) => {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
      const piece = box(width, start.distanceTo(end), width, timber, 0, .012);
      piece.position.copy(start).lerp(end, .5);
      piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
      group.add(piece);
    };
    beam([-w / 2, eave + .03, front + .04], [ridge, eave + roofHeight, front + .04], .105);
    beam([ridge, eave + roofHeight, front + .04], [w / 2, eave + .03, front + .04], .105);
    for (const side of [-1, 1]) {
      beam([side * w * .44, eave, front + .06], [side * w * .23, eave + .37, front + .06], .065);
      // Timber plinths, corner brackets, and rain gutters give the walls several layers.
      group.add(at(box(.12, .12, d + .18, timber, 0), side * w / 2, .37, 0),
        at(cyl(.035, .035, bodyHeight - .2, storyMaterial(0x727d70), 0, 8), side * (w / 2 + .07), 1.1, -d / 2 + .1));
    }
    let canopy;
    if (style === 'rain') {
      const fabric = new THREE.PlaneGeometry(1.65, 1.08, 10, 6);
      fabric.rotateX(-Math.PI / 2);
      const vertices = fabric.attributes.position;
      for (let i = 0; i < vertices.count; i++) vertices.setY(i, .13 * Math.cos(vertices.getX(i) / 1.65 * Math.PI));
      fabric.computeVertexNormals();
      const material = storyMaterial(0x9eafa4, 'cloth'); material.side = THREE.DoubleSide;
      canopy = new THREE.Mesh(fabric, material); canopy.castShadow = true;
    } else canopy = tiledRoof(1.65, 1.08, .34, roof, .02, true);
    group.add(at(canopy, 0, 2.13, front + .36));
    for (const side of [-1, 1]) {
      group.add(at(box(.065, 1.94, .065, paleTimber, 0), side * .69, .97, front + .7));
      beam([side * .69, 1.55, front + .7], [side * .39, 1.96, front + .7], .05);
    }
    const plaque = box(.82, .19, .045, timber, 0, .025);
    group.add(at(plaque, 0, 1.78, front + .12));
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.74, .15), new THREE.MeshBasicMaterial({ map: textTex(name ?? 'Willowbend', { size: 60, color: '#eadcbb' }), transparent: true, depthWrite: false }));
    group.add(at(label, 0, 1.78, front + .147));
    if (style === 'stones') {
      // Fennel's low collection room changes the silhouette without taking space
      // from the front path. Its collider is part of the same authored structure.
      group.add(at(box(.72, 1.15, 1.35, plaster, 0, .06), -w / 2 - .32, .77, -.15));
      const leanRoof = box(1.0, .085, 1.65, storyMaterial(0x8b927e, 'roof'), 0, .02); leanRoof.rotation.z = .15;
      group.add(at(leanRoof, -w / 2 - .35, 1.42, -.15),
        at(box(.39, .42, .035, glass, 0, .025), -w / 2 - .32, .96, .55),
        at(box(.43, .045, .12, paleTimber, 0), -w / 2 - .32, .71, .6));
      if (solid) {
        const sx = -w / 2 - .32, sz = -.15;
        addSolid(x + Math.cos(ry) * sx + Math.sin(ry) * sz, z - Math.sin(ry) * sx + Math.cos(ry) * sz, .52);
      }
    }
    if (style === 'herbs') {
      const shade = box(.95, .055, 1.5, storyMaterial(0xb5bc96, 'cloth'), 0, .015); shade.rotation.z = -.16;
      group.add(at(shade, w / 2 + .36, 1.96, -.05));
      for (const side of [-1, 1]) {
        group.add(at(box(.055, 1.9, .055, paleTimber, 0), w / 2 + .76, .95, side * .65 - .05));
        if (solid) {
          const sx = w / 2 + .76, sz = side * .65 - .05;
          addSolid(x + Math.cos(ry) * sx + Math.sin(ry) * sz, z - Math.sin(ry) * sx + Math.cos(ry) * sz, .065);
        }
      }
      for (let i = 0; i < 4; i++) {
        const bunch = ball(.09, storyMaterial(0x8c9873, 'foliage'), 0, 8, 6); bunch.scale.y = 2;
        group.add(at(bunch, w / 2 + .65, 1.65, -.5 + i * .31));
      }
    }
    if (style === 'play') for (const side of [-1, 1]) for (let plank = 0; plank < 4; plank++) {
      group.add(at(box(w / 2 - .42, .09, .045, paleTimber, 0, .01), side * (w / 4 + .21), .43 + plank * .115, front + .015));
    }
  }
  // Open shutters and a deep sill keep a home readable from a moving camera.
  for (const side of [-1, 1]) {
    const wx = side * w * .31, wy = .3 + bodyHeight * .56;
    for (const edge of [-1, 1]) group.add(
      at(box(.07, .83, .11, timber, 0, .025), wx + edge * .29, wy, front + .015),
      at(box(.51, .08, .11, timber, 0, .025), wx, wy + edge * .375, front + .015));
    group.add(at(box(.51, .67, .065, glass, 0, .045), wx, wy, front + .026),
      at(box(.025, .68, .04, paleTimber, 0), wx, wy, front + .13),
      at(box(.53, .025, .04, paleTimber, 0), wx, wy, front + .13));
    const shutter = at(box(.25, .77, .06, paint, 0, .025), wx + side * .47, wy, front - .025);
    shutter.rotation.y = side * .3;
    group.add(shutter, at(box(.79, .11, .31, timber, 0, .025), wx, wy - .49, front + .1));
    if (style) {
      // Hollow window boxes, leaves and real blossoms replace the old row of beads.
      group.add(at(box(.77, .17, .27, paint, 0, .025), wx, wy - .43, front + .13),
        at(box(.66, .025, .20, storyMaterial(0x716448, 'soil'), 0), wx, wy - .335, front + .13));
      for (let leaf = 0; leaf < 6; leaf++) {
        const green = ball(.07, storyMaterial(leaf % 2 ? 0x8e9b70 : 0x718460, 'foliage'), 0, 7, 5);
        green.scale.set(.65, 1.7, 1); green.rotation.z = Math.sin(leaf * 2.4) * .65;
        group.add(at(green, wx - .27 + leaf * .11, wy - .27, front + .15));
      }
      for (const edge of [-1, 1]) {
        const curtain = box(.10, .58, .018, storyMaterial(style === 'sewing' ? 0xc4aaa7 : 0xd9cfaf, 'cloth'), 0, .01);
        group.add(at(curtain, wx + edge * .18, wy, front + .077));
      }
      for (let slat = 0; slat < 4; slat++) {
        const batten = box(.19, .016, .015, paleTimber, 0); batten.rotation.y = side * .3;
        group.add(at(batten, wx + side * .47, wy - .23 + slat * .15, front + .015));
      }
    }
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
  for (let i = 0; i < (!style || ['keepsakes', 'sewing', 'carpenter'].includes(style) ? 8 : 0); i++) {
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
