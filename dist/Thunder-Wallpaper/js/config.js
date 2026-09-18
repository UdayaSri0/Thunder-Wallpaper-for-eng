/* Classic scripts intentionally support file:// without module fetches. */
window.Storm = window.Storm || {};
Storm.schema = {
  cloudspeed: {
    label: "Cloud speed",
    group: "Atmosphere",
    type: "slider",
    value: 35,
    min: 0,
    max: 100,
  },
  clouddensity: {
    label: "Cloud density",
    type: "slider",
    value: 65,
    min: 10,
    max: 100,
  },
  cloudbrightness: {
    label: "Cloud brightness",
    type: "slider",
    value: 55,
    min: 10,
    max: 100,
  },
  fogamount: {
    label: "Foreground mist",
    type: "slider",
    value: 25,
    min: 0,
    max: 100,
  },
  rainamount: {
    label: "Rain",
    type: "combo",
    value: "0",
    options: [
      ["Off", "0"],
      ["Light", "1"],
      ["Medium", "2"],
      ["Heavy", "3"],
    ],
  },
  lightningenabled: {
    label: "Lightning enabled",
    group: "Lightning",
    type: "bool",
    value: true,
  },
  lightningfrequency: {
    label: "Frequency",
    type: "combo",
    value: "normal",
    options: [
      ["Very rare", "veryrare"],
      ["Rare", "rare"],
      ["Normal", "normal"],
      ["Frequent", "frequent"],
      ["Storm", "storm"],
    ],
  },
  lightningintensity: {
    label: "Intensity",
    type: "slider",
    value: 75,
    min: 0,
    max: 100,
  },
  visibleboltfrequency: {
    label: "Foreground bolt weight",
    type: "slider",
    value: 20,
    min: 0,
    max: 100,
  },
  cloudlightningfrequency: {
    label: "Internal lightning weight",
    type: "slider",
    value: 55,
    min: 0,
    max: 100,
  },
  middleboltfrequency: {
    label: "Middle-cloud bolt weight",
    type: "slider",
    value: 25,
    min: 0,
    max: 100,
  },
  lightningglow: {
    label: "Glow strength",
    type: "slider",
    value: 65,
    min: 0,
    max: 100,
  },
  lightningcolour: {
    label: "Lightning colour",
    type: "color",
    value: "0.73 0.85 1",
  },
  reducedflash: { label: "Reduced Flash Mode", type: "bool", value: false },
  animationfps: {
    label: "Frame rate",
    group: "Performance",
    type: "combo",
    value: "60",
    options: [
      ["30 FPS", "30"],
      ["45 FPS", "45"],
      ["60 FPS", "60"],
      ["Unlimited", "0"],
    ],
  },
  animationspeed: {
    label: "Animation speed",
    type: "slider",
    value: 100,
    min: 0,
    max: 200,
  },
  quality: {
    label: "Cloud detail",
    type: "combo",
    value: "balanced",
    options: [
      ["Efficient", "efficient"],
      ["Balanced", "balanced"],
      ["High", "high"],
    ],
  },
  interactive: {
    label: "Click to stir the storm",
    group: "Interaction",
    type: "bool",
    value: true,
  },
};
Storm.settings = Object.fromEntries(
  Object.entries(Storm.schema).map(([k, v]) => [k, v.value]),
);
// Optional transparent PNG/WebP overlays. Paths are relative to index.html.
Storm.cloudTextures = [];
Storm.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
Storm.random = (a, b) => a + Math.random() * (b - a);
Storm.color = () => Storm.settings.lightningcolour.split(/\s+/).map(Number);
