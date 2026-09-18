// Regenerate Wallpaper Engine metadata from the same schema as the browser controls.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const context = {};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), context);

const properties = {};
let order = 0;
for (const [key, def] of Object.entries(context.Storm.schema)) {
  const property = { order: order++, text: def.label, type: def.type, value: def.value };
  if (def.type === "slider") {
    property.min = def.min;
    property.max = def.max;
    property.step = def.step || 1;
    property.fraction = !!def.step && def.step < 1;
  }
  if (def.options) property.options = def.options.map(([label, value]) => ({ label, value }));
  properties[key] = property;
}

const project = {
  title: "Thunder — A Living Storm",
  description: `Watch a dark, living storm unfold across your desktop. Layered clouds drift and slowly evolve while travelling leaders form branching channels, trigger bright return strokes, and sometimes re-strike. Three independently configurable lightning colours illuminate nearby clouds with the colour of each active channel.

Features:
• Procedural multi-layer storm clouds, slow deformation, fog, and optional rain
• Progressive leaders, delayed branches, return strokes, natural fades, and re-strikes
• Internal, middle-cloud, foreground, cloud-to-cloud, and cloud-to-ground channels
• Three configurable colours with simultaneous colour-aware cloud illumination
• Common single strikes plus stochastic rare double and very rare triple events
• Offline procedural thunder with volume, intensity, delay, and spatial controls
• Click interaction, performance controls, and a safety-focused Reduced Flash Mode
• Fully offline: no external downloads, APIs, audio files, or runtime dependencies

Photosensitivity: contains intermittent lightning flashes. Reduced Flash Mode caps brightness, removes rapid multi-strike events, restricts re-strikes, and enforces a 10-second safety interval. Lightning can also be disabled completely. Thunder audio is disabled by default.

For lower laptop power use: 30 FPS + Efficient cloud detail + Rain Off. Supports 16:9, 16:10, ultrawide, and other common resolutions.`,
  file: "index.html",
  general: { properties },
  contentrating: "Everyone",
  preview: "preview.jpg",
  ratingsex: "none",
  ratingviolence: "none",
  tags: ["Relaxing"],
  type: "web",
  version: 0,
};
fs.writeFileSync(path.join(root, "project.json"), JSON.stringify(project, null, 2) + "\n");
console.log(`Built project.json with ${order} properties.`);
