import { topics, chatter } from './dialogue.js';
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeKid, makeCat, makeBunny, makeBear, makeDuck, makeDog, makeFrog, animate } from './chibi.js';
import { groundAt, walkable, zoneAt, height, WATER } from './layout.js';
import { rand, clamp, lerp } from './util.js';
import { projects, deposits, workbench, loadProgress, saveProgress, complete, contribute, remaining, plots, meadowBoard, neighborhood, plotProject, villageJobs, itemNames, moveItems } from './rebuild.js';

const $ = id => document.getElementById(id);
const TEST = /[?&](test|debug)\b/.test(location.search);
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (touch) document.body.classList.add('touch');

// ---------- title ----------
const NAME = 'Willowbend';
for (const cls of ['back', 'front']) {
  const layer = document.createElement('span');
  layer.className = 'layer ' + cls;
  [...NAME].forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.transform = `translateY(${(Math.sin(i * 1.1) * 0.7).toFixed(2)}vh) rotate(${i % 2 ? 2.4 : -2.4}deg)`;
    layer.appendChild(s);
  });
  $('title').appendChild(layer);
}

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 900);

await Promise.all([document.fonts.load('700 68px Fredoka'), document.fonts.load('800 100px "Baloo 2"')]).catch(() => {});
const world = buildWorld(scene);

// ---------- the cast ----------
const player = makeKid();
scene.add(player.root);
const CAST = [
  { name: 'Mabel', make: makeCat, home: world.homes.cat, lines: ['Morning! The well water tastes like clouds today.', 'I heard something humming inside Echo Cave. Brr!', 'If you find nice wood, Bruno needs it for the new house.'] },
  { name: 'Pip', make: makeBunny, home: world.homes.bunny, lines: ['The orchard apples are almost ripe!', 'Have you seen the old watchtower across the creek?', 'I planted carrots. Well, I tried to.'] },
  { name: 'Bruno', make: makeBear, home: world.homes.bear, lines: [] },
  { name: 'Dot', make: makeDuck, home: world.homes.duck, lines: ['Quack! Oh, sorry. Hello!', 'The lily pond is the best place for a nap.', 'Someone lives inside the Elder Tree. I saw a light!'] },
  { name: 'Biscuit', make: makeDog, home: world.homes.dog, lines: ['Wanna race to the bridge? ...Maybe later.', 'I buried something in the woods. I forget where.', 'Every path out of town goes somewhere good!'] },
  { name: 'Fennel', make: makeFrog, home: world.homes.frog, lines: ['Ribbit. The creek is extra sparkly at noon.', 'The highlands are rocky, but the view is worth it.', 'I collect shiny pebbles. Want to see? No? Okay.'] },
  ...villageJobs.map((job, index) => ({
    name: job.villager, make: [makeCat, makeFrog, makeBunny][index], home: job.start, job,
  })),
].map((v, i) => {
  const c = v.make();
  c.ph = i * 1.3;
  scene.add(c.root);
  return { ...v, c, x: 0, z: 0, ry: 0, state: 'pose', timer: rand(0.5, 3), tx: 0, tz: 0, line: 0 };
});
const byName = Object.fromEntries(CAST.map(v => [v.name, v]));

// The opening shot: the gang lined up on the south road with the village behind them.
const POSE = {
  kid: [0.15, 19.7, -0.05], Mabel: [-2.55, 19.0, 0.28], Pip: [2.7, 19.1, -0.3], Bruno: [5.2, 16.9, -0.35],
  Dot: [-6.5, 12.5, 0.6], Biscuit: [3.5, 9.5, -0.2], Fennel: [-4.8, 15.4, 0.45],
};
const SPLASH_CAM = { pos: new THREE.Vector3(0, 3.6, 30.5), look: new THREE.Vector3(0, 2.2, 16) };
const pl = { x: POSE.kid[0], z: POSE.kid[1], y: 0, ry: POSE.kid[2], vx: 0, vz: 0, speed: 0 };
function setPose(c, x, z, ry) { c.root.position.set(x, groundAt(x, z), z); c.root.rotation.y = ry; }
setPose(player, pl.x, pl.z, pl.ry);
for (const v of CAST) { [v.x, v.z, v.ry] = POSE[v.name] ?? [...v.home, 0]; setPose(v.c, v.x, v.z, v.ry); }
player.armHold = byName.Mabel.c.armHold = byName.Bruno.c.armHold = true;
player.arms[-1].rotation.z = -2.55;
byName.Mabel.c.arms[-1].rotation.z = -2.5;
byName.Bruno.c.arms[1].rotation.z = 2.35;

