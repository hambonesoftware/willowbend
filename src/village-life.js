import { itemIcon, itemLabel } from './item-ui.js';
import { villageMusic } from './village-music.js';
import { advanceDay, calendar, chapter, DAY_SECONDS, friendship, letters, locations, remember } from './life.js';
import { raceCourse, scheduledSpot, timingHit, treasureSite } from './activities.js';
import { availableArc } from './villager-stories.js';
import { itemNames, moveItems } from './rebuild.js';

export function villageLife(progress, view) {
  const life = progress.life;
  const $ = id => document.getElementById(id);
  const journal = $('journal');
  const activity = $('activity');
  const meter = activity.querySelector('meter');
  const timingTrack = activity.querySelector('.timing-track');
  const music = villageMusic();
  let musicOn = false;
  const musicChoice = () => [musicOn ? 'Turn music off' : 'Turn music on', () => {
    musicOn = music.toggle();
    showJournal();
  }];
  let task = null, festivalTime = 0, lastMinute = -1, dotStop = 0;
  let day = calendar(life);
  if (life.festival && life.festivalUntil > life.time) festivalTime = life.festivalUntil - life.time;
  let morningSave = Math.floor(life.time / 30);

  function save(message = '') { view.save(message); }

  function open(title, content, options = [], inWorld = false) {
    $('journal-title').textContent = title;
    const page = $('journal-content');
    page.replaceChildren();
    for (const row of content) {
      if (typeof row === 'string') {
        const p = document.createElement('p');
        p.textContent = row;
        page.append(p);
      } else page.append(row);
    }
    journal.classList.toggle('scene-sheet', inWorld);
    const actions = $('journal-options');
    actions.replaceChildren();
    for (const [label, run, item, cost] of options) {
      const button = view.button(actions, label, run);
      if (!item) continue;
      button.classList.add('item-action');
      const copy = document.createElement('span');
      copy.className = 'item-action-copy';
      const note = document.createElement('small');
      note.textContent = cost;
      copy.append(label, note);
      button.setAttribute('aria-label', label);
      button.replaceChildren(itemIcon(item), copy);
    }
    if (!journal.open) {
      view.release();
      if (inWorld) journal.show();
      else journal.showModal();
    }
  }

  function showJournal() {
    const [title, next] = chapter(life, view.done);
    const notes = letters(life).map(([id, name, words]) => {
      const entry = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = life.lettersRead.includes(id) ? name : name + ' • New';
      const body = document.createElement('p');
      body.textContent = words;
      entry.append(summary, body);
      entry.addEventListener('toggle', () => {
        if (!entry.open || life.lettersRead.includes(id)) return;
        life.lettersRead.push(id);
        summary.textContent = name;
        save();
      });
      return entry;
    });
    const friends = Object.entries(life.bonds).filter(([, bond]) => bond.points > 0).map(([name, bond]) =>
      name + ' · ' + (bond.points >= 4 ? 'Close friend' : bond.points >= 2 ? 'Friend' : 'Acquaintance') +
      (bond.memories.length ? ' — ' + bond.memories.at(-1) : ''));
    open('Village journal', [title, next, ...notes, ...friends], [musicChoice()]);
  }

  $('open-journal').addEventListener('click', () => { view.release(); showJournal(); });
  journal.addEventListener('close', view.focus);

  function book(isHome) {
    const options = [];
    if (isHome) {
      options.push(['Rest until morning', () => {
        advanceDay(life, DAY_SECONDS - life.time % DAY_SECONDS + 0.01);
        journal.close();
        save('A new day in Willowbend.');
      }]);
      options.push(['Change outfit', () => {
        const outfits = ['Moss', 'Berry', 'Sky'];
        life.home.outfit = outfits[(outfits.indexOf(life.home.outfit) + 1) % outfits.length];
        save();
        book(true);
      }]);
      options.push(['Decorate the cottage', () => {
        const decor = ['Flower box', 'Lantern', 'Welcome mat'];
        life.home.decoration = decor[(decor.indexOf(life.home.decoration) + 1) % decor.length];
        save();
        book(true);
      }]);
    }
    if (!isHome) return openSupplies();
    options.push(['Read journal', showJournal]);
    open('Your cottage', ['Outfit · ' + life.home.outfit, 'Outside · ' + life.home.decoration], options);
  }

  function openSupplies() {
    const cards = Object.keys(life.stock).map(item => {
      const card = document.createElement('section');
      card.className = 'supply-card';
      const info = document.createElement('p');
      const label = itemLabel(item);
      info.textContent = label + ' · Crate ' + life.stock[item] + ' · Backpack ' + (progress.inventory[item] ?? 0);
      const buttons = document.createElement('div');
      buttons.className = 'supply-actions';
      function offer(taking) {
        const source = taking ? life.stock : progress.inventory;
        const target = taking ? progress.inventory : life.stock;
        const button = view.button(buttons, (taking ? 'Take ' : 'Share ') + label.toLowerCase(), () => {
          if (!moveItems(source, target, item, 1)) return;
          save();
          view.receipt(item, taking ? 1 : -1);
          openSupplies();
          if (!journal.querySelector('[data-supply-action="' + action + '"]')?.disabled) {
            journal.querySelector('[data-supply-action="' + action + '"]')?.focus();
          } else {
            journal.querySelector('[data-supply-action="' + alternate + '"]:enabled')?.focus();
          }
        });
        const action = item + (taking ? '-take' : '-share');
        const alternate = item + (taking ? '-share' : '-take');
        button.dataset.supplyAction = action;
        button.disabled = !(source[item] > 0);
      }
      card.append(itemIcon(item), info, buttons);
      offer(true);
      offer(false);
      return card;
    });
    open('Village supplies', cards, [['Read journal', showJournal]]);
  }

  function recipePreview(input, count, output, yieldCount) {
    const row = document.createElement('div');
    row.className = 'recipe-preview';
    const amount = document.createElement('strong');
    amount.textContent = count + ' ' + itemLabel(input).toLowerCase() + ' → ' + yieldCount + ' ' +
      (yieldCount === 1 && output === 'planks' ? 'plank' : itemLabel(output).toLowerCase());
    row.append(itemIcon(input), amount, itemIcon(output));
    return row;
  }

  function recipes() {
    const stock = progress.inventory;
    const options = [];
    const contents = ['In your backpack · ' + stock.wood + ' wood · ' + stock.planks + ' planks · ' + stock.copper + ' copper'];
    contents.push(recipePreview('wood', 1, 'planks', 1));
    for (const count of [1, 3, 5].filter(count => stock.wood >= count)) {
      const label = 'Cut ' + count + ' ' + (count === 1 ? 'plank' : 'planks');
      options.push([label, () => {
        stock.wood -= count;
        stock.planks += count;
        journal.close();
        save(label + ' at the workbench.');
        view.receipt('planks', count);
      }, 'planks', count + ' wood → ' + count + (count === 1 ? ' plank' : ' planks')]);
    }
    if (!view.done('beacon')) {
      contents.push(recipePreview('copper', 2, 'lantern', 1));
      if (!view.done('bakery')) contents.push('The lantern recipe unlocks when the bakery reopens.');
      else if (stock.lantern) contents.push('You already have a lantern for the watchtower.');
      if (view.done('bakery') && stock.copper >= 2 && !stock.lantern) {
        options.push(['Make a lantern', () => {
          stock.copper -= 2;
          stock.lantern++;
          journal.close();
          save('Made a lantern for the beacon.');
          view.receipt('lantern', 1);
        }, 'lantern', '2 copper → 1 lantern']);
      }
    }
    open('Workbench', contents, options);
  }

  function projectPreview(title, materials, name, build) {
    const rows = materials.map(({ item, yours, neighbor, remaining }) => {
      const row = document.createElement('div');
      row.className = 'project-material';
      const words = document.createElement('span');
      words.textContent = itemLabel(item) + ' · You ' + yours + ' · ' + name + ' ' + neighbor + ' · Still needed ' + remaining;
      row.append(itemIcon(item), words);
      return row;
    });
    const options = materials.some(item => item.yours || item.neighbor)
      ? [['Contribute supplies', () => { journal.close(); build(); }]] : [];
    open(title, rows, options, true);
  }

  function startTiming(kind, spot, recipe) {
    view.release();
    task = { kind, spot, recipe, elapsed: 0 };
    meter.max = 2;
    meter.value = 0;
    timingTrack.hidden = false;
    timingTrack.style.setProperty('--position', '0%');
    meter.low = kind === 'Bake' ? 0.58 : 1.03;
    meter.high = meter.low + 0.62;
    timingTrack.style.setProperty('--start', meter.low * 50 + '%');
    timingTrack.style.setProperty('--end', meter.high * 50 + '%');
    activity.querySelector('span').textContent = kind === 'Bake' ? 'Check the pastry when the needle reaches the marked band.' : 'Reel in when the needle reaches the marked band.';
    activity.hidden = false;
  }

  function finishTiming() {
    const good = timingHit(task.elapsed, task.kind === 'Bake' ? 0.89 : 1.34);
    const { kind, recipe } = task;
    task = null;
    activity.hidden = true;
    if (kind === 'Bake') {
      const firstBatch = !life.batch;
      if (firstBatch) life.recipe = recipe;
      life.batch = true;
      life.bakingResult = good ? 'golden' : 'toasted';
      progress.inventory.bread = (progress.inventory.bread ?? 0) + 1;
      if (firstBatch) {
        remember(life, 'Pip', 'Chose ' + recipe.toLowerCase() + ' together.', 2);
        remember(life, 'Clover', 'Shared the first tray with Pip.', 2);
      } else {
        remember(life, 'Pip', 'Baked ' + recipe.toLowerCase() + ' together again.');
      }
      save(good ? 'Pip and Clover split the first pastry with you.' : 'The edges got dark. Pip and Clover laughed and split it with you.');
    } else {
      if (good) {
        life.catches++;
        remember(life, 'Reed', 'Watched the pond together.');
        save('A silver fish! You let it go and watched the ripples.');
      } else save('The ripple slipped away. Cast again when you’re ready.');
    }
  }

  function chooseRecipe() {
    view.release();
    open('A taste test with Pip and Clover', [
      'Pip sets down two trays. Clover keeps one hand on the tart-apple tray.',
      '“You pick,” says Pip. “Clover and I have been arguing since breakfast.”',
    ], ['Honey apple buns', 'Tart-apple turnovers'].map(recipe => [recipe, () => {
      if (!life.firstHelp) life.firstHelp = 'Pip';
      journal.close();
      save();
      startTiming('Bake', view.position(), recipe);
    }]), true);
  }

  function visit(name) {
    const bond = friendship(life, name);
    if (bond.day < day.day) {
      bond.day = day.day;
      bond.points++;
      save();
    }
  }

  function give(name, item) {
    const favorites = { Mabel: 'pebble', Pip: 'apples', Bruno: 'wood', Dot: 'bread', Biscuit: 'apples', Fennel: 'pebble', Hazel: 'cider', Reed: 'stone', Clover: 'apples' };
    remember(life, name, 'You brought ' + itemNames[item][1] + '.', item === favorites[name] ? 2 : 1);
    if (name === 'Pip' && item === 'apples') friendship(life, name).appleGiftPending = true;
  }

  function personal(name) {
    const scene = availableArc(progress, name);
    if (!scene) return null;
    const { stage } = life.bonds[name];
    const [label, line] = scene;
    return [label, () => {
      friendship(life, name).stage++;
      remember(life, name, line);
      if (name === 'Biscuit' && stage === 1) life.treasure ??= 'hidden';
      if (name === 'Bruno' && stage === 1) life.stock.planks += 2;
      if (name === 'Hazel' && stage === 1) life.stock.apples += 2;
      if (name === 'Fennel' && stage === 1) life.stock.stone += 2;
      save();
      return line;
    }];
  }

  function giftGreeting(name) {
    const bond = life.bonds[name];
    if (name !== 'Pip' || !bond?.appleGiftPending) return null;
    bond.appleGiftPending = false;
    save();
    return 'I remember the apple you brought me. I saved it for the next tray.';
  }

  function helpMessage(name) {
    if (life.festival && name === 'Mabel') return life.festival === 'share'
      ? 'I can see the lantern you gave Hazel from my window. Rowan would have loved that.'
      : 'Rowan’s lantern is still above the well. People stop there every evening now.';
    if (name === 'Pip' && life.firstHelp === 'Bruno' && !life.batch) return 'Bruno says the door shuts properly again. Now it’s my turn to borrow you for a minute.';
    if (name === 'Bruno' && life.firstHelp === 'Pip' && !life.repair) return 'Pip sent me a pastry. I ate it before I even got to the workbench.';
    if (name === 'Mabel' && life.arrival) return 'There you are! Your cottage is just down the south road.';
    if (name === 'Pip' && life.batch) return 'I made ' + life.recipe.toLowerCase() + ' again. Your pick is the one everyone asks for now.';
    if (name === 'Bruno' && life.repair) return life.repair === 'old'
      ? 'I can still see the marks Rowan left on that old latch. I’m glad we kept it.'
      : 'That new latch is easier for Reed to use. I’m glad you thought of that.';
    if (name === 'Dot' && life.lantern) return 'I keep thinking about that light we found by the Elder Tree.';
    if (life.bonds[name]?.points >= 4) return 'Good to see you again. Come sit for a minute.';
    return null;
  }

  function topics(name, say) {
    const choices = [];
    const line = (label, run) => choices.push({ label, run: () => say(run()) });
    if (name === 'Mabel' && !life.arrival) {
      line('Show the old postcard', () => {
        life.arrival = 'welcome';
        remember(life, 'Mabel', 'Welcomed you home by the south road.', 2);
        save('Mabel left you a key and a note in the journal.');
        return 'I remember when the whole village looked like this postcard. Come stay in the little house by the south road. There’s a key waiting for you.';
      });
    }
    if (name === 'Pip' && life.arrival && !life.appleGreeting) line('Help Pip pick up the apples', () => {
      life.appleGreeting = true;
      remember(life, 'Pip', 'Helped gather the apples Pip dropped.');
      progress.inventory.apples++;
      view.receipt('apples', 1);
      save('Pip tucked one apple into your backpack for later.');
      return 'You got the last one! Clover says I should carry fewer. I say we should get a bigger basket.';
    });
    if (name === 'Pip' && life.arrival && !life.batch) choices.unshift({ label: 'Bake with Pip and Clover', run: chooseRecipe });
    if (name === 'Bruno' && life.arrival && !life.repair) {
      choices.push({ label: 'Fix the latch with Bruno', run: () => {
        view.release();
        open('Hold the door steady', ['Bruno takes one end of the door. Mabel props up the other. There’s just room for your hands at the latch.'], [
          ['Keep the old latch', () => repair('old')],
          ['Make it easier to open', () => repair('new')],
        ], true);
      } });
    }
    if (name === 'Mabel' && life.repair && life.batch && !life.scrapbook) {
      line('Look through the Lantern Night photos', () => {
        life.scrapbook = true;
        remember(life, 'Mabel', 'Opened the scrapbook to the whole village.');
        save('A lantern in Mabel’s old photo looks like the light Dot saw.');
        return 'Look at the lantern behind the Elder Tree. Rowan hung it there the night the tower went dark. Dot says she saw that very light recently.';
      });
    }
    if (name === 'Dot' && life.scrapbook && !life.lantern) line('Meet at the Elder Tree', () => {
      life.lantern = 'invited';
      save('Follow the north road to meet Dot at the Elder Tree.');
      return 'I’m nervous, but I want to see it with you. I’ll meet you at the end of the north road.';
    });
    if (name === 'Fennel' && life.lantern === 'found' && !life.echo) line('Show Fennel the lantern mark', () => {
      life.echo = 'invited';
      save('Find the matching boot mark at Echo Cave.');
      return 'A tiny boot. Rowan signed their things that way. Look for the same mark by the cave mouth.';
    });
    if (name === 'Biscuit') choices.push({ label: 'Race to the pond trail', run: () => {
      view.release();
      task = { kind: 'Race', elapsed: 0, next: 0 };
      timingTrack.hidden = true;
      activity.hidden = false;
      activity.querySelector('span').textContent = 'Start at the village sign on the south road, then follow the markers.';
    } });
    if (name === 'Dot' || name === 'Reed') line('Sit by the pond together', () => {
      remember(life, name, 'Shared a quiet moment by the pond.');
      save();
      return name === 'Dot' ? 'Listen. If we stay quiet long enough, the frogs start up again.' : 'That’s my favorite part of the day, when you can hear the water between the birds.';
    });
    if (name === 'Pip' && life.batch && view.done('bakery')) line('Share breakfast', () => {
      remember(life, 'Pip', 'Stayed for breakfast at the bakery.');
      save();
      return 'I saved you a place beside Clover. Sit a while. The rest can wait.';
    });
    const scene = personal(name);
    if (scene) line(...scene);
    return choices;
  }

  function repair(kind) {
    life.repair = kind;
    if (!life.firstHelp) life.firstHelp = 'Bruno';
    progress.started = true;
    if (!view.done('cottage')) {
      progress.built.cottage.planks = 2;
      view.refresh();
      view.photo('cottage');
    }
    remember(life, 'Bruno', kind === 'old' ? 'Saved Rowan’s old latch together.' : 'Made the cottage door easier for everyone.', 2);
    remember(life, 'Mabel', 'Held the door steady with you.');
    save(kind === 'old' ? 'Bruno polished Rowan’s old latch. The cottage door closes again.' : 'Bruno held the door open while everyone tried the new latch.');
    journal.close();
  }

  function action(near) {
    const at = (spot, label, run) => ({ spot, label, run });
    if (task && task.kind !== 'Race' && near(...task.spot)) return at(task.spot, task.kind === 'Bake' ? 'Check pastry' : 'Reel in', finishTiming);
    if (life.arrival && near(...locations.home) && !near(...locations.garden)) return at(locations.home, 'Visit your cottage', () => book(true));
    if (near(...locations.plaza) && life.arrival) {
      if (life.festival && festivalTime <= 0 && day.phase === 'Evening') return at(locations.plaza, 'Gather at the well', eveningGathering);
      if (!life.festival && life.keeper && view.done('bakery') && view.done('beacon')) return at(locations.plaza, 'Ring the Lantern Night bell', festival);
      return at(locations.plaza, 'Open village supplies', () => book(false));
    }
    if (near(...locations.pond) && life.arrival) return at(locations.pond, 'Cast a line', () => startTiming('Fish', locations.pond));
    if (life.lantern === 'invited' && near(...locations.tree)) return at(locations.tree, 'Follow Dot’s lantern', () => {
      life.lantern = 'found';
      remember(life, 'Dot', 'Followed the lantern light into the woods.', 2);
      save('Dot finds Rowan’s little boot mark on the lantern.');
      open('A light in the Elder Tree', ['Dot holds your sleeve until the light brightens. Then she lets go.', 'The lantern is just far enough inside the tree to stay dry. A little boot is scratched into the handle.'], [], true);
    });
    if (life.echo === 'invited' && near(...locations.cave)) return at(locations.cave, 'Trace the keeper’s mark', () => {
      life.echo = true;
      progress.inventory.copper += 2;
      remember(life, 'Fennel', 'Found Rowan’s mark in Echo Cave.', 2);
      save('The cave mark points to the watchtower. You found copper beside it.');
    });
    if (life.echo === true && !life.keeper && near(...locations.tower)) return at(locations.tower, 'Open the keeper’s box', () => {
      life.keeper = true;
      save('Rowan’s letter is in the journal. Bring the village together to light the lanterns.');
      showJournal();
    });
    if (life.treasure === 'hidden' && near(...treasureSite)) return at(treasureSite, 'Look under the roots', () => {
      life.treasure = 'found';
      progress.inventory.pebble = (progress.inventory.pebble ?? 0) + 1;
      remember(life, 'Biscuit', 'Found the keepsake on the north trail.', 2);
      save('You found Biscuit’s smooth green keepsake.');
    });
    if (life.arrival && near(...locations.garden)) {
      if (!life.garden) return at(locations.garden, 'Plant an apple seed', () => { life.garden = { planted: life.time, watered: false }; save('Planted an apple seed.'); });
      if (!life.garden.watered) return at(locations.garden, 'Water the garden', () => { life.garden.watered = true; save('The seedling will be ready after it has had time to grow.'); });
      if (life.time - life.garden.planted > 45) return at(locations.garden, 'Pick garden apples', () => {
        progress.inventory.apples += 3;
        life.garden = null;
        save('Picked three apples from your garden.');
      });
    }
    const photoSpot = [-7, 25];
    if (life.scrapbook && near(...photoSpot)) return at(photoSpot, 'Frame a market photo', () => {
      if (!view.photo('scrapbook', { site: locations.market, approach: [-3, 25], villagers: ['Mabel', 'Hazel'] })) {
        save('The picture didn’t come out. Try again from the market path.');
        return;
      }
      life.photos++;
      remember(life, 'Hazel', 'Made a market scrapbook page.', 2);
      save('Mabel added your market photo to the scrapbook.');
    });
    if (life.batch && view.done('bakery') && near(...locations.bakery)) return at(locations.bakery, 'Bake another batch', chooseRecipe);
    return null;
  }

  function eveningGathering() {
    const words = life.festival === 'share'
      ? 'Hazel brought her lantern back to the well. Pip says it helps them find the way home after a late shift.'
      : 'Mabel says you can see Rowan’s lantern from the south road. Bruno brings a bench out so everyone has a place to sit.';
    const options = [
      ['Stay a while', () => {
        if (life.gatheringDay !== day.day) {
          life.gatheringDay = day.day;
          life.festivalUntil = life.time + 90;
          festivalTime = 90;
          remember(life, 'Mabel', 'Watched the lanterns come on at the well.');
          save('The neighbors are coming down to the well.');
        }
        journal.close();
      }],
      ['Open village supplies', () => book(false)],
    ];
    open('An evening at the well', [words], options, true);
  }

  function festival() {
    view.release();
    open('Lantern Night', ['Bruno opens the cottage door wide. Pip and Clover bring a tray of ' + life.recipe.toLowerCase() + '.', 'Mabel turns the postcard over. This time, the village can make its own.'], [
      ['Hang Rowan’s lantern at the well', () => celebrate('remember')],
      ['Give each neighbor a lantern', () => celebrate('share')],
    ], true);
  }

  function celebrate(choice) {
    life.festival = choice;
    festivalTime = 180;
    life.festivalUntil = life.time + festivalTime;
    journal.close();
    remember(life, 'Mabel', choice === 'remember' ? 'Hung Rowan’s lantern at the well.' : 'Shared out the lanterns.');
    view.refresh();
    view.photo('lantern-night', { site: [0, 0], approach: [0, 5], villagers: ['Mabel', 'Pip', 'Bruno', 'Dot', 'Clover'] });
    save(choice === 'remember' ? 'Rowan’s lantern shines over the well. Everyone stays for a second pastry.' : 'Warm lights travel all the way down the paths as everyone heads home together.');
  }

  function update(dt, paused) {
    if (!paused) {
      const nextDay = advanceDay(life, dt);
      day = calendar(life);
      if (nextDay) save('A new day in Willowbend. The neighbors have restocked the village supplies.');
      const mark = Math.floor(life.time / 30);
      if (mark !== morningSave) { morningSave = mark; view.persist(); }
      festivalTime = Math.max(0, festivalTime - dt);
    }
    day = calendar(life);
    music.update(festivalTime > 0 ? 'Festival' : day.phase);
    const minute = Math.floor(day.fraction * 24 * 60 + 6 * 60) % (24 * 60);
    if (minute !== lastMinute) {
      lastMinute = minute;
      const hour = Math.floor(minute / 60);
      $('day-clock').textContent = day.season + ' ' + day.day + ' · ' + (hour % 12 || 12) + ':' + String(minute % 60).padStart(2, '0') + (hour < 12 ? ' am' : ' pm');
      $('day-clock').hidden = false;
      $('weather').hidden = day.weather !== 'Rain';
    }
    if (!task || paused) return;
    if (task.kind === 'Race') {
      const point = raceCourse[task.next];
      if (task.next) task.elapsed += dt;
      if (view.near(...point, 2.8)) {
        task.next++;
        if (task.next === raceCourse.length) {
          life.raceBest = Math.min(life.raceBest ?? Infinity, task.elapsed);
          remember(life, 'Biscuit', 'Raced to the pond trail together.', 2);
          save('You and Biscuit reached the pond trail in ' + Math.round(task.elapsed) + ' seconds.');
          task = null;
          activity.hidden = true;
          return;
        }
      }
      activity.querySelector('span').textContent = 'Biscuit’s race · ' + task.next + '/' + raceCourse.length + (task.next ? ' · ' + Math.floor(task.elapsed) + 's' : ' · Start at the south road');
      if (task.elapsed > 90) { task = null; activity.hidden = true; save('Biscuit is ready for another race whenever you are.'); }
    } else {
      task.elapsed += dt;
      if (!view.near(...task.spot, 3.2)) { task = null; activity.hidden = true; return; }
      meter.value = task.elapsed % 2;
      timingTrack.style.setProperty('--position', meter.value * 50 + '%');
    }
  }

  function invitation(villager) {
    if (!life.arrival || life.festival || day.phase === 'Night' || villager.name !== 'Biscuit' || life.raceBest !== null || task) return null;
    if (life.invitedRaceDay === day.day) return null;
    const [x, z] = view.position();
    const distance = Math.hypot(x - villager.x, z - villager.z);
    if (distance < 2.6) {
      life.invitedRaceDay = day.day;
      view.whisper(villager, 'Hey! Want to race? I’ll meet you at the south-road sign.');
      save();
      return null;
    }
    if (distance > 8) return null;
    return [x, z];
  }

  function destination(villager) {
    if (festivalTime > 0) return scheduledSpot(villager, day.phase, view.done('bakery'), true);
    const invite = invitation(villager);
    if (invite) return invite;
    if (life.lantern === 'invited' && villager.name === 'Dot') {
      const route = [[3, 5], [3, -6], [0, -16], [-4, -32], [-9, -48], [-7, -64], [-13, -79]];
      if (Math.hypot(villager.x - route[dotStop][0], villager.z - route[dotStop][1]) < 1.5 && dotStop < route.length - 1) dotStop++;
      return route[dotStop];
    }
    if (task?.kind === 'Race' && task.next > 0 && villager.name === 'Biscuit') return raceCourse[task.next];
    if (!life.arrival && villager.name === 'Mabel') return [-1.95, 19];
    if (life.arrival && (life.repair || day.day > 1)) return scheduledSpot(villager, day.phase, view.done('bakery'), false);
    return null;
  }

  function activityGreeting(name) {
    if (task?.kind === 'Race') return name === 'Biscuit'
      ? 'I’m right behind you! Keep an eye out for the next marker.'
      : 'Racing Biscuit? I’ll give you two some room.';
    if (life.lantern === 'invited') return name === 'Dot'
      ? 'I’m following the north road. We’ll meet at the Elder Tree.'
      : 'I saw Dot headed north. Aren’t you two meeting at the Elder Tree?';
    if (life.echo === 'invited' && name !== 'Fennel') return 'Did you find Rowan’s mark at Echo Cave yet? Fennel was asking.';
    return null;
  }

  return { action, activityGreeting, destination, give, giftGreeting, recipes, projectPreview, topics, update, visit, helpMessage, showJournal,
    get festival() { return festivalTime > 0; },
    get racePoint() { return task?.kind === 'Race' ? raceCourse[task.next] : null; },
    get day() { return day; },
  };
}
