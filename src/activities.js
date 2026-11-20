import { bakeryStations } from './bakery-routines.js';

export const raceCourse = [[0, 24], [0, 29], [-3, 34], [-8, 37]];
export const treasureSite = [-2, -29];

const favoritePlaces = {
  Mabel: [[-7, 3], [-5, 21], [-2, 5]],
  Pip: [[7, 5.8], [-3, 8], [3, 5]],
  Bruno: [[-12, -12], [-14, -11], [-3, -5]],
  Dot: [[12, 4], [3, 24], [-4, 6]],
  Biscuit: [[3, -9], [0, 24], [4, 5]],
  Fennel: [[-8, -4], [-16, -4], [-5, -3]],
  Hazel: [[-5, 23], [-5, 23], [-6, 23]],
  Reed: [[-16, 37], [-19, 38], [-16, 37]],
  Clover: [[-28, 2], [-28, 2], [-27, 3]],
};

export function scheduledSpot(villager, phase, bakery, festival) {
  if (festival) {
    const index = Object.keys(favoritePlaces).indexOf(villager.name);
    const angle = index * Math.PI * 2 / 9;
    return [Math.sin(angle) * 5, Math.cos(angle) * 5];
  }
  if (phase === 'Night') return villager.home;
  if (bakery && bakeryStations[villager.name] && ['Morning', 'Afternoon'].includes(phase)) {
    return bakeryStations[villager.name].spot;
  }
  if (!bakery && villager.name === 'Pip' && phase === 'Morning') return [2.7, 19.1];
  return favoritePlaces[villager.name][['Morning', 'Afternoon', 'Evening'].indexOf(phase)];
}

export function timingHit(elapsed, center) {
  return Math.abs(elapsed % 2 - center) <= 0.31;
}
