import * as THREE from 'three';
import { at, bake, ball, box, cap, cyl, flat, textTex, torus } from './gfx.js';
import { addSolid, groundAt } from './layout.js';
import { fbm } from './util.js';

// The courtyard uses its own palette and random stream so it cannot move existing world props.
const colors = { plaster: 0xe8d4ad, wood: 0x89634b, trim: 0xbb9668, roof: 0x637e70, clay: 0xb76d51 };
const random = index => {
  const n = Math.sin(index * 127.1 + 31.7) * 43758.5453;
  return n - Math.floor(n);
};

function surface(color, kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const pen = canvas.getContext('2d');
  pen.fillStyle = '#' + new THREE.Color(color).getHexString();
  pen.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const x = random(i * 4) * 256, y = random(i * 4 + 1) * 256;
    pen.fillStyle = i % 2 ? '#fff0d312' : '#392d2414';
    pen.fillRect(x, y, kind === 'wood' ? 1 : 1 + random(i * 4 + 2) * 2, kind === 'wood' ? 5 + random(i * 4 + 3) * 34 : 2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, roughness: 1 });
}

function beam(group, start, end, width, material) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const piece = box(width, a.distanceTo(b), width, material, 0, width * .16);
  piece.position.copy(a).lerp(b, .5);
  piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  group.add(piece);
}

function courtyardGround() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const pen = canvas.getContext('2d');
  const image = pen.createImageData(256, 256);
  for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
    const x = (px / 255 - .5) * 14, z = (py / 255 - .5) * 12;
    const grain = fbm(x * 8, z * 8, 2);
    const noise = fbm(x * 1.4, z * 1.4, 3);
    const edge = Math.max(0, Math.min(1, (1 - Math.hypot(x / 7, z / 6) + noise * .13) * 7));
    const path = Math.max(0, Math.min(1, 2.1 - Math.hypot(x * .34, (z - .1) * .45) + noise * .8));
    const grass = [123, 143, 94], earth = [191, 166, 126];
    const offset = (py * 256 + px) * 4;
    for (let channel = 0; channel < 3; channel++) {
      image.data[offset + channel] = grass[channel] * (1 - path) + earth[channel] * path + grain * 14;
    }
    image.data[offset + 3] = edge * 255;
  }
  pen.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(14, 12, 40, 36);
  geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i) + 7, z = vertices.getZ(i) + 6;
    vertices.setXYZ(i, x, groundAt(x, z) + .125, z);
  }
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 1, depthWrite: false }));
  ground.receiveShadow = true;
  ground.renderOrder = 1;
  return ground;
}

