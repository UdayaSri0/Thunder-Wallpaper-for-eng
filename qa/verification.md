# Verification — 18 September 2026

## Automated logic checks

`node tools/test.cjs`: **12 checks passed**.

- All runtime HTML references resolve to local files.
- All 18 Wallpaper Engine properties match the runtime schema and defaults.
- Partial property updates, malformed values, and numeric bounds handled.
- Host pause and global FPS callbacks handled.
- 30,000 depth selections: 55.2% internal, 24.5% middle, 20.3% foreground.
- Frequency samples are non-periodic and ordered from Very Rare to Storm.
- 500 generated bolts have unique finite geometry with bounded branching.
- A simulated 20-minute normal storm produced 128 events with a maximum of three simultaneous live events; queues stayed bounded.
- Reduced mode produced one pulse per event, no clusters, and at least 10 seconds between events even at twice normal animation speed.
- Disabling lightning clears live events and queues; zero depth weights remain valid.
- Manual cooldown and schedule reset verified.
- Short pulses remain visible at 30 FPS even at twice normal animation speed.

## Browser runtime checks

`tools/runtime.html`: **12 checks passed** in the embedded Chromium browser at a 1280 × 800 viewport, with Balanced clouds.

- WebGL shader compilation.
- Live host property updates for rain and render quality.
- Observed rates: **29.9 FPS at 30**, **45.0 FPS at 45**, **60.0 FPS at 60** over short two-second sampling windows. These are local observations, not a hardware-independent performance guarantee.
- Host FPS cap, pause, and resume.
- Zero animation speed freezes the simulation clock.
- Simulated WebGL context loss and restoration without GL rendering errors.
- Reduced-flash pulse structure.

The browser's injected instrumentation emitted an unrelated MutationObserver message with no source URL while inspecting the iframe test page. The wallpaper has no MutationObserver code. Browser timing measurements remained separate from the native Wallpaper Engine check.

## Visual checks

Inspected the live wallpaper and deterministic rendering fixtures for:

- 1280 × 720 (16:9), 1280 × 800 (16:10), and 1680 × 720 (21:9).
- Calm cloud visibility; internal, middle, and foreground lightning; localized illumination.
- Reduced-flash brightness and optional rain.
- Canvas fallback with WebGL unavailable.
- Settings panel, Rain selection, Reduced Flash checkbox, and Reset behavior.

Captures are stored beside this file. The wallpaper thumbnail is a capture of the foreground-lightning fixture.

## Compatibility scope

The property format was checked against official Wallpaper Engine documentation and an installed first-party web wallpaper's `project.json`. The callback lifecycle was exercised using the documented API in a browser. The final project was then installed in Wallpaper Engine 2.8.42, opened in the native editor, confirmed to expose all 18 properties, applied to the desktop, and observed running through Wallpaper Engine's web wallpaper process.

The browser's URL policy prevented automated navigation directly to `file://`, so visual tests used an optional loopback server limited to the project folder. Runtime files use classic scripts and relative paths without fetch, module loading, CDNs, or server APIs; opening `index.html` locally is the intended deployment path.
