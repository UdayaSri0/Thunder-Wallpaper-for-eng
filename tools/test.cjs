const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
let seed = 61882;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
};
const listeners = {},
  ctx = {
    Math: math,
    console,
    Float32Array,
    Uint8Array,
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null, setItem() {} },
    document: {
      body: { classList: { add() {} } },
      createElement: () => ({ getContext: () => ({}) }),
    },
  };
ctx.window = ctx;
ctx.addEventListener = (key, fn) => (listeners[key] ??= []).push(fn);
ctx.dispatchEvent = (e) => (listeners[e.type] || []).forEach((fn) => fn(e));
vm.createContext(ctx);
for (const file of ["config.js", "wallpaper-properties.js", "lightning.js"])
  vm.runInContext(fs.readFileSync(path.join(root, "js", file), "utf8"), ctx, {
    filename: file,
  });
const S = ctx.Storm,
  defaults = { ...S.settings };
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
check("All HTML local asset references exist", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g))
    assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
});
check("Wallpaper Engine metadata matches every runtime property", () => {
  const project = JSON.parse(
    fs.readFileSync(path.join(root, "project.json"), "utf8"),
  );
  assert.equal(project.file, "index.html");
  assert.deepEqual(
    Object.keys(project.general.properties),
    Object.keys(S.schema),
  );
  for (const [key, def] of Object.entries(S.schema))
    assert.equal(project.general.properties[key].value, def.value);
});
check(
  "Partial host updates preserve other values and clamp malformed inputs",
  () => {
    ctx.wallpaperPropertyListener.applyUserProperties({
      cloudspeed: { value: 92 },
    });
    assert.equal(S.settings.cloudspeed, 92);
    assert.equal(S.settings.fogamount, 25);
    S.applySettings({
      cloudspeed: 999,
      cloudbrightness: NaN,
      rainamount: "bad",
      reducedflash: "false",
      lightningcolour: "oops",
    });
    assert.equal(S.settings.cloudspeed, 100);
    assert.equal(S.settings.cloudbrightness, 55);
    assert.equal(S.settings.rainamount, "0");
    assert.equal(S.settings.reducedflash, false);
    assert.equal(S.settings.lightningcolour, defaults.lightningcolour);
    S.applySettings(defaults);
  },
);
check("Host pause and host FPS callbacks", () => {
  ctx.wallpaperPropertyListener.setPaused(true);
  assert.equal(S.hostPaused, true);
  ctx.wallpaperPropertyListener.setPaused(false);
  ctx.wallpaperPropertyListener.applyGeneralProperties({ fps: 30 });
  assert.equal(S.hostFPS, 30);
});
check("Default lightning depth distribution approximates 55 / 25 / 20", () => {
  const l = new S.Lightning(),
    counts = [0, 0, 0];
  for (let i = 0; i < 30000; i++) counts[l.chooseDepth()]++;
  counts.forEach((count, i) =>
    assert.ok(Math.abs(count / 30000 - [0.55, 0.25, 0.2][i]) < 0.015),
  );
  console.log(
    "  Depth percentages: " +
      counts.map((n) => (n / 300).toFixed(1)).join(" / "),
  );
});
check(
  "Frequency modes produce irregular delays and are correctly ordered",
  () => {
    let previous = Infinity;
    for (const mode of ["veryrare", "rare", "normal", "frequent", "storm"]) {
      S.settings.lightningfrequency = mode;
      const l = new S.Lightning(),
        samples = Array.from({ length: 1500 }, () => l.delay()),
        mean = samples.reduce((a, b) => a + b) / samples.length;
      assert.ok(mean < previous);
      assert.ok(new Set(samples.map((x) => x.toFixed(2))).size > 100);
      previous = mean;
      console.log("  " + mode + " mean " + mean.toFixed(2) + "s");
    }
    S.applySettings(defaults);
  },
);
check("500 bolts have unique, finite geometry and bounded branches", () => {
  const hashes = new Set();
  for (let i = 0; i < 500; i++) {
    const paths = S.generateLightningBolt(0.5, 0.2, 0.6, 0.9);
    assert.ok(paths.length >= 3 && paths.length <= 9);
    for (const p of paths)
      for (const point of p.points) assert.ok(point.every(Number.isFinite));
    hashes.add(JSON.stringify(paths[0].points));
  }
  assert.equal(hashes.size, 500);
});
check(
  "Simulated 20-minute normal storm stays bounded and produces varied clusters",
  () => {
    const l = new S.Lightning();
    let maximum = 0,
      clustered = false;
    for (let i = 0; i < 72000; i++) {
      l.update(1 / 60, 1 / 60);
      maximum = Math.max(maximum, l.active.length);
      if (l.pending.length > 1) clustered = true;
      assert.ok(l.active.length <= 4);
      assert.ok(l.pending.length <= 4);
    }
    assert.ok(l.totalEvents > 50 && l.totalEvents < 500);
    assert.ok(clustered);
    console.log(
      "  " + l.totalEvents + " events; maximum " + maximum + " concurrent",
    );
  },
);
check(
  "Reduced mode: one soft pulse, no clusters, real-time 10s minimum even at 2x speed",
  () => {
    S.settings.reducedflash = true;
    S.settings.lightningfrequency = "storm";
    const l = new S.Lightning();
    let last = -100,
      count = 0;
    for (let i = 0; i < 36000; i++) {
      const before = l.totalEvents;
      l.update(2 / 60, 1 / 60);
      if (l.totalEvents > before) {
        assert.ok(l.wallTime - last >= 10 - 1e-8);
        last = l.wallTime;
        count++;
      }
      for (const e of l.active) {
        assert.equal(e.pulses.length, 1);
        assert.ok(e.power <= 0.3);
      }
      assert.ok(l.pending.length <= 1);
    }
    assert.ok(count > 10);
    assert.equal(l.trigger(), l.wallTime - l.lastStrike >= 10);
    S.applySettings(defaults);
  },
);
check(
  "Disabled lightning clears pending and live events; zero weights remain valid",
  () => {
    const l = new S.Lightning();
    l.createEvent();
    l.cluster();
    S.settings.lightningenabled = false;
    l.update(0.1, 0.1);
    assert.equal(l.active.length, 0);
    assert.equal(l.pending.length, 0);
    assert.equal(l.trigger(), false);
    S.applySettings(defaults);
    S.applySettings({
      cloudlightningfrequency: 0,
      visibleboltfrequency: 0,
      middleboltfrequency: 0,
    });
    assert.equal(l.chooseDepth(), 0);
    S.applySettings(defaults);
  },
);
check("Mode changes clear rapid events and manual input has a cooldown", () => {
  const l = new S.Lightning();
  assert.equal(l.trigger(), true);
  assert.equal(l.trigger(), false);
  S.settings.reducedflash = true;
  l.resetSchedule();
  assert.equal(l.active.length, 0);
  assert.equal(l.pending.length, 0);
  assert.ok(l.next - l.time >= 10);
  S.applySettings(defaults);
});
check("Short pulses remain visible at 30 FPS and 2x animation speed", () => {
  const l = new S.Lightning();
  const e = l.createEvent(2);
  e.pulses = [{ start: 0, duration: 0.04, amplitude: 1 }];
  e.duration = 0.05;
  const lights = l.update(2 / 30, 1 / 30);
  assert.equal(lights.length, 1);
  assert.ok(lights[0].power > 1);
  l.update(2 / 30, 1 / 30);
  assert.equal(l.active.length, 0);
});
console.log("\n" + checks + " checks passed.");
