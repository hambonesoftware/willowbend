// Authored plots around the square. Local +z faces the square; the centre of each
// entrance stays clear for walkers, deliveries, and evening homeward journeys.
export const villageHomes = [
  { id: 'mabel', name: 'Mabel', site: [-10, -9], style: 'keepsakes', front: 4.5, bloom: 0xc9a1a5,
    wall: 0xfff0d2, roof: 0xb6836d, door: 0x4f9bd6, trail: [[-6.65, -5.99], [-4.8, -4.4]] },
  { id: 'biscuit', name: 'Biscuit', site: [8, -14], style: 'play', front: 4.5, bloom: 0xd6bd76,
    wall: 0xffe2c8, roof: 0x718b80, door: 0xf2a541, w: 3, trail: [[5.77, -10.09], [3.5, -8], [1.5, -6.6]] },
  { id: 'dot', name: 'Dot', site: [15, 3], style: 'rain', front: 4.5, bloom: 0xb8b5cf,
    wall: 0xe9f3ff, roof: 0xb6a477, door: 0xe8604c, trail: [[10.59, 2.12], [8.4, .5], [6.4, .3]] },
  { id: 'pip', name: 'Pip', site: [11, 13], style: 'herbs', front: 2.8, bloom: 0xd1b88a,
    wall: 0xfde8ef, roof: 0x968892, door: 0x6cc45e, w: 2.6, trail: [[9.19, 10.86], [8.7, 12.5], [5.2, 14], [1.3, 14]] },
  { id: 'fennel', name: 'Fennel', site: [-11, 12], style: 'stones', front: 4.5, bloom: 0xe1d5b4,
    wall: 0xfff0d2, roof: 0xa48069, door: 0x3fa7a0, w: 2.6, trail: [[-7.96, 8.68], [-6, 6.7], [-5, 4.8]] },
  { id: 'sewing', name: 'Sewing room', site: [-16, 3], style: 'sewing', front: 4.5, bloom: 0xc4a0b6,
    wall: 0xe8f6e4, roof: 0x89998b, door: 0x8f7bd8, trail: [[-11.58, 2.17], [-9, 2], [-6.4, 1.5]] },
];

export const homeFacing = home => Math.atan2(-home.site[0], -home.site[1]);
export function homePoint(home, x, z) {
  const angle = homeFacing(home), c = Math.cos(angle), s = Math.sin(angle);
  return [home.site[0] + c * x + s * z, home.site[1] - s * x + c * z];
}
