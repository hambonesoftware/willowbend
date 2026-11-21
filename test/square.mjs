import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { loadProgress, projects } from '../src/rebuild.js';
import { homePoint, villageHomes } from '../src/village-homes.js';
import { DAY_SECONDS } from '../src/life.js';

globalThis.localStorage = { getItem: () => null };
const save = loadProgress();
save.started = true;
Object.assign(save.life, { arrival: 'welcome', repair: 'old', batch: true, recipe: 'Honey apple buns' });
for (const name of ['cottage', 'bakery']) save.built[name] = { ...projects[name].needs };
save.inventory.apples = 3;
const server = await serve();
const url = (process.env.WB_URL ?? 'http://127.0.0.1:' + server.address().port).replace(/\/$/, '') + '/?test';
let browser, page;
try {
  browser = await launchBrowser();
  page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.setDefaultTimeout(60000);
  await page.addInitScript(data => {
    if (!localStorage.getItem('willowbend-rebuild-v1')) localStorage.setItem('willowbend-rebuild-v1', JSON.stringify(data));
  }, save);
  const errors = [];
  const listen = current => {
    current.on('pageerror', error => errors.push(error.message));
    current.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  };
  listen(page);
  await mkdir('test-results/square', { recursive: true });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.READY);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => WB.info().started && getComputedStyle(document.getElementById('splash')).opacity === '0');

  // Search the actual collision map, including new fences, old houses, furniture,
  // and the restored bakery. Data-only tests would miss a sealed garden entrance.
  const access = await page.evaluate(homes => {
    function reachable(target) {
      const step = .5, origin = [0, 4], key = (x, z) => x + ',' + z;
      const open = [{ x: 0, z: 0, score: Math.hypot(target[0], target[1] - 4) }], seen = new Set(['0,0']);
      for (let attempt = 0; open.length && attempt < 9000; attempt++) {
        open.sort((a, b) => a.score - b.score);
        const current = open.shift(), x = origin[0] + current.x * step, z = origin[1] + current.z * step;
        if (Math.hypot(x - target[0], z - target[1]) < .4) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nx = current.x + dx, nz = current.z + dz, px = origin[0] + nx * step, pz = origin[1] + nz * step;
          if (px < -25 || px > 23 || pz < -23 || pz > 23 || seen.has(key(nx, nz)) || !WB.walkable(px, pz)) continue;
          if (dx && dz && (!WB.walkable(x + dx * step, z) || !WB.walkable(x, z + dz * step))) continue;
          seen.add(key(nx, nz));
          open.push({ x: nx, z: nz, score: Math.hypot(px - target[0], pz - target[1]) });
        }
      }
      return false;
    }
    return homes.map(home => ({ name: home.name, gate: WB.walkable(...home.gate),
      entry: WB.walkable(...home.entry), connected: reachable(home.entry) }));
  }, (await page.evaluate(() => WB.info().district)).homes);
  console.log('Garden access', JSON.stringify(access));
  for (const home of access) assert.ok(home.gate && home.entry && home.connected, home.name + ' has a reachable, open entrance');
  for (const home of villageHomes) {
    assert.equal(await page.evaluate(([x, z]) => WB.walkable(x, z), homePoint(home, 3.5, -.9)), false, home.name + ' fence is tangible');
    const gate = homePoint(home, 0, home.front);
    const moved = await page.evaluate(([x, z, hx, hz]) => {
      WB.warp(x, z); WB.lookAt(hx, hz); WB.sim(.45, ['KeyW']);
      const state = WB.info(); return Math.hypot(state.x - x, state.z - z);
    }, [...gate, ...home.site]);
    assert.ok(moved > .35, 'player can walk through ' + home.name + ' gate');
    await page.evaluate(([x, z, hx, hz]) => { WB.warp(x, z); WB.lookAt(hx, hz); WB.zoom(12.5); WB.sim(.6); }, [...gate, ...home.site]);
    if (home.id === 'pip') assert.ok(await page.evaluate(() => WB.avatarVisible()), 'bakery does not obscure the player entering Pip’s garden');
    await page.screenshot({ path: 'test-results/square/' + home.id + '-garden.png' });
  }
  await page.evaluate(() => { WB.warp(0, 12); WB.lookAt(0, -2); WB.zoom(17); WB.sim(45); });
  const workers = await page.evaluate(() => WB.info().villagers.filter(v => v.activity).map(v => v.name));
  console.log('Residents reached work', workers.join(', '));
  assert.ok(workers.length >= 5, 'daily activities remain reachable through the new gardens');
  await page.screenshot({ path: 'test-results/square/square-day.png' });
  await page.evaluate(() => { WB.warp(-5, 3); WB.positionVillager('Mabel', -6.8, 3); WB.sim(.2); });
  await page.getByRole('button', { name: 'Talk', exact: true }).click();
  await page.evaluate(() => WB.sim(.7));
  assert.equal(await page.evaluate(() => WB.info().speaking), 'Mabel');
  assert.equal(await page.locator('dialog[open]').count(), 0, 'conversation stays in the world');
  await page.screenshot({ path: 'test-results/square/square-conversation.png' });
  await page.getByRole('button', { name: 'Goodbye', exact: true }).click();
  await page.evaluate(seconds => { WB.passTime(seconds); WB.warp(0, 12); WB.lookAt(0, -2); WB.zoom(17); WB.sim(60); }, DAY_SECONDS * .75 - await page.evaluate(() => WB.info().life.time));
  assert.equal(await page.evaluate(() => WB.info().day.phase), 'Night');
  const returned = await page.evaluate(() => {
    const state = WB.info();
    return state.district.homes.filter(home => home.id !== 'sewing').map(home => {
      const villager = state.villagers.find(v => v.name === home.name);
      return { name: home.name, distance: Math.hypot(villager.x - home.entry[0], villager.z - home.entry[1]) };
    });
  });
  console.log('Homeward routes', JSON.stringify(returned));
  for (const home of returned) assert.ok(home.distance < .4, home.name + ' reaches the doorstep at night');
  await page.screenshot({ path: 'test-results/square/square-night.png' });

  const saved = await page.evaluate(() => localStorage.getItem('willowbend-rebuild-v1'));
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  await mobile.addInitScript(data => localStorage.setItem('willowbend-rebuild-v1', data), saved);
  listen(mobile); await page.close(); page = mobile;
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.READY);
  await page.locator('#splash').tap();
  await page.evaluate(() => { WB.warp(-6.65, -5.99); WB.lookAt(-10, -9); WB.zoom(12.5); WB.sim(.8); });
  await page.screenshot({ path: 'test-results/square/garden-phone.png' });
  await page.getByRole('button', { name: 'Backpack', exact: true }).tap();
  assert.ok(await page.locator('#backpack').isVisible());
  assert.equal(await page.evaluate(() => WB.info().progress.inventory.apples), 3, 'existing backpack survives the scene upgrade and reload');
  assert.ok(await page.evaluate(() => WB.info().houseFinished), 'restored cottage survives reload');
  assert.deepEqual(errors, []);
  console.log('Six garden entrances, movement, daily routines, conversation, night, mobile, and saved progress passed.');
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: 'test-results/square/failure.png', timeout: 10000 }).catch(() => {});
  throw error;
} finally { await browser?.close(); server.close(); }
