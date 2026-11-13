// Chibi villagers: big round head, tall glossy eyes, blush, mitten hands, stubby legs.
// Every character is a small rig of pivots (hips, arms, head) so one walk cycle animates them all.
import * as THREE from 'three';
import { mesh, ball, box, cyl, cap, cone, torus, at } from './gfx.js';

const EYE = new THREE.MeshBasicMaterial({ color: 0x2c1f2b });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const BLUSH = new THREE.MeshBasicMaterial({ color: 0xff8098, transparent: true, opacity: 0.55, depthWrite: false });
const T = 0.03;
const WOOD = 0xa9794a;

export function chibi(o) {
  const root = new THREE.Group();          // sits on the ground, turns to face
  const body = new THREE.Group();          // bobs while walking
  root.add(body);
  const limb = o.limb ?? o.skin;
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.17, 0.42, 0);
    hip.add(at(cap(0.115, 0.14, o.legs ?? limb, T), 0, -0.15, 0));
    const shoe = ball(0.155, o.shoes ?? limb, T, 16, 12);
    shoe.scale.set(1, 0.72, 1.35);
    hip.add(at(shoe, 0, -0.31, 0.06));
    body.add(hip);
    legs.push(hip);
  }
  const torso = ball(0.4, o.outfit, T);
  torso.scale.set(1, 1.12, 0.9);
  body.add(at(torso, 0, 0.74, 0));
  const arms = {};
  for (const sx of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(sx * 0.34, 0.95, 0);
    a.add(at(cap(0.095, 0.22, o.sleeve ?? o.outfit, T), 0, -0.19, 0));
    a.add(at(ball(0.12, limb, T, 14, 10), 0, -0.41, 0));
    a.rotation.z = sx * 0.5;
    body.add(a);
    arms[sx] = a;
  }
  const head = new THREE.Group();
  head.position.set(0, 1.52, 0);
  body.add(head);
  const skull = ball(0.62, o.skin, T, 28, 20);
  skull.scale.set(1.08, 0.98, 1);
  head.add(skull);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.098, 18, 14), EYE);
    e.scale.set(1, 1.42, 0.45); e.position.set(sx * 0.235, -0.03, 0.575); e.rotation.y = sx * 0.36;
    head.add(e);
    head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), WHITE), sx * 0.235 + 0.032, 0.04, 0.625));
    head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), WHITE), sx * 0.235 - 0.034, -0.085, 0.618));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), BLUSH);
    b.scale.set(1.15, 0.62, 0.25); b.position.set(sx * 0.42, -0.2, 0.44); b.rotation.y = sx * 0.75;
    head.add(b);
  }
  let mouthZ = 0.6, mouthY = -0.215;
  if (o.muzzle) {
    const mz = ball(0.2, o.muzzle, 0.02); mz.scale.set(1.3, 0.85, 0.7);
    head.add(at(mz, 0, -0.18, 0.5));
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), new THREE.MeshBasicMaterial({ color: o.nose ?? 0x3a2630 }));
    nose.scale.set(1.3, 0.9, 0.8);
    head.add(at(nose, 0, -0.105, 0.645));
    mouthZ = 0.64; mouthY = -0.2;
  }
  if (o.beak) {
    const bk = cone(0.13, 0.3, o.beak, 0.022, 14); bk.rotation.x = Math.PI / 2; bk.scale.set(1.5, 1, 0.6);
    head.add(at(bk, 0, -0.17, 0.68));
  } else {
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(o.muzzle ? 0.04 : 0.052, 0.015, 6, 14, Math.PI), EYE);
    mouth.rotation.z = Math.PI;
    head.add(at(mouth, 0, mouthY, mouthZ));
  }

  const earPivots = [];
  if (o.ears === 'cat') for (const sx of [-1, 1]) {
    const e = cone(0.21, 0.38, o.skin, T, 14); e.rotation.z = -sx * 0.42; head.add(at(e, sx * 0.39, 0.53, 0));
    const i = cone(0.11, 0.22, 0xffb3c0, 0, 10); i.rotation.z = -sx * 0.42; head.add(at(i, sx * 0.385, 0.5, 0.085));
  }
  if (o.ears === 'bunny') for (const sx of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(sx * 0.22, 0.5, -0.03); ear.rotation.z = sx > 0 ? -0.55 : 0.12;
    ear.add(at(cap(0.115, 0.5, o.skin, T), 0, 0.42, 0));
    const inn = cap(0.062, 0.38, 0xffb3c0, 0); inn.scale.z = 0.4; ear.add(at(inn, 0, 0.42, 0.09));
    head.add(ear); earPivots.push(ear);
  }
  if (o.ears === 'bear') for (const sx of [-1, 1]) {
    head.add(at(ball(0.2, o.skin, T), sx * 0.47, 0.44, -0.02));
    const i = ball(0.11, o.muzzle, 0); i.scale.z = 0.5; head.add(at(i, sx * 0.47, 0.44, 0.14));
  }
  if (o.ears === 'floppy') for (const sx of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(sx * 0.5, 0.28, 0); ear.rotation.z = sx * 0.28;
    const e = ball(0.22, o.ear ?? o.skin, T); e.scale.set(0.55, 1.25, 0.8); ear.add(at(e, 0, -0.24, 0));
    head.add(ear); earPivots.push(ear);
  }
  if (o.hair) {
    const hc = mesh(new THREE.SphereGeometry(0.655, 28, 16, 0, Math.PI * 2, 0, 1.72), o.hair, T);
    hc.scale.set(1.08, 1, 1.02); hc.rotation.x = -0.42; head.add(hc);
    for (const [hx, hy, hz, r] of [[-0.3, 0.3, 0.47, 0.18], [0, 0.37, 0.52, 0.19], [0.3, 0.3, 0.47, 0.18], [-0.62, -0.02, -0.02, 0.2], [0.62, -0.02, -0.02, 0.2], [0.12, 0.66, 0, 0.16]]) head.add(at(ball(r, o.hair, T), hx, hy, hz));
  }
  if (o.tuft) for (const [x, rz] of [[-0.06, 0.4], [0.06, -0.3]]) { const t = cap(0.05, 0.16, o.tuft, 0.02); t.rotation.z = rz; head.add(at(t, x, 0.68, 0)); }

  root.traverse(m => { if (m.isMesh && !m.userData.ink) m.castShadow = true; });
  return { root, body, head, arms, legs, ears: earPivots, walk: 0, speed: 0 };
}

