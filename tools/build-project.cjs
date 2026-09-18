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
  description:
    "A procedural cinematic thunderstorm with layered clouds, unpredictable lightning, optional rain, and a reduced flash setting. Click the sky to stir the storm; S opens settings. Fully offline.",
  file: "index.html",
  general: { properties },
  preview: "preview.jpg",
  type: "web",
  version: 0,
};
fs.writeFileSync(
  path.join(root, "project.json"),
  JSON.stringify(project, null, 2) + "\n",
);
console.log("Built project.json with " + order + " properties.");
