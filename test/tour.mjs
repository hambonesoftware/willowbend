// Plays the game in headless Edge: the splash, walking, talking, the bridge, the river, every
// landmark, and the touch joystick on a phone-sized screen. Screenshots land in test-results/.
import fs from 'node:fs';
import path from 'node:path';
import { serve, ROOT } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const OUT = path.join(ROOT, 'test-results');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const srv = await serve();
const BASE = `http://127.0.0.1:${srv.address().port}/?test`;
const browser = await launchBrowser();
let fails = 0, passes = 0;
const check = (ok, msg, extra = '') => { if (ok) passes++; else fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}${extra ? '  ' + extra : ''}`); };

async function open(opts) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.READY, null, { timeout: 180000 });
  return { page, context, errors };
}
const info = page => page.evaluate(() => window.WB.info());
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

{
  const { page, context, errors } = await open({ viewport: { width: 1280, height: 720 } });
  const t0 = await info(page);
  console.log('scene:', JSON.stringify({ calls: t0.calls, tris: t0.tris, stats: t0.stats }));
  await shot(page, '01-splash');
  check(!t0.started, 'opens on the splash screen');

  await page.keyboard.press('Enter');
  await page.evaluate(() => window.WB.sim(2.4));
  let s = await info(page);
  check(s.started, 'any key starts the game');
  await shot(page, '02-village');

  const before = s;
  await page.evaluate(() => window.WB.sim(3, ['KeyW']));
  s = await info(page);
  check(s.z < before.z - 6, 'W walks the kid up the road', `z ${before.z} -> ${s.z}`);
  check(s.zone === 'Willowbend Village', 'the zone sign names the village', s.zone);
  const walkedVillagers = s.villagers.filter(v => v.state !== 'pose').length;
  check(walkedVillagers === 6, 'villagers leave their opening poses');
  await shot(page, '03-walking');

  await page.evaluate(() => window.WB.sim(0.6, ['KeyW']));
  const walkSpeed = (await info(page)).speed;
  await page.evaluate(() => { window.WB.warp(1, 28); window.WB.lookAt(1, 60); window.WB.sim(0.6, ['KeyW', 'ShiftLeft']); });
  const runSpeed = (await info(page)).speed;
  check(runSpeed > walkSpeed * 1.5, 'Shift runs', `walk ${walkSpeed}, run ${runSpeed}`);

  // talking
  const m = await page.evaluate(() => window.WB.villager('Mabel'));
  await page.evaluate(([x, z]) => { window.WB.warp(x, z + 1.8); window.WB.lookAt(x, z); window.WB.sim(0.3); }, [m.x, m.z]);
  s = await info(page);
  check(s.near === 'Mabel', 'walking up to Mabel offers a chat', s.near);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.WB.sim(0.4));
  s = await info(page);
  check(s.speaking === 'Mabel', 'Space starts the chat');
  await shot(page, '04-talk');

  // the bridge carries you over the creek; the creek stops you anywhere else
  await page.evaluate(() => { window.WB.warp(19.5, -21); window.WB.lookAt(19.5, -30); window.WB.sim(0.1); });
  let mid = null;
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.WB.sim(0.5, ['KeyD']));
    const p = await info(page);
    if (Math.abs(p.x - 31) < 2.5) mid = p;
  }
  s = await info(page);
  check(s.x > 40, 'the bridge crosses Bramble Creek', `x ${s.x}`);
  check(mid && mid.y > 0.7, 'the kid climbs the arch of the bridge', `deck y ${mid?.y}`);
  await page.evaluate(() => { window.WB.warp(24, -40); window.WB.lookAt(24, -60); window.WB.sim(0.1); });
  await page.evaluate(() => window.WB.sim(5, ['KeyD']));
  s = await info(page);
  const h = await page.evaluate(([x, z]) => window.WB.height(x, z), [s.x, s.z]);
  check(h > -0.45 + 0.1, 'the creek blocks walking where there is no bridge', `stopped at x ${s.x}, ground ${h.toFixed(2)}`);

  // every landmark is reachable and named
  const SPOTS = [
    ['05-bridge', 22, -29, 31, -21, 'Bramble Creek'],
    ['06-tower', 61, -28, 76, -38, 'Old Watchtower'],
    ['07-glade', -10, -76, -12, -91, 'Elder Tree Glade'],
    ['08-cave', -78, -34, -91, -38, 'Echo Cave'],
    ['09-pond', -18, 44, -34, 42, 'Lily Pond'],
    ['10-farm', -10, 21, -21, 21, null],
    ['11-orchard', -38, -2, -38, 9, null],
  ];
  for (const [name, x, z, lx, lz, zone] of SPOTS) {
    if (only && !name.includes(only)) continue;
    const ok = await page.evaluate(([x, z]) => window.WB.walkable(x, z), [x, z]);
    check(ok, `${name}: viewpoint is walkable`);
    await page.evaluate(([x, z, lx, lz]) => { window.WB.warp(x, z); window.WB.lookAt(lx, lz); window.WB.sim(0.6); }, [x, z, lx, lz]);
    // walk a few steps toward it so the zone sign has to fire on its own
    await page.evaluate(() => window.WB.sim(1.2, ['KeyW']));
    s = await info(page);
    if (zone) check(s.zone === zone, `${name}: zone sign reads "${zone}"`, s.zone);
    await page.evaluate(([lx, lz]) => { window.WB.lookAt(lx, lz); window.WB.zoom(19); window.WB.sim(0.1); }, [lx, lz]);
    await shot(page, name);
    await page.evaluate(() => window.WB.zoom(12.5));
  }
  const z0 = (await page.evaluate(() => window.WB.info())).camDist;
  await page.evaluate(() => window.WB.sim(0.5, ['Minus']));
  const z1 = (await page.evaluate(() => window.WB.info())).camDist;
  check(z1 > z0 + 3, 'the minus key zooms out', `${z0} -> ${z1}`);
  check(errors.length === 0, 'no page errors (desktop)', errors.join(' | '));
  await context.close();
}

{
  const { page, context, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await shot(page, '12-phone-splash');
  await page.touchscreen.tap(195, 600);
  await page.evaluate(() => window.WB.sim(2.4));
  const a = await info(page);
  check(a.started, 'phone: a tap starts the game');
  // drag the floating joystick with a real touch, then hold it via the hook while time runs
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', 90, 700); await touch('touchMove', 90, 660); await touch('touchMove', 90, 640);
  const stick = await page.evaluate(() => getComputedStyle(document.getElementById('stick')).display);
  check(stick === 'block', 'phone: touching the left side shows the joystick');
  await touch('touchEnd', 0, 0);
  await page.evaluate(() => { window.WB.joy(0, -1); window.WB.sim(2.5); window.WB.joy(0, 0); });
  const b = await info(page);
  check(b.z < a.z - 6, 'phone: pushing the stick walks the kid', `z ${a.z} -> ${b.z}`);
  // right side drags the camera round
  const yaw0 = b.yaw;
  await touch('touchStart', 300, 400); await touch('touchMove', 250, 400); await touch('touchMove', 200, 400); await touch('touchEnd', 0, 0);
  const c = await info(page);
  check(Math.abs(c.yaw - yaw0) > 0.3, 'phone: dragging the right side turns the camera', `yaw ${yaw0} -> ${c.yaw}`);
  const m = await page.evaluate(() => window.WB.villager('Pip'));
  await page.evaluate(([x, z]) => { window.WB.warp(x, z + 1.8); window.WB.lookAt(x, z); window.WB.sim(0.3); }, [m.x, m.z]);
  const shown = await page.evaluate(() => getComputedStyle(document.getElementById('talk')).display);
  check(shown === 'block', 'phone: the Talk button shows up next to a villager');
  await page.touchscreen.tap(390 - 22 - 39, 844 - 28 - 39);
  await page.evaluate(() => window.WB.sim(0.3));
  const d = await info(page);
  check(d.speaking === 'Pip', 'phone: tapping Talk starts the chat', d.speaking);
  await shot(page, '13-phone-talk');
  check(errors.length === 0, 'no page errors (phone)', errors.join(' | '));
  await context.close();
}

await browser.close();
srv.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
