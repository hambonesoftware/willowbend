// Plays the game in headless Edge: the splash, walking, talking, the bridge, the river, every
// landmark, and the touch joystick on a phone-sized screen. Screenshots land in test-results/.
import fs from 'node:fs';
import path from 'node:path';
import { serve, ROOT } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

async function closeConversation(page) {
  await page.getByRole('button', { name: 'Goodbye' }).click();
  await page.waitForFunction(() => document.activeElement?.id === 'c');
}

const OUT = path.join(ROOT, 'test-results');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
// WB_URL=https://hambonesoftware.github.io/willowbend/ runs the same tour against the live site
const srv = process.env.WB_URL ? null : await serve();
const BASE = process.env.WB_URL ? process.env.WB_URL.replace(/\/?$/, '/') + '?test' : `http://127.0.0.1:${srv.address().port}/?test`;
const browser = await launchBrowser().catch(error => {
  srv?.close();
  throw error;
});
let fails = 0, passes = 0;
const check = (ok, msg, extra = '') => { if (ok) passes++; else fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}${extra ? '  ' + extra : ''}`); };

async function open(opts) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    const response = await page.goto(BASE, { waitUntil: 'load' });
    if (!response?.ok()) throw new Error('Tour page returned HTTP ' + response?.status());
    await page.waitForFunction(() => window.READY, null, { timeout: 60000 });
  } catch (error) {
    await shot(page, 'startup-failure').catch(() => {});
    throw new Error('Could not start Willowbend at ' + BASE + ': ' + errors.join(' | '), { cause: error });
  }
  return { page, context, errors };
}
const info = page => page.evaluate(() => window.WB.info());
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 60000 });
async function holdUntil(page, key, predicate, target) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(predicate, target, { timeout: 75000 });
  } finally {
    await page.keyboard.up(key);
  }
}

try {

if (only !== 'route') {
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
  check(walkedVillagers === 9, 'villagers leave their opening poses');
  await shot(page, '03-walking');

  const travel = async keys => page.evaluate(keys => {
    WB.warp(0, 24);
    WB.lookAt(0, 0);
    WB.sim(0.55);
    WB.sim(0.5, keys);
    return 24 - WB.info().z;
  }, keys);
  const walkSpeed = await travel(['KeyW']);
  const runSpeed = await travel(['KeyW', 'ShiftLeft']);
  check(runSpeed > walkSpeed * 1.5, 'Shift covers more ground on the south road', `walk ${walkSpeed}, run ${runSpeed}`);

  // talking
  await page.evaluate(() => {
    WB.warp(0, 24);
    WB.positionVillager('Mabel', 0, 22);
    WB.lookAt(0.6, 22);
    WB.sim(0.3);
  });
  s = await info(page);
  check(s.near === 'Mabel', 'walking up to Mabel offers a chat', s.near);
  await page.evaluate(() => {
    WB.sim(0.2, ['Minus']);
    WB.sim(0.6);
  });
  const beforeTalk = await info(page);
  const closeEnough = (a, b) => a.every((value, i) => Math.abs(value - b[i]) < 0.01);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.WB.sim(0.65));
  s = await info(page);
  check(s.speaking === 'Mabel', 'Space starts the chat');
  check(beforeTalk.talkBlend === 0 && beforeTalk.yaw !== 0 && s.talkBlend === 1 &&
    !closeEnough(s.cameraPosition, beforeTalk.cameraPosition) && !closeEnough(s.cameraQuaternion, beforeTalk.cameraQuaternion),
    'the conversation frames the speakers from a different camera position and angle');
  await page.locator('#villager-speech.show').waitFor();
  check(await page.locator('#villager-speech').isVisible() && await page.locator('dialog[open]').count() === 0,
    'the greeting is a world bubble and leaves the game visible');
  await shot(page, '04-talk');
  await page.keyboard.press('Space');
  await page.locator('#conversation-panel').waitFor();
  await page.keyboard.press('Digit2');
  check((await page.locator('#speech-reply').textContent()).includes('east road'), 'number keys choose a reply');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.WB.sim(0.65));
  s = await info(page);
  check(s.speaking === null && s.talkBlend === 0 && s.camDist === beforeTalk.camDist && s.yaw === beforeTalk.yaw &&
    closeEnough(s.cameraPosition, beforeTalk.cameraPosition) && closeEnough(s.cameraQuaternion, beforeTalk.cameraQuaternion),
    'ending conversation restores the previous exploration camera',
    'delta ' + Math.hypot(...s.cameraPosition.map((value, i) => value - beforeTalk.cameraPosition[i])).toFixed(3));
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  const replies = page.locator('#conversation-panel');
  await replies.waitFor();
  await holdUntil(page, 'KeyS', z => WB.info().speaking === null && WB.info().z > z + 0.3, s.z);
  check(!(await replies.isVisible()), 'walking away with replies focused closes the conversation');

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
    ['06-meadow-rest', 51, -24, 52, -21, 'Meadow Rest'],
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
  // Hold a real touch while the game loop advances.
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', 90, 700); await touch('touchMove', 90, 660); await touch('touchMove', 90, 640);
  const stick = await page.evaluate(() => getComputedStyle(document.getElementById('stick')).display);
  check(stick === 'block', 'phone: touching the left side shows the joystick');
  try {
    await page.waitForFunction(z => window.WB.info().z < z - 6, a.z, { timeout: 75000 });
  } finally {
    await touch('touchEnd', 0, 0);
  }
  const b = await info(page);
  check(b.z < a.z - 6, 'phone: pushing the stick walks the kid', `z ${a.z} -> ${b.z}`);
  // right side drags the camera round
  const yaw0 = b.yaw;
  await touch('touchStart', 300, 400); await touch('touchMove', 250, 400); await touch('touchMove', 200, 400); await touch('touchEnd', 0, 0);
  const c = await info(page);
  check(Math.abs(c.yaw - yaw0) > 0.3, 'phone: dragging the right side turns the camera', `yaw ${yaw0} -> ${c.yaw}`);
  await page.evaluate(() => {
    WB.warp(0, 24);
    WB.positionVillager('Pip', 0, 22);
    WB.lookAt(0, 22);
    WB.sim(0.3);
  });
  check(await page.getByRole('button', { name: 'Talk', exact: true }).isVisible(), 'phone: Talk is available near a villager');
  await page.getByRole('button', { name: 'Talk', exact: true }).tap();
  await page.evaluate(() => window.WB.sim(0.65));
  const speech = page.locator('#villager-speech.show');
  await speech.waitFor();
  const d = await info(page);
  check(d.speaking === 'Pip' && d.talkBlend === 1 && (await speech.locator('#speech-reply').textContent()).includes('orchard'),
    'phone: tapping Talk shows Pip’s greeting and frames the conversation', d.speaking);
  const ask = page.getByRole('button', { name: 'Ask a question', exact: true });
  await ask.tap();
  const panel = page.locator('#conversation-panel');
  await panel.waitFor();
  const options = await panel.boundingBox();
  const bubble = await speech.boundingBox();
  check(options.y > 422 && bubble.y + bubble.height < options.y && await page.locator('dialog[open]').count() === 0,
    'phone: reply choices open at the bottom with room for the world bubble');
  await shot(page, '13-phone-conversation');
  await page.getByRole('button', { name: 'Where should I go?' }).tap();
  const bounds = await speech.boundingBox();
  check(!(await panel.isVisible()) && bounds.x >= 0 && bounds.x + bounds.width <= 390 &&
    (await speech.locator('#speech-reply').textContent()).includes('orchard'),
    'phone: directions are answered overhead and the reply strip closes');
  await ask.tap();
  await panel.getByRole('button', { name: 'More topics' }).tap();
  await panel.getByRole('button', { name: 'Active jobs' }).tap();
  check((await speech.locator('#speech-reply').textContent()).includes('jobs underway'),
    'phone: follow-up questions are answered in the same world bubble');
  await shot(page, '13-phone-speech-bubble');
  const portrait = page.viewportSize();
  const landscape = { width: portrait.height, height: portrait.width };
  await page.setViewportSize(landscape);
  await ask.tap();
  await page.evaluate(() => WB.sim(0.1));
  const landscapePanel = await panel.boundingBox();
  const landscapeBubble = await speech.boundingBox();
  const contained = box => box && box.x >= 0 && box.y >= 0 &&
    box.x + box.width <= landscape.width && box.y + box.height <= landscape.height;
  check(contained(landscapePanel) && contained(landscapeBubble) && (
    landscapePanel.x + landscapePanel.width < landscapeBubble.x || landscapeBubble.x + landscapeBubble.width < landscapePanel.x ||
    landscapePanel.y + landscapePanel.height < landscapeBubble.y || landscapeBubble.y + landscapeBubble.height < landscapePanel.y
  ), 'phone landscape: reply choices and speech bubble fit without overlap');
  await shot(page, '13-landscape-conversation');
  await page.setViewportSize(portrait);
  await page.waitForFunction(([width, height]) => innerWidth === width && innerHeight === height, [portrait.width, portrait.height]);
  await touch('touchStart', 60, portrait.height - 48);
  await touch('touchMove', 60, portrait.height - 116);
  try {
    await page.waitForFunction(z => WB.info().speaking === null && WB.info().z < z - 0.3, d.z);
  } finally {
    await touch('touchEnd', 0, 0);
  }
  await page.evaluate(() => window.WB.sim(0.65));
  check((await info(page)).talkBlend === 0 && !(await panel.isVisible()),
    'phone: the joystick immediately resumes movement and ends the conversation');

  await page.evaluate(() => {
    WB.warp(0, 24);
    WB.positionVillager('Pip', 0, 24);
    WB.lookAt(0, 0);
    WB.sim(0.2);
  });
  await touch('touchStart', 60, portrait.height - 48);
  await touch('touchMove', 60, portrait.height - 58);
  try {
    await page.keyboard.press('Space');
    await page.evaluate(() => WB.sim(0.65));
    const settled = await info(page);
    const pip = settled.villagers.find(villager => villager.name === 'Pip');
    check(settled.speaking === 'Pip' && Math.hypot(settled.x - pip.x, settled.z - pip.z) > 1.5 && pip.x === 0 && pip.z === 24,
      'phone: a held stick stays neutral during Talk and close characters make room for each other');
  } finally {
    await touch('touchEnd', 0, 0);
  }
  check(errors.length === 0, 'no page errors (phone)', errors.join(' | '));
  await context.close();
}

}

if (!only || only === 'route') {
  const { page, context, errors } = await open({ viewport: { width: 1000, height: 650 } });
  try {
    await page.keyboard.press('Enter');
    await page.keyboard.down('Shift');
    // Stay on the south road, pass the plaza's well on its east side, then approach the bridge.
    await holdUntil(page, 'KeyW', z => window.WB.info().z < z, 3.5);
    await holdUntil(page, 'KeyD', x => window.WB.info().x > x, 8);
    await holdUntil(page, 'KeyW', z => window.WB.info().z < z, -8);
    await holdUntil(page, 'KeyD', x => window.WB.info().x > x, 18);
    await holdUntil(page, 'KeyW', z => window.WB.info().z < z, -20.4);
    await holdUntil(page, 'KeyD', x => window.WB.info().x > x, 40.5);
    check((await info(page)).x > 40.5, 'keyboard-only route crosses the bridge from the splash');
    await page.keyboard.up('Shift');

    // Use focused fixtures for the quest transitions, then interact through the normal controls.
    const approachBruno = () => page.evaluate(() => {
      const { x, z } = window.WB.villager('Bruno');
      window.WB.warp(x, z + 1);
      window.WB.lookAt(x, z);
      window.WB.sim(0.2);
    });
    const conversation = page.locator('#conversation-panel');
    const speech = page.locator('#villager-speech');
    const ask = page.getByRole('button', { name: 'Ask a question', exact: true });
    const handoff = page.locator('#exchange');
    const chooseMore = async label => {
      await ask.click();
      await conversation.getByRole('button', { name: 'More topics' }).click();
      await conversation.getByRole('button', { name: label }).click();
    };
    const choose = async label => {
      await ask.click();
      await conversation.getByRole('button', { name: label }).click();
      await speech.waitFor();
      await closeConversation(page);
    };
    const talkToPip = async () => {
      await page.evaluate(() => {
        window.WB.warp(4, 4);
        window.WB.positionVillager('Pip', 4, 4);
        window.WB.sim(0.25);
      });
      await page.keyboard.press('Space');
      await speech.waitFor();
      if (await speech.locator('#speech-name').textContent() !== 'Pip') throw Error('Expected to talk to Pip');
    };
    await talkToPip();
    await chooseMore('Take supplies');
    check(await page.locator('dialog[open]').count() === 0, 'item exchanges stay in the world with no modal');
    await handoff.getByRole('button', { name: 'Bread, 1 available', exact: true }).click();
    await handoff.getByRole('button', { name: 'Take', exact: true }).click();
    check((await info(page)).progress.inventory.bread === 1, 'taking supplies adds a villager’s item to the backpack');
    await chooseMore('Give an item');
    await handoff.getByRole('button', { name: 'Cancel' }).click();
    check((await info(page)).progress.inventory.bread === 1 && !(await conversation.isVisible()) && !(await handoff.isVisible()),
      'canceling a transfer keeps the item and returns to the conversation');
    await page.getByRole('button', { name: 'Exchange items' }).click();
    await handoff.getByRole('button', { name: 'Give', exact: true }).click();
    check((await info(page)).progress.inventory.bread === 0, 'giving an item removes the selected quantity');
    await chooseMore('Take supplies');
    await handoff.getByRole('button', { name: 'Bread, 1 available', exact: true }).click();
    await handoff.getByRole('button', { name: 'Take', exact: true }).click();
    await closeConversation(page);
    await page.keyboard.press('KeyB');
    const backpack = page.locator('#backpack');
    await backpack.waitFor();
    check((await backpack.locator('#backpack-items').textContent()).includes('Bread1'), 'the backpack shows the returned item and count');
    await backpack.getByRole('button', { name: 'Close' }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'c');
    await approachBruno();
    await page.keyboard.press('Space');
    await choose('Talk about rebuilding');
    const objective = page.locator('#objective');
    await objective.waitFor({ state: 'visible', timeout: 5000 });
    const visit = async (x, z, label) => {
      const walkable = await page.evaluate(([x, z]) => {
        window.WB.warp(x, z);
        window.WB.sim(0.25);
        return window.WB.walkable(x, z);
      }, [x, z]);
      check(walkable, label + ' approach is walkable');
      await page.keyboard.press('Space');
    };
    await page.evaluate(() => {
      const { x, z } = window.WB.villager('Mabel');
      window.WB.warp(x, z + 1);
      window.WB.sim(0.25);
    });
    await page.keyboard.press('Space');
    await speech.waitFor();
    check((await speech.locator('#speech-reply').textContent()).includes('Bramble Creek'),
      'a different villager notices the active cottage job');
    await ask.click();
    await conversation.getByRole('button', { name: 'Where should I go?' }).click();
    check(!(await conversation.isVisible()) && (await speech.locator('#speech-reply').textContent()).includes('east road'),
      'choosing directions closes the reply strip and shows an in-world answer');
    await ask.click();
    await conversation.getByRole('button', { name: 'Active jobs' }).click();
    check((await speech.locator('#speech-reply').textContent()).includes('Gather branches'),
      'active jobs topic repeats the next step without changing progress');
    await closeConversation(page);
    const voices = await page.evaluate(() => {
      window.WB.warp(4, 4);
      window.WB.positionVillager('Mabel', 5, 4);
      window.WB.positionVillager('Biscuit', 7, 4);
      const voices = new Set();
      for (let i = 0; i < 7; i++) {
        window.WB.sim(2);
        const panel = document.getElementById('chatter');
        if (!panel.hidden) voices.add(panel.textContent.split(' · ')[0]);
      }
      return voices.size;
    });
    check(voices >= 2, 'villagers exchange lines with at least two speakers');

    check((await objective.textContent()).includes('Bramble Creek'), 'Bruno lends the hatchet and gives directions');
    await page.evaluate(() => {
      WB.warp(46, -22);
      WB.positionVillager('Mabel', 46, -21);
      WB.sim(0.25);
    });
    check((await info(page)).near === 'Mabel' && await page.getByRole('button', { name: 'Chop', exact: true }).isVisible(),
      'Chop takes priority when both wood and a villager are nearby');
    await visit(46, -22, 'creek wood');
    check((await info(page)).progress.inventory.wood === 3, 'hatchet yields wood');
    await visit(-12, -13.5, 'workbench');
    check((await info(page)).progress.inventory.planks === 3, 'workbench crafts planks');
    await visit(-14, -11, 'cottage');
    check((await info(page)).houseFinished, 'the finished cottage replaces its frame');
    await visit(52, -27, 'meadow stone');
    await visit(7, 5.8, 'bakery');
    check((await info(page)).progress.built.bakery.stone === 3, 'partial delivery installs the bakery oven');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.READY, null, { timeout: 90000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => WB.info().started);
    check((await info(page)).progress.built.bakery.stone === 3, 'partial construction survives reload');
    check((await info(page)).progress.inventory.bread === 1, 'received items survive reload');
    await talkToPip();
    await chooseMore('What’s new?');
    check((await speech.locator('#speech-reply').textContent()).includes('My basket is at the north edge of the orchard'),
      'Pip can share the bakery’s orchard clue while jobs are active');
    await chooseMore('Take supplies');
    check(await handoff.locator('[data-item="bread"]').count() === 0, 'villager stock stays depleted after reload');
    await closeConversation(page);
    await visit(-5, -32, 'woods wood');
    await visit(-38, 1, 'orchard apples');
    await visit(-12, -13.5, 'workbench');
    await visit(7, 5.8, 'bakery');
    check((await info(page)).progress.photos.includes('bakery'), 'completed bakery gets a portrait');
    await visit(-85, -37, 'cave copper');
    await visit(-58, -24, 'highland stone');
    await visit(-12, -13.5, 'workbench');
    check((await info(page)).progress.inventory.lantern === 1, 'workbench crafts the lantern');
    await visit(72, -37, 'watchtower');
    check((await info(page)).progress.built.beacon.lantern === 1, 'lantern lights the watchtower');

    for (const [id, host, stop] of [
      ['market', [-5, 23], [-19, 16]],
      ['pond', [-16, 37], [-22, 41]],
      ['orchard', [-28, 2], [-36, 1]],
    ]) {
      await visit(...host, id + ' host');
      await choose(/^Start job/);
      check((await info(page)).progress.errands[id] === 'active', id + ' job starts through dialogue');
      await visit(...stop, id + ' pickup');
      check((await info(page)).progress.errands[id] === 'carrying', id + ' job records its pickup');
      await visit(...host, id + ' delivery');
      const deliver = page.locator('#talk').and(page.getByRole('button', { name: /^(Deliver|Report back)/ }));
      await deliver.waitFor();
      await ask.waitFor();
      check(await deliver.isVisible() && await ask.isVisible(), id + ' gives delivery priority and keeps Ask available');
      if (id === 'market') await page.keyboard.press('Space');
      else await deliver.click();
      await closeConversation(page);
      check((await info(page)).progress.errands[id] === 'done', id + ' job completes through dialogue');
    }

    const planner = page.locator('#planner');
    const openPlanner = async () => {
      await visit(54, -21.3, 'planning board');
      await planner.waitFor({ state: 'visible' });
    };
    await openPlanner();
    const lots = planner.locator('section');
    await lots.nth(0).getByRole('button', { name: 'Meadow bakehouse' }).click();
    await lots.nth(1).getByRole('button', { name: 'Meadow lodge' }).click();
    await lots.nth(2).getByRole('button', { name: 'Meadow workshop' }).click();
    check((await info(page)).progress.plots.bakehouse === 0, 'player chooses where the bakehouse goes');
    await planner.getByRole('button', { name: 'Close' }).click();
    await visit(47, -31, 'stormfall timber');
    await visit(61, -33, 'meadow quarry');
    await visit(48, -24, 'meadow apples');
    await visit(-12, -13.5, 'workbench');
    await visit(51, -29.2, 'meadow bakehouse');
    await visit(57, -29.2, 'meadow lodge');
    await visit(60, -23.2, 'meadow workshop');
    check(Object.keys((await info(page)).progress.built.bakehouse).length === 3, 'bakehouse accepts player-gathered supplies');
    await openPlanner();
    await planner.getByRole('button', { name: 'Pip · Deliver apples' }).click();
    await planner.getByRole('button', { name: 'Bruno · Haul timber' }).click();
    await planner.getByRole('button', { name: 'Close' }).click();
    await page.evaluate(() => window.WB.sim(18));
    check((await info(page)).progress.jobs.Pip === 'delivered', 'Pip walks a delivery route and stocks the bakehouse');
    check((await info(page)).progress.jobs.Bruno === 'delivered', 'Bruno delivers timber to the workshop');
    await openPlanner();
    await planner.getByRole('button', { name: 'Celebrate opening day' }).click();
    check((await info(page)).progress.opening, 'opening day adds the neighborhood group portrait');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.READY, null, { timeout: 90000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => WB.info().started);
    await page.locator('#open-album').click();
    await page.waitForFunction(() => {
      const photos = [...document.querySelectorAll('#album img')];
      return photos.length === 13 && photos.every(photo => photo.complete && photo.naturalWidth > 0);
    }, null, { timeout: 20000 });
    check(await page.locator('#album figure').count() === 13, 'all thirteen portraits load from device storage');
    await shot(page, '14-rebuild-album');
    check(errors.length === 0, 'no page errors on the keyboard route or quest', errors.join(' | '));
  } catch (error) {
    console.error('Last player state:', JSON.stringify(await info(page).catch(() => null)));
    await shot(page, 'route-failure').catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
} finally {
  await browser.close();
  srv?.close();
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
