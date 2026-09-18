/* Classic scripts intentionally support file:// without module fetches. */
window.Storm = window.Storm || {};
Storm.schema = {
  cloudspeed: { label: "Cloud Speed", group: "Atmosphere", type: "slider", value: 35, min: 0, max: 100 },
  clouddensity: { label: "Cloud Density", type: "slider", value: 65, min: 10, max: 100 },
  cloudbrightness: { label: "Cloud Brightness", type: "slider", value: 55, min: 10, max: 100 },
  cloudcontrast: { label: "Cloud Contrast", type: "slider", value: 62, min: 0, max: 100 },
  cloudturbulence: { label: "Cloud Turbulence", type: "slider", value: 48, min: 0, max: 100 },
  cloudsoftness: { label: "Cloud Softness", type: "slider", value: 55, min: 0, max: 100 },
  fogamount: { label: "Foreground Mist", type: "slider", value: 25, min: 0, max: 100 },
  rainamount: { label: "Rain", type: "combo", value: "0", options: [["Off", "0"], ["Light", "1"], ["Medium", "2"], ["Heavy", "3"]] },

  lightningenabled: { label: "Lightning Enabled", group: "Lightning", type: "bool", value: true },
  lightningfrequency: { label: "Frequency", type: "combo", value: "normal", options: [["Very rare", "veryrare"], ["Rare", "rare"], ["Normal", "normal"], ["Frequent", "frequent"], ["Storm", "storm"]] },
  lightningintensity: { label: "Intensity", type: "slider", value: 75, min: 0, max: 100 },
  lightningglow: { label: "Glow Strength", type: "slider", value: 65, min: 0, max: 100 },
  cloudlightningfrequency: { label: "Internal Lightning Weight", type: "slider", value: 55, min: 0, max: 100 },
  middleboltfrequency: { label: "Middle-Cloud Bolt Weight", type: "slider", value: 25, min: 0, max: 100 },
  visibleboltfrequency: { label: "Foreground Bolt Weight", type: "slider", value: 20, min: 0, max: 100 },
  lightningtravelspeed: { label: "Lightning Travel Speed", type: "slider", value: 100, min: 50, max: 200 },
  lightningfadespeed: { label: "Lightning Fade Speed", type: "slider", value: 100, min: 50, max: 200 },
  restrikechance: { label: "Re-strike Chance", type: "slider", value: 35, min: 0, max: 100 },
  maxrestrikes: { label: "Maximum Re-strikes", type: "combo", value: "2", options: [["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]] },

  lightningcolour1enabled: { label: "Colour 1 Enabled", group: "Lightning Colours", type: "bool", value: true },
  lightningcolour1: { label: "Lightning Colour 1", type: "color", value: "0.72 0.86 1" },
  lightningcolour2enabled: { label: "Colour 2 Enabled", type: "bool", value: true },
  lightningcolour2: { label: "Lightning Colour 2", type: "color", value: "1 0.93 0.82" },
  lightningcolour3enabled: { label: "Colour 3 Enabled", type: "bool", value: true },
  lightningcolour3: { label: "Lightning Colour 3", type: "color", value: "0.69 0.60 1" },

  doublelightningenabled: { label: "Double Lightning Enabled", group: "Multi-Strike", type: "bool", value: true },
  doublelightninginterval: { label: "Average Double-Strike Gap", type: "slider", value: 150, min: 20, max: 900, suffix: " s" },
  triplelightningenabled: { label: "Triple Lightning Enabled", type: "bool", value: true },
  triplelightninginterval: { label: "Average Triple-Strike Gap", type: "slider", value: 420, min: 30, max: 1800, suffix: " s" },
  multistrikemingap: { label: "Multi-Strike Minimum Gap", type: "slider", value: 80, min: 50, max: 3000, suffix: " ms" },
  multistrikemaxgap: { label: "Multi-Strike Maximum Gap", type: "slider", value: 1400, min: 50, max: 3000, suffix: " ms" },
  multistrikespread: { label: "Multi-Strike Spread", type: "slider", value: 65, min: 0, max: 100 },

  thunderaudioenabled: { label: "Thunder Audio", group: "Thunder Audio", type: "bool", value: false },
  thundervolume: { label: "Thunder Volume", type: "slider", value: 40, min: 0, max: 100 },
  thunderintensity: { label: "Thunder Intensity", type: "slider", value: 60, min: 0, max: 100 },
  thundermindelay: { label: "Minimum Thunder Delay", type: "slider", value: 0.25, min: 0, max: 10, step: 0.05, suffix: " s" },
  thundermaxdelay: { label: "Maximum Thunder Delay", type: "slider", value: 6, min: 0, max: 10, step: 0.05, suffix: " s" },
  spatialthunder: { label: "Spatial Thunder", type: "bool", value: true },

  reducedflash: { label: "Reduced Flash Mode", group: "Safety / Performance", type: "bool", value: false },
  animationfps: { label: "Frame Rate", type: "combo", value: "60", options: [["30 FPS", "30"], ["45 FPS", "45"], ["60 FPS", "60"], ["Unlimited", "0"]] },
  animationspeed: { label: "Animation Speed", type: "slider", value: 100, min: 0, max: 200 },
  quality: { label: "Cloud Detail", type: "combo", value: "balanced", options: [["Efficient", "efficient"], ["Balanced", "balanced"], ["High", "high"]] },
  interactive: { label: "Click to Stir the Storm", type: "bool", value: true },
};
Storm.settings = Object.fromEntries(Object.entries(Storm.schema).map(([key, def]) => [key, def.value]));
Storm.cloudTextures = [];
Storm.clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
Storm.random = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
Storm.parseColour = (value) => String(value).trim().split(/\s+/).map(Number).map((part) => Storm.clamp(part, 0, 1));
Storm.enabledColours = () => {
  const colours = [1, 2, 3]
    .filter((slot) => Storm.settings[`lightningcolour${slot}enabled`])
    .map((slot) => ({ slot, value: Storm.parseColour(Storm.settings[`lightningcolour${slot}`]) }));
  return colours.length ? colours : [{ slot: 1, value: Storm.parseColour(Storm.settings.lightningcolour1) }];
};
Storm.colour = (slot = 1) => Storm.parseColour(Storm.settings[`lightningcolour${slot}`] || Storm.settings.lightningcolour1);
