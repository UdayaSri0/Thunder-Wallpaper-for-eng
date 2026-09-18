# Thunder — A Living Storm

Thunder is a fully offline procedural thunderstorm for Wallpaper Engine Web Wallpaper. Multi-scale storm clouds drift and slowly evolve while coloured electrical leaders travel through internal, middle-cloud, and foreground channels. Leaders grow segment by segment, branches activate behind the tip, a fast return stroke illuminates the established channel, and occasional re-strikes leave a fading ionized trace.

The wallpaper has no runtime libraries, remote requests, downloaded audio, external fonts, or required image assets. Thunder is synthesized locally with the Web Audio API and is off by default.

## Quick start

Open `index.html` in a current desktop browser or import it as a Web Wallpaper in Wallpaper Engine.

- Press **S** to open browser settings and **Esc** to close them.
- Click the sky to summon a strike near the pointer. The standard manual cooldown is 1.2 seconds.
- Browser settings are stored as `thunder.settings.v2`; Reset restores the schema defaults.
- The scene starts calm, rain is off, and procedural thunder is off.
- Reduced Flash Mode enforces a 10-second real-time safety gap and suppresses rapid multi-strike activity.

## Add to Wallpaper Engine

1. Keep `index.html`, `project.json`, `preview.jpg`, `css/`, `js/`, and `assets/` together.
2. In Wallpaper Engine, choose **Create Wallpaper** and import `index.html` as a web wallpaper.
3. Save and apply the project. `project.json` exposes all 43 schema-driven user properties.
4. If an editor import replaces metadata, copy the `general.properties` object from this project’s generated `project.json` into the imported project metadata, preserving editor-owned fields.

The source uses classic local scripts, so `file://` works without a server or build step. Node is used only by development scripts.

## Lightning model

### Three independent colours

Colour 1 defaults to cold blue-white, Colour 2 to a restrained warm-neutral white, and Colour 3 to violet-blue. Each slot has its own enable switch. A strike selects and stores its colour when it is created; drawing never consults a global live colour.

With one enabled slot, every strike uses it. With two or three slots, selection is randomized. Double events usually prefer two different enabled colours, and triple events often use all three in randomized order, but occasional reuse prevents a mechanical pattern. If all slots are disabled, Colour 1 is used as a safe fallback.

Every active channel creates a few bounded, moving light samples carrying position, power, depth, and that strike’s RGB colour. The cloud shader ranks candidates and uploads the strongest eight, so simultaneous blue, white, and violet strikes illuminate different cloud regions correctly.

### Single, double, and triple events

Normal single strikes retain the irregular frequency model: range-based waits with occasional short activity and longer silence. Dedicated double and triple events run on independent statistical clocks and do not replace normal lightning.

**Average Double-Strike Gap is a statistical rarity control, not a countdown timer.** A value of 300 seconds does not mean a double strike occurs every five minutes. Gaps are drawn from a shifted exponential distribution with a small minimum, producing substantial variation around the selected long-term mean.

Average Triple-Strike Gap works the same way on a separate clock. Its 420-second default makes triple events substantially rarer than doubles at the 150-second default. Double events contain exactly two independent channels; triples contain exactly three. Each channel has its own geometry, position, depth, colour, intensity, propagation, return stroke, re-strikes, and thunder calculation.

Multi-Strike Minimum/Maximum Gap controls the randomized delay between channels inside a double or triple. Multi-Strike Spread controls how far positions can diverge without dividing the screen into rigid zones. Invalid minimum/maximum pairs are normalized centrally.

### Travelling channel lifecycle

Bolt geometry is generated once per strike. Every point stores cumulative length and normalized progress; paths are not rebuilt per frame.

1. The stepped leader advances from 0 to 1 and reveals only the reached part of the main channel.
2. A branch stays hidden until the main leader crosses its attachment threshold, then grows outward at its own slightly varied speed.
3. At the destination, a much faster, brighter return stroke moves back through the established path.
4. Re-strikes may reuse that same channel after randomized pauses. Maximum Re-strikes is a cap, not a guaranteed count.
5. Core, middle glow, broad bloom, and residual channel decay at different nonlinear rates.

Travel Speed and Fade Speed scale the relevant phases while retaining small per-strike variation. Destinations include cloud-to-ground, cloud-to-cloud, intra-cloud, diagonal, and partial descending channels. Internal leaders remain mostly obscured but their travelling cloud glow is visible; middle channels are diffused; foreground channels show the full lifecycle.

## Cloud renderer

`js/clouds.js` retains the original WebGL FBM foundation and adds a clearer scale hierarchy: broad cumulonimbus masses, rolling middle structure, and turbulence detail. Vertical tower shaping and dark lower banks create recognizable storm-cloud structure. Very slow domain deformation evolves formations without rapid boiling.

- **Cloud Contrast** changes the separation between dense dark masses and thin illuminated areas.
- **Cloud Turbulence** changes small/medium-scale warping.
- **Cloud Softness** changes erosion width and edge diffusion.

The shader accepts eight bounded colour-aware localized lights. The active leader tip is normally strongest; return strokes add important channel samples without uploading hundreds of points. Tone mapping and safety multipliers keep the whole screen from becoming pure white.

When WebGL is unavailable, cached Canvas cloud banks provide a simpler fallback. It preserves progressive coloured channels, double/triple events, re-strikes, moving coloured glow, weather, audio, and settings, while approximating advanced density occlusion.

## Procedural thunder

`js/thunder-audio.js` uses one reusable AudioContext. Each voice combines a short filtered-noise crack, a shaped low-pass noise rumble, and a low-frequency oscillator. Filter cutoffs, crack character, low-end energy, stereo position, duration, and decay vary per strike. No sound files are loaded.

