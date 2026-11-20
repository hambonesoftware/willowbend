import { bakeryRoutine, bakeryStations } from '../src/bakery-routines.js';
import assert from 'node:assert/strict';
import { advanceDay, calendar, chapter, createLife, DAY_SECONDS, friendship, letters, remember } from '../src/life.js';
import { raceCourse, scheduledSpot, timingHit } from '../src/activities.js';
import { availableArc } from '../src/villager-stories.js';
import { complete, contribute, loadProgress, saveProgress } from '../src/rebuild.js';

const life = createLife();
assert.match(chapter(life, () => false)[0], /^I ·/);
assert.equal(calendar(life).phase, 'Morning');
assert.equal(advanceDay(life, DAY_SECONDS / 4), false);
assert.equal(calendar(life).phase, 'Afternoon');
assert.equal(advanceDay(life, DAY_SECONDS), true);
assert.equal(calendar(life).weather, 'Rain');
assert.equal(life.stock.wood, 5);
assert.equal(calendar({ ...life, time: DAY_SECONDS * 7 }).season, 'Summer');
remember(life, 'Pip', 'Shared a pastry.', 2);
remember(life, 'Pip', 'Shared a pastry.', 2);
assert.equal(friendship(life, 'Pip').points, 2);
const milestones = {
  Mabel: state => { state.life.scrapbook = true; },
  Bruno: state => { state.life.repair = 'old'; },
  Pip: state => { state.life.batch = true; },
  Dot: state => { state.life.lantern = 'found'; },
  Biscuit: state => { state.life.treasure = 'found'; },
  Fennel: state => { state.life.keeper = true; },
  Hazel: state => { state.errands.market = 'done'; },
  Reed: state => { state.life.catches = 1; },
  Clover: state => { state.life.batch = true; },
};
for (const [name, completeMilestone] of Object.entries(milestones)) {
  const state = { life: createLife(), errands: {} };
  assert.equal(availableArc(state, name), null);
  const bond = friendship(state.life, name);
  bond.points++;
  const firstScene = availableArc(state, name);
  assert.ok(firstScene?.every(Boolean), name);
  bond.stage++;
  assert.equal(availableArc(state, name), null, name);
  bond.points += 1;
  const middleScene = availableArc(state, name);
  assert.ok(middleScene?.every(Boolean), name);
  assert.notDeepEqual(firstScene, middleScene);
  bond.stage++;
  bond.points += 2;
  assert.equal(availableArc(state, name), null, name);
  completeMilestone(state);
  const endingScene = availableArc(state, name);
  assert.ok(endingScene?.every(Boolean), name);
  assert.notDeepEqual(middleScene, endingScene);
  bond.stage++;
  assert.equal(availableArc(state, name), null, name);
}
assert.equal(raceCourse.length, 4);
assert.equal(timingHit(2.9, .89), true);
assert.equal(timingHit(1.6, .89), false);
assert.notDeepEqual(scheduledSpot({ name: 'Pip', home: [11, 13] }, 'Morning', true, false),
  scheduledSpot({ name: 'Pip', home: [11, 13] }, 'Morning', false, false));
assert.deepEqual(scheduledSpot({ name: 'Reed', home: [-16, 37] }, 'Night', true, false), [-16, 37]);

for (const [name, station] of Object.entries(bakeryStations)) {
  const villager = { name, x: station.spot[0], z: station.spot[1], home: [11, 13] };
  assert.deepEqual(scheduledSpot(villager, 'Morning', true, false), station.spot);
  assert.deepEqual(scheduledSpot(villager, 'Afternoon', true, false), station.spot);
  assert.ok(bakeryRoutine(villager, { phase: 'Morning' }, true, false, false));
  assert.equal(bakeryRoutine(villager, { phase: 'Morning' }, false, false, false), null);
  assert.equal(bakeryRoutine(villager, { phase: 'Morning' }, true, false, true), null);
  assert.equal(bakeryRoutine(villager, { phase: 'Morning' }, true, true, false), null);
  assert.equal(bakeryRoutine(villager, { phase: 'Evening' }, true, false, false), null);
  assert.deepEqual(scheduledSpot(villager, 'Night', true, false), villager.home);
}

Object.assign(life, { arrival: 'welcome', repair: 'old', batch: true });
assert.match(chapter(life, () => false)[0], /^II ·/);
Object.assign(life, { scrapbook: true, lantern: 'found', echo: true, keeper: true });
assert.match(chapter(life, () => false)[0], /^III ·/);
assert.match(chapter(life, () => true)[0], /^IV ·/);
life.festival = 'share';
assert.match(chapter(life, () => true)[0], /After the Lanterns/);
assert.deepEqual(letters(life).map(note => note[0]), ['postcard', 'welcome', 'latch', 'breakfast', 'keeper', 'thanks']);

const legacy = { version: 1, started: true, inventory: { planks: 1 }, photos: { cottage: 'legacy-photo' },
  built: { cottage: { planks: 3 } }, gathered: ['creek'] };
let saved = JSON.stringify(legacy);
globalThis.localStorage = { getItem: () => saved, setItem: (key, data) => { saved = data; } };
const progress = loadProgress();
assert.equal(progress.life.harvests.creek, 0);
assert.equal(progress.photos.cottage, 'legacy-photo');
assert.equal(complete(progress, 'cottage'), true);
assert.deepEqual(contribute(progress, 'cottage'), []);
assert.equal(progress.inventory.planks, 1);
progress.life = life;
assert.equal(saveProgress(progress), true);
assert.deepEqual(loadProgress().life, life);
console.log('Life systems, chapter gates, timing, schedules, and save migration passed.');