// ---------- camera ----------
const cam = { yaw: 0, pitch: 0.5, dist: 12.5, x: pl.x, y: 0, z: pl.z, mode: 'splash', blend: 0 };
camera.position.copy(SPLASH_CAM.pos);
camera.lookAt(SPLASH_CAM.look);
const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
function followPose(out, look) {
  const h = Math.cos(cam.pitch) * cam.dist;
  // pulled back, aim a little ahead and up so the view opens onto what's in front
  const ahead = Math.max(0, cam.dist - 12.5);
  look.set(cam.x - Math.sin(cam.yaw) * ahead * 0.6, cam.y + 1.3 + ahead * 0.3, cam.z - Math.cos(cam.yaw) * ahead * 0.6);
  out.set(cam.x + Math.sin(cam.yaw) * h, cam.y + 1.3 + Math.sin(cam.pitch) * cam.dist, cam.z + Math.cos(cam.yaw) * h);
  // never let the hills swallow the camera
  const g = height(out.x, out.z);
  if (out.y < g + 1.5) out.y = g + 1.5;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touch ? 1.5 : 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.3 ? 36 * Math.min(1.8, 1.3 / (w / h)) : 36;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- input ----------
const keys = new Set();
const input = { mx: 0, mz: 0, run: false, turn: 0 };
let started = false;
const startKeys = e => { if (!started) { start(); e.preventDefault(); } };
addEventListener('keydown', e => {
  if (!started) { if (!splash.classList.contains('loading')) startKeys(e); return; }
  if (document.querySelector('dialog[open]') || e.target.matches?.('button, select')) return;
  if (e.code === 'KeyB' && !e.repeat) { openBackpack(); e.preventDefault(); return; }
  keys.add(e.code);
  if (e.code === 'Space' || e.code === 'Enter') { if (!e.repeat) interact(); e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const splash = $('splash');
splash.addEventListener('pointerdown', e => { if (!splash.classList.contains('loading')) startKeys(e); });

// touch: left side is a floating joystick, anywhere else drags the camera round
const stick = $('stick'), knob = $('knob');
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const drag = { id: null, x: 0 };
const canvasEl = $('c');
canvasEl.addEventListener('pointerdown', e => {
  if (!started) return;
  if (touch && e.clientX < innerWidth * 0.45 && joy.id === null) {
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
    stick.style.display = 'block'; stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px';
    knob.style.transform = 'translate(0,0)';
  } else if (drag.id === null) { drag.id = e.pointerId; drag.x = e.clientX; }
  canvasEl.setPointerCapture(e.pointerId);
});
canvasEl.addEventListener('pointermove', e => {
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const len = Math.hypot(dx, dy), R = 52;
    if (len > R) { dx *= R / len; dy *= R / len; }
    joy.x = dx / R; joy.y = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (e.pointerId === drag.id) {
    cam.yaw -= (e.clientX - drag.x) * 0.006;
    drag.x = e.clientX;
  }
});
const endPointer = e => {
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; stick.style.display = 'none'; }
  if (e.pointerId === drag.id) drag.id = null;
};
canvasEl.addEventListener('pointerup', endPointer);
canvasEl.addEventListener('pointercancel', endPointer);
// zooming out also lowers the camera, so pulling back shows the horizon and the landmarks
const zoom = d => { cam.dist = clamp(d, 7, 24); cam.pitch = lerp(0.64, 0.26, (cam.dist - 7) / 17); };
canvasEl.addEventListener('wheel', e => zoom(cam.dist + e.deltaY * 0.01), { passive: true });
$('talk').addEventListener('click', interact);

function readInput() {
  if (document.querySelector('dialog[open]')) { Object.assign(input, { mx: 0, mz: 0, run: false, turn: 0, zoom: 0 }); return; }
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  let mag = Math.hypot(mx, mz);
  if (mag > 1) { mx /= mag; mz /= mag; mag = 1; }
  let run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (joy.id !== null) { mx = joy.x; mz = joy.y; mag = Math.hypot(mx, mz); if (mag < 0.12) mx = mz = 0; run = mag > 0.85; }
  input.mx = mx; input.mz = mz; input.run = run;
  input.turn = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
  input.zoom = (keys.has('Minus') || keys.has('NumpadSubtract') ? 1 : 0) - (keys.has('Equal') || keys.has('NumpadAdd') ? 1 : 0);
}

// ---------- starting ----------
function start() {
  if (started) return;
  started = true;
  splash.classList.add('gone');
  $('hud').classList.add('on');
  player.armHold = byName.Mabel.c.armHold = byName.Bruno.c.armHold = false;
  cam.mode = 'intro'; cam.blend = 0;
  cam.yaw = 0; cam.x = pl.x; cam.z = pl.z; cam.y = groundAt(pl.x, pl.z);
  for (const v of CAST) { v.state = 'idle'; v.timer = rand(0.3, 2.5); }
  lastZone = null;
  refreshProjects();
}

// ---------- moving ----------
const WALK = 4.4, RUN = 7.6, R = 0.42;
function move(o, dx, dz) {
  const nx = o.x + dx, nz = o.z + dz;
  if (walkable(nx, nz, R)) { o.x = nx; o.z = nz; return true; }
  if (Math.abs(dx) > 1e-5 && walkable(o.x + dx, o.z, R)) { o.x += dx; return true; }
  if (Math.abs(dz) > 1e-5 && walkable(o.x, o.z + dz, R)) { o.z += dz; return true; }
  return false;
}
const turnTo = (cur, want, k) => { let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + d * k; };

function updatePlayer(dt) {
  readInput();
  cam.yaw += input.turn * dt * 1.8;
  if (input.zoom) zoom(cam.dist + input.zoom * dt * 10);
  const want = Math.hypot(input.mx, input.mz);
  const speed = want > 0.01 ? (input.run ? RUN : WALK) * Math.min(1, want) : 0;
  // input is relative to where the camera looks
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  const wx = input.mx * c + input.mz * s, wz = -input.mx * s + input.mz * c;
  const len = Math.hypot(wx, wz) || 1;
  pl.vx = lerp(pl.vx, (wx / len) * speed, Math.min(1, dt * 12));
  pl.vz = lerp(pl.vz, (wz / len) * speed, Math.min(1, dt * 12));
  const moved = move(pl, pl.vx * dt, pl.vz * dt);
  if (!moved) { pl.vx *= 0.5; pl.vz *= 0.5; }
  if (want > 0.05) pl.ry = turnTo(pl.ry, Math.atan2(wx, wz), Math.min(1, dt * 14));
  const gy = groundAt(pl.x, pl.z);
  pl.y = pl.y ? lerp(pl.y, gy, Math.min(1, dt * 18)) : gy;
  player.root.position.set(pl.x, pl.y, pl.z);
  player.root.rotation.y = pl.ry;
  pl.speed = Math.hypot(pl.vx, pl.vz);
}

// ---------- villagers ----------
function updateVillager(v, dt) {
  const dpx = pl.x - v.x, dpz = pl.z - v.z, dp = Math.hypot(dpx, dpz);
  if (chat && (chat.a === v || chat.b === v)) {
    const partner = chat.a === v ? chat.b : chat.a;
    v.ry = turnTo(v.ry, Math.atan2(partner.x - v.x, partner.z - v.z), Math.min(1, dt * 6));
    v.c.root.position.y = groundAt(v.x, v.z);
    v.c.root.rotation.y = v.ry;
    return 0;
  }
  let speed = started ? updateWorker(v, dt) : null;
  if (speed !== null) {
    v.c.root.position.set(v.x, groundAt(v.x, v.z), v.z);
    v.c.root.rotation.y = v.ry;
    return speed;
  }
  speed = 0;
  if (v.job || v.state === 'pose') { /* holding the opening shot */ }
  else if (dp < 2.8 && started) {
    v.ry = turnTo(v.ry, Math.atan2(dpx, dpz), Math.min(1, dt * 6));
    if (v.state === 'walk') { v.state = 'idle'; v.timer = rand(1, 2); }
  } else if (v === byName.Bruno && progress.started && !complete(progress, 'cottage')) {
    // Bruno waits where he gave the player the errand.
  } else if (v.state === 'idle') {
    v.timer -= dt;
    if (v.timer <= 0) {
      for (let k = 0; k < 8; k++) {
        const a = rand(0, 6.28), r = rand(2, 10), tx = v.home[0] + Math.cos(a) * r, tz = v.home[1] + Math.sin(a) * r;
        if (Math.hypot(tx, tz) < 26 && walkable(tx, tz, 0.5)) { v.tx = tx; v.tz = tz; v.state = 'walk'; v.stuck = 0; break; }
      }
      if (v.state !== 'walk') v.timer = 1;
    }
  } else if (v.state === 'walk') {
    const dx = v.tx - v.x, dz = v.tz - v.z, d = Math.hypot(dx, dz);
    if (d < 0.4) { v.state = 'idle'; v.timer = rand(2, 6); }
    else {
      speed = 2.0;
      v.ry = turnTo(v.ry, Math.atan2(dx, dz), Math.min(1, dt * 5));
      const step = speed * dt;
      if (!move(v, Math.sin(v.ry) * step, Math.cos(v.ry) * step)) {
        v.stuck += dt;
        if (v.stuck > 0.6) { v.state = 'idle'; v.timer = rand(0.5, 1.5); }
      }
    }
  }
  v.c.root.position.set(v.x, groundAt(v.x, v.z), v.z);
  v.c.root.rotation.y = v.ry;
  return speed;
}

// ---------- talking ----------
const promptEl = $('prompt'), talkBtn = $('talk');
const objective = $('objective');
const album = $('album');
const progress = loadProgress();
let near = null, speaking = null;
const done = name => complete(progress, name);
const nearPoint = (x, z) => Math.hypot(pl.x - x, pl.z - z) < 2.2;

function refreshProjects(message) {
  objective.hidden = !started;
  const cottage = done('cottage'), bakery = done('bakery'), beacon = done('beacon');
  world.showNeighborhood(progress, bakery, done);
  world.showErrands(progress.errands);
  world.showProjects(progress.started, cottage, bakery, progress.built.bakery.stone === 3, beacon);
  for (const node of deposits) {
    const unlocked = node.id === 'creek' ? progress.started
      : ['grove', 'quarry', 'meadow-apples', 'cave'].includes(node.id) ? bakery : cottage;
    world.deposits.get(node.id).visible = unlocked && !progress.gathered.includes(node.id);
  }
  const next = !progress.started ? 'Talk to Bruno to help rebuild Willowbend.'
    : !cottage ? (progress.inventory.planks >= 3 ? 'Bring the planks to Bruno or the cottage northwest of the plaza.'
      : progress.inventory.wood ? 'Craft planks at Bruno’s temporary bench.' : 'Cross Bramble Creek and cut the marked branches with your hatchet.')
    : !bakery ? 'Bakery needs ' + remaining(progress, 'bakery') + '. Gather wood in the woods, stone past the bridge, and apples at the orchard.'
    : !beacon ? 'Beacon needs ' + remaining(progress, 'beacon') + '. Mine copper by Echo Cave and stone in the highlands. Craft a lantern at the workbench.'
    : progress.opening ? 'Willowbend and the meadow are open. See your group photos in the album.'
      : 'Plan the new neighborhood at the Meadow Planning board beyond Bramble Creek.';
  const errands = villageJobs.filter(job => ['active', 'carrying'].includes(progress.errands[job.id]))
    .map(job => progress.errands[job.id] === 'carrying' ? job.delivery : job.pickup);
  objective.textContent = [message, next, ...errands].filter(Boolean).join(' ');
}

function renderAlbum() {
  const entries = Object.entries(projects).filter(([name]) => progress.photos[name] || progress.photos[name + '-before']);
  const pages = $('album-pages');
  pages.replaceChildren();
  for (const [name, project] of entries) {
    if (progress.photos[name + '-before']) {
      appendAlbumPhoto(pages, progress.photos[name + '-before'], project.title + ' · Before construction');
    }
    if (progress.photos[name]) appendAlbumPhoto(pages, progress.photos[name], project.title + ' · You, ' + new Intl.ListFormat('en').format(project.villagers));
  }
  if (progress.photos.opening) appendAlbumPhoto(pages, progress.photos.opening, 'Meadow opening day · You and the neighbors');
  if (!pages.children.length) pages.textContent = 'Finish a project to take your first group photo.';
}

function appendAlbumPhoto(pages, source, label) {
  const figure = document.createElement('figure');
  const image = new Image();
  image.src = source;
  image.alt = label;
  const caption = document.createElement('figcaption');
  caption.textContent = label;
  const download = document.createElement('a');
  download.href = source;
  download.download = label.split(' · ')[0] + '.jpg';
  download.textContent = 'Save photo';
  caption.append(' · ', download);
  figure.append(image, caption);
  pages.append(figure);
}

$('open-album').addEventListener('click', () => {
  keys.clear();
  renderAlbum();
  album.showModal();
});
function restoreGameFocus() {
  keys.clear();
  if (!document.querySelector('dialog[open]')) canvasEl.focus({ preventScroll: true });
}
const backpack = $('backpack');
const exchange = $('exchange');
const exchangeForm = $('exchange-form');
const exchangeItem = $('exchange-item');
const exchangeCount = $('exchange-count');
const exchangeStatus = $('exchange-status');
let handoff = null;

function stockedItems(stock) {
  return Object.keys(itemNames).filter(item => stock[item] > 0);
}

function itemRow(label, count) {
  const row = document.createElement('li');
  const name = document.createElement('span');
  const quantity = document.createElement('strong');
  name.textContent = label;
  quantity.textContent = count;
  row.append(name, quantity);
  return row;
}

function openBackpack() {
  if (!started || document.querySelector('dialog[open]')) return;
  keys.clear();
  const items = stockedItems(progress.inventory);
  $('backpack-items').replaceChildren(...items.map(item => itemRow(itemNames[item][0], progress.inventory[item])));
  $('backpack-empty').hidden = items.length > 0;
  $('backpack-tools').hidden = !progress.started;
  $('backpack-tool-list').textContent = done('cottage') ? 'Hatchet · Pickaxe' : 'Hatchet';
  const errands = villageJobs.filter(job => progress.errands[job.id] === 'carrying');
  $('backpack-errands').hidden = !errands.length;
  $('backpack-job-items').replaceChildren(...errands.map(job => itemRow(job.cargo, 1)));
  backpack.showModal();
}

$('open-backpack').addEventListener('click', openBackpack);
backpack.addEventListener('close', restoreGameFocus);
exchange.addEventListener('close', restoreGameFocus);

function updateExchangeCount() {
  const available = handoff.from[exchangeItem.value];
  exchangeCount.max = available;
  exchangeCount.value = 1;
  exchangeStatus.textContent = available + ' available';
}

exchangeItem.addEventListener('change', updateExchangeCount);

function openExchange(villager, giving) {
  const supplies = progress.villagerSupplies[villager.name];
  const from = giving ? progress.inventory : supplies;
  const to = giving ? supplies : progress.inventory;
  const items = stockedItems(from);
  if (!items.length) {
    showAnswer(villager, giving ? 'Your backpack is empty. Bring something with you next time.' : 'I’m out of spare supplies right now.');
    return;
  }
  handoff = { villager, giving, from, to };
  hideAnswer();
  if (conversation.open) conversation.close();
  keys.clear();
  $('exchange-title').textContent = giving ? 'Give to ' + villager.name : 'Take from ' + villager.name;
  $('exchange-submit').textContent = giving ? 'Give' : 'Take';
  exchangeItem.replaceChildren(...items.map(item => new Option(itemNames[item][0] + ' · ' + from[item], item)));
  updateExchangeCount();
  exchange.showModal();
}

exchangeForm.addEventListener('submit', event => {
  event.preventDefault();
  const { villager, giving, from, to } = handoff;
  const item = exchangeItem.value;
  const count = exchangeCount.valueAsNumber;
  if (!moveItems(from, to, item, count)) {
    exchangeStatus.textContent = 'Choose an available quantity.';
    return;
  }
  const [label, plural] = itemNames[item];
  const singular = { planks: 'plank', apples: 'apple' }[item] ?? label.toLowerCase();
  const amount = count + ' ' + (count === 1 ? singular : plural);
  commitProgress(giving ? 'Gave ' + villager.name + ' ' + amount + '.' : 'Received ' + amount + ' from ' + villager.name + '.');
  exchange.close();
  showAnswer(villager, giving ? 'Thanks! I’ll keep the supplies here if you need them back.' : 'Here you go. I put ' + amount + ' in your backpack.');
});

album.addEventListener('close', restoreGameFocus);

function takePhoto(name, project = projects[name]) {
  if (name in neighborhood) project = plotProject(progress, name);
  const [x, z] = project.site;
  const [ax, az] = project.photoSpot ?? project.approach;
  const forward = new THREE.Vector3(ax - x, 0, az - z).normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const group = [makeKid(), ...project.villagers.map(villager => byName[villager].make())];
  const portrait = new THREE.PerspectiveCamera(name === 'beacon' ? 55 : 41, 1.5, 0.5, 900);
  const distance = name === 'opening' ? 10 : 7;
  portrait.position.set(ax + forward.x * distance, groundAt(ax, az) + 3.6, az + forward.z * distance);
  portrait.lookAt(ax - forward.x * 0.9, groundAt(ax, az) + (name === 'beacon' ? 3.3 : 1.8), az - forward.z * 0.9);
  const actors = [player, ...CAST.map(v => v.c)];
  actors.forEach(actor => { actor.root.visible = false; });
  try {
    for (const [index, actor] of group.entries()) {
      const offset = (index - (group.length - 1) / 2) * 1.18;
      const px = ax + right.x * offset, pz = az + right.z * offset;
      setPose(actor, px, pz, Math.atan2(forward.x, forward.z));
      scene.add(actor.root);
    }
    renderer.setPixelRatio(1);
    renderer.setSize(720, 480, false);
    renderer.render(scene, portrait);
    const photo = document.createElement('canvas');
    const source = renderer.domElement;
    const scale = Math.min(1, 720 / Math.max(source.width, source.height));
    photo.width = Math.round(source.width * scale);
    photo.height = Math.round(source.height * scale);
    photo.getContext('2d').drawImage(source, 0, 0, photo.width, photo.height);
    progress.photos[name] = photo.toDataURL('image/jpeg', 0.82);
    return true;
  } catch {
    return false;
  } finally {
    group.forEach(actor => scene.remove(actor.root));
    actors.forEach(actor => { actor.root.visible = true; });
    resize();
    renderer.render(scene, camera);
  }
}

function commitProgress(message) {
  if (!saveProgress(progress)) message += ' Device storage is unavailable. Progress is kept for this session.';
  refreshProjects(message);
}

function build(name) {
  const added = contribute(progress, name);
  if (!added.length) return refreshProjects('Still needed: ' + remaining(progress, name) + '.');
  if (!done(name)) return commitProgress('Delivered ' + added.join(', ') + '.');
  refreshProjects();
  const photographed = takePhoto(name);
  commitProgress(projects[name].title + ' is finished!' + (photographed ? ' Group photo added to the album.' : ' The group photo could not be captured.'));
}

const planner = $('planner');
planner.addEventListener('close', restoreGameFocus);
const workers = { Pip: 'Deliver apples', Bruno: 'Haul timber' };
const workRoutes = {
  Pip: [[48, -24], [50, -25.5], meadowBoard],
  Bruno: [[47, -31], [47, -27.5], [50, -25.5], meadowBoard],
};
const villagerCargoGeometry = {
  Pip: new THREE.SphereGeometry(0.19, 12, 8),
  Bruno: new THREE.BoxGeometry(0.65, 0.2, 0.23),
};
const villagerCargoMaterials = {
  Pip: new THREE.MeshToonMaterial({ color: 0xdc5346 }),
  Bruno: new THREE.MeshToonMaterial({ color: 0xa9794a }),
};
const nextStop = {};

function openPlanner() {
  keys.clear();
  renderPlanner();
  planner.showModal();
}

function plannerButton(parent, label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pill';
  button.textContent = label;
  button.addEventListener('click', action);
  parent.append(button);
}

function renderPlanner() {
  const sites = $('meadow-sites');
  sites.replaceChildren();
  for (const [index] of plots.entries()) {
    const section = document.createElement('section');
    const title = document.createElement('strong');
    const choice = Object.keys(neighborhood).find(name => progress.plots[name] === index);
    title.textContent = 'Plot ' + (index + 1) + (choice ? ' · ' + projects[choice].title : '');
    section.append(title);
    if (choice) {
      const details = document.createElement('p');
      details.textContent = done(choice) ? 'Finished' : 'Still needed: ' + remaining(progress, choice);
      section.append(details);
    } else for (const [name, project] of Object.entries(neighborhood)) {
      if (name in progress.plots) continue;
      plannerButton(section, project.title, () => {
        const [x, z] = plots[index];
        const view = { ...project, site: [x, z], approach: [x, z + 3.2] };
        takePhoto(name + '-before', view);
        progress.plots[name] = index;
        commitProgress('Foundation placed on plot ' + (index + 1) + '.');
        renderPlanner();
      });
    }
    sites.append(section);
  }
  const jobs = $('meadow-jobs');
  jobs.replaceChildren();
  for (const [villager, job] of Object.entries(workers)) {
    const required = villager === 'Pip' ? 'bakehouse' : 'workshop';
    if (!done(required)) continue;
    if (progress.jobs[villager]) {
      const line = document.createElement('p');
      line.textContent = villager + (progress.jobs[villager] === 'delivered' ? ' finished the first delivery.' : ' is on the delivery route.');
      jobs.append(line);
    } else plannerButton(jobs, villager + ' · ' + job, () => {
      progress.jobs[villager] = 'working';
      commitProgress(villager + ' started the first delivery.');
      renderPlanner();
    });
  }
  const event = $('meadow-event');
  event.replaceChildren();
  if (!progress.opening && Object.keys(neighborhood).every(done) && Object.keys(workers).every(name => progress.jobs[name] === 'delivered')) {
    plannerButton(event, 'Celebrate opening day', () => {
      const home = plotProject(progress, 'bakehouse');
      if (takePhoto('opening', { ...home, villagers: ['Bruno', 'Pip', 'Dot', 'Mabel', 'Fennel'] })) {
        progress.opening = true;
        commitProgress('Opening day photo added to the album.');
        planner.close();
      }
    });
  }
}

function updateWorker(v, dt) {
  const worker = progress.jobs[v.name];
  if (!worker) return null;
  const destination = plotProject(progress, v.name === 'Pip' ? 'bakehouse' : 'workshop').approach;
  if (worker === 'delivered') {
    if (v.cargo) v.cargo.visible = false;
    [v.x, v.z] = destination;
    return 0;
  }
  const route = workRoutes[v.name];
  if (!(v.name in nextStop)) {
    [v.x, v.z] = route[0];
    nextStop[v.name] = 1;
    v.cargo = new THREE.Mesh(
      villagerCargoGeometry[v.name],
      villagerCargoMaterials[v.name],
    );
    v.cargo.position.set(0, 0.8, 0.52);
    v.c.root.add(v.cargo);
  }
  const [x, z] = route[nextStop[v.name]] ?? destination;
  const dx = x - v.x, dz = z - v.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.2) {
    if (nextStop[v.name] < route.length) nextStop[v.name]++;
    else {
      progress.jobs[v.name] = 'delivered';
      if (v.name === 'Pip') progress.inventory.apples += 2;
      else progress.inventory.wood += 2;
      commitProgress(v.name + ' delivered the first supplies.');
      if (planner.open) renderPlanner();
    }
    return 0;
  }
  v.ry = Math.atan2(dx, dz);
  const step = Math.min(distance, dt * 2.4);
  v.x += dx * step / distance;
  v.z += dz * step / distance;
  return 2.4;
}

function craft() {
  const stock = progress.inventory;
  if (stock.wood) {
    const count = stock.wood;
    stock.planks += count;
    stock.wood = 0;
    commitProgress('Crafted ' + count + ' planks.');
  } else if (done('bakery') && stock.copper >= 2 && !stock.lantern && !done('beacon')) {
    stock.copper -= 2;
    stock.lantern++;
    commitProgress('Crafted the beacon lantern.');
  } else {
    refreshProjects(done('bakery') ? 'Workbench recipes: wood makes planks, and 2 copper makes a lantern.' : 'Bring wood to craft planks.');
  }
}

function nearbyAction() {
  if (!started) return null;
  for (const job of villageJobs) {
    if (progress.errands[job.id] !== 'active' || !nearPoint(...job.stop)) continue;
    const [x, z] = job.stop;
    return { position: { x, y: groundAt(x, z), z }, label: job.pickup, run() {
      progress.errands[job.id] = 'carrying';
      commitProgress('Collected ' + job.cargo + '.');
    } };
  }
  if (!progress.started) return null;
  for (const node of deposits) {
    const prop = world.deposits.get(node.id);
    if (!prop.visible || !nearPoint(node.x, node.z)) continue;
    const label = node.tool ? (node.tool === 'Hatchet' ? 'Chop ' : 'Mine ') + node.name : 'Harvest apples';
    return { position: prop.position, label, run() {
      progress.inventory[node.kind] += node.amount;
      progress.gathered.push(node.id);
      commitProgress('Gathered ' + node.amount + ' ' + node.kind + '.');
    } };
  }
  if (done('bakery') && nearPoint(...meadowBoard)) {
    const [x, z] = meadowBoard;
    return { position: { x, y: groundAt(x, z), z }, label: 'Plan neighborhood', run: openPlanner };
  }
  const workshop = done('workshop') ? plotProject(progress, 'workshop').approach : null;
  const station = nearPoint(...workbench) ? workbench : workshop && nearPoint(...workshop) ? workshop : null;
  if (station && (!workshop || station === workbench || progress.inventory.wood)) {
    const [x, z] = station;
    return { position: { x, y: groundAt(x, z), z }, label: 'Craft at workbench', run: craft };
  }
  for (const [name, project] of Object.entries(projects)) {
    if (!project.needs || (name in neighborhood && !(name in progress.plots))) continue;
    const [x, z] = name in neighborhood ? plotProject(progress, name).approach : project.approach;
    if (done(name) || (name === 'bakery' && !done('cottage')) || (name === 'beacon' && !done('bakery')) || !nearPoint(x, z)) continue;
    return { position: { x, y: groundAt(x, z), z }, label: 'Build ' + project.title, run: () => build(name) };
  }
  return null;
}

function brunoLine() {
  if (!progress.started) {
    progress.started = true;
    commitProgress('Bruno lent you a hatchet.');
    return 'Take my hatchet across Bramble Creek. Chop the marked branches, then bring the wood to my bench northwest of the plaza.';
  }
  if (!done('cottage') && progress.inventory.planks) {
    build('cottage');
    return 'Thanks for bringing the planks!';
  }
  if (!done('cottage')) return 'My bench is northwest of the plaza, next to the cottage frame. I need three planks.';
  if (!done('bakery')) return 'Your pickaxe is ready. Pip left an apple basket at the orchard. The bakery frame is southeast of the plaza.';
  if (!done('beacon')) return 'Dot spotted copper at Echo Cave. Bring two pieces to the workbench to craft the lantern.';
  return 'The beacon is shining. Look how far we’ve come!';
}

function villagerLine(villager) {
  const job = villager.job;
  if (job) {
    const state = progress.errands[job.id];
    if (state === 'done') return 'Thanks for helping with my stall. See you around town!';
    if (state === 'carrying') {
      progress.errands[job.id] = 'done';
      refreshProjects();
      const photographed = takePhoto(job.id);
      commitProgress(job.title + ' completed.' + (photographed ? ' Group photo added.' : ''));
      return 'Thanks! We did it together.';
    }
    if (state !== 'active') {
      progress.errands[job.id] = 'active';
      commitProgress(job.title + ' started.');
    }
    return job.line;
  }
  if (villager === byName.Bruno) return brunoLine();
  if (progress.started && !done('cottage') && villager.name === 'Mabel') {
    return 'I marked the fallen branches for Bruno. They’re just past Bramble Creek bridge.';
  }
  if (done('cottage') && !done('bakery') && villager.name === 'Pip') {
    return 'I picked apples for the bakery! My basket is at the north edge of the orchard.';
  }
  if (done('bakery') && !done('beacon')) {
    if (villager.name === 'Dot') return 'I saw copper glinting near the entrance to Echo Cave.';
    if (villager.name === 'Fennel') return 'I marked loose stone near the path through Pebble Highlands.';
  }
  return villager.lines[villager.line++ % villager.lines.length];
}

const conversation = $('conversation');
const speech = $('villager-speech');
let answer = null;
let followupChoices = [];

function hideAnswer() {
  answer = null;
  speech.hidden = true;
}

function showAnswer(villager, words) {
  answer = { villager, remaining: Math.max(8, 3 + words.length / 15) };
  $('speech-name').textContent = villager.name;
  $('speech-reply').textContent = words;
  if (conversation.open) conversation.close();
  const followup = $('speech-more');
  followupChoices = conversationChoices(villager);
  followup.replaceChildren(new Option('Ask another question…', ''), ...followupChoices.map(({ label }, index) => new Option(label, String(index))));
  speech.hidden = false;
}

$('speech-more').addEventListener('change', event => {
  const choice = followupChoices[event.currentTarget.value];
  if (answer && choice) choice.run();
});
$('speech-close').addEventListener('click', () => {
  hideAnswer();
  restoreGameFocus();
});

function updateAnswer(dt) {
  if (!answer) return;
  const { villager } = answer;
  if (!speech.contains(document.activeElement)) answer.remaining -= dt;
  if (answer.remaining <= 0 || Math.hypot(villager.x - pl.x, villager.z - pl.z) > 6) {
    const focused = speech.contains(document.activeElement);
    hideAnswer();
    if (focused) restoreGameFocus();
    return;
  }
  const p = screenAt(villager.x, villager.c.root.position.y + 2.65, villager.z);
  const width = speech.offsetWidth;
  const height = speech.offsetHeight;
  const x = p.on ? clamp(p.x, 12 + width / 2, innerWidth - 12 - width / 2) : innerWidth / 2;
  const y = clamp(p.on ? p.y - 14 : innerHeight * 0.65, 54 + height, innerHeight - 20);
  speech.style.left = x + 'px';
  speech.style.top = (y - height) + 'px';
  speech.style.setProperty('--tail', clamp(p.x - x + width / 2, 18, width - 18) + 'px');
  speech.classList.toggle('offscreen', !p.on || p.x < 0 || p.x > innerWidth || p.y < 0 || p.y > innerHeight);
}
let chat = null, chatDelay = 2, lastPair = '';
const overheard = [];
const heardTopics = new Map();

function activeJobs() {
  const errands = villageJobs.flatMap(job => {
    const state = progress.errands[job.id];
    return state === 'active' ? [job.pickup] : state === 'carrying' ? [job.delivery] : [];
  });
  if (progress.started && !done('beacon')) {
    if (!done('cottage')) errands.push(progress.inventory.planks ? 'Deliver planks for Bruno’s cottage' : progress.inventory.wood ? 'Craft planks at Bruno’s workbench' : 'Gather branches across Bramble Creek');
    else if (!done('bakery')) errands.push('Finish the village bakery with ' + remaining(progress, 'bakery'));
    else errands.push('Finish the watchtower beacon with ' + remaining(progress, 'beacon'));
  }
  for (const name of Object.keys(progress.plots)) {
    if (!done(name)) errands.push('Build the ' + projects[name].title.toLowerCase() + ' with ' + remaining(progress, name));
  }
  for (const [name, state] of Object.entries(progress.jobs)) {
    if (state === 'working') errands.push('Check on ' + name + '’s meadow delivery');
  }
  return errands;
}

function jobReply(jobs) {
  return jobs.length ? 'Here’s what you’re working on. ' + jobs.join('. ') + '.'
    : 'You have no jobs underway. Ask Hazel at Farmgate Market, Reed by the pond, or Clover by the orchard.';
}

function openConversation(villager) {
  hideAnswer();
  speaking = villager;
  keys.clear();
  chat = null;
  $('chatter').hidden = true;
  chatDelay = 2;
  $('conversation-name').textContent = villager.name;
  const words = $('conversation-reply');
  const jobs = activeJobs();
  words.textContent = jobs.length ? 'You’re in the middle of ' + jobs.length + (jobs.length === 1 ? ' job' : ' jobs') + '. ' + jobReply(jobs)
    : 'Good to see you. What would you like to talk about?';
  const choices = $('conversation-topics');
  choices.replaceChildren();
  for (const { label, run } of conversationChoices(villager)) {
    plannerButton(choices, label, run);
  }
  conversation.showModal();
}

function conversationChoices(villager) {
  const choices = [];
  const option = (label, reply) => choices.push({ label, run: () => showAnswer(villager, reply()) });
  choices.push(
    { label: 'Give an item', run: () => openExchange(villager, true) },
    { label: 'Take supplies', run: () => openExchange(villager, false) },
  );
  option('How’s life in Willowbend?', () => topics[villager.name][0]);
  option('Where should I go?', () => topics[villager.name][1]);
  option('Active jobs', () => jobReply(activeJobs()));
  if (villager.job || villager === byName.Bruno) {
    const job = villager.job;
    const state = job && progress.errands[job.id];
    const label = state === 'carrying' ? job.delivery : job && !state ? 'Start job · ' + job.title
      : job ? 'Talk about ' + job.title.toLowerCase() : 'Talk about rebuilding';
    option(label, () => villagerLine(villager));
  } else option('What’s new?', () => villagerLine(villager));
  option('Village news', () => progress.opening ? 'The meadow neighborhood is open. Everyone’s talking about the opening-day photograph.'
    : done('bakery') ? 'The bakery is open. The next big thing is the neighborhood across Bramble Creek.'
    : 'Bruno is looking for help rebuilding. Hazel, Reed, and Clover also have work available.');
  if (overheard.length) option('What have people been saying?', () => 'I heard this nearby. “' + overheard.at(-1).split(' · ').slice(1).join(' · ') + '”');
  return choices;
}

conversation.addEventListener('close', () => {
  speaking = null;
  restoreGameFocus();
});

function interact() {
  if (!started || document.querySelector('dialog[open]')) return;
  const action = nearbyAction();
  if (action) return action.run();
  if (near) openConversation(near);
}

function updateChatter(dt) {
  const panel = $('chatter');
  if (!started || document.querySelector('dialog[open]')) {
    panel.hidden = true;
    return;
  }
  if (!chat) {
    chatDelay -= dt;
    if (chatDelay > 0) return;
    const nearby = CAST.filter(v => progress.jobs[v.name] !== 'working' && Math.hypot(v.x - pl.x, v.z - pl.z) < 16);
    for (const a of nearby) {
      const b = nearby.find(candidate => candidate !== a && Math.hypot(candidate.x - a.x, candidate.z - a.z) < 8 &&
        [a.name, candidate.name].sort().join('/') !== lastPair);
      if (!b) continue;
      const key = [a.name, b.name].sort().join('/');
      const initiator = (heardTopics.get(key) ?? 0) % 2 ? b : a;
      const partner = initiator === a ? b : a;
      heardTopics.set(key, (heardTopics.get(key) ?? 0) + 1);
      const topics = [chatter[initiator.name], [
        'Has anyone checked the pond trail lately?',
        progress.errands.pond === 'done' ? 'Reed has a fresh report at the shelter.' : 'Reed was looking for someone to check the dock marker.',
        'I’ll stop by the shelter next time I’m out that way.',
      ], [
        'Any news from across the creek?',
        progress.opening ? 'The meadow is open. I hope there’s still something left at the bakehouse.' :
          done('bakery') ? 'There are building lots near Meadow Rest. The planning board has the details.' : 'Bruno is still getting the village buildings ready.',
        'I’ll follow the bridge road and see for myself.',
      ]];
      const visit = heardTopics.get(key) - 1;
      chat = { a: initiator, b: partner, lines: topics[visit % topics.length], turn: 0, left: 0 };
      lastPair = key;
      break;
    }
    if (!chat) { chatDelay = 2; return; }
  }
  if (Math.hypot(chat.a.x - pl.x, chat.a.z - pl.z) > 20 || progress.jobs[chat.a.name] === 'working' || progress.jobs[chat.b.name] === 'working') {
    chat = null;
    panel.hidden = true;
    chatDelay = 2;
    return;
  }
  chat.left -= dt;
  if (chat.left <= 0) {
    if (chat.turn === chat.lines.length) {
      chat = null;
      panel.hidden = true;
      chatDelay = 3;
      return;
    }
    const speaker = chat.turn % 2 ? chat.b : chat.a;
    const line = chat.lines[chat.turn++];
    const caption = speaker.name + ' · ' + line;
    panel.textContent = caption;
    panel.hidden = false;
    overheard.push(caption);
    if (overheard.length > 9) overheard.shift();
    speaker.c.root.userData.hop = 0.35;
    chat.left = Math.max(2.6, line.length / 19);
  }
}

refreshProjects();

const proj = new THREE.Vector3();
function screenAt(x, y, z) {
  proj.set(x, y, z).project(camera);
  return { x: (proj.x * 0.5 + 0.5) * innerWidth, y: (-proj.y * 0.5 + 0.5) * innerHeight, on: proj.z >= -1 && proj.z <= 1 };
}
function updateTalk(dt) {
  near = null;
  let best = 2.6;
  if (started) for (const v of CAST) { const d = Math.hypot(v.x - pl.x, v.z - pl.z); if (d < best) { best = d; near = v; } }
  const action = nearbyAction();
  talkBtn.classList.toggle('near', !!near || !!action);
  talkBtn.textContent = action ? action.label.split(' ')[0] : 'Talk';
  if (action || (near && !conversation.open)) {
    const target = action ? action.position : near.c.root.position;
    const p = screenAt(target.x, target.y + (action ? 1.5 : 2.5), target.z);
    const label = action ? action.label : 'Talk to ' + near.name;
    promptEl.textContent = touch ? label : 'Space · ' + label;
    promptEl.style.display = p.on ? 'block' : 'none';
    promptEl.style.left = p.x + 'px'; promptEl.style.top = p.y + 'px';
  } else promptEl.style.display = 'none';
  for (const v of CAST) {
    const u = v.c.root.userData;
    if (u.hop > 0) { u.hop = Math.max(0, u.hop - dt); v.c.root.position.y += Math.sin((1 - u.hop / 0.35) * Math.PI) * 0.35; }
  }
}

// ---------- where am I ----------
const zoneEl = $('zone');
let lastZone = null, zoneT = 0, pendingZone = null, pendingT = 0;
function updateZone(dt) {
  if (!started) return;
  const z = zoneAt(pl.x, pl.z);
  if (z !== pendingZone) { pendingZone = z; pendingT = 0; }
  pendingT += dt;
  if (pendingZone !== lastZone && pendingT > 0.35) {
    lastZone = pendingZone;
    zoneEl.querySelector('span').textContent = lastZone;
    zoneEl.classList.add('show');
    zoneT = 2.8;
  }
  if (zoneT > 0) { zoneT -= dt; if (zoneT <= 0) zoneEl.classList.remove('show'); }
}

// ---------- loop ----------
const clock = new THREE.Clock();
let time = 0, frames = 0;
function tick() {
  update(Math.min(0.05, clock.getDelta()));
  renderer.render(scene, camera);
  if (++frames === 3) { splash.classList.remove('loading'); window.READY = true; }
  requestAnimationFrame(tick);
}
function update(dt) {
  time += dt;
  if (started) updatePlayer(dt);
  animate(player, dt, time, started ? pl.speed : 0);
  if (!started) player.arms[-1].rotation.z = -(2.5 + Math.sin(time * 6) * 0.22);
  for (const v of CAST) {
    const sp = updateVillager(v, dt);
    animate(v.c, dt, time, sp);
  }
  if (!started) {
    byName.Mabel.c.arms[-1].rotation.z = -(2.5 + Math.sin(time * 6 + 1.3) * 0.22);
    byName.Bruno.c.arms[1].rotation.z = 2.35 + Math.sin(time * 9) * 0.25;
  }
  updateTalk(dt);
  updateChatter(dt);
  updateZone(dt);

  if (cam.mode !== 'splash') {
    cam.x = lerp(cam.x, pl.x, Math.min(1, dt * 6));
    cam.z = lerp(cam.z, pl.z, Math.min(1, dt * 6));
    cam.y = lerp(cam.y, pl.y, Math.min(1, dt * 4));
    followPose(tmpPos, tmpLook);
    if (cam.mode === 'intro') {
      cam.blend = Math.min(1, cam.blend + dt / 1.8);
      const k = cam.blend * cam.blend * (3 - 2 * cam.blend);
      tmpPos.lerpVectors(SPLASH_CAM.pos, tmpPos, k);
      tmpLook.lerpVectors(SPLASH_CAM.look, tmpLook, k);
      if (cam.blend >= 1) cam.mode = 'follow';
    }
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
    camera.updateMatrixWorld();
  }
  updateAnswer(dt);
  world.follow(started ? pl.x : 0, started ? pl.z : 12);
  world.update(dt, time, camera);
}
tick();

if (TEST) {
  window.WB = {
    start,
    info: () => ({
      started, houseFinished: world.house.visible, progress: { inventory: { ...progress.inventory }, gathered: [...progress.gathered], built: structuredClone(progress.built), photos: Object.keys(progress.photos), plots: { ...progress.plots }, jobs: { ...progress.jobs }, opening: progress.opening, errands: { ...progress.errands } }, x: +pl.x.toFixed(2), z: +pl.z.toFixed(2), y: +pl.y.toFixed(2), speed: +pl.speed.toFixed(2), camDist: +cam.dist.toFixed(2), zone: lastZone, near: near?.name ?? null,
      speaking: speaking?.name ?? null, yaw: +cam.yaw.toFixed(3), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, stats: world.stats,
      villagers: CAST.map(v => ({ name: v.name, x: +v.x.toFixed(2), z: +v.z.toFixed(2), state: v.state })),
    }),
    warp(x, z) { pl.x = x; pl.z = z; pl.y = 0; cam.x = x; cam.z = z; },
    // run the game forward without waiting on frames (headless browsers draw slowly)
    sim(seconds, hold = []) {
      for (const k of hold) keys.add(k);
      for (let t = 0; t < seconds; t += 1 / 30) update(1 / 30);
      for (const k of hold) keys.delete(k);
      renderer.render(scene, camera);
    },
    face(ry) { pl.ry = ry; },
    zoom,
    lookAt(x, z) { cam.yaw = Math.atan2(-(x - pl.x), -(z - pl.z)); cam.x = pl.x; cam.z = pl.z; cam.y = groundAt(pl.x, pl.z); },
    walkable: (x, z) => walkable(x, z),
    height, WATER,
    positionVillager(name, x, z) {
      const v = byName[name];
      v.x = x;
      v.z = z;
      v.state = 'idle';
      v.timer = 20;
      setPose(v.c, x, z, v.ry);
    },
    villager: name => { const v = byName[name]; return { x: v.x, z: v.z }; },
    tris() {
      const by = {};
      scene.traverse(o => {
        if (!o.isMesh) return;
        const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        const k = (o.material.side === THREE.BackSide ? 'ink ' : '') + (o.material.color ? '#' + o.material.color.getHexString() : o.material.type);
        by[k] = (by[k] || 0) + n;
      });
      return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, n]) => `${k} ${Math.round(n / 1000)}k`);
    },
  };
}
