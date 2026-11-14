import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { DAY_SECONDS, locations } from '../src/life.js';
import { raceCourse } from '../src/activities.js';

const server = await serve();
let browser, page;
try {
  browser = await launchBrowser();
  page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.setDefaultTimeout(45000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = (process.env.WB_URL ?? 'http://127.0.0.1:' + server.address().port).replace(/\/\s*$/, '') + '/?test';
  const info = () => page.evaluate(() => WB.info());
  const open = async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.READY);
    await page.keyboard.press('Enter');
    await page.evaluate(() => WB.sim(.1));
  };
  const go = async ([x, z]) => page.evaluate(([x, z]) => {
    WB.warp(x, z);
    WB.sim(.08);
  }, [x, z]);
  const close = async () => {
    if (await page.locator('#journal').isVisible()) await page.locator('#journal').getByRole('button', {name:'Close'}).click();
    if (await page.locator('#talk-goodbye').isVisible()) await page.locator('#talk-goodbye').click();
    await page.locator('#c').focus();
  };
  const talk = async name => {
    await close();
    await page.evaluate(name => {
      WB.warp(0, 23);
      for (const villager of WB.info().villagers) {
        if (villager.name !== name && Math.hypot(villager.x, villager.z - 23) < 3) WB.positionVillager(villager.name, -8, 23);
      }
      WB.positionVillager(name, 0, 23);
      WB.sim(.08);
    }, name);
    await page.keyboard.press('Space');
    assert.equal((await info()).speaking, name);
    await page.getByRole('button', {name:'Ask a question',exact:true}).click();
  };
  const choose = async label => {
    const button = page.getByRole('button', { name: label, exact: true });
    if (!(await button.isVisible())) await page.getByRole('button', { name: 'More topics' }).click();
    await button.click();
  };
  const action = async point => {
    await close();
    await go(point);
    await page.keyboard.press('Space');
  };
  const pass = time => page.evaluate(time => WB.passTime(time), time);

  await open();
  const walkable = await page.evaluate(spots => Object.fromEntries(Object.entries(spots).map(([name, point]) =>
    [name, WB.walkable(...point)])), locations);
  for (const [name, accessible] of Object.entries(walkable)) assert.ok(accessible, name + ' activity is on walkable ground');
  const starter = await info();
  const mabel = starter.villagers.find(v => v.name === 'Mabel');
  assert.ok(Math.hypot(mabel.x - starter.x, mabel.z - starter.z) < 3);
  await page.keyboard.press('Space');
  assert.equal((await info()).speaking, 'Mabel');
  await page.getByRole('button', {name:'Ask a question',exact:true}).click();
  const frozen = (await info()).life.time;
  await page.evaluate(() => WB.sim(.5));
  assert.equal((await info()).life.time, frozen);
  await choose('Show the old postcard');
  assert.ok((await info()).life.arrival);
  await close();
  const approach = await page.evaluate(() => {
    WB.warp(0, 19);
    WB.positionVillager('Biscuit', 3.8, 19);
    WB.sim(1);
    return { invitation: WB.info().life.invitedRaceDay, chatter: document.querySelector('#chatter').textContent };
  });
  assert.equal(approach.invitation, 1);
  assert.match(approach.chatter, /Want to race/);
  await talk('Pip');
  await choose('Help Pip pick up the apples');
  assert.equal((await info()).progress.inventory.apples, 1);
  await talk('Pip');
  await choose('Bake with Pip and Clover');
  assert.equal(await page.locator('#journal').evaluate(el => el.matches('.scene-sheet') && !el.matches(':modal')), true);
  await page.getByRole('button', { name: 'Tart-apple turnovers' }).click();
  await page.evaluate(() => WB.sim(.8));
  await page.keyboard.press('Space');
  assert.equal((await info()).life.batch, true);
  await talk('Bruno');
  await choose('Fix the latch with Bruno');
  await page.getByRole('button', { name: 'Keep the old latch' }).click();
  const repaired = await info();
  assert.equal(repaired.life.firstHelp, 'Pip');
  assert.equal(repaired.life.repair, 'old');
  assert.equal(repaired.houseFinished, true);
  assert.equal(repaired.progress.inventory.wood, 0);
  await talk('Pip');
  assert.match(await page.locator('#speech-reply').textContent(), /tart-apple turnovers/);
  await close();
  console.log('Arrival, independent player choice, pastry timing, repair, and remembered recipe passed.');

  await action(locations.plaza);
  await page.getByRole('button', { name: 'Take planks' }).click();
  assert.equal((await info()).progress.inventory.planks, 1);
  await page.getByRole('button', { name: 'Share planks' }).click();
  assert.equal((await info()).progress.inventory.planks, 0);
  await page.getByRole('button', { name: 'Read journal' }).click();
  await page.getByText('Mabel’s welcome note', { exact: false }).click();
  await page.waitForFunction(() => WB.info().life.lettersRead.includes('welcome'));
  await page.getByRole('button', { name: 'Turn music on' }).click();
  await page.getByRole('button', { name: 'Turn music off' }).click();
  await action(locations.home);
  await page.getByRole('button', { name: 'Change outfit' }).click();
  await page.getByRole('button', { name: 'Decorate the cottage' }).click();
  await page.getByRole('button', { name: 'Rest until morning' }).click();
  assert.ok((await info()).life.time >= DAY_SECONDS);
  assert.equal((await info()).life.home.outfit, 'Berry');
  await action(locations.garden);
  await action(locations.garden);
  await pass(46);
  await action(locations.garden);
  assert.equal((await info()).progress.inventory.apples, 4);
  await action(locations.pond);
  assert.match(await page.locator('#activity').textContent(), /Reel in/);
  assert.equal(await page.locator('#activity').isVisible(), true);
  const reel = await page.evaluate(() => {
    const meter = document.querySelector('#activity meter');
    WB.sim((1.34 - meter.value + meter.max) % meter.max);
    const state = { timing: meter.value, label: document.querySelector('#talk').getAttribute('aria-label'), prompt: document.querySelector('#prompt').textContent };
    document.querySelector('#talk').click();
    return state;
  });
  assert.equal((await info()).life.catches, 1, JSON.stringify(reel));
  await talk('Biscuit');
  await choose('Race to the pond trail');
  for (const point of raceCourse) await go(point);
  assert.notEqual((await info()).life.raceBest, null);
  await talk('Biscuit');
  await choose('Ask why Biscuit races');
  await talk('Biscuit');
  await choose('Ask for a treasure hunt');
  await action([-2, -29]);
  assert.equal((await info()).life.treasure, 'found');
  console.log('Home changes, rest, gardening, fishing, race, and treasure passed.');

  await talk('Mabel');
  await choose('Look through the Lantern Night photos');
  await action([-7, 25]);
  assert.ok((await info()).progress.photos.includes('scrapbook'));
  await talk('Dot');
  await choose('Meet at the Elder Tree');
  await talk('Pip');
  assert.match(await page.locator('#speech-reply').textContent(), /meeting at the Elder Tree/);
  await action(locations.tree);
  assert.equal((await info()).life.lantern, 'found');
  await close();
  await talk('Fennel');
  await choose('Show Fennel the lantern mark');
  await action(locations.cave);
  await action(locations.tower);
  assert.equal((await info()).life.keeper, true);
  assert.match(await page.locator('#journal-content').textContent(), /Rowan/);
  await close();
  await action([46, -22]);
  assert.equal((await info()).progress.inventory.wood, 3);
  await action([46, -22]);
  assert.equal((await info()).progress.inventory.wood, 3);
  await pass(DAY_SECONDS * 3 / 4);
  assert.equal((await info()).day.phase, 'Night');
  await pass(DAY_SECONDS / 4);
  assert.equal((await info()).day.phase, 'Morning');
  await action([46, -22]);
  assert.equal((await info()).progress.inventory.wood, 6);
  await action(locations.bench);
  await page.getByRole('button', { name: 'Cut 3 planks' }).click();
  assert.equal((await info()).progress.inventory.wood, 3);
  await action([52, -27]);
  await action(locations.bakery);
  assert.ok((await info()).progress.photos.includes('bakery'));
  assert.ok((await info()).life.contributions.bakery);
  await action(locations.bench);
  await page.getByRole('button', { name: 'Make a lantern' }).click();
  await action([-58, -24]);
  await action(locations.tower);
  await action(locations.plaza);
  const beforeFestival = await page.evaluate(() => localStorage.getItem('willowbend-rebuild-v1'));
  await page.getByRole('button', { name: 'Give each neighbor a lantern' }).click();
  assert.equal((await info()).life.festival, 'share');
  assert.ok((await info()).progress.photos.includes('lantern-night'));
  await open();
  const result = await info();
  assert.equal(result.life.festival, 'share');
  assert.equal(result.life.recipe, 'Tart-apple turnovers');
  assert.equal(result.life.home.outfit, 'Berry');
  assert.ok(result.progress.photos.includes('lantern-night'));
  assert.match(result.life.bonds.Pip.memories.join(' '), /turnovers/);
  await talk('Mabel');
  assert.match(await page.locator('#speech-reply').textContent(), /gave Hazel/);
  await close();
  await pass(DAY_SECONDS / 2);
  await action(locations.plaza);
  await page.getByRole('button', { name: 'Stay a while' }).click();
  assert.equal((await info()).festivalActive, true);

  // Replay the festival decision from the same save on a mobile viewport.
  const alternate = await browser.newPage({ viewport: { width: 390, height: 720 }, isMobile: true, hasTouch: true });
  await alternate.addInitScript(saved => localStorage.setItem('willowbend-rebuild-v1', saved), beforeFestival);
  alternate.on('pageerror', error => errors.push(error.message));
  await page.close();
  page = alternate;
  await open();
  await go(locations.plaza);
  await page.locator('#talk').tap();
  await page.getByRole('button', { name: 'Hang Rowan’s lantern at the well' }).tap();
  assert.equal((await info()).life.festival, 'remember');
  assert.ok((await info()).progress.photos.includes('lantern-night'));
  assert.deepEqual(errors, []);
  console.log('Mystery, task-aware greetings, renewable deposits, shared repairs, both festival endings, and reload passed.');
} catch (error) {
  if (page && !page.isClosed()) {
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/story-failure.png', timeout: 10000 }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  server.close();
}
