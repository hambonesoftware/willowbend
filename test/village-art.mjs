import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { loadProgress, projects } from '../src/rebuild.js';
import { DAY_SECONDS } from '../src/life.js';

const server = await serve();
const url = 'http://127.0.0.1:' + server.address().port + '/?test';
globalThis.localStorage = { getItem: () => null };
const save = loadProgress();
save.started = true;
Object.assign(save.life, { arrival: 'welcome', repair: 'old', batch: true, recipe: 'Honey apple buns', garden: { planted: 0, watered: true } });
Object.assign(save.plots, { lodge: 0, workshop: 1, bakehouse: 2 });
save.opening = true;
Object.assign(save.jobs, { Pip: 'delivered', Bruno: 'delivered' });
Object.assign(save.errands, { market: 'done', orchard: 'done', pond: 'done' });
for (const [name, project] of Object.entries(projects)) if (project.needs) save.built[name] = { ...project.needs };
save.inventory.apples = 1;
let browser, page;
try {
  browser = await launchBrowser();
  page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.setDefaultTimeout(60000);
  await page.addInitScript(data => {
    if (!localStorage.getItem('willowbend-rebuild-v1')) localStorage.setItem('willowbend-rebuild-v1', JSON.stringify(data));
  }, save);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('test-results', { recursive: true });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.READY);
  await page.keyboard.press('Enter');
  await page.evaluate(() => { WB.warp(0, 14); WB.sim(45); });
  const crew = await page.evaluate(() => WB.info().villagers);
  console.log('Villager activities', JSON.stringify(crew));
  const working = crew.filter(v => v.activity);
  assert.ok(working.length >= 5, 'residents reach their daytime activities');
  await page.evaluate(() => { WB.warp(-5, 3); WB.sim(.15); });
  await page.getByRole('button', { name: 'Talk', exact: true }).click();
  assert.equal(await page.evaluate(() => WB.info().speaking), 'Mabel');
  await page.evaluate(() => WB.sim(.7));
  assert.equal(await page.evaluate(() => WB.info().villagers.find(v => v.name === 'Mabel').carrying), false);
  await page.screenshot({ animations: 'disabled', path: 'test-results/village-conversation.png' });
  await page.getByRole('button', { name: 'Goodbye', exact: true }).click();
  await page.evaluate(() => WB.sim(.7));
  assert.equal(await page.evaluate(() => WB.info().villagers.find(v => v.name === 'Mabel').activity), 'flowers');
  const views = [
    ['village-square', 0, 18, 0, 0, 20],
    ['village-homes', -4, 1.5, -13, -8, 18],
    ['market', -1, 26, -7, 23, 16],
    ['farm', -10, 21, -21, 21, 20],
    ['orchard', -38, -2, -38, 9, 19],
    ['pond', -18, 44, -34, 42, 20],
    ['bridge', 22, -29, 31, -21, 20],
    ['meadow', 51, -24, 57, -32, 21],
    ['elder-tree', -10, -76, -12, -91, 23],
    ['cave', -78, -34, -91, -38, 21],
    ['watchtower', 62, -29, 76, -38, 23],
  ];
  for (const [name, x, z, lx, lz, zoom] of views) {
    await page.evaluate(([x, z, lx, lz, zoom]) => {
      if (!WB.walkable(x, z)) throw new Error('Blocked viewpoint at ' + x + ', ' + z);
      WB.warp(x, z); WB.lookAt(lx, lz); WB.zoom(zoom); WB.sim(3.5);
    }, [x, z, lx, lz, zoom]);
    await page.screenshot({ animations: 'disabled', path: 'test-results/' + name + '.png' });
  }
  await page.evaluate(seconds => {
    WB.passTime(seconds); WB.warp(0, 18); WB.lookAt(0, 0); WB.zoom(20); WB.sim(2);
  }, DAY_SECONDS * .75 - (await page.evaluate(() => WB.info().life.time)));
  assert.equal(await page.evaluate(() => WB.info().day.phase), 'Night');
  await page.screenshot({ animations: 'disabled', path: 'test-results/village-night.png' });
  const saved = await page.evaluate(() => localStorage.getItem('willowbend-rebuild-v1'));
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  await mobile.addInitScript(data => localStorage.setItem('willowbend-rebuild-v1', data), saved);
  mobile.on('pageerror', error => errors.push(error.message));
  await page.close();
  page = mobile;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.READY);
  await page.locator('#splash').tap();
  await page.evaluate(() => { WB.warp(0, 18); WB.lookAt(0, 0); WB.zoom(17); WB.sim(1.3); });
  await page.screenshot({ animations: 'disabled', path: 'test-results/village-phone-night.png' });
  await page.getByRole('button', { name: 'Backpack', exact: true }).tap();
  assert.equal(await page.locator('#backpack').isVisible(), true);
  assert.equal(await page.evaluate(() => WB.info().progress.inventory.apples), 1);
  assert.deepEqual(errors, []);
  console.log('Town, homes, market, farm, orchard, pond, bridge, meadow, Elder Tree, cave, tower, and night views passed without runtime errors.');
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: 'test-results/village-failure.png', timeout: 10000 }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  server.close();
}
