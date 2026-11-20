export const bakeryStations = {
  Pip: { spot: [6.25, 5.25], facing: 2.2, work: 'knead' },
  Clover: { spot: [8.55, 5.25], facing: -2.2, work: 'mix' },
};

export function bakeryRoutine(villager, day, bakeryOpen, festival, interrupted) {
  const station = bakeryStations[villager.name];
  if (!station || !bakeryOpen || festival || interrupted || !['Morning', 'Afternoon'].includes(day.phase)) return null;
  return Math.hypot(villager.x - station.spot[0], villager.z - station.spot[1]) < .24 ? station : null;
}

