export const projects = {
  cottage: { title: 'Bruno’s cottage', site: [-17, -13], approach: [-14, -11], photoSpot: [-17, -9], needs: { planks: 3 }, villagers: ['Bruno', 'Mabel'] },
  bakery: { title: 'Willowbend bakery', site: [7, 8.5], approach: [7, 5.8], needs: { planks: 4, stone: 3, apples: 3 }, villagers: ['Bruno', 'Pip'] },
  beacon: { title: 'Watchtower beacon', site: [76, -38], approach: [72, -37], needs: { lantern: 1, stone: 2 }, villagers: ['Bruno', 'Dot', 'Fennel'] },
};

export const plots = [[51, -32], [57, -32], [60, -26]];
export const meadowBoard = [54, -22.5];
export const neighborhood = {
  lodge: { title: 'Meadow lodge', needs: { planks: 3, stone: 2 }, villagers: ['Bruno', 'Mabel'] },
  workshop: { title: 'Meadow workshop', needs: { planks: 3, stone: 2 }, villagers: ['Bruno', 'Fennel'] },
  bakehouse: { title: 'Meadow bakehouse', needs: { planks: 2, stone: 2, apples: 2 }, villagers: ['Bruno', 'Pip', 'Dot'] },
};
Object.assign(projects, neighborhood);

export function plotProject(progress, name) {
  const [x, z] = plots[progress.plots[name]];
  return { ...projects[name], site: [x, z], approach: [x, z + 2.8], photoSpot: [x, z + 3.2] };
}

export const villageJobs = [
  { id: 'market', villager: 'Hazel', title: 'Open the market stall', start: [-5, 23], stop: [-19, 16], finish: [-5, 23], pickup: 'Pick farm flowers', delivery: 'Deliver flowers to Hazel', cargo: 'flowers', line: 'Pick flowers at the north edge of the farm. I’ll put them on display at the market.' },
  { id: 'pond', villager: 'Reed', title: 'Check the pond trail', start: [-16, 37], stop: [-22, 41], finish: [-16, 37], pickup: 'Check the pond marker', delivery: 'Report back to Reed', cargo: 'trail report', line: 'Check the marker near the Lily Pond dock and tell me how the trail looks.' },
  { id: 'orchard', villager: 'Clover', title: 'Stock the cider stand', start: [-28, 2], stop: [-36, 1], finish: [-28, 2], pickup: 'Collect cider apples', delivery: 'Deliver apples to Clover', cargo: 'cider apples', line: 'My cider apples are in a crate at the north edge of the orchard. Can you fetch them?' },
];
Object.assign(projects, Object.fromEntries(villageJobs.map(job => [job.id, {
  title: job.title, site: job.finish, approach: [job.finish[0], job.finish[1] + 3], villagers: [job.villager],
}])));

export const deposits = [
  { id: 'creek', kind: 'wood', name: 'fallen branches', tool: 'Hatchet', x: 46, z: -23.7, amount: 3 },
  { id: 'woods', kind: 'wood', name: 'fallen branches', tool: 'Hatchet', x: -5, z: -32, amount: 4 },
  { id: 'meadow', kind: 'stone', name: 'loose stone', tool: 'Pickaxe', x: 52, z: -27, amount: 3 },
  { id: 'highlands', kind: 'stone', name: 'loose stone', tool: 'Pickaxe', x: -58, z: -24, amount: 2 },
  { id: 'orchard', kind: 'apples', name: 'apple basket', x: -38, z: 1, amount: 3 },
  { id: 'grove', kind: 'wood', name: 'stormfall timber', tool: 'Hatchet', x: 47, z: -31, amount: 8 },
  { id: 'quarry', kind: 'stone', name: 'meadow quarry stone', tool: 'Pickaxe', x: 61, z: -33, amount: 6 },
  { id: 'meadow-apples', kind: 'apples', name: 'meadow apples', x: 48, z: -24, amount: 2 },
  { id: 'cave', kind: 'copper', name: 'copper seam', tool: 'Pickaxe', x: -85, z: -37, amount: 2 },
];

export const workbench = [-12, -12];
const key = 'willowbend-rebuild-v1';
export const materials = ['wood', 'planks', 'stone', 'apples', 'copper', 'lantern'];

export const itemNames = {
  wood: ['Wood', 'wood'],
  planks: ['Planks', 'planks'],
  stone: ['Stone', 'stone'],
  apples: ['Apples', 'apples'],
  copper: ['Copper', 'copper'],
  lantern: ['Lantern', 'lanterns'],
  bread: ['Bread', 'bread'],
  cider: ['Cider', 'cider'],
  pebble: ['Polished pebble', 'polished pebbles'],
};

const startingSupplies = {
  Mabel: { wood: 1 }, Pip: { apples: 2, bread: 1 }, Bruno: { planks: 1 },
  Dot: { stone: 1 }, Biscuit: { wood: 2 }, Fennel: { stone: 2, pebble: 1 },
  Hazel: { apples: 1 }, Reed: { stone: 1 }, Clover: { apples: 3, cider: 1 },
};

export function moveItems(from, to, item, count) {
  if (!Object.hasOwn(itemNames, item) || !Number.isSafeInteger(count) || count < 1 || count > (from[item] ?? 0)) return false;
  const total = (to[item] ?? 0) + count;
  if (!Number.isSafeInteger(total)) return false;
  from[item] -= count;
  to[item] = total;
  return true;
}

export function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    if (data?.version === 1) {
      data.plots ??= {};
      data.jobs ??= {};
      data.errands ??= {};
      data.opening ??= false;
      data.villagerSupplies ??= structuredClone(startingSupplies);
      for (const name of Object.keys(projects)) data.built[name] ??= {};
      return data;
    }
  } catch {}
  return {
    version: 1, started: false, villagerSupplies: structuredClone(startingSupplies), plots: {}, jobs: {}, errands: {}, opening: false, photos: {}, gathered: [],
    inventory: Object.fromEntries(materials.map(name => [name, 0])),
    built: Object.fromEntries(Object.keys(projects).map(name => [name, {}])),
  };
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function complete(progress, name) {
  return Object.entries(projects[name].needs).every(([item, count]) => progress.built[name][item] >= count);
}

export function contribute(progress, name) {
  const paid = progress.built[name];
  const added = [];
  for (const [item, required] of Object.entries(projects[name].needs)) {
    const count = Math.min(progress.inventory[item], required - (paid[item] ?? 0));
    if (!count) continue;
    progress.inventory[item] -= count;
    paid[item] = (paid[item] ?? 0) + count;
    added.push(count + ' ' + item);
  }
  return added;
}

export function remaining(progress, name) {
  return Object.entries(projects[name].needs)
    .map(([item, count]) => [item, count - (progress.built[name][item] ?? 0)])
    .filter(([, count]) => count > 0)
    .map(([item, count]) => count + ' ' + item)
    .join(', ');
}