// One cycle for everyone: legs swing, arms counter-swing, a little hop, ears flop.
export function animate(c, dt, t, speed) {
  c.speed += (speed - c.speed) * Math.min(1, dt * 10);
  const s = Math.min(1, c.speed / 4);
  c.walk += dt * (5 + c.speed * 2.2);
  const p = c.walk, sw = Math.sin(p);
  c.legs[0].rotation.x = sw * 0.75 * s;
  c.legs[1].rotation.x = -sw * 0.75 * s;
  if (!c.armHold) {
    c.arms[-1].rotation.x = -sw * 0.7 * s;
    c.arms[1].rotation.x = sw * 0.7 * s;
    c.arms[-1].rotation.z = -0.5 + s * 0.2;
    c.arms[1].rotation.z = 0.5 - s * 0.2;
  }
  const breathe = Math.sin(t * 2.2 + (c.ph || 0)) * 0.02 * (1 - s);
  c.body.position.y = Math.abs(Math.cos(p)) * 0.11 * s + breathe;
  c.body.rotation.x = 0.1 * s;
  c.body.rotation.z = Math.sin(p) * 0.05 * s;
  c.head.rotation.x = -0.06 * s + Math.sin(t * 1.6 + (c.ph || 0)) * 0.035;
  for (const [i, e] of c.ears.entries()) e.rotation.x = Math.sin(p * 2 + i) * 0.18 * s - 0.05 * s;
}

