import * as THREE from 'three';
import { at, bake, ball, box, cyl, torus } from './gfx.js';
import { artNoise, lampPoolMaterial, storyMaterial } from './art-materials.js';
import { addSolid, groundAt } from './layout.js';
import { homeFacing, homePoint, villageHomes } from './village-homes.js';

const wood = storyMaterial(0x957855, 'wood'), dark = storyMaterial(0x695a46, 'wood');
const trim = storyMaterial(0xc2aa80, 'wood'), stone = storyMaterial(0xa5a18c, 'masonry');
const clay = storyMaterial(0xb7866c, 'plaster'), soil = storyMaterial(0x776650, 'soil');
const brass = storyMaterial(0xb49c65), linen = storyMaterial(0xe1d4b2, 'cloth');
const greens = [0x718260, 0x879467, 0x9ca474].map(c => storyMaterial(c, 'foliage'));
const glow = storyMaterial(0xbba77f, 'glass');
const petalMaterials = new Map();
const leafShape = new THREE.Shape();
leafShape.moveTo(0, 0); leafShape.bezierCurveTo(-.15, .18, -.12, .42, 0, .55);
leafShape.bezierCurveTo(.13, .38, .13, .16, 0, 0);
const leafGeo = new THREE.ShapeGeometry(leafShape, 4);
const stemGeo = new THREE.CylinderGeometry(.012, .018, .55, 5);
let pathMaterial;

function beam(group, a, b, size, mat = wood) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const piece = box(size, start.distanceTo(end), size, mat, 0, .012);
  piece.position.copy(start).lerp(end, .5);
  piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  group.add(piece);
}

function blossoms(group, x, y, z, color, scale = 1, seed = 0) {
  if (!petalMaterials.has(color)) petalMaterials.set(color, storyMaterial(color));
  const flowers = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4 + seed, r = Math.sqrt(i / 7) * .38;
    const px = Math.sin(angle) * r, pz = Math.cos(angle) * r, h = .38 + artNoise(i + seed) * .4;
    const stem = new THREE.Mesh(stemGeo, greens[0]);
    stem.scale.y = h / .55; flowers.add(at(stem, px, h / 2, pz));
    for (let side = -1; side <= 1; side += 2) {
      const leaf = new THREE.Mesh(leafGeo, greens[i % 3]);
      leaf.rotation.set(.5, angle + side, side * .7); leaf.scale.setScalar(.65);
      flowers.add(at(leaf, px, h * .28, pz));
    }
    const head = new THREE.Group();
    for (let petal = 0; petal < 5; petal++) {
      const a = petal * Math.PI * 2 / 5;
      const lobe = ball(.075, petalMaterials.get(color), 0, 6, 4);
      lobe.scale.set(1, .45, 1.35); lobe.rotation.y = -a;
      head.add(at(lobe, Math.sin(a) * .075, 0, Math.cos(a) * .075));
    }
    head.add(ball(.036, brass, 0, 6, 4));
    head.rotation.z = Math.sin(angle) * .22;
    flowers.add(at(head, px, h, pz));
  }
  flowers.scale.setScalar(scale);
  group.add(at(flowers, x, y, z));
}

function bush(group, x, y, z, size = 1, color = 0, seed = 0) {
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4 + seed, r = i ? .3 : 0;
    const clump = ball(.32 + artNoise(i + seed) * .1, greens[i % 3], 0, 9, 6);
    clump.scale.set(size, size * (.8 + artNoise(i + 27) * .3), size);
    group.add(at(clump, x + Math.sin(a) * r * size, y + (.26 + i % 2 * .1) * size, z + Math.cos(a) * r * size));
  }
  if (color) blossoms(group, x, y + .18 * size, z, color, size * .72, seed);
}

function pot(group, x, y, z, radius = .24, color = 0, seed = 0) {
  group.add(at(cyl(radius, radius * .7, radius * 1.4, clay, 0, 12), x, y + radius * .7, z),
    at(torus(radius * .96, .025, clay, 0).rotateX(Math.PI / 2), x, y + radius * 1.35, z),
    at(cyl(radius * .85, radius * .85, .025, soil, 0, 12), x, y + radius * 1.35, z));
  if (color) blossoms(group, x, y + radius * 1.4, z, color, radius * 1.7, seed);
  else bush(group, x, y + radius * 1.4, z, radius * 1.5, 0, seed);
}