export function bakeryCourtyard(scene) {
  const plaster = surface(colors.plaster, 'plaster');
  const wood = surface(colors.wood, 'wood');
  const trim = surface(colors.trim, 'wood');
  const stone = new THREE.MeshStandardMaterial({ color: 0x9e9982, roughness: 1 });
  const clay = new THREE.MeshStandardMaterial({ color: colors.clay, roughness: 1 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf0e0bb, roughness: 1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x536f67, roughness: .5 });
  const litGlass = new THREE.MeshBasicMaterial({ color: 0xffce83 });
  const building = new THREE.Group();
  building.position.set(7, groundAt(7, 8.5), 8.5);
  building.rotation.y = Math.PI;
  building.add(at(box(4.0, .35, 3, stone, 0, .12), 0, .18, 0),
    at(box(3.8, 2.55, 2.8, plaster, 0, .17), 0, 1.5, 0));
  // A lopsided gable gives the bakery an individual silhouette.
  const front = new THREE.Shape();
  front.moveTo(-1.9, 2.7);
  front.lineTo(.2, 4.1);
  front.lineTo(1.9, 2.7);
  front.closePath();
  const gable = new THREE.ExtrudeGeometry(front, { depth: 2.8, bevelEnabled: false });
  building.add(at(new THREE.Mesh(gable, plaster), 0, 0, -1.4));
  for (const x of [-1.77, 1.77]) building.add(at(box(.14, 2.55, .15, wood, 0), x, 1.5, 1.43));
  building.add(at(box(3.72, .14, .16, wood, 0), 0, 2.72, 1.45));
  beam(building, [-1.85, 2.77, 1.47], [.2, 4.11, 1.47], .12, wood);
  beam(building, [.2, 4.11, 1.47], [1.85, 2.77, 1.47], .12, wood);
  beam(building, [.2, 2.77, 1.48], [.2, 4.0, 1.48], .09, wood);

  const roofColors = [0x597567, 0x6c8876, 0x7d9077, 0x688071];
  const roofMats = roofColors.map(color => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  for (const side of [-1, 1]) {
    const span = side < 0 ? 2.38 : 1.98;
    const angle = Math.atan2(1.5, span);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 10; col++) {
      const along = (row + .5) / 7;
      const x = .2 + side * along * span;
      const y = 4.23 - along * 1.5;
      const tile = box(span / 7 / Math.cos(angle) + .07, .085, .39, roofMats[(row + col * 3) % 4], 0, .025);
      tile.position.set(x, y + random(row * 40 + col) * .018, -1.73 + col * .365);
      tile.rotation.z = -side * angle;
      tile.rotation.y = (random(row * 15 + col) - .5) * .035;
      building.add(tile);
    }
  }
  building.add(at(cap(.1, 3.65, wood, 0).rotateX(Math.PI / 2), .2, 4.25, 0));
  // Shopfront with a recessed door, a display window, and open wooden shutters.
  building.add(at(box(.81, 1.83, .12, wood, 0, .08), -.98, 1.18, 1.44),
    at(box(.58, 1.48, .13, trim, 0, .07), -.98, 1.13, 1.49));
  const doorGlass = at(box(.37, .55, .06, glass, 0, .07), -.98, 1.5, 1.58);
  building.add(doorGlass, at(ball(.045, 0xd6b66e, 0), -.77, 1.01, 1.59));
  const windows = [doorGlass];
  building.add(at(box(1.74, 1.28, .16, wood, 0, .07), .66, 1.51, 1.43));
  const pane = at(box(1.49, 1.03, .065, glass, 0, .05), .66, 1.51, 1.54);
  windows.push(pane);
  building.add(pane);
  for (const wx of [.17, .67, 1.17]) building.add(at(box(.04, 1.05, .05, trim, 0), wx, 1.51, 1.6));
  building.add(at(box(1.53, .04, .06, trim, 0), .66, 1.52, 1.61));
  for (const side of [-1, 1]) {
    const shutter = at(box(.39, 1.18, .1, trim, 0, .02), .66 + side * 1.1, 1.51, 1.42);
    shutter.rotation.y = -side * .35;
    building.add(shutter);
  }
  building.add(at(torus(.29, .055, trim, 0), .2, 3.2, 1.46));
  const atticPane = new THREE.Mesh(new THREE.CircleGeometry(.25, 24), glass);
  building.add(at(atticPane, .2, 3.2, 1.45),
    at(box(.49, .035, .035, trim, 0), .2, 3.2, 1.48),
    at(box(.035, .49, .035, trim, 0), .2, 3.2, 1.48));
  windows.push(atticPane);
  const counter = new THREE.Group();
  counter.add(at(box(1.8, .11, .7, wood, 0, .04), .66, .98, 1.9));
  building.add(counter);
  for (let i = 0; i < 4; i++) {
    const loaf = ball(.13, 0xd7a368, 0, 12, 8);
    loaf.scale.set(1.2, .7, 1);
    counter.add(at(loaf, .1 + i * .34, 1.12, 1.93));
  }

  const ivy = new THREE.MeshStandardMaterial({ color: 0x657d55, roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const leaf = ball(.09, ivy, 0, 10, 7);
    leaf.scale.set(1.2, .75, .3);
    leaf.rotation.z = Math.sin(i * 2.4) * .7;
    building.add(at(leaf, 1.7 + Math.sin(i * .75) * .21, .5 + i * .09, 1.53));
  }
  for (const sx of [-1, 1]) {
    const rear = at(box(.65, .85, .06, glass, 0, .04), sx * 1.02, 1.45, -1.43);
    windows.push(rear);
    building.add(rear, at(box(.8, .08, .22, trim, 0), sx * 1.02, .96, -1.48),
      at(box(.035, .87, .04, trim, 0), sx * 1.02, 1.45, -1.48),
      at(box(.67, .035, .04, trim, 0), sx * 1.02, 1.45, -1.48));
  }

  // Narrow planks underfoot and old masonry at the entrance.
  for (let i = 0; i < 6; i++) building.add(at(box(.28, .13, .65, trim, 0, .015), -1.8 + i * .29, .15, 1.73));
  const canopy = new THREE.Group();
  canopy.position.set(.6, 2.33, 1.5);
  for (let i = 0; i < 8; i++) {
    const stripe = at(box(.29, .065, .94, i % 2 ? cream : clay, 0, .02), -1.02 + i * .29, -.13, .43);
    stripe.rotation.x = .24;
    canopy.add(stripe, at(box(.29, .18, .06, i % 2 ? cream : clay, 0, .055), -1.02 + i * .29, -.32, .9));
  }
  building.add(canopy);
  const shopSign = at(box(1.5, .39, .10, wood, 0, .06), .61, 2.65, 1.57);
  const lettering = flat(new THREE.PlaneGeometry(1.35, .31), 0xffedc9, {
    map: textTex('Pip’s bakery', { w: 512, h: 128, size: 60, color: '#fff0d2' }), transparent: true,
  });
  lettering.position.set(.61, 2.65, 1.63);
  building.add(shopSign, lettering);
  // Each side has timber and inset windows so walking around the bakery remains rewarding.
  for (const side of [-1, 1]) {
    building.add(at(box(.09, .12, 2.65, wood, 0), side * 1.93, 2.6, 0),
      at(box(.1, 1.12, 1.02, wood, 0, .04), side * 1.94, 1.55, 0));
    const sidePane = at(box(.05, .86, .79, glass, 0, .03), side * 2, 1.55, 0);
    windows.push(sidePane);
    building.add(sidePane);
    building.add(at(box(.09, .04, .84, trim, 0), side * 2.04, 1.55, 0),
      at(box(.09, .9, .04, trim, 0), side * 2.04, 1.55, 0));
  }
  building.add(at(box(.55, 1.27, .53, clay, 0, .055), -1, 3.7, -.65),
    at(box(.7, .12, .67, cream, 0, .03), -1, 4.36, -.65));
  for (let i = 0; i < 6; i++) building.add(at(box(.28, .06, .04, trim, 0), -1 + (i % 2) * .11, 3.24 + i * .17, -.37));

  const surroundings = new THREE.Group();
  const ground = courtyardGround();
  scene.add(ground);
  // Low borders leave the plaza, bakery approach, and the neighboring house reachable.
  for (let i = 0; i < 16; i++) {
    const x = 3.25 + (i % 4) * .33, z = 7.3 + Math.floor(i / 4) * .38;
    const rock = ball(.16, i % 3 ? 0xaaa18a : 0xc6b89c, 0, 10, 6);
    rock.scale.set(1.12, .55, .86);
    surroundings.add(at(rock, x, groundAt(x, z) + .18, z));
  }
  for (const [x, z] of [[3.6, 7.8], [10.1, 8.8]]) {
    const y = groundAt(x, z);
    surroundings.add(at(cyl(.3, .23, .47, clay, 0, 14), x, y + .24, z));
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const leaf = ball(.19, i % 2 ? 0x799261 : 0x536e50, 0, 10, 7);
      leaf.scale.set(.65, 1.6, .6);
      leaf.rotation.z = Math.sin(a) * .7;
      surroundings.add(at(leaf, x + Math.sin(a) * .22, y + .65, z + Math.cos(a) * .2));
      if (i % 2) surroundings.add(at(ball(.085, 0xd9b1a0, 0, 8, 6), x + Math.sin(a) * .27, y + .91, z + Math.cos(a) * .2));
    }
  }
  const bladeOutline = new THREE.Shape();
  bladeOutline.moveTo(-.022, 0);
  bladeOutline.quadraticCurveTo(-.02, .16, .04, .27);
  bladeOutline.quadraticCurveTo(.012, .10, .022, 0);
  bladeOutline.closePath();
  const bladeGeometry = new THREE.ShapeGeometry(bladeOutline, 3);
  for (let i = 0; i < 74; i++) {
    const angle = i * 2.4, radius = 3.6 + random(i + 600) * 1.7;
    const x = 7 + Math.sin(angle) * radius, z = 7 + Math.cos(angle) * radius * .75;
    if (x < 2.9 || (z < 6 && x > 4.2 && x < 9.5) || (z > 8 && x > 9)) continue;
    const blades = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.Mesh(bladeGeometry,
        k % 2 ? foliage : dryFoliage);
      blade.position.set((k - 1) * .045, 0, 0);
      blade.scale.y = .7 + random(i + k) * .5;
      blade.rotation.set(-.18, k * 1.8, (k - 1) * .22);
      blades.add(blade);
    }
    surroundings.add(at(blades, x, groundAt(x, z) + .08, z));
  }
  // A prep bench is placed against the side wall, clear of the interaction path.
  const table = new THREE.Group();
  table.position.set(9.6, groundAt(9.6, 6.7), 6.7);
  table.add(at(box(1.35, .12, .58, trim, 0, .03), 0, 1, 0));
  for (const x of [-.48, .48]) table.add(at(box(.08, 1, .36, wood, 0), x, .5, 0));
  table.add(at(cyl(.22, .15, .2, cream, 0, 16), -.2, 1.16, 0),
    at(box(.29, .42, .24, cream, 0, .04), .34, 1.26, -.04));
  surroundings.add(table);
  for (let i = 0; i < 4; i++) {
    const loaf = ball(.12, 0xd6a26a, 0, 12, 8);
    loaf.scale.set(1.4, .6, .8);
    surroundings.add(at(loaf, 9.1 + i * .26, groundAt(9.6, 6.7) + 1.16, 6.91));
  }
  const tree = new THREE.Group();
  tree.position.set(11.7, groundAt(11.7, 8.7), 8.7);
  beam(tree, [0, 0, 0], [-.11, 2.5, .07], .17, wood);
  beam(tree, [0, 1.1, 0], [.65, 2.3, .1], .08, wood);
  const greens = [0x657d57, 0x809367, 0x93a077];
  for (let i = 0; i < 8; i++) {
    const foliage = ball(.69, new THREE.MeshStandardMaterial({ color: greens[i % 3], roughness: 1 }), 0, 18, 12);
    const angle = i * 2.4;
    foliage.scale.set(1.1, .8, .95);
    tree.add(at(foliage, Math.sin(angle) * .65, 2.6 + random(i + 1000) * .5, Math.cos(angle) * .55));
  }
  surroundings.add(tree);
  for (let i = 0; i < 5; i++) {
    const log = cyl(.13, .14, .6, trim, 0, 12);
    log.rotation.z = Math.PI / 2;
    surroundings.add(at(log, 9.4, groundAt(9.4, 10.3) + .15 + Math.floor(i / 3) * .22, 10 + i % 3 * .23));
  }
  const seated = new THREE.Group();
  seated.position.set(3.4, groundAt(3.4, 5.2), 5.2);
  seated.rotation.y = -.3;
  seated.add(at(cyl(.51, .51, .1, trim, 0, 18), 0, .73, 0),
    at(cyl(.06, .12, .7, wood, 0, 10), 0, .35, 0));
  seated.add(at(cyl(.09, .07, .15, cream, 0, 12), 0, .84, 0),
    at(torus(.06, .02, cream, 0), .12, .84, 0));
  surroundings.add(seated);
  for (const z of [4.2, 6.1]) {
    const stool = at(cyl(.27, .22, .45, wood, 0, 14), 3.4, groundAt(3.4, z) + .23, z);
    surroundings.add(stool);
  }
  // Deterministic weathering, stepping stones, and fallen leaves add scale at foot level.
  for (let i = 0; i < 18; i++) {
    const x = 4 + random(i + 340) * 6.2, z = 3.4 + random(i + 400) * 3.3;
    const leaf = flat(new THREE.CircleGeometry(.055 + random(i) * .045, 5), i % 2 ? 0xae8c56 : 0x8d9769);
    leaf.rotation.x = -Math.PI / 2;
    surroundings.add(at(leaf, x, groundAt(x, z) + .15, z));
  }
  for (const pane of windows) pane.userData.keep = true;
  canopy.userData.keep = true;
  for (let i = 0; i < 7; i++) {
    const x = 7 + Math.sin(i * .8) * .12, z = 3.6 + i * .47;
    const paving = cyl(.23 + random(i + 880) * .09, .27, .045, stone, 0, 7);
    paving.scale.set(1.5, 1, .85);
    paving.rotation.y = i * .7;
    surroundings.add(at(paving, x, groundAt(x, z) + .15, z));
  }
  const bakedBuilding = bake(building);
  const bakedSurroundings = bake(surroundings);
  scene.add(bakedBuilding, bakedSurroundings);
  const steamMaterial = new THREE.MeshBasicMaterial({ color: 0xe6ddce, transparent: true, opacity: .12, depthWrite: false });
  const steam = Array.from({ length: 6 }, () => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(.15, 8, 6), steamMaterial);
    scene.add(puff);
    return puff;
  });
  const spill = new THREE.PointLight(0xffc37e, 0, 6, 2);
  spill.position.set(6.8, groundAt(7, 8.5) + 1.65, 6.3);
  scene.add(spill);
  const bird = new THREE.Group();
  bird.add(at(ball(.12, 0x8c7862, 0, 12, 8), 0, .12, 0),
    at(ball(.07, 0x695a49, 0, 10, 8), 0, .2, .08));
  scene.add(bird);
  let open = false, registered = false;
  function sync(done) {
    open = done;
    if (open && !registered) {
      addSolid(7, 8.5, 2.1);
      addSolid(9.6, 6.7, .65);
      addSolid(3.4, 5.2, .54);
      addSolid(11.7, 8.7, .35);
      registered = true;
    }
    bakedBuilding.visible = bakedSurroundings.visible = ground.visible = done;
    canopy.visible = done;
  }
  function update(t, day, reducedMotion) {
    const dark = day.phase === 'Evening' || day.phase === 'Night';
    spill.intensity = open && dark ? 4 : 0;
    for (const window of windows) window.material = dark && open ? litGlass : glass;
    // Windows are kept live because their evening glow changes independently of the masonry.
    for (let i = 0; i < steam.length; i++) {
      const age = (t * .22 + i / steam.length) % 1;
      const puff = steam[i];
      puff.visible = open && day.phase !== 'Night' && !reducedMotion;
      puff.position.set(8 + age * .35, groundAt(7, 8.5) + 4.5 + age * 1.4, 9.15 + age * .3);
      puff.scale.setScalar(.7 + age * 1.9);
    }
    canopy.rotation.z = reducedMotion ? 0 : Math.sin(t * 1.4) * .012;
    bird.visible = open && day.phase !== 'Night';
    const hop = reducedMotion ? 0 : Math.max(0, Math.sin(t * 2)) * .07;
    bird.position.set(4.3 + (reducedMotion ? 0 : Math.sin(t * .28) * .4), groundAt(4.3, 7) + .15 + hop, 7);
    bird.rotation.y = Math.sin(t * .4) * .8;
  }
  sync(false);
  return { sync, update, building: bakedBuilding };
}

const foliage = new THREE.MeshStandardMaterial({ color: 0x768853, roughness: 1, side: THREE.DoubleSide });
const dryFoliage = new THREE.MeshStandardMaterial({ color: 0xa69d65, roughness: 1, side: THREE.DoubleSide });
