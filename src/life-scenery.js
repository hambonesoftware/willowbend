import * as THREE from 'three';
import { addSolid, groundAt } from './layout.js';
import { locations } from './life.js';
import { at, bake, ball, box } from './gfx.js';
import { cottage, flower, lamp } from './props.js';

export function lifeScenery(scene, buildings) {
  const [x, z] = locations.home;
  const home = bake(cottage(x + 3, z + 2, -2.2, { wall: 0xffdfb8, roof: 0x6ea98b, door: 0x9c5d45, solid: false }));
  const flowerBox = flower(x + 1.6, z + 2, 0xe88492);
  const porchLamp = lamp(x + 1.9, z + 2.1);
  const mat = box(1, .07, .65, 0xbb795d, 0.01);
  mat.position.set(x + 1, groundAt(x + 1, z + 1) + .06, z + 1);
  const garden = new THREE.Group();
  garden.position.set(locations.garden[0], groundAt(...locations.garden), locations.garden[1]);
  const shoots = at(ball(.24, 0x72a34e, 0.02), 0, .23, 0);
  const fruit = at(ball(.13, 0xe56f55, 0.02), .15, .36, .11);
  garden.add(box(1.3, .18, .85, 0x875839, 0.02), shoots, fruit);
  let seedling = null, homeSolid = false;

  const festival = new THREE.Group();
  const amber = new THREE.MeshBasicMaterial({ color: 0xffc66d });
  const globe = new THREE.SphereGeometry(.23, 12, 8);
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    const gx = Math.sin(angle) * 5.5, gz = Math.cos(angle) * 5.5;
    festival.add(lantern(gx, gz, 2));
  }
  const shares = new THREE.Group();
  for (const [lx, lz] of [[-4, 9], [3, 12], [-5, 21], [2, 25], [8, 8], [-9, -7]]) {
    shares.add(lantern(lx, lz, 1.35));
  }
  const keepsake = lantern(0, 0, 2.45);
  function lantern(lx, lz, height) {
    const post = new THREE.Group();
    post.position.set(lx, groundAt(lx, lz), lz);
    post.add(at(box(.06, height, .06, 0x784e3a, 0), .15, height / 2, .05),
      at(new THREE.Mesh(globe, amber), 0, height, 0));
    return post;
  }

  const warm = new THREE.MeshBasicMaterial({ color: 0xffd182 });
  const windows = Object.values({ ...buildings, home: { x: x + 3, z: z + 2, facing: -2.2, visible: () => home.visible } }).map(building => {
    const light = new THREE.Group();
    const width = building.width ?? 2.8;
    for (const [side, offset] of [[-1, -.085], [-1, .085], [1, -.085], [1, .085]]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(.115, .27), warm);
      light.add(at(pane, side * width * .31 + offset, 1.22, 1.283));
    }
    light.position.set(building.x, groundAt(building.x, building.z), building.z);
    light.rotation.y = building.facing;
    scene.add(light);
    return { light, visible: building.visible };
  });
  const pathLights = new THREE.Group();
  for (const [lx, lz] of [[-3, 21], [1.5, 13], [3, -9], [-2, -19]]) {
    pathLights.add(lantern(lx, lz, 1.35));
  }
  const marketShelf = new THREE.Group();
  marketShelf.position.set(-7.2, groundAt(-7.2, 24.7), 24.7);
  for (const sx of [-.55, .55]) marketShelf.add(at(box(.10, 1, .30, 0x9f6344, .02), sx, .5, 0));
  for (const y of [.36, .85]) marketShelf.add(at(box(1.25, .1, .37, 0xd9a368, .025), 0, y, 0));
  for (const sx of [-.31, 0, .29]) marketShelf.add(at(ball(.11, 0xe07854, .02), sx, .98, 0));
  scene.add(marketShelf);
  const crate = box(1.1, .7, .8, 0xa97449, .025);
  crate.position.set(1.45, groundAt(1.45, 3.3) + .4, 3.3);
  const tree = new THREE.Mesh(globe, amber);
  tree.position.set(-12, groundAt(-12, -87) + 1.35, -87);
  const raceMarker = new THREE.Mesh(new THREE.TorusGeometry(.58, .08, 6, 24), amber);
  raceMarker.rotation.x = -Math.PI / 2;
  raceMarker.visible = false;
  scene.add(home, flowerBox, porchLamp, mat, garden, crate, festival, shares, keepsake, tree, raceMarker, pathLights);

  function sync(life) {
    home.visible = !!life.arrival;
    if (home.visible && !homeSolid) {
      addSolid(x + 3, z + 2, 1.55);
      homeSolid = true;
    }
    seedling = life.garden;
    flowerBox.visible = home.visible && life.home.decoration === 'Flower box';
    porchLamp.visible = home.visible && life.home.decoration === 'Lantern';
    mat.visible = home.visible && life.home.decoration === 'Welcome mat';
    garden.visible = !!life.garden;
    crate.visible = home.visible;
    marketShelf.visible = !!life.marketShelf;
    festival.visible = !!life.festival;
    shares.visible = life.festival === 'share';
    keepsake.visible = life.festival === 'remember';
    tree.visible = life.lantern === 'invited';
    amber.color.setHex(life.festival === 'share' ? 0xffdfa0 : 0xffbe62);
  }

  const harvestEffect = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), new THREE.MeshBasicMaterial());
  harvestEffect.visible = false;
  scene.add(harvestEffect);
  let age = 0;
  function gather(prop, kind) {
    age = 0;
    harvestEffect.visible = true;
    harvestEffect.position.copy(prop.position);
    harvestEffect.material.color.setHex({ wood: 0xc98a52, stone: 0xb7c4cf, copper: 0xc0794e, apples: 0xe56f55 }[kind]);
  }

  function update(dt, point, day) {
    const dark = day.phase === 'Night' || day.phase === 'Evening';
    pathLights.visible = dark && home.visible;
    for (const { light, visible } of windows) light.visible = dark && visible();
    if (seedling) {
      const growth = seedling.watered ? Math.min(1, (day.time - seedling.planted) / 45) : 0;
      shoots.scale.setScalar(.4 + .6 * growth);
      fruit.visible = growth >= 1;
    }
    raceMarker.visible = !!point;
    if (point) raceMarker.position.set(point[0], groundAt(...point) + .09, point[1]);
    if (harvestEffect.visible) {
      age += dt;
      harvestEffect.position.y += dt * 2;
      harvestEffect.scale.setScalar(Math.max(.05, 1 - age * 1.5));
      harvestEffect.visible = age < .55;
    }
  }

  return { sync, gather, update };
}
