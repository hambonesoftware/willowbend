import * as THREE from 'three';
import { at, ball, box, cap, cyl, torus } from './gfx.js';
import { storyMaterial } from './art-materials.js';

const linen = storyMaterial(0xdfd2ad, 'cloth');
const timber = storyMaterial(0xab8d63, 'wood');
const green = storyMaterial(0x7d9064, 'cloth');
const clay = storyMaterial(0xb3836d, 'plaster');
const ink = storyMaterial(0x625a4c);

export function dressVillager(c, name) {
  if (c.baking) return;
  const prop = new THREE.Group();
  prop.position.set(0, .68, .55);
  const tool = new THREE.Group();
  prop.add(tool);
  if (name === 'Mabel') {
    const basket = cyl(.23, .18, .19, timber, 0, 12);
    const handle = torus(.22, .022, timber, 0, Math.PI);
    prop.add(basket, at(handle, 0, .12, 0));
    for (let i = 0; i < 5; i++) prop.add(at(ball(.065, i % 2 ? 0xd2b08f : 0xc6a1a3, 0, 8, 6), (i - 2) * .07, .18, .02));
    const shawl = torus(.30, .065, storyMaterial(0x9f9380, 'cloth'), .005);
    shawl.rotation.x = Math.PI / 2;
    c.body.add(at(shawl, 0, 1.01, -.015));
  }
  if (name === 'Bruno') {
    prop.add(at(box(.66, .055, .30, timber, 0, .02), -.03, .03, 0));
    c.body.add(at(box(.4, .42, .045, storyMaterial(0xae9270, 'cloth'), .006, .04), 0, .66, .36));
  }
  if (name === 'Dot') {
    tool.add(at(cyl(.14, .12, .21, green, 0, 12), 0, 0, 0));
    const spout = cyl(.025, .035, .24, green, 0, 8);
    spout.rotation.z = -.9;
    tool.add(at(spout, .18, .05, 0), at(torus(.11, .022, green, 0), -.16, .05, 0));
  }
  if (name === 'Biscuit') {
    tool.add(ball(.14, storyMaterial(0xc59869, 'cloth'), .008, 14, 10));
    const scarf = torus(.29, .05, storyMaterial(0x849378, 'cloth'), .006);
    scarf.rotation.x = Math.PI / 2;
    c.body.add(at(scarf, 0, 1.02, 0));
  }
  if (name === 'Fennel') {
    prop.add(at(ball(.09, storyMaterial(0x8e9b89, 'masonry'), 0, 10, 8), -.19, .10, .03));
    tool.add(at(torus(.11, .022, ink, 0), .13, .18, 0), at(cyl(.018, .018, .18, timber, 0, 6), .13, 0, 0));
    const strap = box(.06, .55, .035, timber, 0, .01);
    strap.rotation.z = -.5;
    c.body.add(at(strap, .03, .81, .35));
  }
  if (name === 'Hazel') {
    prop.add(at(box(.4, .05, .34, timber, .005, .025), 0, .05, 0),
      at(box(.34, .012, .29, linen, 0, .01), 0, .084, 0));
    tool.add(at(cyl(.012, .012, .22, ink, 0, 6), .11, .13, 0));
    c.body.add(at(box(.43, .41, .04, linen, .006, .04), 0, .66, .36));
  }
  if (name === 'Reed') {
    tool.add(at(cyl(.065, .07, .18, ink, .005, 12).rotateX(Math.PI / 2), -.08, .08, 0),
      at(cyl(.065, .07, .18, ink, .005, 12).rotateX(Math.PI / 2), .08, .08, 0),
      at(box(.17, .04, .07, timber, 0), 0, .08, -.02));
    const badge = ball(.07, clay, 0, 10, 8);
    badge.scale.z = .3;
    c.body.add(at(badge, -.18, .9, .34));
  }
  c.body.add(prop);
  prop.visible = false;
  c.dailyWork = { prop, tool, blend: 0 };
}

export function animateVillagerWork(c, dt, t, activity, reducedMotion) {
  const work = c.dailyWork;
  if (!work) return;
  work.blend += ((activity ? 1 : 0) - work.blend) * Math.min(1, dt * 12);
  work.prop.visible = work.blend > .05;
  if (!work.prop.visible) return;
  const blend = work.blend;
  const rhythm = reducedMotion ? 0 : Math.sin(t * 2.6 + c.ph);
  work.prop.scale.setScalar(blend);
  work.prop.position.y = activity === 'watch' ? 1.5 : .68;
  work.tool.position.y = activity === 'play' ? .2 + Math.max(0, rhythm) * .24 : 0;
  work.tool.rotation.z = activity === 'water' ? -.18 + rhythm * .07 : activity === 'ledger' ? rhythm * .15 : 0;
  c.arms[-1].rotation.x = -blend * (activity === 'watch' ? 1.9 : .9);
  c.arms[1].rotation.x = -blend * (activity === 'watch' ? 1.9 : .95 + rhythm * .09);
  c.arms[-1].rotation.z = -.2;
  c.arms[1].rotation.z = .2;
  if (activity === 'woodwork') c.arms[1].rotation.x = -(1.15 + rhythm * .4) * blend;
  c.head.rotation.x += (activity === 'watch' ? -.04 : .1) * blend;
}