function basket(group, x, y, z, size = .3) {
  group.add(at(cyl(size, size * .76, size * .8, trim, 0, 12), x, y + size * .4, z),
    at(cyl(size * .82, size * .82, .02, soil, 0, 12), x, y + size * .8, z));
  for (let ring = 0; ring < 4; ring++) group.add(at(torus(size * (.8 + ring * .05), .015, wood, 0).rotateX(Math.PI / 2), x, y + .04 + ring * size * .21, z));
  group.add(at(torus(size * .84, .024, trim, 0, Math.PI), x, y + size * .77, z));
}

function chair(group, x, z, angle = 0) {
  const g = new THREE.Group();
  for (const sx of [-.22, .22]) for (const sz of [-.2, .2]) g.add(at(box(.06, .48, .06, wood, 0), sx, .24, sz));
  for (let plank = 0; plank < 4; plank++) g.add(at(box(.49, .06, .105, wood, 0, .012), 0, .5, -.17 + plank * .115));
  for (const sx of [-.22, .22]) g.add(at(box(.055, .78, .055, wood, 0), sx, .6, -.2));
  for (const y of [.73, .92]) g.add(at(box(.49, .11, .05, trim, 0), 0, y, -.2));
  g.rotation.y = angle; group.add(at(g, x, 0, z));
}

function table(group, x, z, radius = .55) {
  group.add(at(cyl(radius, radius, .08, wood, 0, 16), x, .83, z),
    at(cyl(.09, .13, .78, dark, 0, 8), x, .4, z));
  for (const angle of [0, Math.PI / 2]) {
    const foot = box(radius * 1.4, .08, .12, dark, 0, .015); foot.rotation.y = angle;
    group.add(at(foot, x, .05, z));
  }
}

function mug(group, x, y, z) {
  group.add(at(cyl(.085, .075, .16, linen, 0, 10), x, y + .08, z),
    at(cyl(.068, .068, .01, dark, 0, 10), x, y + .163, z),
    at(torus(.055, .017, linen, 0), x + .085, y + .08, z));
}

function book(group, x, y, z, color = 0x899279, open = false) {
  group.add(at(box(.4, .055, .29, storyMaterial(color, 'cloth'), 0, .014), x, y + .027, z),
    at(box(.35, .023, .25, linen, 0, .005), x, y + .067, z));
  if (open) for (const side of [-1, 1]) {
    const page = box(.23, .018, .28, linen, 0); page.rotation.z = side * .13;
    group.add(at(page, x + side * .115, y + .09, z));
    for (let line = 0; line < 4; line++) group.add(at(box(.14, .003, .008, trim, 0), x + side * .12, y + .11, z - .08 + line * .045));
  }
}

function lantern(group, x, y, z) {
  group.add(at(cyl(.09, .1, .20, glow, 0, 8), x, y + .14, z),
    at(cyl(.13, .1, .045, dark, 0, 8), x, y + .27, z),
    at(cyl(.11, .13, .04, dark, 0, 8), x, y + .02, z),
    at(torus(.065, .014, dark, 0), x, y + .33, z));
}

function climbingRose(group, x, z, color) {
  for (let i = 0; i < 17; i++) {
    const y = .15 + i * .13, px = x + Math.sin(i * 1.3) * .09;
    const leaf = ball(.09, greens[i % 3], 0, 7, 5);
    leaf.scale.set(1.4, .6, .45); leaf.rotation.z = i * .9;
    group.add(at(leaf, px, y, z + .08));
    if (i % 6 === 2) blossoms(group, px, y - .1, z, color, .35, i);
  }
}

function gardenTree(group, x, z, blossomColor = 0) {
  beam(group, [x, 0, z], [x + .1, 2.9, z], .14, dark);
  for (let i = 0; i < 4; i++) {
    const a = i * 2.4, bx = x + Math.sin(a) * .65, bz = z + Math.cos(a) * .6;
    beam(group, [x, 1.6, z], [bx, 3.0 + i % 2 * .3, bz], .075, wood);
    bush(group, bx, 2.7 + i % 2 * .3, bz, 1.1, blossomColor, i * 31);
  }
}

