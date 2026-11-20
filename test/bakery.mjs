import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { loadProgress, projects } from '../src/rebuild.js';
import { DAY_SECONDS } from '../src/life.js';

const server = await serve();
const url = (process.env.WB_URL ?? 'http://127.0.0.1:' + server.address().port).replace(/\/$/, '') + '/?test';
globalThis.localStorage = { getItem: () => null };
const save = loadProgress();
save.started = true;
Object.assign(save.life, { arrival: 'welcome', repair: 'old', batch: true, recipe: 'Honey apple buns' });
save.inventory.apples = 1;
for (const name of ['cottage', 'bakery']) save.built[name] = { ...projects[name].needs };
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
  const info = () => page.evaluate(() => WB.info());
  const button = name => page.getByRole('button', { name, exact: true });
  async function open() {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.READY);
    await page.keyboard.press('Enter');
  }
  await mkdir('test-results', { recursive: true });
  await open();
  const arrived = await page.evaluate(() => {
    WB.warp(7, 1);
    WB.zoom(17);
    WB.lookAt(7, 8.5);
    WB.sim(32);
    return WB.info();
  });
  const crew = arrived.villagers.filter(v => ['Pip', 'Clover'].includes(v.name));
  console.log('Bakery crew', JSON.stringify(crew));
  assert.equal(crew.find(v => v.name === 'Pip').activity, 'knead');
  assert.equal(crew.find(v => v.name === 'Clover').activity, 'mix');
  assert.ok(crew.every(v => v.carrying));
  await page.screenshot({ animations: 'disabled', path: 'test-results/bakery-day.png' });
  assert.equal(await page.evaluate(() => WB.walkable(7, 5.8)), true);
  await page.evaluate(() => {
    WB.warp(5.2, 3.5);
    WB.lookAt(7, 8.5);
    WB.sim(.6, ['KeyW']);
  });
  const walking = await info();
  assert.ok(walking.z > 3.5, 'walking toward the storefront crosses the courtyard');
  await page.evaluate(() => {
    WB.warp(4.9, 4.5);
    WB.sim(.2);
  });
  await button('Talk').click();
  assert.equal((await info()).speaking, 'Pip');
  await page.evaluate(() => WB.sim(.7));
  const talking = (await info()).villagers.find(v => v.name === 'Pip');
  assert.equal(talking.activity, null);
  assert.equal(talking.carrying, false);
  await page.evaluate(() => WB.sim(1.5));
  const conversation = await info();
  const speaker = conversation.villagers.find(v => v.name === 'Pip');
  const center = [(conversation.x + speaker.x) / 2, (conversation.z + speaker.z) / 2];
  assert.ok(conversation.villagers.filter(v => v.name !== 'Pip').every(v => Math.hypot(v.x - center[0], v.z - center[1]) > 2.1),
    'neighbors leave room for the conversation');
  await page.screenshot({ animations: 'disabled', path: 'test-results/bakery-talk.png' });
  await button('Exchange items').click();
  await page.locator('#exchange').getByRole('button', { name: 'Give', exact: true }).click();
  assert.equal((await info()).progress.inventory.apples, 0);
  await button('Goodbye').click();
  await page.evaluate(() => WB.sim(1));
  assert.equal((await info()).villagers.find(v => v.name === 'Pip').activity, 'knead');

  await page.evaluate(seconds => { WB.passTime(seconds); WB.warp(7, 1); WB.lookAt(7, 8.5); WB.sim(1.5); }, DAY_SECONDS / 2);
  assert.equal((await info()).day.phase, 'Evening');
  await page.screenshot({ animations: 'disabled', path: 'test-results/bakery-evening.png' });
  await page.evaluate(() => WB.sim(25));
  assert.ok((await info()).villagers.filter(v => ['Pip', 'Clover'].includes(v.name)).every(v => !v.activity));

  await page.evaluate(seconds => { WB.passTime(seconds); WB.warp(7, 1); WB.lookAt(7, 8.5); WB.sim(32); }, DAY_SECONDS - (await info()).life.time % DAY_SECONDS);
  const persisted = await page.evaluate(() => localStorage.getItem('willowbend-rebuild-v1'));
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  await mobile.addInitScript(data => {
    if (!localStorage.getItem('willowbend-rebuild-v1')) localStorage.setItem('willowbend-rebuild-v1', data);
  }, persisted);
  mobile.on('pageerror', error => errors.push(error.message));
  await page.close();
  page = mobile;
  await open();
  await page.evaluate(() => { WB.warp(7, 1); WB.zoom(14); WB.lookAt(7, 8.5); WB.sim(32); });
  await page.screenshot({ animations: 'disabled', path: 'test-results/bakery-phone.png' });
  await button('Backpack').tap();
  assert.equal(await page.locator('#backpack').isVisible(), true);
  await page.screenshot({ animations: 'disabled', path: 'test-results/bakery-phone-backpack.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).tap();
  assert.equal((await info()).progress.inventory.apples, 0);
  assert.match((await info()).life.bonds.Pip.memories.join(' '), /brought apples/);
  assert.deepEqual(errors, []);
  console.log('Bakery routines, walking access, conversation interruption, gift persistence, evening departures, and mobile reduced motion passed.');
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ animations: 'disabled', path: 'test-results/bakery-failure.png', timeout: 10000 }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  server.close();
}
