# Thunder — A Living Storm

A fully offline, procedural thunderstorm for **Wallpaper Engine Web Wallpaper**. Dark blue-grey clouds drift at three depths; intermittent lightning lights up their texture, with occasional branching foreground bolts. No third-party runtime libraries, downloads, server, APIs, audio, or image assets are required.

## Quick start

Open **`index.html`** in a current desktop browser. Keep the whole folder together. The entry point uses classic local scripts, so `file://` works without a build step or a server.

- **S** opens the settings panel; **Esc** closes it.
- Moving the pointer reveals the small settings button in the lower-right corner.
- Click the sky to trigger a randomized strike near the pointer. The normal cooldown is 1.2 seconds; Reduced Flash Mode enforces at least 10 seconds between events. Clicking is optional and can be disabled.
- Browser settings are remembered locally where browser storage is available. **Reset** restores defaults.
- The scene starts calm. The first natural lightning event is randomly delayed, and rain is off by default.

## Add to Wallpaper Engine

1. Extract `Thunder-Wallpaper.zip` into its own folder, or use this project's main folder.
2. Open Wallpaper Engine's wallpaper editor, choose **Create Wallpaper**, and select or drag in **`index.html`**.
3. Select the web wallpaper option if prompted, then save and apply the wallpaper.
4. The included **`project.json`** contains all 18 user properties. Check **Edit → Change Project Settings** in the editor. Wallpaper Engine makes a copy of the source folder when importing.
5. If the importer regenerates `project.json` and the controls are absent, open the imported folder using **Edit → Open in Explorer**. Copy the `general.properties` object from this project's `project.json` into the imported `project.json`, preserving the imported file's other fields. Reopen the project. You can also register the same property keys manually in Change Project Settings.
6. Select the applied wallpaper in the **Installed** tab to use its native settings. Mouse interaction depends on Wallpaper Engine forwarding mouse input; the native property controls work independently.

For an existing editable installation, keep `index.html`, `project.json`, `preview.jpg`, `css/`, `js/`, and `assets/` together under its project directory. The distribution ZIP includes only the wallpaper and its documentation, not the development checks.

