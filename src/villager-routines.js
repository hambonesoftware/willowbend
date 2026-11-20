const roles = {
  Mabel: 'flowers', Bruno: 'woodwork', Dot: 'water', Biscuit: 'play',
  Fennel: 'study', Hazel: 'ledger', Reed: 'watch',
};

export function villagerRoutine(villager, destination, day, life) {
  if (!life.arrival || !destination || !['Morning', 'Afternoon'].includes(day.phase)) return null;
  if (villager.name === 'Dot' && life.lantern === 'invited') return null;
  const work = roles[villager.name];
  if (!work || Math.hypot(villager.x - destination[0], villager.z - destination[1]) > .28) return null;
  return { work, facing: { Bruno: -1.4, Hazel: .2, Reed: -1.4, Mabel: .6, Dot: 1.5, Fennel: -.3, Biscuit: .1 }[villager.name] };
}
