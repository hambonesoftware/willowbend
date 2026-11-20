# Willowbend

Willowbend is a small cel-shaded village you can explore in a browser. Show Mabel the old postcard to find a home and discover why the village stopped celebrating Lantern Night.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run serve
```

Open http://127.0.0.1:8934/. The browser needs WebGL and access to jsDelivr for Three.js.

## The Lanterns of Willowbend

Show Mabel the postcard on the south road. Then choose whether to help Pip bake or help Bruno repair a door first. Your cottage lets you change your outfit, decorate the porch, and rest until morning. Open the journal to read letters, review friendships, and find the next story lead. The mystery leads from the Elder Tree through Echo Cave to the old watchtower.

A day lasts about 22 minutes of play. Conversations and menus pause the clock, and you can rest to start a new day. Villagers have places to visit at different times of day. Friendships grow through visits, gifts, and time together. You can race Biscuit, look for buried treasure, fish at Lily Pond, tend the cottage garden, or take a scrapbook photo at Farmgate Market.

Gathered supplies return the next morning. The crate near the well holds shared supplies and accepts donations. Villagers can pitch in on building projects. Once Mabel welcomes you, the workbench lets you choose a plank batch. Celebrate at the well after solving the mystery and restoring the bakery and beacon. Return to the well in the evening after Lantern Night to catch up with your neighbors.

## A living storybook village

Homes and meadow buildings have textured plaster, timber trim, and tiled roofs. Market stalls and the bridge use warm, weathered wood. The square has worn paving, gardens soften the doorsteps, and the woods, orchard, glade, and pond use layered greenery and natural ground. Leaves and water move gently, birds circle the pond, and village windows and lamps glow after sunset.

Mabel tends flowers, Bruno works wood, Hazel keeps her ledger, Fennel studies stones, Dot waters plants, Reed watches wildlife, and Biscuit plays. Daytime activities follow their schedules and pause for conversation.

Restoring the bakery opens a tiled shopfront and a courtyard with a bread counter, prep bench, plants, and a place to sit. Pip and Clover wear their own aprons and work there in the morning and afternoon. They put their baking things down to talk, and neighbors give the conversation space. Evening lights the shop windows. The courtyard view comes a little closer as you walk in, and reduced motion quiets the decorative movement.

## Controls

- **Keyboard and mouse** — WASD or arrow keys to walk, Shift to run, Q/E or drag to turn, minus/plus or scroll to zoom, Space or Enter to interact.
- **Touch** — Tap to start. Drag from the left side to walk and from the right side to turn. Tap the action button when it appears.

## Rebuild Willowbend

Use the action button near a marked resource, the workbench, or a building site. The hatchet gathers wood and the pickaxe gathers stone and copper. The workbench turns wood into planks and copper into a lantern. You can deliver materials in batches. Each finished project adds a group portrait to the photo album.

Progress and photos save to this browser’s local storage. Keep using the same browser or home-screen installation to resume. Storage sharing between these modes depends on your browser. Clearing the game’s site data also clears the save. Playing requires a connection to load the game and Three.js.

## Backpack and supplies

Open **Backpack** from the HUD or press **B**. Supplies stack with no weight or slot limit. Browse supplies, tools, and job items, then select an illustrated item to see what it does and any nearby action.

While talking, choose **Items** to give a gift or take supplies. Pick an item tile and use the quantity buttons for larger stacks. Villagers start with different supplies and hold on to items you give them. Exchanges and friendship memories save on the device.

The workbench previews what each recipe spends and produces. The village crate shows both inventories. At a building site, check what you and your neighbors can contribute and how much the project will still need.

## Talk and listen

Use **Talk** near a villager. The camera moves closer and they greet you in a speech bubble. **Ask** brings up replies and questions at the bottom of the screen. You can ask for directions, personal stories, town news, or a reminder of your active jobs. If you’re carrying something a villager is waiting for, the action button offers to deliver it, with **Ask** alongside it.

**Space** or **Enter** uses the contextual action. While the reply strip is open, you can choose a reply by tapping it or using **Tab** and **Enter**. The number keys also select replies in order. Walk away, select **Goodbye**, or press **Esc** to return to your previous camera view.

Nearby villagers also stop, face each other, and talk. Their exchanges appear on screen as you explore, and you can ask a villager what you recently overheard.

## Visit the village outskirts

Follow the side paths from the south road to Farmgate Market and the Pond Trail Shelter. Hazel needs flowers from the farm, and Reed needs a report from the Lily Pond dock. The orchard path leads to Clover’s cider stand, where you can help bring in a crate of apples. Talk to each villager to start their job. Completing a job changes their stall and adds a group photo to the album.

## Build the meadow neighborhood

After opening the village bakery, cross Bramble Creek and use the Meadow Planning board near Meadow Rest. Choose which of the three marked lots gets the lodge, workshop, or bakehouse. Gather stormfall timber, quarry stone, and meadow apples, then deliver materials at each foundation. The completed workshop can also turn wood into planks close to the meadow.

Return to the board to assign Pip’s apple delivery and Bruno’s timber haul. When the three buildings and both deliveries are complete, celebrate opening day at the board. The album keeps each plot’s before and after portraits and the opening group photo. Use **Save photo** to download a JPEG.

## Browser tour

Run `npm test` with Edge or Chrome installed. Set `BROWSER_PATH` for a different Chromium executable, or install Playwright Chromium with `npx playwright-core install chromium`. Run `npm run test:story` for Lantern Night, `npm run test:inventory` for item exchanges, and `npm run test:bakery` for bakery routines, or `npm run test:art` for the village and landmark views, work interruptions, and phone controls after dark. The tour saves screenshots to `test-results/`. The story suite takes a screenshot on failure and replays the festival decision on a touch viewport.

To check a deployment that includes the same test hooks and features, set `WB_URL` to its base URL before running `npm test`. The [GitHub Pages site](https://hambonesoftware.github.io/willowbend/) is served from the repository.
