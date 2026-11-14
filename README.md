# Willowbend

Willowbend is a small cel-shaded village you can explore in a browser. Talk to Bruno to borrow a hatchet and begin rebuilding the cottage, bakery, and watchtower beacon.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run serve
```

Open http://127.0.0.1:8934/. The browser needs WebGL and access to jsDelivr for Three.js.

## Controls

- **Keyboard and mouse** — WASD or arrow keys to walk, Shift to run, Q/E or drag to turn, minus/plus or scroll to zoom, Space or Enter to interact.
- **Touch** — Tap to start. Drag from the left side to walk and from the right side to turn. Tap the action button when it appears.

## Rebuild Willowbend

Use the action button near a marked resource, the workbench, or a building site. The hatchet gathers wood and the pickaxe gathers stone and copper. The workbench turns wood into planks and copper into a lantern. You can deliver materials in batches. Each finished project adds a group portrait to the photo album.

Progress and photos save to this browser’s local storage. Keep using the same browser or home-screen installation to resume. Storage sharing between these modes depends on your browser. Clearing the game’s site data also clears the save. Playing requires a connection to load the game and Three.js.

## Backpack and supplies

Open **Backpack** from the HUD or press **B**. Supplies stack with no weight or slot limit. Tools and items needed for an active job have their own sections.

While talking, choose **Ask**, then **More topics** for **Give an item** and **Take supplies**. Pick an item and how many to transfer. Villagers start with different supplies and hold on to anything you give them so you can take it back later. Your backpack and each villager’s supplies are saved on the device.

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

Run `npm test` with Edge or Chrome installed. Set `BROWSER_PATH` for a different Chromium executable, or install Playwright Chromium with `npx playwright-core install chromium`. The tour saves screenshots to `test-results/`.

To check a deployment that includes the same test hooks and features, set `WB_URL` to its base URL before running `npm test`. The [GitHub Pages site](https://hambonesoftware.github.io/willowbend/) is served from the repository.