function bed(group, x, z, width, depth, color, seed, rocky = false) {
  group.add(at(box(width, .12, depth, soil, 0, .1), x, .11, z));
  if (rocky) {
    for (let i = 0; i < 13; i++) {
      const a = i * Math.PI * 2 / 13, rock = ball(.18, stone, 0, 7, 5);
      rock.scale.set(1.3, .6, 1); rock.rotation.y = a;
      group.add(at(rock, x + Math.sin(a) * width / 2, .15, z + Math.cos(a) * depth / 2));
    }
  } else {
    for (const side of [-1, 1]) group.add(at(box(.07, .18, depth + .12, wood, 0, .015), x + side * width / 2, .12, z),
      at(box(width, .18, .07, wood, 0, .015), x, .12, z + side * depth / 2));
  }
  const n = Math.max(2, Math.ceil(depth / .48));
  for (let i = 0; i < n; i++) blossoms(group, x + Math.sin(i * 2.4 + seed) * width * .18, .17,
    z - depth * .37 + i / (n - 1) * depth * .74, color, .7 + artNoise(i + seed) * .3, i + seed);
}

function fence(group, home, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.ceil(length / .65);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n;
    group.add(at(box(.08, .68 + i % 3 * .035, .08, trim, 0, .012), x, .34, z));
    addSolid(...homePoint(home, x, z), .09);
  }
  for (const y of [.23, .49]) beam(group, [a[0], y, a[1]], [b[0], y, b[1]], .06);
}

function groundPatch(home) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const pen = canvas.getContext('2d'), image = pen.createImageData(256, 256);
  const front = home.front + .8, back = -3.9, width = 8.8;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const px = (x / 255 - .5) * width, pz = back + y / 255 * (front - back);
    const n = artNoise(x * 17 + y * 301), wear = Math.max(0, 1 - Math.abs(px + Math.sin(pz) * .1) / .9) * (pz > .7 ? 1 : .15);
    const border = Math.min(4.4 - Math.abs(px), pz - back, front - pz);
    const i = (y * 256 + x) * 4;
    const grass = [128, 142, 93], earth = [181, 157, 118];
    for (let c = 0; c < 3; c++) image.data[i + c] = grass[c] * (1 - wear) + earth[c] * wear + (n - .5) * 14;
    image.data[i + 3] = Math.max(0, Math.min(1, border / .9 + (n - .5) * .15)) * 225;
  }
  pen.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(width, front - back, 24, 24); geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const [x, z] = homePoint(home, vertices.getX(i), vertices.getZ(i) + (front + back) / 2);
    // The canvas top is the rear of the plot; PlaneGeometry's rotated UVs match that axis.
    vertices.setXYZ(i, x, groundAt(x, z) + .15, z);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; mesh.renderOrder = 2;
  return mesh;
}

function trail(points) {
  const vertices = [], uv = [], indices = [];
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const samples = curve.getSpacedPoints(Math.max(20, Math.ceil(curve.getLength() / .25)));
  let along = 0;
  for (let i = 0; i < samples.length; i++) {
    const before = samples[Math.max(0, i - 1)], after = samples[Math.min(samples.length - 1, i + 1)];
    const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx, dz);
    if (i) along += samples[i].distanceTo(samples[i - 1]);
    for (const side of [-1, 1]) {
      const width = .54 + Math.sin(along * 2.1) * .025;
      const x = samples[i].x - dz / length * width * side, z = samples[i].z + dx / length * width * side;
      vertices.push(x, groundAt(x, z) + .16, z); uv.push(side < 0 ? 0 : 1, along);
    }
    if (i) { const n = i * 2; indices.push(n - 2, n - 1, n, n - 1, n + 1, n); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  if (!pathMaterial) {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 128;
    const pen = canvas.getContext('2d'), image = pen.createImageData(64, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
      const n = artNoise(x * 19 + y * 97), edge = Math.min(x, 63 - x) / 12, i = (y * 64 + x) * 4;
      for (const [channel, value] of [194, 177, 139].entries()) image.data[i + channel] = value + (n - .5) * 15;
      image.data[i + 3] = Math.max(0, Math.min(1, edge + (n - .5) * .25)) * 220;
    }
    pen.putImageData(image, 0, 0);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapT = THREE.RepeatWrapping;
    pathMaterial = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1 });
  }
  const mesh = new THREE.Mesh(geometry, pathMaterial); mesh.receiveShadow = true; mesh.renderOrder = 3;
  return mesh;
}

