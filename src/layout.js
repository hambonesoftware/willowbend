// The map: where everything is, the shape of the land, and what you can walk on.
// x runs east, z runs south. The village sits at the origin; the wilds spread out on every side
// and a ring of mountains closes the horizon (no island: the river runs in and out through it).
import { fbm, lerp, smooth, polyDist, clamp } from './util.js';

export const WATER = -0.45;
export const WORLD = 300;                  // terrain mesh size
export const RING = { x: 0, z: -8, r: 100 }; // mountains begin past this radius
export const LIMIT = 108;                  // hard walk limit from RING centre

export const RIVER = [[30, -160], [34, -100], [40, -62], [31, -22], [33, 10], [46, 44], [58, 80], [66, 160]];
export const POND = { x: -34, z: 42, r: 11 };
export const BRIDGE = { x0: 22.5, x1: 39.5, z: -21, w: 1.7 };

export const PATHS = {
  north: [[0, -6], [-1, -18], [-4, -32], [-9, -48], [-7, -64], [-11, -80]],
  east: [[6, -1], [15, -9], [21, -20], [41, -21], [52, -27], [66, -36], [72, -38]],
  west: [[-6, 0], [-16, -3], [-28, -6], [-44, -14], [-58, -24], [-72, -32], [-82, -36]],
  south: [[0, 6], [0, 18], [1, 30], [-6, 40], [-21, 44]],
};
const pathList = Object.values(PATHS);
export const pathDist = (x, z) => Math.min(...pathList.map(p => polyDist(p, x, z)));

export const SITES = {
  plaza: { x: 0, z: 0, r: 6.5 },
  farm: { x: -21, z: 21, w: 11, d: 8 },
  orchard: { x: -38, z: 9 },
  glade: { x: -12, z: -88, r: 10 },
  tower: { x: 76, z: -38 },
  cave: { x: -91, z: -38 },
};

export function height(x, z) {
  let h = fbm(x * 0.017, z * 0.017, 4) * 3.0 + 0.95 + fbm(x * 0.07, z * 0.07, 2) * 0.3;
  h += smooth(42, 8, Math.hypot(x + 80, z + 32)) * 5.0;              // Pebble Highlands
  h += smooth(16, 4, Math.hypot(x - SITES.tower.x, z - SITES.tower.z)) * 4.2; // watchtower hill
  const r = Math.hypot(x - RING.x, z - RING.z);
  const m = smooth(RING.r - 2, RING.r + 38, r);
  h += m * (20 + fbm(x * 0.035, z * 0.035, 3) * 12);
  h = lerp(h, 0, smooth(34, 22, Math.hypot(x, z)));                 // the village is level
  h = lerp(h, 0.05, smooth(10, 6, Math.hypot(x - SITES.farm.x, z - SITES.farm.z)));
  h = lerp(h, 0.2, smooth(13, 8, Math.hypot(x - SITES.glade.x, z - SITES.glade.z)) * 0.8);
  // roads stay dry and are graded a little so they never run up a sudden bump
  const dpath = pathDist(x, z);
  if (dpath < 5) h = lerp(h, Math.max(h * 0.85, 0.15), smooth(5, 1.5, dpath));
  const dp = Math.hypot(x - POND.x, z - POND.z);
  h = lerp(h, Math.min(h, 0.1), smooth(POND.r + 7, POND.r + 2, dp));
  h = lerp(h, -1.7, smooth(POND.r + 1, POND.r - 4, dp));
  const dr = polyDist(RIVER, x, z);
  h = lerp(h, Math.min(h, 0.15), smooth(11, 5.5, dr));
  h = lerp(h, -1.9, smooth(5.0, 2.2, dr));
  return h;
}

export function bridgeDeck(x) {
  const t = clamp((x - BRIDGE.x0) / (BRIDGE.x1 - BRIDGE.x0), 0, 1);
  return 0.18 + Math.sin(t * Math.PI) * 0.95;
}
export function onBridge(x, z) {
  return x > BRIDGE.x0 - 0.3 && x < BRIDGE.x1 + 0.3 && Math.abs(z - BRIDGE.z) < BRIDGE.w;
}
// Ground height under a walker, counting the bridge deck.
export function groundAt(x, z) {
  const h = height(x, z);
  return onBridge(x, z) ? Math.max(h, bridgeDeck(x)) : h;
}

// Solid things the props register as they are placed: circles on the ground.
export const solids = [];
const CELL = 8, grid = new Map();
export function addSolid(x, z, r) {
  const s = { x, z, r };
  solids.push(s);
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
    const k = i + ',' + j;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(s);
  }
  return s;
}
export function hitSolid(x, z, r) {
  const list = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
  if (list) for (const s of list) {
    const dx = x - s.x, dz = z - s.z, rr = r + s.r;
    if (dx * dx + dz * dz < rr * rr) return s;
  }
  return null;
}

export function walkable(x, z, r = 0.45) {
  if (Math.hypot(x - RING.x, z - RING.z) > LIMIT) return false;
  if (onBridge(x, z)) return Math.abs(z - BRIDGE.z) < BRIDGE.w - 0.35;
  const h = height(x, z);
  if (h < WATER + 0.12) return false;
  if (h > 9.5) return false;
  return !hitSolid(x, z, r);
}

// Named places, so walking somewhere new says where you are.
export function zoneAt(x, z) {
  const d = (s, px, pz) => Math.hypot(x - px, z - pz) < s;
  if (d(16, SITES.glade.x, SITES.glade.z)) return 'Elder Tree Glade';
  if (d(18, SITES.tower.x, SITES.tower.z)) return 'Old Watchtower';
  if (d(13, SITES.cave.x, SITES.cave.z)) return 'Echo Cave';
  if (d(17, POND.x, POND.z)) return 'Lily Pond';
  if (Math.abs(x - SITES.farm.x) < 8 && Math.abs(z - SITES.farm.z) < 7) return 'Village Farm';
  if (d(11, SITES.orchard.x, SITES.orchard.z)) return 'Appleby Orchard';
  if (d(29, 0, 0)) return 'Willowbend Village';
  if (polyDist(RIVER, x, z) < 10) return 'Bramble Creek';
  if (z < -28 && x < 24) return 'Whispering Woods';
  if (x < -52) return 'Pebble Highlands';
  if (x > 36) return 'Sunny Meadow';
  return 'The Wilds';
}
