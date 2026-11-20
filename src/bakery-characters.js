import * as THREE from 'three';
import { storyMaterial } from './art-materials.js';
import { at, ball, box, cyl, torus } from './gfx.js';
import { makeBunny } from './chibi.js';

function baker(clover) {
  const c = makeBunny();
  const shirt = storyMaterial(clover ? 0x88956a : 0xb97c74, 'cloth');
  // Each bunny has its own outfit material so Clover and Pip stay distinct.
  c.body.traverse(part => {
    if (part.isMesh && part.material.color?.getHex() === 0xf291b0) part.material = shirt;
  });
  const linen = storyMaterial(clover ? 0xdccaa4 : 0xf3e1bd, 'cloth');
  const pocket = storyMaterial(0xbda786, 'cloth');
  const apron = box(.44, .5, .05, linen, .009, .06);
  c.body.add(at(apron, 0, .66, .36));
  c.body.add(at(box(.23, .14, .035, pocket, .006, .025), 0, .64, .4));
  for (const side of [-1, 1]) {
    const strap = box(.055, .26, .035, linen, 0, .01);
    strap.rotation.z = side * .23;
    c.body.add(at(strap, side * .12, .98, .29));
  }
  const neck = torus(.28, .035, clover ? 0x80694f : 0x7b9271, .007);
  neck.rotation.x = Math.PI / 2;
  c.body.add(at(neck, 0, 1.03, 0));
  if (clover) {
    const ribbon = box(.24, .1, .05, 0x6e8262, .008, .02);
    c.head.add(at(ribbon, -.34, .54, .23));
  }
  const work = new THREE.Group();
  work.position.set(0, .69, .63);
  if (clover) {
    work.add(cyl(.22, .14, .19, 0x8e9e86, .008, 16));
    const batter = ball(.17, 0xe9d6a7, 0, 12, 8);
    batter.scale.y = .22;
    work.add(at(batter, 0, .09, 0));
  } else {
    work.add(at(box(.73, .045, .45, 0xb48b60, .007, .03), 0, -.02, 0));
    const dough = ball(.16, 0xf0d8ad, 0, 14, 10);
    dough.scale.set(1.3, .45, .75);
    work.add(at(dough, 0, .04, .015));
  }
  const tool = cyl(.036, .036, clover ? .32 : .56, clover ? 0x9f7a4c : 0xc9a16e, .006, 10);
  if (!clover) tool.rotation.z = Math.PI / 2;
  tool.position.set(0, .13, .02);
  work.add(tool);
  c.body.add(work);
  work.visible = false;
  c.baking = { work, tool, blend: 0 };
  return c;
}

export const makePip = () => baker(false);
export const makeClover = () => baker(true);

export function animateBaker(c, dt, t, routine, reducedMotion) {
  const baking = c.baking;
  if (!baking) return;
  const target = routine ? 1 : 0;
  baking.blend += (target - baking.blend) * Math.min(1, dt * 12);
  baking.work.visible = baking.blend > .05;
  if (baking.blend < .01) return;
  const strength = baking.blend;
  const rhythm = reducedMotion ? 0 : Math.sin(t * (routine?.work === 'mix' ? 3.4 : 2.6));
  baking.work.scale.setScalar(strength);
  c.arms[-1].rotation.x = c.arms[-1].rotation.x * (1 - strength) - (.9 + rhythm * .10) * strength;
  c.arms[1].rotation.x = c.arms[1].rotation.x * (1 - strength) - (1.0 + rhythm * .14) * strength;
  c.arms[-1].rotation.z = -.19;
  c.arms[1].rotation.z = .19;
  c.head.rotation.x += .13 * strength;
  c.body.rotation.x += (.035 + rhythm * .025) * strength;
  baking.tool.position.z = rhythm * .075;
  baking.tool.rotation.x = routine?.work === 'mix' ? .4 + rhythm * .22 : 0;
}