function garden(home, decor, scene, motion) {
  const group = new THREE.Group(), front = home.front;
  group.position.set(home.site[0], groundAt(...home.site), home.site[1]); group.rotation.y = homeFacing(home);
  scene.add(groundPatch(home), trail(home.trail));
  // These boundaries are deliberately open at the front and at the back corners.
  fence(group, home, [-3.5, -.9], [-3.5, ['play', 'stones'].includes(home.style) ? 1.1 : front - .5]);
  fence(group, home, [3.5, -.9], [3.5, home.style === 'stones' ? .3 : front - .5]);
  if (['keepsakes', 'sewing'].includes(home.style)) {
    fence(group, home, [-3.5, front - .5], [-1.15, front - .5]);
    fence(group, home, [1.15, front - .5], [3.5, front - .5]);
    // A slim rose arch frames the entrance without putting scenery across the walking lane.
    if (['mabel', 'sewing'].includes(home.id)) {
      for (const x of [-1.02, 1.02]) beam(group, [x, 0, front - .5], [x, 2.3, front - .5], .09, trim);
      beam(group, [-1.12, 2.3, front - .5], [1.12, 2.3, front - .5], .1, trim);
      climbingRose(group, -1.02, front - .5, home.bloom);
      climbingRose(group, 1.02, front - .5, home.bloom);
      for (let i = 0; i < 5; i++) {
        const leaf = ball(.16, greens[i % 3], 0, 8, 5); leaf.scale.set(2, .5, .8);
        group.add(at(leaf, -.8 + i * .4, 2.3, front - .5));
        if (i % 2) blossoms(group, -.8 + i * .4, 2.25, front - .5, home.bloom, .4, i);
      }
    }
  }
  // Beds have depth, edging, foliage, and several heights instead of isolated flower dots.
  const planting = {
    keepsakes: [[-2.55, 2, 1.2, 2.7], [2.55, 2.4, 1.0, 1.8]],
    play: [[-2.8, 3.25, .9, .9], [2.7, -.2, .8, 1.5]],
    rain: [[-2.5, 1.8, 1.15, 2.6]],
    herbs: [[2.75, .7, .8, 1.8]],
    stones: [[-2.7, 2.3, .75, 1.5]],
    sewing: [[2.65, 2.6, 1.05, 1.7]],
  };
  for (const [i, [x, z, w, d]] of planting[home.style].entries()) bed(group, x, z, w, d, home.bloom, i + home.site[0], home.style === 'rain');
  for (const side of [-1, 1]) {
    bush(group, side * 2.55, 0, -.95, .9, home.bloom, side + 42);
    pot(group, side * .93, 0, 1.76, .23, home.bloom, side + 62);
  }
  for (let i = 0; i < 5; i++) {
    const paving = cyl(.24, .27, .04, stone, 0, 7); paving.scale.set(1.7, 1, .85); paving.rotation.y = i * 2.1;
    group.add(at(paving, Math.sin(i * 1.2) * .07, .17, 1.9 + i * (front - 1.9) / 4));
  }
  const lamp = at(new THREE.Mesh(new THREE.PlaneGeometry(3, 3), lampPoolMaterial()), 0, .18, 1.8);
  lamp.rotation.x = -Math.PI / 2; group.add(lamp);
  lantern(group, -1, .85, 1.8);

  // Each scene has a different purpose and a recognisable silhouette.
  if (home.style === 'keepsakes') {
    gardenTree(group, -3.65, -2.0, home.bloom);
    table(group, -2.5, -2.3, .57); chair(group, -2.5, -1.4, Math.PI);
    book(group, -2.63, .88, -2.3, 0x9f8272, true); mug(group, -2.21, .88, -2.4);
    basket(group, -3.1, 0, -1.7); blossoms(group, -3.1, .24, -1.7, home.bloom, .6, 19);
    // A tiny framed family photograph and pressed-flower papers on Mabel's garden shelf.
    group.add(at(box(.55, .72, .22, wood, 0, .02), 2.45, .36, -2.2));
    for (const y of [.17, .49]) book(group, 2.45, y, -2.04, y > .3 ? 0x9d967a : 0xb79979);
    const photo = at(box(.22, .27, .035, trim, 0), 2.45, .87, -2.15); photo.rotation.x = -.15; group.add(photo);
    group.add(at(ball(.045, clay, 0, 7, 5), 2.45, .89, -2.12));
  } else if (home.style === 'play') {
    gardenTree(group, -3.7, -2.2);
    beam(group, [-3.7, 2.65, -1.6], [-2.2, 2.65, -1.6], .09);
    for (const side of [-1, 1]) beam(group, [-2.6 + side * .25, .56, -1.6], [-2.6 + side * .25, 2.65, -1.6], .018, linen);
    group.add(at(box(.67, .065, .30, trim, 0, .02), -2.6, .56, -1.6));
    // Low target hoops, a chalk course, and a toy chest leave the main path free.
    group.add(at(box(1.05, .4, .55, storyMaterial(0x859a88, 'wood'), 0, .05), -2.45, .22, -2.4));
    for (const x of [-2.8, -2.1]) group.add(at(box(.07, .42, .58, trim, 0), x, .23, -2.4));
    for (let i = 0; i < 3; i++) {
      group.add(at(torus(.26, .025, i % 2 ? clay : brass, 0, Math.PI), 2.5, .32, -2.7 + i * .6));
      const mark = new THREE.Mesh(new THREE.RingGeometry(.29, .31, 20), linen); mark.rotation.x = -Math.PI / 2;
      group.add(at(mark, 1.65 + i % 2 * .48, .17, .65 + i * .8));
    }
    basket(group, -2.6, 0, -.3); group.add(at(ball(.17, clay, 0, 12, 8), -2.5, .35, -.3));
  } else if (home.style === 'rain') {
    for (let i = 0; i < 11; i++) {
      const a = i * Math.PI * 2 / 11, rock = ball(.18, stone, 0, 8, 5); rock.scale.y = .55;
      group.add(at(rock, 2.4 + Math.sin(a) * .64, .12, 1.5 + Math.cos(a) * .9));
    }
    const basin = cyl(.57, .57, .025, storyMaterial(0x7c9e99), 0, 22); basin.scale.z = 1.4;
    group.add(at(basin, 2.4, .08, 1.5));
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(leafGeo, greens[i % 3]); leaf.rotation.set(-.2, i, -.3); leaf.scale.set(1.3, 1.5, 1);
      group.add(at(leaf, 2.0 + i * .25, .1, 2.1));
    }
    const barrel = cyl(.38, .33, .88, wood, 0, 14); group.add(at(barrel, 2.2, .44, -1.7));
    for (const y of [.18, .68]) group.add(at(torus(.365, .025, dark, 0).rotateX(Math.PI / 2), 2.2, y, -1.7));
    group.add(at(cyl(.32, .32, .02, storyMaterial(0x7d9d99), 0, 14), 2.2, .89, -1.7));
    beam(group, [1.5, 2.05, -.9], [2.2, 1.02, -1.7], .055, dark);
    const bath = new THREE.Group();
    bath.add(at(cyl(.12, .22, .53, stone, 0, 10), 0, .3, 0), at(cyl(.42, .28, .10, stone, 0, 16), 0, .6, 0),
      at(cyl(.35, .35, .014, storyMaterial(0x8ea7a3), 0, 16), 0, .66, 0));
    group.add(at(bath, -2.5, 0, -2.1));
    for (let i = 0; i < 4; i++) pot(group, -2.5 + i % 2 * .5, 0, -.4 + Math.floor(i / 2) * .55, .18, 0, i);
  } else if (home.style === 'herbs') {
    for (let i = 0; i < 5; i++) pot(group, -2.45 + Math.sin(i * 2.4) * .48, i % 2 * .12, .8 + i * .2, .17 + i % 3 * .04, i % 3 ? 0 : home.bloom, i * 13);
    const rack = new THREE.Group();
    for (const x of [-.65, .65]) beam(rack, [x, 0, -.2], [x, 1.2, .25], .06, trim);
    for (let shelf = 0; shelf < 3; shelf++) {
      rack.add(at(box(1.5, .06, .38, wood, 0), 0, .25 + shelf * .36, shelf * .1));
      for (let i = 0; i < 3; i++) pot(rack, -.48 + i * .48, .29 + shelf * .36, shelf * .1, .12, 0, i + shelf * 3);
    }
    group.add(at(rack, -2.35, 0, -1.9));
    table(group, 2.45, -2.2, .5); book(group, 2.45, .88, -2.2, 0xb29977, true);
    basket(group, 2.6, 0, -.45); pot(group, 1.95, 0, -.4, .18, home.bloom);
  } else if (home.style === 'stones') {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = .3 + i * .06, rock = ball(.19 + i % 3 * .06, stone, 0, 7, 5);
      rock.scale.set(1.25, .6, 1); rock.rotation.y = a;
      group.add(at(rock, 2.5 + Math.sin(a) * r, .15, 1.7 + Math.cos(a) * r));
    }
    bush(group, 2.7, .1, 2.4, .7, 0, 49);
    const shelf = new THREE.Group();
    for (const x of [-.6, .6]) shelf.add(at(box(.09, 1.12, .34, wood, 0), x, .56, 0));
    for (let i = 0; i < 3; i++) {
      shelf.add(at(box(1.4, .08, .45, trim, 0), 0, .18 + i * .38, 0));
      for (let j = 0; j < 4; j++) {
        const rock = ball(.10 + j % 2 * .03, storyMaterial([0x9ba48e, 0xbab09c, 0x8d9d9b, 0xb4a0a0][j], 'masonry'), 0, 7, 5);
        rock.scale.y = .7; shelf.add(at(rock, -.48 + j * .32, .29 + i * .38, .06));
      }
    }
    group.add(at(shelf, -2.45, 0, -2));
    table(group, 2.5, -2.2, .55); book(group, 2.55, .88, -2.2, 0x82938b, true);
    group.add(at(torus(.10, .018, brass, 0).rotateX(-Math.PI / 2), 2.27, .95, -2.05));
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4, rock = ball(.16, stone, 0, 7, 5); rock.scale.y = .55;
      group.add(at(rock, -2.4 + Math.sin(a) * .65, .13, -.1 + Math.cos(a) * .5));
    }
  } else if (home.style === 'sewing') {
    table(group, -2.45, 1.7, .65); chair(group, -2.45, 2.6, Math.PI);
    for (let i = 0; i < 3; i++) group.add(at(cyl(.07, .07, .16, storyMaterial([0xb78e8e, 0x8b9a83, 0xc6b183][i], 'cloth'), 0, 8), -2.7 + i * .24, .96, 1.7));
    basket(group, 2.4, 0, -2.1, .38);
    const line = new THREE.Group();
    beam(line, [-1, 0, 0], [-1, 1.65, 0], .06); beam(line, [1, 0, 0], [1, 1.65, 0], .06);
    beam(line, [-1, 1.65, 0], [1, 1.55, 0], .015, linen);
    for (let i = 0; i < 3; i++) {
      const cloth = box(.40, .56, .014, storyMaterial([0xccaaa1, 0xd8cfb0, 0xa1ad96][i], 'cloth'), 0, 0);
      line.add(at(cloth, -.63 + i * .63, 1.24 - i * .03, 0));
      motion.cloths.push({ cloth, phase: i });
    }
    line.rotation.y = .5; group.add(at(line, 2.45, 0, -.5));
  }
  const furniture = {
    keepsakes: [[-2.5, -2.3, .57], [-2.5, -1.4, .3], [2.45, -2.2, .35], [-3.65, -2, .18]],
    play: [[-2.45, -2.4, .55], [-3.7, -2.2, .18]],
    rain: [[2.2, -1.7, .38], [-2.5, -2.1, .42]],
    herbs: [[-2.35, -1.9, .65], [2.45, -2.2, .5]],
    stones: [[-2.45, -2, .65], [2.5, -2.2, .55]],
    sewing: [[-2.45, 1.7, .65], [-2.45, 2.6, .3], [2.4, -2.1, .35]],
  };
  for (const [x, z, r] of furniture[home.style]) addSolid(...homePoint(home, x, z), r);
  decor.add(group);
}

