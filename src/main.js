import { villagerRoutine } from './villager-routines.js';
import { dressVillager, animateVillagerWork } from './villager-activities.js';
import { bakerPath } from './bakery-paths.js';
import { makePip, makeClover, animateBaker } from './bakery-characters.js';
import { bakeryRoutine } from './bakery-routines.js';
import { inventoryPanels } from './inventory-panels.js';
import { itemIcon, stockedItems } from './item-ui.js';
import { chapter, remember } from './life.js';
import { villageLife } from './village-life.js';
import { greetings, topics, chatter } from './dialogue.js';
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeKid, makeCat, makeBear, makeDuck, makeDog, makeFrog, animate } from './chibi.js';
import { groundAt, hitSolid, walkable, zoneAt, height, WATER } from './layout.js';
import { easeCamera } from './camera-clearance.js';
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
const hat = new THREE.Mesh(new THREE.SphereGeometry(.38, 20, 14), new THREE.MeshToonMaterial({ color: 0x639777 }));
hat.position.set(.08, .53, -.03);
hat.scale.y = .44;
player.head.add(hat);
const CAST = [
  { name: 'Mabel', make: makeCat, home: world.homes.cat, lines: ['Morning! The well water tastes like clouds today.', 'I heard something humming inside Echo Cave. Brr!', 'If you find nice wood, Bruno needs it for the new house.'] },
  { name: 'Pip', make: makePip, home: world.homes.bunny, lines: ['The orchard apples are almost ripe!', 'Have you seen the old watchtower across the creek?', 'I planted carrots. Well, I tried to.'] },
  { name: 'Bruno', make: makeBear, home: world.homes.bear, lines: [] },
  { name: 'Dot', make: makeDuck, home: world.homes.duck, lines: ['Quack! Oh, sorry. Hello!', 'The lily pond is the best place for a nap.', 'Someone lives inside the Elder Tree. I saw a light!'] },
  { name: 'Biscuit', make: makeDog, home: world.homes.dog, lines: ['Wanna race to the bridge? ...Maybe later.', 'I buried something in the woods. I forget where.', 'Every path out of town goes somewhere good!'] },
  { name: 'Fennel', make: makeFrog, home: world.homes.frog, lines: ['Ribbit. The creek is extra sparkly at noon.', 'The highlands are rocky, but the view is worth it.', 'I collect shiny pebbles. Want to see? No? Okay.'] },
  ...villageJobs.map((job, index) => ({
    name: job.villager, make: [makeCat, makeFrog, makeClover][index], home: job.start, job,
  })),
].map((v, i) => {
  const c = makeResident(v);
  c.ph = i * 1.3;
  scene.add(c.root);
  return { ...v, c, x: 0, z: 0, ry: 0, state: 'pose', timer: rand(0.5, 3), tx: 0, tz: 0, line: 0 };
});
function makeResident(villager) {
  const character = villager.make();
  dressVillager(character, villager.name);
  return character;
}
const byName = Object.fromEntries(CAST.map(v => [v.name, v]));

