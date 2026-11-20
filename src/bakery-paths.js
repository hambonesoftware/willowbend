import { walkable } from './layout.js';

const step = .8;
const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

// Find footpaths around the cottages and courtyard furniture when a villager changes stations.
function route(start, target) {
  const [tx, tz] = target;
  const key = (x, z) => x + ',' + z;
  const clear = (x, z) => walkable(tx + x * step, tz + z * step, .44);
  const sx = Math.round((start[0] - tx) / step), sz = Math.round((start[1] - tz) / step);
  const first = { x: sx, z: sz, cost: 0, estimate: Math.hypot(sx, sz), previous: null };
  const frontier = [first], seen = new Map([[key(sx, sz), first]]);
  for (let attempts = 0; frontier.length && attempts < 2600; attempts++) {
    let best = 0;
    for (let i = 1; i < frontier.length; i++) if (frontier[i].estimate < frontier[best].estimate) best = i;
    const current = frontier.splice(best, 1)[0];
    if (current.x === 0 && current.z === 0) {
      const points = [];
      for (let node = current; node; node = node.previous) points.unshift([tx + node.x * step, tz + node.z * step]);
      return points;
    }
    for (const [dx, dz] of neighbors) {
      const x = current.x + dx, z = current.z + dz;
      if (Math.abs(x) > 65 || Math.abs(z) > 65 || !clear(x, z)) continue;
      if (dx && dz && (!clear(current.x + dx, current.z) || !clear(current.x, current.z + dz))) continue;
      const cost = current.cost + Math.hypot(dx, dz);
      const id = key(x, z), known = seen.get(id);
      if (known && known.cost <= cost) continue;
      const node = { x, z, cost, estimate: cost + Math.hypot(x, z), previous: current };
      seen.set(id, node);
      frontier.push(node);
    }
  }
  return [];
}

export function bakerPath(villager, destination) {
  // Nighttime house destinations are handled by the existing village schedule.
  if (!walkable(...destination, .44)) return destination;
  const journey = villager.bakeryJourney;
  if (!journey || Math.hypot(journey.target[0] - destination[0], journey.target[1] - destination[1]) > .1) {
    villager.bakeryJourney = { target: [...destination], points: route([villager.x, villager.z], destination), next: 0 };
  }
  const current = villager.bakeryJourney;
  while (current.next < current.points.length - 1 &&
    Math.hypot(villager.x - current.points[current.next][0], villager.z - current.points[current.next][1]) < .38) current.next++;
  return current.points[current.next] ?? destination;
}
