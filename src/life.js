export const DAY_SECONDS = 22 * 60;
export const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const phases = ['Morning', 'Afternoon', 'Evening', 'Night'];
export const locations = {
  home: [3, 26], plaza: [0, 4], bakery: [7, 5.8], market: [-5, 23],
  pond: [-21, 39], tree: [-11, -80], cave: [-84, -37], tower: [72, -37],
  garden: [5.8, 25], bench: [-12, -12], orchard: [-28, 2],
};

export function createLife() {
  return {
    time: 0, arrival: null, repair: null, bonds: {}, lettersRead: [],
    recipe: null, batch: false, scrapbook: false, lantern: null, echo: false, keeper: false,
    festival: null, weather: 'Clear', home: { outfit: 'Moss', decoration: 'Flower box' },
    garden: null, raceBest: null, catches: 0, photos: 0, treasure: null,
    stock: { wood: 3, planks: 2, stone: 3, apples: 2 }, harvests: {}, contributions: {},
  };
}

export function calendar(life) {
  const day = Math.floor(life.time / DAY_SECONDS) + 1;
  const fraction = life.time % DAY_SECONDS / DAY_SECONDS;
  return { day, fraction, time: life.time, phase: phases[Math.floor(fraction * 4)], season: seasons[Math.floor((day - 1) / 7) % 4], weather: life.weather };
}

export function advanceDay(life, time) {
  const before = Math.floor(life.time / DAY_SECONDS);
  life.time += time;
  const after = Math.floor(life.time / DAY_SECONDS);
  if (before === after) return false;
  life.weather = ['Clear', 'Breezy', 'Rain', 'Clear'][(after + 1) % 4];
  const days = after - before;
  life.stock.wood += 2 * days;
  life.stock.stone += days;
  life.stock.apples += 2 * days;
  return true;
}

export function friendship(life, name) {
  return life.bonds[name] ??= { points: 0, day: 0, memories: [], stage: 0 };
}

export function remember(life, name, memory, points = 1) {
  const bond = friendship(life, name);
  if (bond.memories.includes(memory)) return;
  bond.memories.push(memory);
  bond.points += points;
}

export function chapter(life, built) {
  if (life.festival) return ['After the Lanterns', 'Visit friends, grow your garden, and enjoy the village you helped bring together.'];
  if (!life.arrival) return ['I · Finding Your Place', 'Show Mabel the postcard. She usually waits by the south road.'];
  if (!life.repair || !life.batch) return ['I · Finding Your Place', 'Help Bruno with a small repair and bake with Pip. You can do either first.'];
  if (!life.scrapbook) return ['II · Secrets and Friendships', 'Ask Mabel about her old Lantern Night photograph.'];
  if (life.lantern !== 'found') return ['II · Secrets and Friendships', 'Talk to Dot about the old lantern. Follow the north road to the Elder Tree.'];
  if (life.echo !== true) return ['II · Secrets and Friendships', 'Ask Fennel about the light, then look for the old keeper’s mark at Echo Cave.'];
  if (!life.keeper) return ['II · Secrets and Friendships', 'Climb to the watchtower and read the keeper’s box.'];
  if (!built('bakery') || !built('beacon')) return ['III · Building Together', 'Reopen the bakery and relight the beacon. Friends can help with supplies.'];
  return ['IV · Lantern Night', 'Ring the bell by the well. The celebration can begin whenever you’re ready.'];
}

export function letters(life) {
  const notes = [['postcard', 'The postcard', 'Willowbend, lit from the well to the watchtower. “I hope you’ll be here when the lanterns shine again.”']];
  if (life.arrival) notes.push(['welcome', 'Mabel’s welcome note', 'The little house by the south road is yours. If a chair is in the wrong place, move it. It’s your chair now.']);
  if (life.repair) notes.push(['latch', 'Bruno’s note', life.repair === 'old'
    ? 'I oiled Rowan’s old latch this morning. I’d forgotten how good it feels to fix something with someone.'
    : 'Reed says the new latch is easier to open with wet hands. I’m glad you thought of that.']);
  if (life.batch) notes.push(['breakfast', 'Breakfast with Pip', 'I’m saving you the first pastry. Come to the bakery when you have a moment. No need to hurry.']);
  if (life.keeper) notes.push(['keeper', 'The keeper’s last letter', 'The autumn storm took the tower steps, and no one could agree whose turn it was to fix them. I left for my sister’s with a hurt knee and a dry lantern under the Elder Tree. I thought someone might need it on their way home. Keep a light for one another. — Rowan']);
  if (life.festival) notes.push(['thanks', 'From all of us', 'There’s a place for you at our table. Thank you for giving us a reason to set it again.']);
  return notes;
}