function square(decor) {
  // Garden islands hug the square's edge; all four through-routes stay open.
  for (const [x, z, length, angle, color] of [[-5.4, -2.3, 2.0, -.4, 0xcda4a4], [3.0, -5.7, 1.8, .8, 0xd3bd86],
    [5.6, 2.4, 1.5, -.5, 0xb5adc9], [-2.1, 6.4, 1.5, .1, 0xd6c49b]]) {
    const group = new THREE.Group(); group.rotation.y = angle;
    for (let i = 0; i < 7; i++) {
      const a = i / 6 * Math.PI, rock = box(.4, .22, .3, stone, 0, .09); rock.rotation.y = a;
      group.add(at(rock, Math.cos(a) * length * .6, .16, Math.sin(a) * .5));
    }
    for (let i = 0; i < 3; i++) blossoms(group, -.55 + i * .55, .08, .02, color, .85, i * 13);
    bush(group, -.65, 0, -.3, .7); bush(group, .6, 0, -.3, .65);
    group.position.set(x, groundAt(x, z), z); decor.add(group);
  }
  // A reading table and an old repair basket give the existing benches a purpose.
  const nook = new THREE.Group(); nook.position.set(3.9, groundAt(3.9, -3.9), -3.9);
  table(nook, .4, .95, .4); book(nook, .38, .88, .96, 0x998b72, true); mug(nook, .55, .88, .75);
  basket(nook, -.9, 0, .4, .24); decor.add(nook); addSolid(4.3, -2.95, .4);
  const west = new THREE.Group(); west.position.set(-5.7, groundAt(-5.7, 4.9), 4.9);
  pot(west, 0, 0, 0, .4, 0xc7a0ac, 41); basket(west, .65, 0, .1, .25); decor.add(west);
  // Workstations line up with the residents' established morning stops.
  const flowers = new THREE.Group(); flowers.position.set(-6.3, groundAt(-6.3, 4.15), 4.15);
  flowers.add(at(box(1.1, .07, .6, wood, 0, .02), 0, .72, 0));
  for (const side of [-1, 1]) flowers.add(at(box(.07, .7, .5, trim, 0), side * .43, .35, 0));
  pot(flowers, -.3, .77, 0, .13, 0xcba4a7, 42); basket(flowers, .25, .77, 0, .18);
  blossoms(flowers, .25, .91, 0, 0xdac598, .4, 13); basket(flowers, -.45, 0, .4, .22);
  decor.add(flowers); addSolid(-6.3, 4.15, .42);
  const stones = new THREE.Group(); stones.position.set(-8.3, groundAt(-8.3, -2.8), -2.8);
  table(stones, 0, 0, .42); book(stones, -.1, .88, 0, 0x8a9788, true);
  for (let i = 0; i < 3; i++) stones.add(at(ball(.07, stone, 0, 7, 5), -.22 + i * .2, .96, -.2));
  decor.add(stones); addSolid(-8.3, -2.8, .42);
  const carpenter = new THREE.Group(); carpenter.position.set(-13.8, groundAt(-13.8, -10.4), -10.4);
  for (const side of [-1, 1]) {
    for (const leg of [-1, 1]) beam(carpenter, [side * .4, 0, leg * .25], [side * .4, .42, 0], .07);
    carpenter.add(at(box(.17, .06, 1, wood, 0), side * .4, .44, 0));
  }
  for (let i = 0; i < 3; i++) carpenter.add(at(box(1.25, .06, .16, trim, 0, .012), 0, .49 + i * .03, -.23 + i * .17));
  const saw = box(.45, .045, .14, storyMaterial(0xa5aaa3), 0); saw.rotation.y = -.3;
  carpenter.add(at(saw, .2, .63, .15), at(box(.14, .065, .18, wood, 0, .025), .43, .64, .08));
  basket(carpenter, -.7, 0, .4, .2); decor.add(carpenter);
  // Foot-worn stone fragments and weeds soften the otherwise perfect paving circle.
  for (let i = 0; i < 36; i++) {
    const a = i * 2.4, r = 5.6 + artNoise(i + 490) * 1.4;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.abs(x) < 1.7 || Math.abs(z) < 1.3) continue;
    const pebble = cyl(.08 + artNoise(i) * .08, .12, .035, stone, 0, 5);
    decor.add(at(pebble, x, groundAt(x, z) + .13, z));
  }
}