Official references: [Creating a Web Wallpaper](https://docs.wallpaperengine.io/en/web/first/gettingstarted.html), [User Properties](https://docs.wallpaperengine.io/en/web/customization/properties.html), and [Property Listener API](https://docs.wallpaperengine.io/en/web/api/propertylistener.html).

## How it works

### Cloud and atmosphere rendering

`js/clouds.js` creates a small random noise texture once. A WebGL shader samples it at multiple scales to build independently moving far, main, and foreground cloud fields. Different offsets, scales, directions, shadowing, and coverage produce depth without a short repeating animation. A lower foreground haze catches a little lightning spill. The default scene retains cloud detail during quiet periods.

Lightning illumination uses localized light positions, a soft falloff, and the current cloud field's density and shading. It preserves cloud texture and uses tone mapping to limit highlights. The sky receives only a small amount of spill. A vignette keeps the edges subdued.

When WebGL is unavailable or shader initialization fails, cached procedural Canvas cloud banks provide a simpler fallback. The fallback preserves the event system, controls, rain, and fog, but approximates cloud illumination and bolt occlusion. WebGL gives the intended appearance. WebGL context loss pauses cloud drawing; a restored context rebuilds its resources.

### Lightning, depth, and storm clusters

`js/lightning.js` schedules events in simulation time, never with a fixed repeating interval. Delays are drawn from the chosen frequency range, with occasional short gaps and longer quiet periods. A cluster can begin with a weak internal flash and continue with independently selected strikes after irregular gaps.

Each event has its own position, depth, intensity, duration, and pulse envelope. Regular events can have one to four flashes, generally totaling around 150–600 milliseconds. Bolt geometry uses recursively displaced segments and two branching levels. Bright cores, a middle glow, and a wider soft glow are drawn separately.

The bolt texture encodes the three depths in separate channels. The cloud shader attenuates internal and middle-depth bolts through different density masks; foreground bolts remain clearly visible. The full scene is never replaced by a white flash. Up to four live events are kept in memory.

### Rain and interaction

`js/weather.js` reuses a fixed particle pool for restrained diagonal rain: Off, Light, Medium, or Heavy. Rain defaults to Off. Optional image overlays are loaded once. Pointer clicks create a local event through the same manager and respect both the enabled switch and the reduced-flash cooldown.

## Settings

All settings are available in Wallpaper Engine. Browser equivalents appear in the hidden settings panel.

| Property key              | Control                                      | Default         |
| ------------------------- | -------------------------------------------- | --------------- |
| `cloudspeed`              | Cloud speed                                  | 35%             |
| `clouddensity`            | Cloud density                                | 65%             |
| `cloudbrightness`         | Cloud brightness                             | 55%             |
| `fogamount`               | Fog amount                                   | 25%             |
| `rainamount`              | Off / Light / Medium / Heavy                 | Off             |
| `lightningenabled`        | Lightning enabled                            | On              |
| `lightningfrequency`      | Very rare / Rare / Normal / Frequent / Storm | Normal          |
| `lightningintensity`      | Lightning intensity                          | 75%             |
| `visibleboltfrequency`    | Foreground bolt weight                       | 20              |
| `cloudlightningfrequency` | Internal lightning weight                    | 55              |
| `middleboltfrequency`     | Middle-cloud bolt weight                     | 25              |
| `lightningglow`           | Lightning glow strength                      | 65%             |
| `lightningcolour`         | Lightning colour                             | Cold blue-white |
| `reducedflash`            | Reduced Flash Mode                           | Off             |
| `animationfps`            | 30 / 45 / 60 / Unlimited                     | 60              |
| `animationspeed`          | Master animation speed                       | 100%            |
| `quality`                 | Efficient / Balanced / High cloud detail     | Balanced        |
| `interactive`             | Click to stir the storm                      | On              |

`window.wallpaperPropertyListener` is registered synchronously by `js/wallpaper-properties.js`. It handles partial `applyUserProperties` updates, Wallpaper Engine's global FPS cap via `applyGeneralProperties`, and `setPaused`. Values are validated and constrained. The host's first property update replaces saved browser preferences with project defaults before applying host settings, so browser experimentation cannot silently change the installed wallpaper.

Colour values use Wallpaper Engine's normalized RGB string format, such as `0.73 0.85 1`. The colour picker also allows a purple palette if desired; the default is a restrained cold blue.

### Lightning frequency and probabilities

At 100% master speed, the base waiting ranges are:

| Frequency | Base wait     |
| --------- | ------------- |
| Very rare | 20–60 seconds |
| Rare      | 12–30 seconds |
| Normal    | 5–18 seconds  |
| Frequent  | 2–8 seconds   |
| Storm     | 0.5–4 seconds |

These are distributions, not schedules or strict bounds. Occasional silence multipliers and cluster gaps add variation. Master animation speed scales cloud movement, rain, and event timing; 0 freezes the simulation.

The three depth sliders are **relative weights**, normalized together. Defaults of 55 / 25 / 20 produce approximately 55% internal, 25% middle, and 20% foreground selections. Cluster lead-ins add some extra internal flashes. Set a weight to zero to omit that depth from ordinary selections. If all three are zero, events fall back to internal illumination. Turn Lightning Enabled off to disable every event, including click-triggered ones.

To change the defaults in source, edit `Storm.schema` in `js/config.js`. To change timing distributions or cluster behavior, edit `delay()` and `cluster()` in `js/lightning.js`. After changing the schema, run `node tools/build-project.cjs` to synchronize `project.json`; Node is only a development convenience and is not needed to run the wallpaper.

### Reduced Flash Mode

Reduced Flash Mode limits intensity, replaces rapid flashes with one longer soft pulse, removes clusters, nearly eliminates sky spill, and enforces a minimum 10-second real-time interval between events even at 200% animation speed. Existing flashes and queued events are cleared when the mode changes. Browser first use also honors the operating system's reduced-motion preference unless browser settings have already been saved. Wallpaper Engine uses the selected native property value.

This setting still includes changing light. Switch Lightning Enabled off to remove flashes completely.

## Optional cloud images

No images are needed for the cloud system. To add your own:

1. Put transparent PNG/WebP images with soft edges in `assets/clouds/`.
2. Add relative paths to `Storm.cloudTextures` in `js/config.js`:

   ```js
   Storm.cloudTextures = [
     "assets/clouds/cloud-01.webp",
     "assets/clouds/cloud-02.png",
   ];
   ```

3. Reload the wallpaper. Up to eight textures are loaded once and drift over the procedural scene. Failed images are skipped. These optional overlays are decorative foreground layers; the density-based lightning lighting belongs to the procedural clouds beneath them.

Prefer approximately 1024 × 512 images to keep memory use modest. Use images you own or have permission to use. There are no external or copyrighted image dependencies in this project.

## Performance

- Animation uses one `requestAnimationFrame` loop with elapsed-time updates and a frame limiter. The effective cap is the lower of the wallpaper's limit and Wallpaper Engine's global limit. Unlimited still respects the host's limit.
- Rendering stops when the document is hidden or the host pauses the wallpaper; clocks reset on resume to prevent catch-up bursts.
- Balanced clouds render at up to 1250 pixels wide, Efficient at 850, and High at 1800, all capped at 1000 pixels high. The cloud buffer is smoothly scaled to the display; bolt and rain buffers have independent caps.
- The noise texture, Canvas fallback textures, rain particles, and canvases are reused. Bolt uploads occur only during visible flashes. Event and image counts are bounded.
- For lower laptop power use, select **30 FPS**, **Efficient**, and **Rain Off**. Use Wallpaper Engine's own pause rules while gaming, using fullscreen apps, or running on battery.
- 60 FPS is the default target, not a guarantee on every display or GPU. High detail and heavy rain use more resources. Browser developer tools and recording can affect measurements.

## Project layout

```text
index.html                    Main entry point
project.json                  Wallpaper Engine metadata and user properties
preview.jpg                   Wallpaper thumbnail
css/style.css                 Scene and optional settings panel
js/config.js                  Defaults, property schema, optional image paths
js/clouds.js                  WebGL cloud composition and Canvas fallback
js/lightning.js               Scheduling, pulses, clusters, procedural bolts
js/weather.js                 Optional rain and image overlays
js/wallpaper-properties.js    Host callbacks and validated settings
js/main.js                    Animation loop, input, UI, resize and pause
assets/clouds/                Optional user textures
tools/                       Development checks; omitted from distribution
qa/                          Visual verification captures; omitted from distribution
```

## Verification and development

- Run `node tools/test.cjs` for deterministic logic checks, including a simulated 20-minute storm, distribution sampling, randomized bolt geometry, malformed properties, disabled events, and reduced-flash cooldowns.
- `node tools/preview.cjs` serves only this project at `http://127.0.0.1:8765` for development browsers that prohibit `file://` navigation. Stop it with Ctrl+C when finished. This is optional and is not part of wallpaper operation.
- Visit `/tools/runtime.html` on that preview to check live property updates, observed frame limits, host pause/resume, zero-speed behavior, and WebGL context restoration.
- Visit `/tools/visual.html` for a deterministic calm cloud view. Add `?depth=0`, `?depth=1`, or `?depth=2` to inspect each strike depth; `&reduced=1`, `&rain=2`, and `&fallback=1` inspect the other rendering paths. These are static QA fixtures, not the live wallpaper.
- `qa/verification.md` records the checks performed for this delivery. The native Wallpaper Engine editor/apply workflow still needs to be completed on import; callback tests simulate its documented API.

Only local relative paths appear in the runtime. There are no network requests, build dependencies, or external fonts.
