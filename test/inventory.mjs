import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const server = await serve();
const url = (process.env.WB_URL ?? 'http://127.0.0.1:' + server.address().port).replace(/\/$/, '') + '/?test';
let browser, page;
try {
  browser = await launchBrowser();
  page = await browser.newPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const button = (name, root = page) => root.getByRole('button', { name, exact: true });
  const info = () => page.evaluate(() => WB.info());

  async function start() {
    await page.goto(url);
    await page.waitForFunction(() => window.READY);
    await page.locator('#splash').tap();
  }
  async function visitPip() {
    await page.evaluate(() => {
      WB.warp(1, 23);
      WB.positionVillager('Mabel', -6, 23);
      WB.positionVillager('Pip', 2.2, 22.1);
      WB.positionVillager('Hazel', -6, 26);
      WB.sim(.12);
    });
    await button('Talk').tap();
    assert.equal((await info()).speaking, 'Pip');
  }

  await start();
  await button('Talk').tap();
  await button('Ask a question').tap();
  await button('Show the old postcard').tap();
  await button('Goodbye').tap();
  await visitPip();
  await button('Ask a question').tap();
  await button('More topics').tap();
  await button('Help Pip pick up the apples').tap();
  assert.equal((await info()).progress.inventory.apples, 1);
  await button('Backpack').tap();
  const bag = page.locator('#backpack');
  assert.equal((await info()).speaking, 'Pip');
  assert.equal(await bag.locator('[data-item=apples] img').evaluate(el => el.complete && el.naturalWidth > 0), true);
  const box = await bag.boundingBox();
  assert.ok(box.y > 200 && box.y + box.height >= 843 && box.width === 390, 'phone backpack fills the bottom edge');
  await button('Tools', bag).tap();
  assert.match(await bag.innerText(), /Bruno can lend you tools/);
  await button('Supplies', bag).tap();
  await button('Apples, 1 available', bag).tap();
  assert.match(await bag.locator('#backpack-detail').innerText(), /Orchard fruit/);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/inventory-phone.png' });
  await button('Give to Pip', bag).tap();
  const exchange = page.locator('#exchange');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await exchange.getByRole('group', { name: 'Quantity' }).isVisible(), false);
  await button('Give', exchange).tap();
  assert.equal((await info()).progress.inventory.apples, 0);
  assert.match(await page.locator('#item-receipt').innerText(), /−1 Apples/);
  assert.equal(await page.locator('#item-flight').isVisible(), false);
  assert.match(await page.locator('#speech-reply').innerText(), /next tray/);
  await start();
  await visitPip();
  assert.equal((await info()).progress.inventory.apples, 0);
  assert.match(await page.locator('#speech-reply').innerText(), /remember the apple/);

  await button('Exchange items').tap();
  await button('Apples, 3 available', exchange).tap();
  await button('Increase quantity', exchange).tap();
  await page.screenshot({ path: 'test-results/exchange-phone.png' });
  assert.equal(await exchange.locator('#exchange-count').innerText(), '2');
  assert.match(await exchange.locator('#exchange-status').innerText(), /· 2$/);
  await button('Decrease quantity', exchange).tap();
  assert.equal(await exchange.locator('#exchange-count').innerText(), '1');
  await button('All', exchange).tap();
  assert.equal(await exchange.locator('#exchange-count').innerText(), '3');
  await button('Cancel', exchange).tap();
  assert.equal((await info()).progress.inventory.apples, 0);
  await button('Exchange items').tap();
  await button('Apples, 3 available', exchange).tap();
  await button('All', exchange).tap();
  await button('Take', exchange).tap();
  assert.equal((await info()).progress.inventory.apples, 3);
  await button('Exchange items').tap();
  await button('Take supplies', exchange).tap();
  assert.equal(await exchange.locator('[data-item=apples]').count(), 0);
  await page.setViewportSize({ width: 844, height: 390 });
  await button('Cancel', exchange).tap();
  await button('Goodbye').tap();
  await button('Backpack').tap();
  const landscape = await bag.boundingBox();
  assert.ok(landscape.x > 410, 'wide backpack stays to the side');
  assert.ok(landscape.y + landscape.height <= 390, 'wide backpack stays inside the viewport');
  await page.screenshot({ path: 'test-results/inventory-wide.png' });
  await button('Close', bag).tap();
  await page.evaluate(() => {
    WB.warp(0, 4);
    WB.sim(.12);
  });
  await page.locator('#talk').tap();
  await button('Take planks').tap();
  await button('Take planks').tap();
  await button('Close', page.locator('#journal')).tap();
  await page.evaluate(() => {
    WB.warp(1, 23);
    WB.positionVillager('Pip', -6, 23);
    WB.positionVillager('Bruno', 2.2, 22.1);
    WB.sim(.12);
  });
  await button('Talk').tap();
  await button('Exchange items').tap();
  await button('Planks, 2 available', exchange).tap();
  await button('All', exchange).tap();
  await button('Give', exchange).tap();
  assert.match(await page.locator('#speech-reply').innerText(), /shelf Hazel asked for/);
  const afterGift = await info();
  assert.equal(afterGift.life.marketShelf, true);
  assert.equal(afterGift.progress.inventory.planks, 0);
  assert.match(afterGift.life.bonds.Bruno.memories.join(' '), /market shelf/);
  assert.deepEqual(errors, []);
  console.log('Phone pickup, illustrated backpack, gift, remembered response after reload, reduced motion, quantity controls, cancellation, villager stock, and the market shelf gift passed.');
} catch (error) {
  if (page && !page.isClosed()) {
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/inventory-failure.png', timeout: 10000 }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  server.close();
}