// The opening shot: the gang lined up on the south road with the village behind them.
const POSE = {
  kid: [0.15, 19.7, -0.05], Mabel: [-1.95, 19.0, 0.28], Pip: [2.7, 19.1, -0.3], Bruno: [5.2, 16.9, -0.35],
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
const talkPos = new THREE.Vector3(), talkLook = new THREE.Vector3();
const talkView = { villager: null, yaw: 0, blend: 0, stepTo: null };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function beginTalkView(villager) {
  const stand = talkView.stepTo ?? pl;
  const dx = villager.x - stand.x, dz = villager.z - stand.z;
  const side = Math.hypot(dx, dz) > 0.15 ? Math.atan2(dz, -dx) : cam.yaw;
  talkView.yaw = Math.cos(cam.yaw - side) >= 0 ? side : side + Math.PI;
  const midX = (stand.x + villager.x) / 2, midZ = (stand.z + villager.z) / 2;
  const room = yaw => [2.8, 4.4, 6.2].every(distance => {
    const x = midX + Math.sin(yaw) * distance, z = midZ + Math.cos(yaw) * distance;
    return !hitSolid(x, z, 0.2) && CAST.every(actor => actor === villager || Math.hypot(actor.x - x, actor.z - z) > 0.85);
  });
  if (!room(talkView.yaw) && room(talkView.yaw + Math.PI)) talkView.yaw += Math.PI;
  talkView.villager = villager;
}

function blendTalkView(position, target, dt) {
  const step = reducedMotion.matches ? 1 : dt / 0.52;
  talkView.blend = clamp(talkView.blend + (speaking ? step : -step), 0, 1);
  if (talkView.blend === 0) {
    talkView.villager = null;
    return;
  }
  const v = talkView.villager;
  const x = (pl.x + v.x) / 2, z = (pl.z + v.z) / 2;
  const y = (pl.y + groundAt(v.x, v.z)) / 2;
  const portrait = camera.aspect < 1;
  const preferred = portrait ? 7.2 : 7;
  const halfViewWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect;
  const span = Math.hypot(pl.x - v.x, pl.z - v.z) + 1.8;
  const distance = Math.max(preferred, span / (1.6 * halfViewWidth));
  talkLook.set(x, y + (portrait ? 0.85 : 1.33), z);
  talkPos.set(x + Math.sin(talkView.yaw) * distance, y + 2.95, z + Math.cos(talkView.yaw) * distance);
  talkPos.y = Math.max(talkPos.y, height(talkPos.x, talkPos.z) + 1.5);
  const blend = talkView.blend;
  const ease = blend * blend * (3 - 2 * blend);
  position.lerp(talkPos, ease);
  target.lerp(talkLook, ease);
}
let cameraAvoidAngle = 0;
function followPose(out, look, dt) {
  const nearPlace = Math.min(
    Math.hypot(cam.x, cam.z) / 12,
    Math.hypot(cam.x + 5, cam.z - 23) / 8,
    Math.hypot(cam.x + 16, cam.z - 37) / 8,
    done('bakery') ? Math.hypot(cam.x - 7, cam.z - 6) / 9 : Infinity,
  );
  const courtyard = Math.max(0, 1 - nearPlace);
  const distance = cam.dist - Math.max(0, 12.5 - 10.8) * courtyard * Math.min(1, cam.dist / 12.5);
  const h = Math.cos(cam.pitch) * distance;
  // pulled back, aim a little ahead and up so the view opens onto what's in front
  const ahead = Math.max(0, cam.dist - 12.5) + courtyard * 2.2;
  look.set(cam.x - Math.sin(cam.yaw) * ahead * 0.6, cam.y + 1.3 + ahead * 0.3, cam.z - Math.cos(cam.yaw) * ahead * 0.6);
  out.set(cam.x + Math.sin(cam.yaw) * h, cam.y + 1.3 + Math.sin(cam.pitch) * distance, cam.z + Math.cos(cam.yaw) * h);
  // never let the hills swallow the camera
  const g = height(out.x, out.z);
  if (out.y < g + 1.5) out.y = g + 1.5;
  const safe = easeCamera({ x: cam.x, y: cam.y + 1.3, z: cam.z }, out, world.cameraBuildings, cameraAvoidAngle, dt);
  cameraAvoidAngle = safe.angle;
  out.set(safe.position.x, safe.position.y, safe.position.z);
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
  const openDialog = document.querySelector('dialog[open]');
  if (openDialog) {
    if (e.code === 'Escape' && openDialog.classList.contains('scene-sheet')) openDialog.close();
    return;
  }
  if (speaking && e.code === 'Escape') {
    if (!e.repeat) endConversation();
    e.preventDefault();
    return;
  }
  if (e.target.matches?.('input, select, textarea')) return;
  if (e.target.id === 'speech-reply' && e.key.startsWith('Arrow')) return;
  if (speaking && !panel.hidden && !e.repeat && /^[1-9]$/.test(e.key)) {
    const choice = topicList.children[Number(e.key) - 1];
    if (exchange.hidden && choice) { choice.click(); e.preventDefault(); }
    return;
  }
  if (e.target.matches?.('button') && (e.code === 'Space' || e.code === 'Enter')) {
    if (e.repeat) e.preventDefault();
    return;
  }
  if (e.code === 'KeyB' && !e.repeat) { openBackpack(); e.preventDefault(); return; }
  if (!e.repeat || !speaking) keys.add(e.code);
  if (e.code === 'Space' || e.code === 'Enter') { if (!e.repeat) interact(); e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const splash = $('splash');
splash.addEventListener('pointerdown', e => { if (!splash.classList.contains('loading')) startKeys(e); });

// touch: left side is a floating joystick, anywhere else drags the camera round
const stick = $('stick'), knob = $('knob');
const joy = { id: null, ox: 0, oy: 0, lastX: 0, lastY: 0, x: 0, y: 0 };
const drag = { id: null, x: 0 };
const canvasEl = $('c');
function centerStick(x, y) {
  joy.ox = joy.lastX = x;
  joy.oy = joy.lastY = y;
  joy.x = joy.y = 0;
  stick.style.left = x + 'px';
  stick.style.top = y + 'px';
  knob.style.transform = 'translate(0,0)';
}
canvasEl.addEventListener('pointerdown', e => {
  if (!started) return;
  if (touch && e.clientX < innerWidth * 0.45 && joy.id === null) {
    joy.id = e.pointerId;
    centerStick(e.clientX, e.clientY);
    stick.style.display = 'block';
  } else if (!speaking && drag.id === null) { drag.id = e.pointerId; drag.x = e.clientX; }
  if (joy.id === e.pointerId || drag.id === e.pointerId) canvasEl.setPointerCapture(e.pointerId);
});
canvasEl.addEventListener('pointermove', e => {
  if (e.pointerId === joy.id) {
    joy.lastX = e.clientX;
    joy.lastY = e.clientY;
    let dx = joy.lastX - joy.ox, dy = joy.lastY - joy.oy;
    const len = Math.hypot(dx, dy), R = 52;
    if (len > R) { dx *= R / len; dy *= R / len; }
    joy.x = dx / R; joy.y = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (!speaking && e.pointerId === drag.id) {
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
canvasEl.addEventListener('wheel', e => { if (!speaking) zoom(cam.dist + e.deltaY * 0.01); }, { passive: true });
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
  updateTalk();
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
  const want = Math.hypot(input.mx, input.mz);
  if (speaking && (want > 0.05 || Math.hypot(speaking.x - pl.x, speaking.z - pl.z) > 5)) endConversation();
  if (!speaking) {
    cam.yaw += input.turn * dt * 1.8;
    if (input.zoom) zoom(cam.dist + input.zoom * dt * 10);
  }
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
  else if (speaking) pl.ry = turnTo(pl.ry, conversationFacing(pl, speaking), Math.min(1, dt * 8));
  const stepping = stepBackForTalk(dt);
  const gy = groundAt(pl.x, pl.z);
  pl.y = pl.y ? lerp(pl.y, gy, Math.min(1, dt * 18)) : gy;
  player.root.position.set(pl.x, pl.y, pl.z);
  player.root.rotation.y = pl.ry;
  pl.speed = stepping || Math.hypot(pl.vx, pl.vz);
}

// ---------- villagers ----------
function updateVillager(v, dt) {
  v.activity = null;
  const dpx = pl.x - v.x, dpz = pl.z - v.z, dp = Math.hypot(dpx, dpz);
  if (speaking && v !== speaking) {
    const midX = (pl.x + speaking.x) / 2, midZ = (pl.z + speaking.z) / 2;
    const awayX = v.x - midX, awayZ = v.z - midZ;
    const distance = Math.hypot(awayX, awayZ);
    if (distance < 2.8) {
      const angle = distance > .01 ? Math.atan2(awayX, awayZ) : v.c.ph;
      const step = dt * 1.6;
      for (const offset of [0, .8, -.8, 1.4, -1.4]) {
        const heading = angle + offset;
        if (!move(v, Math.sin(heading) * step, Math.cos(heading) * step)) continue;
        v.ry = turnTo(v.ry, heading, Math.min(1, dt * 5));
        setPose(v.c, v.x, v.z, v.ry);
        return 1.6;
      }
      return 0;
    }
  }
  let listener = v === speaking ? pl : null;
  if (!listener && chat?.a === v) listener = chat.b;
  if (!listener && chat?.b === v) listener = chat.a;
  if (listener) {
    const facing = v === speaking ? conversationFacing(v, listener) : Math.atan2(listener.x - v.x, listener.z - v.z);
    v.ry = turnTo(v.ry, facing, Math.min(1, dt * 6));
    v.c.root.position.set(v.x, groundAt(v.x, v.z), v.z);
    v.c.root.rotation.y = v.ry;
    return 0;
  }
  let speed = started && !life.festival ? updateWorker(v, dt) : null;
  if (speed !== null) {
    v.c.root.position.set(v.x, groundAt(v.x, v.z), v.z);
    v.c.root.rotation.y = v.ry;
    return speed;
  }
  const destination = started && life.destination(v);
  const routine = started && !life.festival && (bakeryRoutine(v, life.day, done('bakery'), false, false) ||
    villagerRoutine(v, destination, life.day, progress.life));
  v.activity = routine?.work ?? null;
  if (routine) {
    v.ry = turnTo(v.ry, routine.facing, Math.min(1, dt * 5));
    setPose(v.c, v.x, v.z, v.ry);
    return 0;
  }
  if (destination && (v.c.baking || progress.life.arrival && v.c.dailyWork || dp >= 2.35 || progress.life.lantern === 'invited' && v.name === 'Dot')) {
    const waypoint = bakerPath(v, destination);
    const dx = waypoint[0] - v.x, dz = waypoint[1] - v.z;
    const distance = Math.hypot(dx, dz);
    let pace = 0;
    if (distance > .13) {
      const step = Math.min(dt * 2.6, distance);
      v.ry = turnTo(v.ry, Math.atan2(dx, dz), Math.min(1, dt * 6));
      pace = move(v, step * dx / distance, step * dz / distance) ||
        move(v, -step * dz / distance, step * dx / distance) ? 2.6 : 0;
    }
    setPose(v.c, v.x, v.z, v.ry);
    return pace;
  }
  speed = 0;
  if (v.state === 'pose') { /* holding the opening shot */ }
  else if (dp < 2.8 && started) {
    v.ry = turnTo(v.ry, Math.atan2(dpx, dpz), Math.min(1, dt * 6));
    if (v.state === 'walk') { v.state = 'idle'; v.timer = rand(1, 2); }
  } else if (v.job || (v === byName.Bruno && progress.started && !complete(progress, 'cottage'))) {
    // Job hosts stay close to their work.
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
    world.deposits.get(node.id).visible = unlocked && (progress.life.harvests[node.id] ?? -1) < life.day.day;
  }
  world.setLife(progress.life);
  const outfit = progress.life.home.outfit;
  hat.material.color.setHex({ Moss: 0x639777, Berry: 0xbc5277, Sky: 0x69a1d6 }[outfit]);
  hat.visible = !!progress.life.arrival;
  const next = !progress.started ? 'Show Mabel your postcard or talk to Bruno about rebuilding.'
    : !cottage ? (progress.inventory.planks >= projects.cottage.needs.planks ? 'Bring the planks to Bruno or the cottage northwest of the plaza.'
      : progress.inventory.wood ? 'Craft planks at Bruno’s temporary bench.' : 'Cross Bramble Creek and cut the marked branches with your hatchet.')
    : !bakery ? 'Bakery needs ' + remaining(progress, 'bakery') + '. Gather wood in the woods, stone past the bridge, and apples at the orchard.'
    : !beacon ? 'Beacon needs ' + remaining(progress, 'beacon') + '. Mine copper by Echo Cave and stone in the highlands. Craft a lantern at the workbench.'
    : progress.opening ? 'Willowbend and the meadow are open. See your group photos in the album.'
      : 'Plan the new neighborhood at the Meadow Planning board beyond Bramble Creek.';
  const errands = villageJobs.filter(job => ['active', 'carrying'].includes(progress.errands[job.id]))
    .map(job => progress.errands[job.id] === 'carrying' ? job.delivery : job.pickup);
  objective.textContent = [message, progress.life.arrival ? chapter(progress.life, done)[1] : next, ...errands].filter(Boolean).join(' ');
}

function renderAlbum() {
  const albumProjects = { ...projects, 'lantern-night': { title: 'Lantern Night', villagers: ['Mabel', 'Pip', 'Bruno', 'Dot', 'Clover'] },
    scrapbook: { title: 'Farmgate scrapbook', villagers: ['Mabel', 'Hazel'] } };
  const entries = Object.entries(albumProjects).filter(([name]) => progress.photos[name] || progress.photos[name + '-before']);
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
  if (speaking) endConversation();
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
const itemsBtn = $('talk-items');
const inventory = inventoryPanels(progress, {
  hasPickaxe: () => done('cottage'),
  jobs: () => villageJobs.filter(job => progress.errands[job.id] === 'carrying'),
  context: item => {
    const villager = speaking ?? near;
    if (!speaking && (item === 'wood' || item === 'copper') && nearPoint(...workbench)) {
      return { label: 'Open workbench', run: craft };
    }
    if (!villager || !(progress.inventory[item] > 0)) return null;
    return { label: 'Give to ' + villager.name, run() {
      if (speaking !== villager) openConversation(villager);
      inventory.openExchange(villager, true, item);
    } };
  },
  openExchange: () => setConversationPanel('exchange'),
  closeExchange: () => {
    setConversationPanel(null);
    itemsBtn.focus({ preventScroll: true });
  },
  transfer: ({ villager, giving, from, to, item, count }) => {
    if (speaking !== villager || !moveItems(from, to, item, count)) return false;
    if (giving) life.give(villager.name, item);
    if (giving && villager.name === 'Bruno' && item === 'planks' && count >= 2 && progress.life.arrival) {
      progress.life.marketShelf = true;
      remember(progress.life, 'Bruno', 'Brought enough planks for Hazel’s market shelf.');
    }
    const [label, plural] = itemNames[item];
    const singular = { planks: 'plank', apples: 'apple' }[item] ?? label.toLowerCase();
    const amount = count + ' ' + (count === 1 ? singular : plural);
    commitProgress(giving ? 'Gave ' + villager.name + ' ' + amount + '.' : 'Received ' + amount + ' from ' + villager.name + '.');
    let reply = giving ? 'Thank you! I’ll keep it here if you need it back.' : 'Here you go. I put ' + amount + ' in your backpack.';
    if (giving && villager.name === 'Pip' && item === 'apples') reply = 'Orchard apples! I’ll save them for the next tray.';
    if (giving && villager.name === 'Bruno' && item === 'planks' && count >= 2 && progress.life.marketShelf) {
      reply = 'That’s enough for the shelf Hazel asked for. Look for it by her market stall.';
    }
    showAnswer(villager, reply);
    showTransfer(villager, item, count, giving);
    return true;
  },
});

function openBackpack() {
  if (!started || document.querySelector('dialog[open]')) return;
  keys.clear();
  inventory.showBackpack();
}

$('open-backpack').addEventListener('click', openBackpack);
backpack.addEventListener('close', () => {
  if (!speaking) restoreGameFocus();
  else if (exchange.hidden) talkBtn.focus({ preventScroll: true });
});

let flight, transferGesture;
function showTransfer(villager, item, count, giving) {
  inventory.receipt(item, giving ? -count : count);
  const marker = $('item-flight');
  flight?.cancel();
  marker.hidden = true;
  if (reducedMotion.matches) return;
  const a = giving ? pl : villager;
  const b = giving ? villager : pl;
  transferGesture = { giver: giving ? player : villager.c, receiver: giving ? villager.c : player, left: .46 };
  const point = actor => screenAt(actor.x, groundAt(actor.x, actor.z) + 1.04, actor.z);
  const start = point(a), end = point(b);
  if (!start.on || !end.on) return;
  const at = (x, y) => 'translate(' + (x - 19) + 'px,' + (y - 19) + 'px)';
  marker.replaceChildren(itemIcon(item));
  marker.style.left = marker.style.top = '0';
  marker.hidden = false;
  flight = marker.animate([
    { transform: at(start.x, start.y), opacity: .3 },
    { transform: at((start.x + end.x) / 2, Math.min(start.y, end.y) - 25), opacity: 1 },
    { transform: at(end.x, end.y), opacity: 0 },
  ], { duration: 460, easing: 'ease-out' });
  flight.onfinish = () => { marker.hidden = true; };
}

album.addEventListener('close', restoreGameFocus);

function takePhoto(name, project = projects[name]) {
  if (name in neighborhood) project = plotProject(progress, name);
  const [x, z] = project.site;
  const [ax, az] = project.photoSpot ?? project.approach;
  const forward = new THREE.Vector3(ax - x, 0, az - z).normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const guest = makeKid();
  if (hat.visible) guest.head.add(hat.clone());
  const group = [guest, ...project.villagers.map(villager => makeResident(byName[villager]))];
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

function projectDonation(name) {
  const { stock, contributions, arrival } = progress.life;
  if (!arrival || contributions[name]) return null;
  return Object.keys(projects[name].needs).find(item => stock[item] > 0 && projects[name].needs[item] > (progress.built[name][item] ?? 0));
}

function inspectProject(name) {
  if (!progress.life.arrival) return build(name);
  const project = projects[name];
  const contribution = projectDonation(name);
  const items = Object.entries(project.needs).map(([item, total]) => {
    const missing = Math.max(0, total - (progress.built[name][item] ?? 0));
    const neighbor = Number(item === contribution);
    const yours = Math.min(missing - neighbor, progress.inventory[item]);
    return { item, yours, neighbor, remaining: missing - neighbor - yours };
  });
  life.projectPreview(project.title, items, project.villagers[0], () => build(name));
}

function build(name) {
  const { stock, contributions } = progress.life;
  const donation = projectDonation(name);
  if (donation) {
    stock[donation]--;
    progress.built[name][donation] = (progress.built[name][donation] ?? 0) + 1;
    contributions[name] = donation;
  }
  const help = donation ? projects[name].villagers[0] + ' brought ' + donation + ' from the village supplies. ' : '';
  const added = contribute(progress, name);
  if (!added.length && !done(name)) return commitProgress(help + 'Still needed: ' + remaining(progress, name) + '.');
  if (!done(name)) return commitProgress(help + 'Delivered ' + added.join(', ') + '.');
  refreshProjects();
  const photographed = takePhoto(name);
  commitProgress(help + projects[name].title + ' is finished!' + (photographed ? ' Group photo added to the album.' : ' The group photo could not be captured.'));
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
  return button;
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
    if (progress.opening && progress.life.arrival) return null;
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
  if (progress.life.arrival) return life.recipes();
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
  const villageAction = life.action(nearPoint);
  if (villageAction) {
    const [x, z] = villageAction.spot;
    return { position: { x, y: groundAt(x, z), z }, label: villageAction.label, run: villageAction.run };
  }
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
      if (!progress.gathered.includes(node.id)) progress.gathered.push(node.id);
      progress.life.harvests[node.id] = life.day.day;
      harvestGesture = { kind: node.kind, left: .55 };
      pl.ry = Math.atan2(node.x - pl.x, node.z - pl.z);
      world.gather(prop, node.kind);
      inventory.receipt(node.kind, node.amount);
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
    return { position: { x, y: groundAt(x, z), z }, label: 'Build ' + project.title, run: () => inspectProject(name) };
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
    const before = progress.inventory.planks;
    build('cottage');
    const used = before - progress.inventory.planks;
    if (used) showTransfer(byName.Bruno, 'planks', used, true);
    return done('cottage') ? 'The cottage is ready. Thanks for helping me finish it.' : 'Thanks for bringing the planks. The last board will go in when we have enough.';
  }
  if (!done('cottage')) return 'My bench is northwest of the plaza, next to the cottage frame. I need two planks.';
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
      if (progress.life.arrival) {
        const reward = { market: ['planks', 2], pond: ['stone', 2], orchard: ['apples', 3] }[job.id];
        progress.life.stock[reward[0]] += reward[1];
        remember(progress.life, villager.name, 'Finished ' + job.title.toLowerCase() + ' together.', 2);
      }
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

const speech = $('villager-speech');
const panel = $('conversation-panel');
const topicList = $('conversation-topics');
const askBtn = $('talk-ask');
const goodbyeBtn = $('talk-goodbye');
const talkLabel = $('talk-label');
const speechName = $('speech-name');
const speechReply = $('speech-reply');
const speechAnnouncement = $('speech-announcement');
let speechGesture = 0;
let harvestGesture = null;
let chat = null, chatDelay = 2, lastPair = '';
const overheard = [];
const heardTopics = new Map();

function showAnswer(villager, words) {
  speechName.textContent = villager.name;
  speechReply.textContent = words;
  speechReply.scrollTop = 0;
  speechAnnouncement.textContent = villager.name + '. ' + words;
  speech.classList.add('show');
  speech.removeAttribute('aria-hidden');
  speechGesture = 0.55;
  setConversationPanel(null);
  placeSpeech(speech, villager, 1.35);
}

function endConversation() {
  speaking = null;
  talkView.stepTo = null;
  speechAnnouncement.textContent = '';
  speech.classList.remove('show');
  speech.setAttribute('aria-hidden', 'true');
  setConversationPanel(null);
}

function setConversationPanel(section) {
  panel.hidden = !section;
  exchange.hidden = section !== 'exchange';
  topicList.hidden = section !== 'topics';
  panel.classList.toggle('is-exchange', section === 'exchange');
  if (section !== 'exchange') inventory.resetExchange();
  panel.scrollTop = 0;
  updateTalk();
  if (section === 'topics') renderTopics();
  else if (section === 'exchange') inventory.focusExchange();
  else {
    const focus = speaking ? talkBtn : canvasEl;
    focus.focus({ preventScroll: true });
  }
}

function toggleTopics() {
  setConversationPanel(!panel.hidden && exchange.hidden ? null : 'topics');
}

itemsBtn.addEventListener('click', () => inventory.openExchange(speaking, stockedItems(progress.inventory).length > 0));
askBtn.addEventListener('click', toggleTopics);
goodbyeBtn.addEventListener('click', endConversation);

const speechAnchor = new THREE.Vector3();
function placeSpeech(element, villager, offset) {
  // The anchor follows the head in local space. The DOM bubble always faces the screen.
  villager.c.head.localToWorld(speechAnchor.set(0, offset, -0.3));
  const p = screenAt(speechAnchor.x, speechAnchor.y, speechAnchor.z);
  const onscreen = p.on && p.x >= 0 && p.x <= innerWidth && p.y >= 0 && p.y <= innerHeight;
  const width = element.offsetWidth, height = element.offsetHeight;
  const ceiling = !panel.hidden && innerHeight > 450 ? panel.offsetTop - 12 : innerHeight - 77;
  const x = clamp(onscreen ? p.x : innerWidth / 2, width / 2 + 12, innerWidth - width / 2 - 12);
  let y = clamp(onscreen ? p.y - 9 : innerHeight * 0.42, 56 + height, Math.max(56 + height, ceiling));
  const overlapsPanel = !panel.hidden && y > panel.offsetTop - 12 && x - width / 2 < panel.offsetLeft + panel.offsetWidth + 8 &&
    x + width / 2 > panel.offsetLeft - 8;
  if (overlapsPanel) y = Math.max(height + 12, panel.offsetTop - 12);
  element.style.transform = 'translate(' + Math.round(x - width / 2) + 'px, ' + Math.round(y - height) + 'px)';
  element.style.setProperty('--tail', clamp(p.x - x + width / 2, 14, width - 14) + 'px');
  element.classList.toggle('offscreen', !onscreen || Math.abs(y - p.y) > 55);
}

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

function deliveryFor(villager) {
  const job = villager.job;
  if (job && progress.errands[job.id] === 'carrying') return job.delivery.split(' to ')[0];
  if (villager === byName.Bruno && progress.started && !done('cottage') && progress.inventory.planks > 0) {
    const needed = projects.cottage.needs.planks - (progress.built.cottage.planks ?? 0) - Number(projectDonation('cottage') === 'planks');
    const offer = Math.min(progress.inventory.planks, needed);
    return offer ? 'Offer ' + offer + (offer === 1 ? ' plank' : ' planks') : 'Accept help';
  }
  return null;
}

function greet(villager) {
  const delivery = deliveryFor(villager);
  if (delivery) return villager === byName.Bruno ? 'Those planks look just right for the cottage.' :
    villager.name === 'Reed' ? 'You made it back from the dock! How’s the trail?' :
      villager.name === 'Hazel' ? 'You found the flowers! I saved a spot for them.' : 'Are those the cider apples? I’ll get the press ready.';
  if (villager.job && progress.errands[villager.job.id] === 'active') return villager.job.line;
  const errand = villageJobs.find(job => ['active', 'carrying'].includes(progress.errands[job.id]));
  if (errand) return 'How’s your errand for ' + errand.villager + ' coming along?';
  const activity = life.activityGreeting(villager.name);
  if (activity) return activity;
  const shared = life.giftGreeting(villager.name) ?? life.helpMessage(villager.name);
  if (shared) return shared;
  if (activeJobs().length) {
    if (!done('cottage') && villager !== byName.Bruno && progress.started) {
      if (progress.inventory.planks >= projects.cottage.needs.planks) return 'Those planks are for Bruno, right? He’s waiting for you.';
      if (progress.inventory.wood) return 'That wood looks sturdy. Have you found Bruno’s workbench?';
      return 'Out gathering for Bruno? Follow the east road across Bramble Creek.';
    }
    return 'Hey! How’s your work around town coming along?';
  }
  return greetings[villager.name];
}

function conversationFacing(actor, listener) {
  const stand = talkView.stepTo;
  const from = actor === pl && stand ? stand : actor;
  const to = listener === pl && stand ? stand : listener;
  const dx = to.x - from.x, dz = to.z - from.z;
  const facing = Math.hypot(dx, dz) > 0.15 ? Math.atan2(dx, dz) :
    talkView.yaw + (actor === pl ? Math.PI / 2 : -Math.PI / 2);
  const angle = Math.atan2(Math.sin(talkView.yaw - facing), Math.cos(talkView.yaw - facing));
  // A small turn toward the camera keeps the eyes visible while the two face each other.
  return facing + clamp(angle, -0.3, 0.3);
}

function findTalkingSpot(villager) {
  const dx = pl.x - villager.x, dz = pl.z - villager.z;
  const gap = Math.hypot(dx, dz);
  if (gap >= 1.35) return null;
  const outward = gap > 0.15 ? Math.atan2(dx, dz) : cam.yaw + Math.PI / 2;
  for (const offset of [0, 30, -30, 60, -60, 90, -90, 120, -120, 180]) {
    const angle = outward + THREE.MathUtils.degToRad(offset);
    const x = villager.x + Math.sin(angle) * 1.7, z = villager.z + Math.cos(angle) * 1.7;
    if (gap > 0.15 && dx * (x - pl.x) + dz * (z - pl.z) < 0) continue;
    if (CAST.some(actor => actor !== villager && Math.hypot(actor.x - x, actor.z - z) < 0.85)) continue;
    const steps = Math.ceil(Math.hypot(x - pl.x, z - pl.z) / 0.18);
    let clear = true;
    for (let i = 1; i <= steps && clear; i++) {
      clear = walkable(lerp(pl.x, x, i / steps), lerp(pl.z, z, i / steps), R);
    }
    if (clear) return { x, z };
  }
  return null;
}

function stepBackForTalk(dt) {
  const stand = talkView.stepTo;
  if (!stand || dt === 0) return 0;
  const distance = Math.hypot(stand.x - pl.x, stand.z - pl.z);
  if (distance < 0.01) {
    talkView.stepTo = null;
    return 0;
  }
  const step = Math.min(distance, dt * WALK);
  const x = lerp(pl.x, stand.x, step / distance), z = lerp(pl.z, stand.z, step / distance);
  if (!walkable(x, z, R)) {
    talkView.stepTo = null;
    return 0;
  }
  pl.x = x;
  pl.z = z;
  if (step === distance) talkView.stepTo = null;
  return step / dt;
}

function openConversation(villager) {
  life.visit(villager.name);
  speaking = villager;
  pl.vx = pl.vz = 0;
  keys.clear();
  if (joy.id !== null) centerStick(joy.lastX, joy.lastY);
  talkView.stepTo = reducedMotion.matches ? null : findTalkingSpot(villager);
  if (chat?.a === villager || chat?.b === villager) {
    chat = null;
    $('chatter').hidden = true;
    chatDelay = 2;
  }
  beginTalkView(villager);
  showAnswer(villager, greet(villager));
}

function conversationChoices(villager) {
  const option = (label, reply) => ({ label, run: () => showAnswer(villager, reply()) });
  const job = villager.job;
  const state = job && progress.errands[job.id];
  const delivery = deliveryFor(villager);
  const main = [];
  if (delivery) main.push(option(delivery, () => villagerLine(villager)));
  else if (job || villager === byName.Bruno) {
    const label = job ? state ? 'Talk about ' + job.title.toLowerCase() : 'Start job · ' + job.title : 'Talk about rebuilding';
    main.push(option(label, () => villagerLine(villager)));
  } else {
    main.push(option(activeJobs().length ? 'Active jobs' : 'What’s new?', () => activeJobs().length ? jobReply(activeJobs()) : villagerLine(villager)));
  }
  main.push(option('Where should I go?', () => topics[villager.name][1]));
  const scenes = life.topics(villager.name, words => showAnswer(villager, words));
  if (scenes.length && !delivery) main.push(scenes.shift());
  const more = [
    ...scenes,
    option('How’s life in Willowbend?', () => topics[villager.name][0]),
    option('Active jobs', () => jobReply(activeJobs())),
    option('Village news', () => progress.opening ? 'The meadow neighborhood is open. Everyone’s talking about the opening-day photograph.'
      : done('bakery') ? 'The bakery is open. The next big thing is the neighborhood across Bramble Creek.'
      : 'Bruno is looking for help rebuilding. Hazel, Reed, and Clover also have work available.'),
    { label: 'Give an item', run: () => inventory.openExchange(villager, true) },
    { label: 'Take supplies', run: () => inventory.openExchange(villager, false) },
  ];
  if (!job && villager !== byName.Bruno) more.splice(1, 0, option('What’s new?', () => villagerLine(villager)));
  if (overheard.length) more.push(option('What have people been saying?', () => 'I heard this nearby. “' + overheard.at(-1).split(' · ').slice(1).join(' · ') + '”'));
  return { main, more: more.filter(choice => !main.some(entry => entry.label === choice.label)) };
}

function renderTopics(expanded = false) {
  const { main, more } = conversationChoices(speaking);
  topicList.replaceChildren();
  for (const { label, run } of expanded ? more : main) plannerButton(topicList, label, run);
  plannerButton(topicList, expanded ? 'Back to replies' : 'More topics', () => renderTopics(!expanded));
  panel.scrollTop = 0;
  topicList.firstElementChild.focus({ preventScroll: true });
}

function interact() {
  if (!started || document.querySelector('dialog[open]')) return;
  if (speaking) {
    const delivery = deliveryFor(speaking);
    if (delivery && panel.hidden) showAnswer(speaking, villagerLine(speaking));
    else toggleTopics();
    return;
  }
  const action = nearbyAction();
  if (action) return action.run();
  if (near) openConversation(near);
}

function updateChatter(dt) {
  const captionEl = $('chatter');
  if (!started || document.querySelector('dialog[open]')) {
    captionEl.hidden = true;
    return;
  }
  if (!speaking && unsolicited && time < unsolicited.until) {
    captionEl.hidden = false;
    captionEl.textContent = unsolicited.villager.name + ' · ' + unsolicited.words;
    placeSpeech(captionEl, unsolicited.villager, 1.38);
    return;
  }
  if (!chat) {
    chatDelay -= dt;
    if (chatDelay > 0) return;
    const nearby = CAST.filter(v => v !== speaking && progress.jobs[v.name] !== 'working' && Math.hypot(v.x - pl.x, v.z - pl.z) < 16);
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
      if (key === 'Clover/Pip' && done('bakery') && progress.life.batch) {
        const recipe = progress.life.recipe.toLowerCase();
        topics.unshift(initiator.name === 'Pip' ?
          ['I made another tray of ' + recipe + '. Can you tell which ones I burnt?', 'Obviously. I saved those for us.', 'Come by the counter. There’s plenty left.'] :
          ['You’ve put out two trays of ' + recipe + ' today.', 'I burnt the first tray. The second one is for customers.', 'Then I know which one we’re having for breakfast.']);
      }
      const visit = heardTopics.get(key) - 1;
      chat = { a: initiator, b: partner, lines: topics[visit % topics.length], turn: 0, left: 0 };
      lastPair = key;
      break;
    }
    if (!chat) { chatDelay = 2; return; }
  }
  if (Math.hypot(chat.a.x - pl.x, chat.a.z - pl.z) > 20 || progress.jobs[chat.a.name] === 'working' || progress.jobs[chat.b.name] === 'working') {
    chat = null;
    captionEl.hidden = true;
    chatDelay = 2;
    return;
  }
  chat.left -= dt;
  if (chat.left <= 0) {
    if (chat.turn === chat.lines.length) {
      chat = null;
      captionEl.hidden = true;
      chatDelay = 3;
      return;
    }
    const speaker = chat.turn % 2 ? chat.b : chat.a;
    const line = chat.lines[chat.turn++];
    const caption = speaker.name + ' · ' + line;
    captionEl.textContent = caption;
    chat.speaker = speaker;
    overheard.push(caption);
    if (overheard.length > 9) overheard.shift();
    chat.left = Math.max(2.6, line.length / 19);
  }
  const speaker = chat.speaker;
  const pos = screenAt(speaker.x, speaker.c.root.position.y + 2.7, speaker.z);
  captionEl.hidden = !!speaking || !pos.on || pos.x < 0 || pos.x > innerWidth || pos.y < 0 || pos.y > innerHeight;
  if (!captionEl.hidden) placeSpeech(captionEl, speaker, 1.38);
}

let unsolicited = null;
const life = villageLife(progress, {
  save: commitProgress, persist: () => saveProgress(progress), refresh: refreshProjects, done, photo: takePhoto,
  whisper: (villager, words) => { unsolicited = { villager, words, until: time + 7 }; },
  button: plannerButton, focus: restoreGameFocus, release: endConversation, receipt: inventory.receipt,
  position: () => [pl.x, pl.z], near: (x, z, radius) => Math.hypot(pl.x - x, pl.z - z) < radius,
});
addEventListener('pagehide', () => saveProgress(progress));
refreshProjects();

const proj = new THREE.Vector3();
function screenAt(x, y, z) {
  proj.set(x, y, z).project(camera);
  return { x: (proj.x * 0.5 + 0.5) * innerWidth, y: (-proj.y * 0.5 + 0.5) * innerHeight, on: proj.z >= -1 && proj.z <= 1 };
}
function updateTalk() {
  near = null;
  let best = 2.6;
  if (started) for (const v of CAST) { const d = Math.hypot(v.x - pl.x, v.z - pl.z); if (d < best) { best = d; near = v; } }
  const action = speaking ? null : nearbyAction();
  const delivery = speaking && deliveryFor(speaking);
  talkBtn.hidden = !speaking && !near && !action;
  let label = action?.label.split(' ')[0] ?? 'Talk';
  if (speaking) label = panel.hidden ? (delivery || 'Ask') : 'Back';
  if (talkLabel.textContent !== label) talkLabel.textContent = label;
  const accessibleLabel = label === 'Ask' ? 'Ask a question' : label;
  if (talkBtn.getAttribute('aria-label') !== accessibleLabel) talkBtn.setAttribute('aria-label', accessibleLabel);
  talkBtn.setAttribute('aria-expanded', String(!!speaking && !panel.hidden));
  itemsBtn.hidden = !speaking || !panel.hidden;
  askBtn.hidden = !delivery || !panel.hidden;
  goodbyeBtn.hidden = !speaking;
  $('hud').classList.toggle('talking', !!speaking);
  $('zone').classList.toggle('quiet', !!speaking);
  if (action || (near && !speaking)) {
    const target = action ? action.position : near.c.root.position;
    const p = screenAt(target.x, target.y + (action ? 1.5 : 2.5), target.z);
    const label = action?.label ?? 'Talk to ' + near.name;
    promptEl.textContent = touch ? label : 'Space · ' + label;
    promptEl.style.display = p.on ? 'block' : 'none';
    promptEl.style.left = p.x + 'px'; promptEl.style.top = p.y + 'px';
  } else promptEl.style.display = 'none';
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
  if (started) {
    updatePlayer(dt);
    life.update(dt, !!speaking || !!document.querySelector('dialog[open]'));
  }
  animate(player, dt, time, started ? pl.speed : 0, reducedMotion.matches);
  if (harvestGesture) {
    if (!reducedMotion.matches && pl.speed < 0.2) {
      const swing = Math.sin(Math.PI * harvestGesture.left / .55);
      player.arms[1].rotation.x -= swing * (harvestGesture.kind === 'apples' ? .9 : 1.7);
      if (harvestGesture.kind === 'apples') player.arms[-1].rotation.x -= swing * .9;
    }
    harvestGesture.left -= dt;
    if (harvestGesture.left <= 0) harvestGesture = null;
  }
  if (!started) player.arms[-1].rotation.z = -(2.5 + Math.sin(time * 6) * 0.22);
  for (const v of CAST) {
    const sp = updateVillager(v, dt);
    animate(v.c, dt, time, sp, reducedMotion.matches);
    animateBaker(v.c, dt, time, v.activity ? { work: v.activity } : null, reducedMotion.matches);
    animateVillagerWork(v.c, dt, time, v.activity, reducedMotion.matches);
    if (v === speaking && speechGesture > 0 && !reducedMotion.matches) {
      const gesture = Math.sin(Math.PI * speechGesture / 0.55);
      v.c.head.rotation.x += gesture * 0.13;
      v.c.arms[1].rotation.x -= gesture * 0.34;
    }
  }
  if (transferGesture) {
    const { giver, receiver, left } = transferGesture;
    if (!reducedMotion.matches) {
      const phase = 1 - left / .46;
      giver.arms[1].rotation.x -= .95 * Math.sin(Math.PI * phase);
      receiver.arms[1].rotation.x -= .65 * Math.sin(Math.PI * phase) * phase;
    }
    transferGesture.left -= dt;
    if (transferGesture.left <= 0) transferGesture = null;
  }
  speechGesture = Math.max(0, speechGesture - dt);
  if (!started) {
    byName.Mabel.c.arms[-1].rotation.z = -(2.5 + Math.sin(time * 6 + 1.3) * 0.22);
    byName.Bruno.c.arms[1].rotation.z = 2.35 + Math.sin(time * 9) * 0.25;
  }
  updateZone(dt);

  if (cam.mode !== 'splash') {
    cam.x = lerp(cam.x, pl.x, Math.min(1, dt * 6));
    cam.z = lerp(cam.z, pl.z, Math.min(1, dt * 6));
    cam.y = lerp(cam.y, pl.y, Math.min(1, dt * 4));
    followPose(tmpPos, tmpLook, dt);
    if (cam.mode === 'intro') {
      cam.blend = Math.min(1, cam.blend + dt / 1.8);
      const k = cam.blend * cam.blend * (3 - 2 * cam.blend);
      tmpPos.lerpVectors(SPLASH_CAM.pos, tmpPos, k);
      tmpLook.lerpVectors(SPLASH_CAM.look, tmpLook, k);
      if (cam.blend >= 1) cam.mode = 'follow';
    }
    blendTalkView(tmpPos, tmpLook, dt);
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
    camera.updateMatrixWorld();
  }
  if (speaking) placeSpeech(speech, speaking, 1.35);
  updateTalk();
  updateChatter(dt);
  world.follow(started ? pl.x : 0, started ? pl.z : 12);
  world.update(dt, time, camera, life.day, life.racePoint, life.festival, reducedMotion.matches);
}
tick();

if (TEST) {
  window.WB = {
    start,
    info: () => ({
      started, houseFinished: world.house.visible, progress: { inventory: { ...progress.inventory }, gathered: [...progress.gathered], built: structuredClone(progress.built), photos: Object.keys(progress.photos), plots: { ...progress.plots }, jobs: { ...progress.jobs }, opening: progress.opening, errands: { ...progress.errands } }, x: +pl.x.toFixed(2), z: +pl.z.toFixed(2), y: +pl.y.toFixed(2), speed: +pl.speed.toFixed(2), camDist: +cam.dist.toFixed(2), zone: lastZone, near: near?.name ?? null,
      life: structuredClone(progress.life), day: life.day, festivalActive: life.festival, speaking: speaking?.name ?? null, talkBlend: talkView.blend,
      cameraPosition: camera.position.toArray(), cameraQuaternion: camera.quaternion.toArray(),
      yaw: +cam.yaw.toFixed(3), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, stats: world.stats,
      district: world.district,
      villagers: CAST.map(v => ({ name: v.name, x: +v.x.toFixed(2), z: +v.z.toFixed(2), state: v.state, activity: v.activity, carrying: v.c.baking?.work.visible ?? v.c.dailyWork?.prop.visible ?? false })),
    }),
    warp(x, z) {
      pl.x = cam.x = x;
      pl.z = cam.z = z;
      pl.y = cam.y = groundAt(x, z);
      pl.vx = pl.vz = 0;
    },
    // run the game forward without waiting on frames (headless browsers draw slowly)
    sim(seconds, hold = []) {
      for (const k of hold) keys.add(k);
      for (let t = 0; t < seconds; t += 1 / 30) update(1 / 30);
      for (const k of hold) keys.delete(k);
      renderer.render(scene, camera);
    },
    passTime(seconds) { life.update(seconds, false); refreshProjects(); },
    face(ry) { pl.ry = ry; },
    zoom,
    lookAt(x, z) { cam.yaw = Math.atan2(-(x - pl.x), -(z - pl.z)); cam.x = pl.x; cam.z = pl.z; cam.y = groundAt(pl.x, pl.z); },
    walkable: (x, z) => walkable(x, z),
    avatarVisible() {
      return [[-.3, 1.52], [.3, 1.52], [0, .8]].every(([dx, height]) => {
        const target = new THREE.Vector3(pl.x + dx, player.root.position.y + height, pl.z);
        const ray = new THREE.Raycaster(camera.position, target.clone().sub(camera.position).normalize(), 0, camera.position.distanceTo(target));
        const hit = ray.intersectObjects(scene.children, true).find(hit => !hit.object.userData.ink && !(hit.object.material.transparent && hit.object.material.opacity < .5));
        for (let object = hit?.object; object; object = object.parent) if (object === player.root) return true;
        return false;
      });
    },
    height, WATER,
    positionVillager(name, x, z) {
      const v = byName[name];
      v.x = x;
      v.z = z;
      v.state = 'idle';
      v.timer = 20;
      v.bakeryJourney = null;
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