// ---------- the cast ----------
export function makeKid() {
  const c = chibi({ skin: 0xffd9b8, outfit: 0x4f8fd6, legs: 0x6b5a4a, shoes: 0x8a4f34, hair: 0xb5562e });
  const sc = torus(0.3, 0.09, 0xe8554e, 0.028); sc.rotation.x = Math.PI / 2; c.body.add(at(sc, 0, 1.02, 0.02));
  const tail = box(0.15, 0.36, 0.07, 0xe8554e, 0.026, 0.03); tail.rotation.z = -0.25; c.body.add(at(tail, 0.22, 0.84, 0.36));
  c.body.add(at(box(0.54, 0.54, 0.28, 0x9a6a44, 0.03, 0.1), 0, 0.8, -0.42));
  const roll = cyl(0.13, 0.13, 0.66, 0x7fc4a0, 0.028, 14); roll.rotation.z = Math.PI / 2; c.body.add(at(roll, 0, 1.13, -0.46));
  return c;
}
export function makeCat() {
  const c = chibi({ skin: 0xf6b65c, muzzle: 0xfff1d6, nose: 0xe8798a, outfit: 0x5fb87a, ears: 'cat' });
  const tail = cap(0.075, 0.5, 0xf6b65c, 0.028); tail.rotation.set(0.6, 0, -0.7); c.body.add(at(tail, 0.34, 0.6, -0.38));
  return c;
}
export function makeBunny() {
  const c = chibi({ skin: 0xfdf5ec, muzzle: 0xffffff, nose: 0xf08aa0, outfit: 0xf291b0, ears: 'bunny' });
  c.body.add(at(cone(0.54, 0.52, 0xf291b0, 0.03, 18), 0, 0.6, 0));
  c.body.add(at(ball(0.14, 0xffffff, 0.026), 0, 0.5, -0.4));
  c.head.add(at(ball(0.085, 0xffd166, 0.016), -0.3, 0.52, 0.2));
  return c;
}
export function makeBear() {
  const c = chibi({ skin: 0xb9804f, muzzle: 0xecd0a6, outfit: 0x5c7fc2, sleeve: 0xb9804f, ears: 'bear' });
  const hat = mesh(new THREE.SphereGeometry(0.67, 28, 14, 0, Math.PI * 2, 0, 1.2), 0xf7c948, 0.03); hat.scale.set(1.08, 1, 1); c.head.add(at(hat, 0, 0.1, 0));
  c.head.add(at(box(0.62, 0.06, 0.34, 0xf7c948, 0.026, 0.03), 0, 0.36, 0.6));
  c.body.add(at(box(0.4, 0.3, 0.08, 0x4a69a8, 0.024, 0.03), 0, 0.92, 0.33));
  c.arms[1].add(at(cyl(0.035, 0.035, 0.6, WOOD, 0.02, 8), 0, -0.66, 0));
  c.arms[1].add(at(box(0.32, 0.15, 0.15, 0x9aa3b5, 0.024, 0.03), 0, -0.95, 0));
  return c;
}
export function makeDuck() {
  const c = chibi({ skin: 0xfff0a8, outfit: 0x8f7bd8, beak: 0xff9a3c, legs: 0xff9a3c, shoes: 0xff9a3c, tuft: 0xfff0a8 });
  const bow = torus(0.11, 0.05, 0xff7a9c, 0.02); c.head.add(at(bow, 0.32, 0.5, 0.2));
  return c;
}
export function makeDog() {
  const c = chibi({ skin: 0xe9c49a, muzzle: 0xfff4e0, ear: 0x9a6a44, outfit: 0xe8604c, ears: 'floppy' });
  const tail = cap(0.07, 0.26, 0xe9c49a, 0.026); tail.rotation.x = -0.9; c.body.add(at(tail, 0, 0.62, -0.42));
  const patch = ball(0.15, 0x9a6a44, 0); patch.scale.set(1, 1, 0.35);
  c.head.add(at(patch, -0.25, 0.0, 0.53));
  return c;
}
export function makeFrog() {
  const c = chibi({ skin: 0x8fd16a, outfit: 0xf2b441, legs: 0x8fd16a });
  // frogs keep their eyes up top
  c.head.children.filter(m => m.material === EYE || m.material === WHITE).forEach(m => { m.visible = false; });
  for (const sx of [-1, 1]) {
    c.head.add(at(ball(0.21, 0x8fd16a, 0.028), sx * 0.3, 0.5, 0.22));
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), EYE); c.head.add(at(e, sx * 0.3, 0.53, 0.4));
    c.head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), WHITE), sx * 0.3 + 0.03, 0.57, 0.48));
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.017, 6, 18, Math.PI), EYE);
  smile.rotation.z = Math.PI; c.head.add(at(smile, 0, -0.08, 0.6));
  c.head.add(at(cyl(0.3, 0.36, 0.2, 0xe8604c, 0.026, 18), 0, 0.62, -0.18));
  return c;
}
