# Willowbend

Willowbend is a small cel-shaded village you can explore in a browser. Talk to Bruno to help finish a house.

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

## Browser tour

Run `npm test` with Edge or Chrome installed. Set `BROWSER_PATH` for a different Chromium executable, or install Playwright Chromium with `npx playwright-core install chromium`. The tour saves screenshots to `test-results/`.

To check a deployment that includes the same test hooks and features, set `WB_URL` to its base URL before running `npm test`. The [GitHub Pages site](https://hambonesoftware.github.io/willowbend/) is served from the repository.
