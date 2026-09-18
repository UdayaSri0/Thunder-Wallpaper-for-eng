# Verification — 18 September 2026

## Environment

- Logic/build: portable Node.js 22.14.0 used from the Windows temporary directory because Node was not installed on PATH.
- Browser QA: installed Microsoft Edge in headless mode with a dedicated temporary profile and local loopback server.
- Renderer: WebGL through Edge’s SwiftShader software backend for deterministic runtime checks.
- No native Wallpaper Engine executable or editor surface was available to Codex.

## Automated logic checks

`node tools/test.cjs`: **20 checks passed**.

- All HTML assets resolve locally and the procedural audio module is included.
- Generated `project.json` matches all 43 runtime schema keys and defaults.
- Property validation, clamping, min/max normalization, host callbacks, and legacy `lightningcolour` migration.
- Three colour parsing and enable combinations, disabled-colour exclusion, and all-disabled fallback.
- Double plans contain two independent channels; triple plans contain three. Geometry, positions, attributes, colours, and internal delays are independent and bounded.
- Active strikes retain their own colour and expose colour-aware moving cloud light samples.
- 30,000 depth selections: **55.4% internal / 24.6% middle / 20.0% foreground**.
- Normal-frequency delays remain irregular and correctly ordered.
- Shifted-exponential double/triple gaps are non-periodic, average near their configured long-term target, and respond to mean changes.
- Disabled double/triple controls produce no special events.
- 300 generated bolts were unique, finite, bounded, and carried monotonic progress metadata.
- Leader progress, branch activation threshold, faster/brighter return stroke, bounded re-strikes, shared channel geometry, multi-stage fade, and dead-event cleanup.
- Deterministic **60-minute** virtual storm: **302 singles, 25 doubles, 9 triples; maximum 5 active and 3 queued**.
- Reduced Flash suppressed all double/triple events, capped brightness/re-strikes, and kept the 10-second wall-time interval at 2× animation speed.
- Thunder distance, delay, profile, pan, disabled/zero-volume gating, and eight-voice admission limit.

## Browser runtime checks

`tools/runtime.html`: **23 checks passed** at 1280 × 720.

- WebGL shader compilation with eight position/power/depth lights and eight RGB light colours.
- All 43 controls loaded from the runtime schema.
- Live three-colour and cloud-control updates.
- Legacy colour migration and all-disabled fallback.
- Dedicated two/three-channel event plans and independent positions.
- Multi-strike and thunder delay min/max normalization.
- Progressive leader growth, return-stroke transition, and colour ownership of moving light samples.
- Audio disabled and volume-zero scheduling gates.
- 30/60 FPS caps were not exceeded. SwiftShader observed **16.5 FPS** under the 30 cap and **21.6 FPS** under the 60 cap; these software-rendered observations are not hardware performance targets.
- Wallpaper Engine host FPS callback, pause, audio quieting, and resume.
- Reduced Flash special-event suppression and 10-second scheduling gap.
- Simulated WebGL context loss and successful restoration without GL errors.

## Procedural audio browser check

`tools/audio.html` was exercised in a separate headless Edge profile with the browser’s autoplay test policy enabled.

- One reusable AudioContext reached `running` state.
- An actual procedural voice started using the cached eight-second noise buffer.
- Peak active voices: 1.
- After natural completion: **0 active voices and 0 pending timers**.

The environment cannot listen to or subjectively grade timbre. Audible naturalness, speaker/headphone balance, and native Wallpaper Engine audio routing still require a human listening pass.

## Visual checks

Deterministic 1280 × 720 WebGL captures were rendered and inspected for:

- partially revealed travelling leader;
- bright established-channel re-strike;
- Colour 1 blue-white, Colour 2 warm-neutral, and Colour 3 violet-blue, including matching cloud illumination;
- triple event with independently positioned/coloured channels;
- internal, middle, and foreground travelling modes;
- low/high cloud contrast, turbulence, and softness;
- Canvas fallback triple event with coloured channels and glow.

New captures are stored as `qa/upgrade-*.png`. The cloud control pairs produced visibly different, usable results. Internal channels were appropriately faint, middle channels diffused, and foreground channels clear.

## Offline and packaging checks

- Runtime source contains no fetch/XHR/CDN/remote media dependency.
- Web Audio noise and oscillation are synthesized locally.
- `node tools/build-project.cjs` generated **43 properties** from `Storm.schema`.
- `dist/Thunder-Wallpaper` and `dist/Thunder-Wallpaper.zip` were rebuilt from the verified source after final tests.

## Unverified native scope

Native Wallpaper Engine import, the editor property presentation, desktop application pause policy, native mouse forwarding, and native audio output were **not tested** because Wallpaper Engine was unavailable in this execution environment. The browser harness exercised the same documented property-listener callbacks, but it is not a substitute for a final native editor/application smoke test.
