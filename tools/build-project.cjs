// Regenerate Wallpaper Engine metadata from the same schema as the browser controls.
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const root = path.resolve(__dirname, ".."),
  context = {};
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "js/config.js"), "utf8"),
  context,
);
const properties = {};
let order = 0;
for (const [key, def] of Object.entries(context.Storm.schema)) {
  const p = {
    order: order++,
    text: def.label,
    type: def.type,
    value: def.value,
  };
  if (def.type === "slider") {
    p.min = def.min;
    p.max = def.max;
    p.step = 1;
    p.fraction = false;
  }
  if (def.options)
    p.options = def.options.map(([label, value]) => ({ label, value }));
  properties[key] = p;
}
const project = {
  title: "Thunder — A Living Storm",
  description: `Watch a dark, living storm unfold across your desktop. Layered clouds drift at different depths while unpredictable lightning flickers inside the cloud bank, breaks through gaps, or forms bright branching bolts in the foreground. Every event varies in timing, position, intensity, depth, pulse pattern, and bolt shape, so the storm never settles into an obvious loop.

Features:
• Procedural multi-layer storm clouds and slow atmospheric fog
• Internal, middle-cloud, and foreground lightning
• Irregular single strikes, double flashes, clusters, and long quiet periods
• Optional Light, Medium, or Heavy rain (Off by default)
• Click anywhere to stir the storm
• Adjustable clouds, fog, lightning, rain, color, FPS, and quality
• Reduced Flash Mode for softer, less frequent lightning
• Fully offline with no external downloads, APIs, audio, or copyrighted assets

Photosensitivity: contains intermittent lightning flashes. Reduced Flash Mode softens flashes and removes rapid multi-flash clusters. Lightning can also be disabled completely.

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
fs.writeFileSync(
  path.join(root, "project.json"),
  JSON.stringify(project, null, 2) + "\n",
);
console.log("Built project.json with " + order + " properties.");
