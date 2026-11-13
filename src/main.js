import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeKid, makeCat, makeBunny, makeBear, makeDuck, makeDog, makeFrog, animate } from './chibi.js';
import { groundAt, walkable, zoneAt, height, WATER } from './layout.js';
import { rand, clamp, lerp } from './util.js';

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
].map((v, i) => {
  const c = v.make();
  c.ph = i * 1.3;
  scene.add(c.root);
  return { ...v, c, x: 0, z: 0, ry: 0, state: 'pose', timer: rand(0.5, 3), tx: 0, tz: 0, line: 0, talkT: 0 };
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
for (const v of CAST) { [v.x, v.z, v.ry] = POSE[v.name]; setPose(v.c, v.x, v.z, v.ry); }
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
  let speed = 0;
  if (v.state === 'pose') { /* holding the opening shot */ }
  else if (dp < 2.8 && started) {
    v.ry = turnTo(v.ry, Math.atan2(dpx, dpz), Math.min(1, dt * 6));
    if (v.state === 'walk') { v.state = 'idle'; v.timer = rand(1, 2); }
  } else if (v === byName.Bruno && (quest === 'fetch' || quest === 'return')) {
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
const promptEl = $('prompt'), bubble = $('bubble'), talkBtn = $('talk');
const objective = $('objective');
const objectives = {
  fetch: 'Follow the east road across Bramble Creek. Pick up the marked logs.',
  return: 'Bring the wood back to Bruno in the village.',
  done: 'Bruno’s house is finished. Look for its red roof northwest of the plaza.',
};
let quest = 'offer';
let near = null, speaking = null;

function setQuest(next) {
  quest = next;
  world.wood.visible = next === 'fetch';
  objective.hidden = false;
  objective.textContent = objectives[next];
}

function brunoLine() {
  if (quest === 'offer') {
    setQuest('fetch');
    return 'Could you bring me a bundle of wood? Take the east road over Bramble Creek. I marked the logs just past the bridge.';
  }
  if (quest === 'fetch') return 'Look for my sign by the logs on the far side of the bridge.';
  if (quest === 'return') {
    world.finishHouse();
    setQuest('done');
    return 'You found it! The house is finished. Come see it northwest of the plaza!';
  }
  return 'Thanks for helping me finish the house!';
}

function nearWood() {
  const { x, z } = world.wood.position;
  return world.wood.visible && Math.hypot(pl.x - x, pl.z - z) < 2.2;
}

function interact() {
  if (!started) return;
  if (nearWood()) {
    setQuest('return');
    return;
  }
  if (!near) return;
  speaking = near;
  near.talkT = near === byName.Bruno ? 7 : 4.5;
  bubble.querySelector('.who').textContent = near.name;
  bubble.querySelector('.say').textContent = near === byName.Bruno ? brunoLine() : near.lines[near.line++ % near.lines.length];
  near.c.root.userData.hop = 0.35;
}
const proj = new THREE.Vector3();
function screenAt(x, y, z) {
  proj.set(x, y, z).project(camera);
  return { x: (proj.x * 0.5 + 0.5) * innerWidth, y: (-proj.y * 0.5 + 0.5) * innerHeight, on: proj.z < 1 };
}
function updateTalk(dt) {
  near = null;
  let best = 2.6;
  if (started) for (const v of CAST) { const d = Math.hypot(v.x - pl.x, v.z - pl.z); if (d < best) { best = d; near = v; } }
  const collect = started && nearWood();
  talkBtn.classList.toggle('near', !!near || collect);
  talkBtn.textContent = collect ? 'Pick up' : 'Talk';
  if (speaking) {
    speaking.talkT -= dt;
    if (speaking.talkT <= 0 || Math.hypot(speaking.x - pl.x, speaking.z - pl.z) > 4.5) speaking = null;
  }
  if (speaking) {
    const p = screenAt(speaking.x, speaking.c.root.position.y + 2.6, speaking.z);
    bubble.style.display = p.on ? 'block' : 'none';
    bubble.style.left = p.x + 'px'; bubble.style.top = p.y + 'px';
  } else bubble.style.display = 'none';
  if (collect || (near && near !== speaking)) {
    const target = collect ? world.wood.position : near.c.root.position;
    const p = screenAt(target.x, target.y + (collect ? 1.5 : 2.5), target.z);
    const label = collect ? 'Pick up wood' : 'Talk to ' + near.name;
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
  }
  world.follow(started ? pl.x : 0, started ? pl.z : 12);
  world.update(dt, time, camera);
}
tick();

if (TEST) {
  window.WB = {
    start,
    info: () => ({
      started, houseFinished: world.house.visible, x: +pl.x.toFixed(2), z: +pl.z.toFixed(2), y: +pl.y.toFixed(2), speed: +pl.speed.toFixed(2), camDist: +cam.dist.toFixed(2), zone: lastZone, near: near?.name ?? null,
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
