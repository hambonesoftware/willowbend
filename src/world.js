// Builds the land, water, paths, sky and every piece of scenery, then bakes the static parts.
import * as THREE from 'three';
import { RAMP, flat, glowTex, bake, ball, at, cone, mesh, box } from './gfx.js';
import { reseed, rand, rng, pick, fbm, smooth, lerp, polyDist } from './util.js';
import {
  WATER, WORLD, RING, LIMIT, RIVER, POND, BRIDGE, PATHS, SITES,
  height, groundAt, bridgeDeck, onBridge, pathDist, hitSolid,
} from './layout.js';
import * as P from './props.js';
import { deposits, projects, workbench } from './rebuild.js';

const SKY = { top: 0x4aaeea, mid: 0x9fdcf8, bot: 0xfff2cc, fog: 0xdcefee };
const PETALS = [0xffffff, 0xff8fb0, 0xffd166, 0xc79bff, 0xff7a59];

export function buildWorld(scene) {
  reseed(20261112);
  const W = { clouds: [], live: [] };
  scene.fog = new THREE.Fog(SKY.fog, 110, 330);
  scene.background = new THREE.Color(SKY.mid);

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6d4b8, 1.8));
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 160 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  W.sun = sun;
  const SUN_DIR = new THREE.Vector3(-20, 17, 20).normalize();
  // the shadow box follows whoever we're looking at, snapped to whole texels so edges don't crawl
  W.follow = (x, z) => {
    const texel = 68 / 2048;
    const sx = Math.round(x / texel) * texel, sz = Math.round(z / texel) * texel;
    sun.target.position.set(sx, 0, sz);
    sun.position.set(sx + SUN_DIR.x * 70, SUN_DIR.y * 70, sz + SUN_DIR.z * 70);
  };
  W.follow(0, 0);

  // ---------- sky ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(SKY.top) }, mid: { value: new THREE.Color(SKY.mid) }, bot: { value: new THREE.Color(SKY.bot) } },
    vertexShader: 'varying vec3 vP; void main() { vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main() { float h = normalize(vP - cameraPosition).y; vec3 c = mix(bot, mid, smoothstep(-0.02, 0.16, h)); c = mix(c, top, smoothstep(0.14, 0.5, h)); gl_FragColor = vec4(c, 1.0); }',
  }));
  sky.renderOrder = -2;
  scene.add(sky);
  W.sky = sky;
  const sunGroup = new THREE.Group();
  sunGroup.add(flat(new THREE.PlaneGeometry(140, 140), 0xffe9a0, { map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sunGroup.add(at(flat(new THREE.CircleGeometry(11, 40), 0xffe58a, { fog: false }), 0, 0, 1));
  scene.add(sunGroup);
  W.sunDisk = sunGroup;

  function cloud(s) {
    const g = new THREE.Group();
    for (const [bx, by, r] of [[0, 0, 3.2], [3.6, -0.4, 2.5], [-3.7, -0.5, 2.3], [1.6, 1.5, 2.3], [-1.7, 1.2, 2.0], [6.4, -0.9, 1.6], [-6.2, -1.0, 1.5]]) {
      const b = flat(new THREE.SphereGeometry(r, 14, 10), 0xffffff, { fog: false });
      b.scale.y = 0.72;
      g.add(at(b, bx, by, 0));
    }
    g.scale.setScalar(s);
    return g;
  }
  for (let i = 0; i < 16; i++) {
    const c = cloud(rand(1.6, 2.8)), a = rand(0, 6.28), r = rand(180, 320);
    c.position.set(Math.cos(a) * r, rand(55, 110), Math.sin(a) * r);
    c.userData.speed = rand(0.6, 1.4);
    scene.add(c);
    W.clouds.push(c);
  }

  // far ranges past the edge of the map, pale with distance
  const far = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rand(-0.05, 0.05), r = rand(200, 250), h = rand(30, 62), w = rand(26, 44);
    const col = pick([0x93b0e0, 0x829fd8, 0x8aa6dc, 0x9db7e4]);
    const m = cone(w, h, col, 0, 10);
    m.castShadow = m.receiveShadow = false;
    far.add(at(m, Math.cos(a) * r, h / 2 - 4, RING.z + Math.sin(a) * r));
    const snow = cone(w * 0.34, h * 0.34, 0xffffff, 0, 10);
    snow.castShadow = false;
    far.add(at(snow, Math.cos(a) * r, h * 0.83 - 4.1, RING.z + Math.sin(a) * r));
  }
  scene.add(far);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(700, 48), new THREE.MeshToonMaterial({ color: 0x86c98e, gradientMap: RAMP }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -6;
  scene.add(floor);

  // ---------- terrain ----------
  const SEG = 230;
  const tg = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  tg.translate(0, 0, RING.z);
  const pos = tg.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color(), c2 = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = height(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.05, z * 0.05, 3);
    c.set(0x8ed35f).lerp(c2.set(0x7fca5c), smooth(-0.3, 0.4, n));
    if (x > 38) c.lerp(c2.set(0xa6df6a), 0.55);                                  // sunny meadow
    if (z < -30 && x < 24 && x > -62) c.lerp(c2.set(0x6fb35a), smooth(-30, -42, z) * 0.75); // woods floor
    if (x < -54) c.lerp(c2.set(0x9cc47a), smooth(-54, -66, x) * 0.6);             // dry highland grass
    // beaches only along real water, not wherever the meadow happens to dip
    const shore = polyDist(RIVER, x, z) < 11 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 6 ? 0.55 : 0.15;
    if (h < WATER + shore) c.lerp(c2.set(0xf2d9a2), smooth(WATER + shore, WATER + shore - 0.3, h));
    if (h < WATER) c.lerp(c2.set(0xc9b27e), smooth(WATER, WATER - 0.6, h));
    if (h > 7) c.lerp(c2.set(0xb7b0c2), smooth(7, 10, h));
    if (h > 22) c.lerp(c2.set(0xffffff), smooth(22, 26, h));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMP }));
  terrain.receiveShadow = true;
  scene.add(terrain);
  W.terrain = terrain;

  // ---------- water ----------
  const WSEG = 150;
  const wg = new THREE.PlaneGeometry(WORLD, WORLD, WSEG, WSEG);
  wg.rotateX(-Math.PI / 2);
  wg.translate(0, WATER, RING.z);
  const wpos = wg.attributes.position, wcol = new Float32Array(wpos.count * 3);
  for (let i = 0; i < wpos.count; i++) {
    const depth = WATER - height(wpos.getX(i), wpos.getZ(i));
    c.set(0x8fe3f0).lerp(c2.set(0x3f9fd8), smooth(0.1, 1.3, depth));
    if (depth < 0.12) c.lerp(c2.set(0xffffff), smooth(0.12, -0.05, depth) * 0.9);
    wcol[i * 3] = c.r; wcol[i * 3 + 1] = c.g; wcol[i * 3 + 2] = c.b;
  }
  wg.setAttribute('color', new THREE.BufferAttribute(wcol, 3));
  const water = new THREE.Mesh(wg, new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMP, transparent: true, opacity: 0.88 }));
  water.receiveShadow = true;
  scene.add(water);
  // glints that drift on the water
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
  W.glints = [];
  for (let i = 0; i < 90; i++) {
    let x, z;
    if (i < 30) { const a = rand(0, 6.28), r = rand(0, POND.r - 3); x = POND.x + Math.cos(a) * r; z = POND.z + Math.sin(a) * r; }
    else { const k = Math.floor(rand(0, RIVER.length - 1)), t = rng(); x = lerp(RIVER[k][0], RIVER[k + 1][0], t) + rand(-1.5, 1.5); z = lerp(RIVER[k][1], RIVER[k + 1][1], t); }
    if (height(x, z) > WATER - 0.3) continue;
    const g = flat(new THREE.PlaneGeometry(0.7, 0.09), 0xffffff, {});
    g.material = glintMat;
    g.rotation.x = -Math.PI / 2; g.rotation.z = rand(-0.3, 0.3);
    g.position.set(x, WATER + 0.02, z);
    g.userData.ph = rand(0, 6.28);
    scene.add(g);
    W.glints.push(g);
  }

  // ---------- paths ----------
  function ribbon(pts, width, color, lift) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const N = Math.ceil(curve.getLength() / 0.45), P2 = [], idx = [], skip = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = curve.getPoint(t), tan = curve.getTangent(t), w = width * 0.5 * (1 + 0.09 * Math.sin(t * N * 0.37));
      const ax = p.x + tan.z * w, az = p.z - tan.x * w, bx = p.x - tan.z * w, bz = p.z + tan.x * w;
      P2.push(ax, height(ax, az) + lift, az, bx, height(bx, bz) + lift, bz);
      skip.push(onBridge(p.x, p.z) || height(p.x, p.z) < WATER + 0.05);
    }
    // the path stops at the water and picks up again past the bridge
    for (let i = 0; i < N; i++) if (!skip[i] && !skip[i + 1]) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color, gradientMap: RAMP, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    m.receiveShadow = true;
    scene.add(m);
  }
  for (const p of Object.values(PATHS)) {
    ribbon(p, 2.5, 0xc9a56a, 0.04); ribbon(p, 2.05, 0xf2d9a2, 0.06);
    // round off where the road runs out
    const [ex, ez] = p[p.length - 1];
    for (const [r, col, lift, f] of [[1.25, 0xc9a56a, 0.04, -2], [1.03, 0xf2d9a2, 0.06, -3]]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshToonMaterial({ color: col, gradientMap: RAMP, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f * 2 }));
      cap.rotation.x = -Math.PI / 2; cap.position.set(ex, height(ex, ez) + lift + 0.02, ez); cap.receiveShadow = true;
      scene.add(cap);
    }
  }
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(SITES.plaza.r + 0.35, 48), new THREE.MeshToonMaterial({ color: 0xc9a56a, gradientMap: RAMP, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.05; plaza.receiveShadow = true;
  scene.add(plaza);
  const plazaIn = new THREE.Mesh(new THREE.CircleGeometry(SITES.plaza.r, 48), new THREE.MeshToonMaterial({ color: 0xead6ad, gradientMap: RAMP, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
  plazaIn.rotation.x = -Math.PI / 2; plazaIn.position.y = 0.07; plazaIn.receiveShadow = true;
  scene.add(plazaIn);

  // ---------- scenery ----------
  const root = new THREE.Group();
  const add = g => { root.add(g); return g; };
  const toPlaza = (x, z) => P.facing(x, z, 0, 0);

  // the village
  add(P.well(0, 0));
  for (const [x, z, o] of [
    [-10, -9, { wall: 0xfff0d2, roof: 0xe8604c, door: 0x4f9bd6 }],
    [8, -14, { wall: 0xffe2c8, roof: 0x3fa7a0, door: 0xf2a541, w: 3.0 }],
    [15, 3, { wall: 0xe9f3ff, roof: 0xf2b441, door: 0xe8604c }],
    [11, 13, { wall: 0xfde8ef, roof: 0x8f7bd8, door: 0x6cc45e, w: 2.6 }],
    [-11, 12, { wall: 0xfff0d2, roof: 0xe8604c, door: 0x3fa7a0, w: 2.6 }],
    [-16, 3, { wall: 0xe8f6e4, roof: 0xf28b6a, door: 0x8f7bd8 }],
  ]) {
    add(P.cottage(x, z, toPlaza(x, z), o));
    const ry = toPlaza(x, z), fx = Math.sin(ry), fz = Math.cos(ry);
    add(P.bush(x - fz * 2.4 + fx * 1.2, z + fx * 2.4 + fz * 1.2, 0.8, 0x58b05c, pick(PETALS)));
  }
  W.homes = { cat: [-10, -9], bunny: [11, 13], bear: [-17, -13], duck: [15, 3], dog: [8, -14], frog: [-11, 12] };
  const [houseX, houseZ] = W.homes.bear;
  const houseFacing = toPlaza(houseX, houseZ);
  const frame = P.frame(houseX, houseZ, houseFacing);
  const house = P.cottage(houseX, houseZ, houseFacing, { wall: 0xffe2c8, roof: 0xd7754f, door: 0x3fa7a0 });
  const frameScenery = bake(frame);
  const houseScenery = bake(house);
  scene.add(frameScenery, houseScenery);
  houseScenery.visible = false;
  W.house = houseScenery;
  add(P.logPile(-20.5, -10.5, 0.9));
  const [bx, bz] = projects.bakery.site;
  const bakeryFrame = bake(P.frame(bx, bz, toPlaza(bx, bz), 'BAKERY PROJECT'));
  const bakery = bake(P.cottage(bx, bz, toPlaza(bx, bz), { wall: 0xffdfac, roof: 0xbc5e82, door: 0x80426b, w: 3.4 }));
  const oven = new THREE.Group();
  oven.position.set(9.5, height(9.5, 8), 8);
  oven.add(at(box(1.05, 0.9, 0.85, 0xbf7157, 0.04, 0.16), 0, 0.45, 0));
  oven.add(at(box(0.56, 0.32, 0.04, 0x4b3140, 0.02, 0.02), 0, 0.4, 0.44));
  const bakerySign = P.signboard('BAKERY', Math.PI, 8.7, 6.5);
  scene.add(bakeryFrame, bakery, oven, bakerySign);
  const bench = P.bench(...workbench, Math.PI / 2);
  const benchSign = P.signboard('WORKBENCH', Math.PI / 2, workbench[0], workbench[1] - 0.5);
  scene.add(bench, benchSign);
  add(P.noticeBoard(-4.4, 9, P.facing(-4.4, 9, 0, 9)));
  for (const a of [0.785, 2.356, 3.927, 5.498]) add(P.lamp(Math.cos(a) * 7.4, Math.sin(a) * 7.4));
  add(P.bench(3.9, -3.9, toPlaza(3.9, -3.9)));
  add(P.bench(-3.9, 3.9, toPlaza(-3.9, 3.9)));
  for (const a of [1.2, 4.35]) { const x = Math.cos(a) * 3.9, z = Math.sin(a) * 3.9; for (let k = 0; k < 6; k++) add(P.flower(x + rand(-0.6, 0.6), z + rand(-0.6, 0.6), pick(PETALS))); }
  add(P.signpost(-3.2, 22.5, 0.15, [['VILLAGE ↑', 0.2, 0.05], ['← LILY POND', -0.2, -0.05]]));
  add(P.signpost(-2.6, -21, -0.1, [['WOODS ↑', 0.2, 0.05], ['↓ VILLAGE', -0.2, -0.05]]));
  add(P.signpost(19.5, -14.5, -0.8, [['BRIDGE →', 0.2, 0.05], ['← VILLAGE', -0.2, -0.05]]));
  add(P.signpost(-26, -2.3, 0.2, [['← HIGHLANDS', -0.2, -0.05], ['ORCHARD ↓', 0.2, 0.05]]));

  // the farm
  const F = SITES.farm;
  add(P.crops(F.x, F.z, F.w - 1, F.d - 1));
  const fx0 = F.x - F.w / 2 - 0.4, fx1 = F.x + F.w / 2 + 0.4, fz0 = F.z - F.d / 2 - 0.4, fz1 = F.z + F.d / 2 + 0.4;
  add(P.fence(fx0, fz0, fx1, fz0)); add(P.fence(fx0, fz1, fx1, fz1)); add(P.fence(fx0, fz0, fx0, fz1));
  add(P.fence(fx1, fz0, fx1, F.z - 1.4)); add(P.fence(fx1, F.z + 1.4, fx1, fz1));
  add(P.scarecrow(F.x - 3.5, F.z - 2.4, 0.6));

  // orchard
  const fruits = [0xe8463c, 0xffb347, 0x9b6bd8];
  [-46, -41, -36, -31].forEach((x, i) => [4, 9, 14].forEach((z, j) => add(P.roundTree(x + rand(-0.6, 0.6), z + rand(-0.6, 0.6), rand(1.15, 1.35), pick([0x6cc45e, 0x74c95a]), fruits[j]))));

  // the pond
  add(P.dock(-22.6, POND.z - 0.2, -Math.PI / 2, WATER));
  for (let i = 0; i < 26; i++) {
    const a = rand(0, 6.28), r = rand(1, POND.r - 2.5), x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
    if (x > POND.x + 7 && Math.abs(z - POND.z) < 2) continue;
    if (height(x, z) < WATER - 0.3) root.add(P.lilyPad(x, z, WATER));
  }

  // the creek and its bridge
  add(P.bridge(BRIDGE.x0, BRIDGE.x1, BRIDGE.z, bridgeDeck));
  W.deposits = new Map();
  for (const node of deposits) {
    const { x, z, kind } = node;
    let prop;
    if (kind === 'wood') prop = P.logPile(x, z, 0.45, false);
    else {
      prop = new THREE.Group();
      prop.position.set(x, height(x, z), z);
      if (kind === 'apples') {
        prop.add(at(box(0.8, 0.32, 0.65, 0xa9794a, 0.02, 0.05), 0, 0.18, 0));
        for (const dx of [-0.23, 0, 0.23]) prop.add(at(ball(0.15, 0xe74945, 0.015, 10, 8), dx, 0.37, 0));
      } else {
        prop.add(at(ball(0.58, 0xa9a2b8, 0.03, 8, 6), 0, 0.31, 0));
        if (kind === 'copper') for (const dx of [-0.18, 0, 0.2]) {
          prop.add(at(cone(0.11, 0.4, 0xe98354, 0.018, 6), dx, 0.78, 0.1));
        }
      }
    }
    const marker = P.signboard(node.name.toUpperCase(), 0, 0, 0.7);
    marker.position.y = 0.52;
    prop.add(marker);
    scene.add(prop);
    W.deposits.set(node.id, prop);
  }

  // A roadside stop between the bridge and the climb to the watchtower.
  add(P.signpost(43, -18.5, -0.45, [['WATCHTOWER →', 0.2, 0.05], ['← WILLOWBEND', -0.2, -0.05]]));
  add(P.bench(51, -21, P.facing(51, -21, 45, -24)));
  add(P.lamp(52.8, -21.1));
  add(P.signpost(55, -22.5, -0.35, [['MEADOW REST', 0.15, 0.05], ['TOWER PATH ↑', -0.2, -0.05]]));

  // the woods, and the glade at their heart
  const G = SITES.glade;
  add(P.elderTree(G.x, G.z - 3));
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.62 + Math.PI;
    if (Math.abs(i - 4) < 1) continue;
    add(P.standingStone(G.x + Math.cos(a + Math.PI) * 8, G.z - 3 + Math.sin(a + Math.PI) * 8, rand(0.85, 1.15)));
  }
  for (let i = 0; i < 26; i++) { const a = rand(0, 6.28), r = rand(2.5, 6); add(P.mushroom(G.x + Math.cos(a) * r, G.z - 3 + Math.sin(a) * r, rand(0.7, 1.5), pick([0xe8554e, 0xc79bff, 0xffb347]))); }

  // landmarks out in the wilds
  add(P.watchtower(SITES.tower.x, SITES.tower.z));
  const beacon = new THREE.Group();
  beacon.position.set(SITES.tower.x, height(SITES.tower.x, SITES.tower.z) + 7.2, SITES.tower.z);
  beacon.add(at(ball(0.8, 0xffab48, 0, 12, 10), 0, 0, 0));
  beacon.add(at(ball(0.54, 0xffe09a, 0, 12, 10), 0, 0.48, 0));
  const light = new THREE.PointLight(0xffb55c, 28, 23);
  beacon.add(light);
  scene.add(beacon);
  W.showProjects = (started, cottageDone, bakeryDone, ovenBuilt, beaconDone) => {
    frameScenery.visible = !cottageDone;
    houseScenery.visible = cottageDone;
    bench.visible = benchSign.visible = started;
    bakeryFrame.visible = cottageDone && !bakeryDone;
    bakery.visible = bakerySign.visible = bakeryDone;
    oven.visible = ovenBuilt;
    beacon.visible = beaconDone;
  };
  add(P.cave(SITES.cave.x, SITES.cave.z, P.facing(SITES.cave.x, SITES.cave.z, -82, -36)));
  add(P.signpost(64, -33, -0.6, [['TOWER →', 0.2, 0.05], ['← VILLAGE', -0.2, -0.05]]));
  add(P.signpost(-74, -30, 0.5, [['← CAVE', -0.2, -0.05], ['VILLAGE →', 0.2, 0.05]]));

  // ---------- nature, scattered by rules ----------
  const ringDist = (x, z) => Math.hypot(x - RING.x, z - RING.z);
  const clear = (x, z, pad, r = 0.6) => {
    const h = height(x, z);
    return h > WATER + 0.35 && h < 9 && ringDist(x, z) < LIMIT + 6 && pathDist(x, z) > pad &&
      Math.hypot(x, z) > 9 && !hitSolid(x, z, r) && !onBridge(x, z) &&
      !(Math.abs(x - F.x) < F.w / 2 + 1.5 && Math.abs(z - F.z) < F.d / 2 + 1.5) &&
      Math.hypot(x - G.x, z - G.z) > 9.5;
  };
  const inWoods = (x, z) => z < -30 && x < 24 && x > -62;
  const sample = (n, fn) => { for (let i = 0; i < n; i++) { const a = rand(0, 6.28), r = Math.sqrt(rng()) * (LIMIT + 14); fn(RING.x + Math.cos(a) * r, RING.z + Math.sin(a) * r); } };

  sample(5200, (x, z) => {
    const woods = inWoods(x, z), high = x < -54, meadow = x > 38, village = Math.hypot(x, z) < 26;
    const density = woods ? 0.55 : high ? 0.12 : meadow ? 0.05 : village ? 0.03 : 0.07;
    if (rng() > density) return;
    const pad = woods ? 2.6 : 3.2;
    if (!clear(x, z, pad, woods ? 1.3 : 1.8)) return;
    if (ringDist(x, z) > LIMIT - 4 && rng() < 0.5) return;
    if (woods) {
      const k = rng();
      if (k < 0.72) add(P.pine(x, z, rand(1.1, 1.9), pick([0x3f9d74, 0x4aa87c, 0x37906a])));
      else if (k < 0.86) add(P.roundTree(x, z, rand(1.1, 1.5), pick([0x5fb86a, 0x58b05c])));
      else add(P.birch(x, z, rand(1.0, 1.3)));
    } else if (high) {
      if (rng() < 0.5) add(P.rock(x, z, rand(0.8, 2.2), pick([0xbdb6c8, 0xb2acc0, 0xc8c2d2])));
      else add(P.pine(x, z, rand(1.0, 1.6), pick([0x3f9d74, 0x4aa87c])));
    } else if (meadow) {
      add(rng() < 0.6 ? P.birch(x, z, rand(1.0, 1.4)) : P.roundTree(x, z, rand(1.1, 1.4), pick([0x74c95a, 0x6cc45e]), rng() < 0.3 ? 0xffb347 : 0));
    } else {
      const k = rng();
      if (k < 0.5) add(P.roundTree(x, z, rand(1.1, 1.5), pick([0x6cc45e, 0x74c95a, 0x5fb86a]), rng() < 0.2 ? 0xe8463c : 0));
      else if (k < 0.75) add(P.pine(x, z, rand(1.1, 1.6)));
      else add(P.bush(x, z, rand(0.9, 1.4), pick([0x58b05c, 0x62b866]), rng() < 0.5 ? pick(PETALS) : 0));
    }
  });
  // the river banks get reeds and stones
  for (let i = 0; i < 260; i++) {
    const k = Math.floor(rand(0, RIVER.length - 1)), t = rng();
    const x = lerp(RIVER[k][0], RIVER[k + 1][0], t) + rand(-6.5, 6.5), z = lerp(RIVER[k][1], RIVER[k + 1][1], t) + rand(-2, 2);
    const h = height(x, z);
    if (h < WATER + 0.05 || h > WATER + 0.9 || ringDist(x, z) > LIMIT + 4 || onBridge(x, z) || pathDist(x, z) < 1.8) continue;
    if (rng() < 0.7) { const g = new THREE.Group(); for (let r = 0; r < 4; r++) { const c3 = cone(0.05, rand(0.6, 1.1), 0x6cae54, 0.016, 5); c3.rotation.z = rand(-0.2, 0.2); g.add(at(c3, rand(-0.2, 0.2), 0.4, rand(-0.2, 0.2))); } g.add(at(cone(0.06, 0.3, 0x8a5e3c, 0.016, 6), 0.1, 1.0, 0)); g.position.set(x, h, z); root.add(g); }
    else add(P.rock(x, z, rand(0.4, 0.8), 0xc8c2d2, false));
  }
  for (let i = 0; i < 70; i++) {
    const a = rand(0, 6.28), r = rand(POND.r - 1, POND.r + 2.5), x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
    if (pathDist(x, z) < 2 || hitSolid(x, z, 0.4)) continue;
    const h = height(x, z); if (h < WATER - 0.1) continue;
    const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const c3 = cone(0.05, rand(0.6, 1.1), 0x6cae54, 0.016, 5); c3.rotation.z = rand(-0.2, 0.2); g.add(at(c3, rand(-0.2, 0.2), 0.4, rand(-0.2, 0.2))); } g.position.set(x, h, z); root.add(g);
  }
  // flowers and grass everywhere it's green
  sample(9000, (x, z) => {
    const h = height(x, z);
    if (h < WATER + 0.45 || h > 7 || pathDist(x, z) < 1.4 || hitSolid(x, z, 0.25) || onBridge(x, z) || Math.hypot(x, z) < SITES.plaza.r + 0.6) return;
    if (Math.abs(x - F.x) < F.w / 2 && Math.abs(z - F.z) < F.d / 2) return;
    const woods = inWoods(x, z), meadow = x > 38;
    const fl = meadow ? 0.5 : woods ? 0.08 : 0.24;
    const k = rng();
    if (k < fl * 0.2) root.add(P.flower(x, z, pick(meadow ? [0xffd166, 0xffffff, 0xc79bff, 0xff8fb0] : PETALS)));
    else if (k < 0.32) root.add(P.tuft(x, z, woods ? 0x4f9a48 : 0x5fb24f));
    else if (woods && k < 0.36) root.add(P.mushroom(x, z, rand(0.6, 1.0), pick([0xe8554e, 0xffb347])));
  });

  // ---------- bake ----------
  for (const [x, z] of [[47.5, -19], [53.5, -19.2], [56, -21]]) {
    for (let i = 0; i < 5; i++) {
      add(P.flower(x + rand(-0.7, 0.7), z + rand(-0.55, 0.55), PETALS[i]));
    }
  }

  const baked = bake(root, 64);
  scene.add(baked);
  W.stats = baked.userData.stats;
  baked.traverse(o => { if (o.userData.flag) W.flag = o; });

  const bal = P.balloon();
  scene.add(bal);
  W.balloon = bal;

  W.update = (dt, t, cam) => {
    sky.position.copy(cam.position);
    W.sunDisk.position.set(cam.position.x + 260, 150, cam.position.z - 330);
    W.sunDisk.lookAt(cam.position);
    for (const cl of W.clouds) {
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 340) cl.position.x = -340;
      cl.lookAt(cam.position.x, cl.position.y, cam.position.z);
    }
    for (const g of W.glints) { const s = Math.sin(t * 1.8 + g.userData.ph); g.visible = s > 0.2; g.scale.x = 0.6 + s * 0.4; }
    if (W.flag) W.flag.rotation.y = Math.sin(t * 2.2) * 0.35;
    const ba = t * 0.018;
    bal.position.set(Math.cos(ba) * 70, 30 + Math.sin(t * 0.5) * 1.2, -30 + Math.sin(ba) * 60);
  };
  return W;
}