export function squareGardens(scene) {
  const decor = new THREE.Group(), motion = { cloths: [] };
  for (const home of villageHomes) garden(home, decor, scene, motion);
  square(decor);
  // Move only the few cloth panels out of the static batch.
  for (const { cloth } of motion.cloths) cloth.userData.keep = true;
  const baked = bake(decor, 24); scene.add(baked);
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0xe2d9c6, transparent: true, opacity: .16, depthWrite: false });
  const hearths = villageHomes.filter(home => ['mabel', 'pip', 'fennel'].includes(home.id)).flatMap((home, index) => {
    const [x, z] = homePoint(home, (home.w ?? 2.8) * .28, -.25);
    return Array.from({ length: 3 }, (_, puff) => {
      const mesh = ball(.12, smokeMaterial, 0, 8, 6); mesh.castShadow = false; mesh.receiveShadow = false; scene.add(mesh);
      return { mesh, x, z, y: groundAt(...home.site) + 3.25, phase: index * .27 + puff / 3 };
    });
  });
  const bird = new THREE.Group(), birdBody = storyMaterial(0x9b8b74), birdWing = storyMaterial(0x776c5b);
  const body = ball(.095, birdBody, 0, 10, 7); body.scale.set(.7, .85, 1.3); bird.add(body);
  bird.add(at(ball(.064, birdBody, 0, 9, 6), 0, .09, .07), at(ball(.025, brass, 0, 6, 4), 0, .08, .133));
  const wings = [-1, 1].map(side => {
    const wing = ball(.075, birdWing, 0, 8, 5); wing.scale.set(.3, .7, 1.3);
    bird.add(at(wing, side * .068, .01, -.01)); return { wing, side };
  });
  const dot = villageHomes.find(home => home.id === 'dot');
  const perchA = homePoint(dot, -2.5, -2.1), perchB = homePoint(dot, 2.2, -1.7);
  scene.add(bird);
  const report = { homes: villageHomes.map(home => ({ id: home.id, style: home.style, name: home.name,
    entry: homePoint(home, 0, 2.35), gate: homePoint(home, 0, home.front), trail: home.trail })),
    meshes: baked.userData.stats.meshes, movingCloths: motion.cloths.length };
  return { report, update(time, day, reducedMotion) {
    for (const { cloth, phase } of motion.cloths) cloth.rotation.x = reducedMotion ? 0 : Math.sin(time * 1.6 + phase) * (day.weather === 'Breezy' ? .10 : .035);
    for (const puff of hearths) {
      const age = (time * .18 + puff.phase) % 1;
      puff.mesh.visible = !reducedMotion && ['Evening', 'Night'].includes(day.phase);
      puff.mesh.position.set(puff.x + age * .25, puff.y + age * 1.2, puff.z + age * .12);
      puff.mesh.scale.setScalar((.6 + age * 1.8) * Math.sin(age * Math.PI));
    }
    bird.visible = day.phase !== 'Night' && day.weather !== 'Rain';
    const clock = reducedMotion ? 0 : time % 20, backwards = clock >= 10;
    const fraction = Math.max(0, (clock % 10 - 6) / 4), from = backwards ? perchB : perchA, to = backwards ? perchA : perchB;
    const yFrom = backwards ? 1.05 : .83, yTo = backwards ? .83 : 1.05;
    bird.position.set(from[0] + (to[0] - from[0]) * fraction,
      groundAt(...dot.site) + yFrom + (yTo - yFrom) * fraction + Math.sin(fraction * Math.PI) * 1.6,
      from[1] + (to[1] - from[1]) * fraction);
    bird.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1]);
    for (const { wing, side } of wings) wing.rotation.z = fraction ? Math.sin(time * 16) * .9 * side : 0;
  } };
}
