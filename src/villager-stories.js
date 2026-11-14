const arcs = {
  Mabel: [
    ['Tell me about the postcard', 'Rowan used to send these to anyone who moved away. I kept one for you.'],
    ['Help save the old photographs', 'I used to think keeping everything safe meant keeping it in a drawer. Let’s leave the scrapbook where everyone can add to it.'],
    ['Add a page for today', 'I’ve left a blank page for whatever happens next. That’s my favorite one.'],
  ],
  Bruno: [
    ['Ask about the old cottage', 'I used to build everything with Rowan. When they left I stopped asking anyone to hold the other end of the board.'],
    ['Learn woodworking', 'Mark the grain before you cut. And when a board is too long, ask a friend to take the other end.'],
    ['Share the work', 'Hazel needed a shelf. This time I asked her to help me put it up. We finished before lunch.'],
  ],
  Pip: [
    ['Ask what went wrong with the pastries', 'I burnt the bottoms and hid the tray. Clover found it anyway. I thought they were laughing at me.'],
    ['Talk about the tasting', 'Clover told me the burnt batch reminded them of their first pie. We laughed for a while. I think we both needed that.'],
    ['Ask what’s in the oven', 'The pastry you picked is on the counter again today. People come for it, then stay to talk.'],
  ],
  Dot: [
    ['Talk about getting lost', 'I know the pond better than anyone. The woods feel different. I used to turn around as soon as I couldn’t hear the water.'],
    ['Talk about the lantern trail', 'Going with you felt different. I heard the water from farther away than I thought I could.'],
    ['Invite Dot to the well', 'I’ll be there. I think I’m ready to tell the others what we saw.'],
  ],
  Biscuit: [
    ['Ask why Biscuit races', 'When everyone stopped meeting at the well, I started racing leaves so I’d have someone to beat.'],
    ['Ask for a treasure hunt', 'I hid a keepsake near the north trail, just past the last village sign. Go look. That’s more fun than racing me again.'],
    ['Share the treasure', 'You found it! I think the next hunt should be one we make together.'],
  ],
  Fennel: [
    ['Ask about the boot-shaped pebble', 'Rowan used a little boot mark to sign things. I started looking for it in every stone after they left.'],
    ['Ask what the cave remembers', 'It’s the echoes I like. Call once, then leave room for something to answer.'],
    ['Return Rowan’s story', 'I can stop looking for a message in every stone now. I’ll still keep the ones that look like boots.'],
  ],
  Hazel: [
    ['Ask about the empty market table', 'I set it out for people who don’t have anything to sell. They can still have somewhere to sit.'],
    ['Help welcome the neighbors', 'I’ll put a jug of cider there. First person to sit down gets to pour for the others.'],
    ['Visit the market table', 'People bring chairs now. I don’t even have to ask.'],
  ],
  Reed: [
    ['Ask about the quiet side of the pond', 'We used to run straight down to the water. Now I leave the reeds alone and the frogs come out again.'],
    ['Ask what you can spot', 'Watch the ripples. If you sit still, a fish will make a ring that moves against the current.'],
    ['Tell Reed what you saw', 'Next time, bring someone who’s had a hard day. The pond has room for two.'],
  ],
  Clover: [
    ['Ask about the apple rivalry', 'I made it a contest because I was afraid Pip would stop asking me to bake with them.'],
    ['Talk about baking together', 'I took the tart apples and Pip made the pastry. It turns out neither of us could have made it alone.'],
    ['Ask about tomorrow’s batch', 'Pip writes down the orders and I save a little extra. There’s always someone who forgot to ask.'],
  ],
};

const endingRequirements = {
  Mabel: ({ life }) => life.scrapbook,
  Bruno: ({ life }) => life.repair,
  Pip: ({ life }) => life.batch,
  Dot: ({ life }) => life.lantern === 'found',
  Biscuit: ({ life }) => life.treasure === 'found',
  Fennel: ({ life }) => life.keeper,
  Hazel: ({ errands }) => errands.market === 'done',
  Reed: ({ life }) => life.catches > 0,
  Clover: ({ life }) => life.batch,
};
const friendshipGoals = [1, 2, 4];

export function availableArc(progress, name) {
  const bond = progress.life.bonds[name];
  const stage = bond?.stage ?? 0;
  const scene = arcs[name]?.[stage];
  if (!scene || (bond?.points ?? 0) < friendshipGoals[stage]) return null;
  if (stage === 2 && !endingRequirements[name](progress)) return null;
  return scene;
}