Delay is derived from perceived distance: foreground ground strikes usually arrive sooner and sharper; middle-depth strikes are intermediate; internal lightning is later, softer, deeper, and more muffled. The user’s Minimum and Maximum Thunder Delay are hard bounds. Each channel in a double or triple schedules its own thunder, so arrivals can separate naturally.

Thunder Volume is the exact master gain; 0 is silent. Thunder Intensity changes crack strength, low-end energy, and rumble character rather than duplicating volume. Spatial Thunder applies restrained left/right panning from strike position.

At most eight voices can be active. Conservative per-layer gain staging feeds a dynamics compressor, and finished nodes are stopped and disconnected. Pause, visibility change, audio disable, and Wallpaper Engine pause clear delayed sounds and active voices so no backlog plays on resume.

Browsers may block AudioContext startup until user interaction. The wallpaper handles this without affecting visuals and attempts to unlock audio after a pointer or keyboard event. Wallpaper Engine may allow audio immediately, but Thunder Audio remains disabled by default to avoid surprising desktop sound.

## Settings

`Storm.schema` in `js/config.js` is the source of truth for browser controls and generated Wallpaper Engine metadata.

| Group | Properties and defaults |
| --- | --- |
| Atmosphere | Cloud Speed 35; Density 65; Brightness 55; Contrast 62; Turbulence 48; Softness 55; Foreground Mist 25; Rain Off |
| Lightning | Enabled; Frequency Normal; Intensity 75; Glow 65; Internal/Middle/Foreground weights 55/25/20; Travel Speed 100; Fade Speed 100; Re-strike Chance 35; Maximum Re-strikes 2 |
| Lightning Colours | All three slots enabled; blue-white, warm-neutral white, violet-blue |
| Multi-Strike | Double enabled, average 150 s; Triple enabled, average 420 s; internal gap 80–1400 ms; Spread 65 |
| Thunder Audio | Disabled; Volume 40; Intensity 60; Delay 0.25–6 s; Spatial Thunder enabled |
| Safety / Performance | Reduced Flash Off; 60 FPS; Animation Speed 100; Balanced detail; Interaction On |

The three depth controls are relative weights. If all are zero, normal strikes safely fall back to internal depth. Animation Speed 0 freezes the simulation. The effective frame cap is the lower of Thunder’s selected cap and Wallpaper Engine’s global cap.

### Backward compatibility

Browser preferences migrate from `thunder.settings.v1` to `thunder.settings.v2`. If legacy data or a host update contains `lightningcolour` but no `lightningcolour1`, the old value becomes Colour 1 while Colours 2 and 3 retain their new defaults. Unknown and malformed values are ignored; numeric settings are clamped; min/max pairs are normalized.

### Reduced Flash Mode

Reduced Flash Mode is a non-bypassable visual safety layer. It:

- caps leader and return-stroke brightness;
- suppresses double and triple events;
- enforces at least 10 seconds of real wall time between strikes, even at 200% animation speed;
- restricts re-strikes to at most one with a heavily reduced chance;
- clears current and queued activity when the mode changes;
- sharply reduces sky-wide spill while keeping cloud texture visible.

Thunder is not automatically disabled because the mode is primarily visual. Suppressed visual events naturally produce no thunder. Disable Lightning entirely to remove changing light.

## Performance and limits

- Eight active lightning strikes, eight cloud light samples, bounded two-level branching, and eight thunder voices.
- Geometry and noise buffers are generated once and reused; no per-frame bolt regeneration or runtime network access.
- Efficient, Balanced, and High cloud buffers cap width at 850, 1250, and 1800 pixels respectively, with a 1000-pixel height cap.
- Rendering stops while hidden or host-paused. Resume resets clocks to avoid catch-up bursts.
- For lower laptop use: 30 FPS, Efficient clouds, and Rain Off.

## Project layout

```text
index.html                    Wallpaper entry point
project.json                  Generated Wallpaper Engine metadata
preview.jpg                   Wallpaper thumbnail
css/style.css                 Scene and settings panel
js/config.js                  Schema, defaults, colours, shared helpers
js/wallpaper-properties.js    Validation, v1→v2 migration, host callbacks
js/clouds.js                  WebGL clouds, eight coloured lights, fallback
js/lightning.js               Scheduling, geometry, leaders, strokes, fading
js/thunder-audio.js           Offline Web Audio thunder engine and pure logic
js/weather.js                 Rain and optional local overlays
js/main.js                    Animation, UI, input, pause, diagnostics
tools/test.cjs                Deterministic unit/statistical tests
tools/runtime.html            Live browser and WebGL runtime checks
tools/visual.html             Deterministic visual fixtures
tools/audio.html              Development-only thunder triggers
qa/verification.md           Recorded verification for this delivery
```

## Verification and development

- `node tools/test.cjs` runs deterministic logic tests and a 60-minute virtual storm.
- `node tools/build-project.cjs` regenerates `project.json` from `Storm.schema`.
- `node tools/preview.cjs` serves this folder at `http://127.0.0.1:8765` for browser QA.
- `/tools/runtime.html` checks the shader, settings, migration, leader progression, audio gating, FPS, pause/resume, Reduced Flash, and context restoration.
- `/tools/visual.html?mode=leader` supports `colour1`, `colour2`, `colour3`, `double`, `triple`, `leader`, `return`, `restrike`, `internal-travel`, `middle-travel`, `foreground-travel`, cloud contrast/turbulence/softness low/high modes, and `fallback=1`.
- `/tools/audio.html` provides nearby, medium, distant, double, and triple thunder triggers for development only.

See `qa/verification.md` for what was actually executed in the current environment and for any unverified native-host scope.
