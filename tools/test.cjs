const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");

let seed = 61882;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
};
const listeners = {};
const canvasContext = new Proxy({}, { get: (target, key) => target[key] || (() => {}) });
const storage = new Map();
const ctx = {
  Math: math,
  console,
  Float32Array,
  Uint8Array,
  setTimeout,
  clearTimeout,
  CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  Event: class { constructor(type) { this.type = type; } },
  matchMedia: () => ({ matches: false }),
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  },
  document: {
    hidden: false,
    body: { classList: { add() {} } },
    getElementById: () => null,
    addEventListener() {},
    createElement: () => ({ id: "", width: 1, height: 1, setAttribute() {}, getContext: () => canvasContext }),
  },
};
ctx.window = ctx;
ctx.addEventListener = (key, fn) => (listeners[key] ??= []).push(fn);
ctx.dispatchEvent = (event) => (listeners[event.type] || []).forEach((fn) => fn(event));
vm.createContext(ctx);
for (const file of ["config.js", "wallpaper-properties.js", "lightning.js", "thunder-audio.js"])
  vm.runInContext(fs.readFileSync(path.join(root, "js", file), "utf8"), ctx, { filename: file });

const S = ctx.Storm;
const defaults = { ...S.settings };
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};
const reset = () => S.applySettings(defaults);
const isolated = () => {
  const lightning = new S.Lightning();
  lightning.next = Infinity;
  lightning.nextDouble = Infinity;
  lightning.nextTriple = Infinity;
  return lightning;
};

check("All HTML local asset references exist and audio is local", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g))
    assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
  assert.match(html, /js\/thunder-audio\.js/);
  assert.doesNotMatch(html, /https?:\/\//);
});

check("Wallpaper Engine metadata matches the runtime schema", () => {
  const project = JSON.parse(fs.readFileSync(path.join(root, "project.json"), "utf8"));
  assert.equal(project.file, "index.html");
  assert.deepEqual(Object.keys(project.general.properties), Object.keys(S.schema));
  for (const [key, def] of Object.entries(S.schema)) assert.equal(project.general.properties[key].value, def.value);
});

check("Settings validate, clamp, normalize pairs, and migrate old colour", () => {
  S.applySettings({ cloudspeed: 999, cloudbrightness: NaN, rainamount: "bad", reducedflash: "false", lightningcolour1: "oops" });
  assert.equal(S.settings.cloudspeed, 100);
  assert.equal(S.settings.cloudbrightness, defaults.cloudbrightness);
  assert.equal(S.settings.rainamount, defaults.rainamount);
  assert.equal(S.settings.reducedflash, false);
  S.applySettings({ lightningcolour: "0.1 0.2 0.3" });
  assert.equal(S.settings.lightningcolour1, "0.1 0.2 0.3");
  S.applySettings({ multistrikemingap: 2500, multistrikemaxgap: 100, thundermindelay: 8, thundermaxdelay: 2 });
  assert.ok(S.settings.multistrikemingap <= S.settings.multistrikemaxgap);
  assert.ok(S.settings.thundermindelay <= S.settings.thundermaxdelay);
  reset();
});

check("Host pause, FPS, and partial property callbacks work", () => {
  ctx.wallpaperPropertyListener.applyUserProperties({ cloudspeed: { value: 92 } });
  assert.equal(S.settings.cloudspeed, 92);
  assert.equal(S.settings.fogamount, defaults.fogamount);
  ctx.wallpaperPropertyListener.setPaused(true);
  assert.equal(S.hostPaused, true);
  ctx.wallpaperPropertyListener.setPaused(false);
  ctx.wallpaperPropertyListener.applyGeneralProperties({ fps: 30 });
  assert.equal(S.hostFPS, 30);
  reset();
});

check("Three colour slots parse and enable independently with fallback", () => {
  S.applySettings({ lightningcolour1: "0.11 0.22 0.33", lightningcolour2: "0.44 0.55 0.66", lightningcolour3: "0.77 0.88 0.99" });
  assert.deepEqual(Array.from(S.colour(1)), [0.11, 0.22, 0.33]);
  assert.deepEqual(Array.from(S.colour(2)), [0.44, 0.55, 0.66]);
  assert.deepEqual(Array.from(S.colour(3)), [0.77, 0.88, 0.99]);
  for (const enabled of [[true, false, false], [false, true, true], [true, true, true], [false, false, false]]) {
    S.applySettings({ lightningcolour1enabled: enabled[0], lightningcolour2enabled: enabled[1], lightningcolour3enabled: enabled[2] });
    const allowed = S.enabledColours().map((entry) => entry.slot);
    if (!enabled.some(Boolean)) assert.deepEqual(Array.from(allowed), [1]);
    for (let index = 0; index < 80; index++) assert.ok(allowed.includes(S.selectStrikeColours(1)[0].slot));
  }
  reset();
});

check("Double and triple plans have distinct strikes, positions, geometry, colours, and bounded gaps", () => {
  const lightning = isolated();
  let foundUniqueTriple = false;
  for (const type of ["double", "triple"]) {
    const plan = lightning.planMultiEvent(type);
    assert.equal(plan.strikes.length, type === "double" ? 2 : 3);
    assert.equal(new Set(plan.strikes.map((strike) => JSON.stringify(strike.paths[0].points))).size, plan.strikes.length);
    assert.equal(new Set(plan.strikes.map((strike) => strike.x)).size, plan.strikes.length);
    for (let index = 1; index < plan.strikes.length; index++) {
      const gap = (plan.strikes[index].offset - plan.strikes[index - 1].offset) * 1000;
      assert.ok(gap >= S.settings.multistrikemingap - 1e-8 && gap <= S.settings.multistrikemaxgap + 1e-8);
    }
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const plan = lightning.planMultiEvent("triple");
    if (new Set(plan.strikes.map((strike) => strike.colourSlot)).size === 3) foundUniqueTriple = true;
  }
  assert.ok(foundUniqueTriple);
});

check("Each active strike retains its own colour and exposes colour-aware moving lights", () => {
  const lightning = isolated();
  const blue = lightning.createStrike(lightning.makeStrikeSpec({ colour: [0.2, 0.5, 1], colourSlot: 1 }));
  const violet = lightning.createStrike(lightning.makeStrikeSpec({ colour: [0.7, 0.3, 1], colourSlot: 3 }));
  lightning.update(0.2, 0.2);
  assert.deepEqual(Array.from(blue.colour), [0.2, 0.5, 1]);
  assert.deepEqual(Array.from(violet.colour), [0.7, 0.3, 1]);
  assert.deepEqual(Array.from(blue.lightSamples[0].colour), [0.2, 0.5, 1]);
  assert.notDeepEqual(Array.from(blue.lightSamples[0].colour), Array.from(violet.lightSamples[0].colour));
});

check("Default depth selection approximates 55 / 25 / 20", () => {
  const lightning = isolated();
  const counts = [0, 0, 0];
  for (let index = 0; index < 30000; index++) counts[lightning.chooseDepth()]++;
  counts.forEach((count, index) => assert.ok(Math.abs(count / 30000 - [0.55, 0.25, 0.2][index]) < 0.015));
  console.log(`  Depth percentages: ${counts.map((count) => (count / 300).toFixed(1)).join(" / ")}`);
});

check("Normal frequency delays stay irregular and correctly ordered", () => {
  let previous = Infinity;
  for (const mode of ["veryrare", "rare", "normal", "frequent", "storm"]) {
    S.settings.lightningfrequency = mode;
    const lightning = new S.Lightning();
    const samples = Array.from({ length: 1500 }, () => lightning.delay());
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    assert.ok(mean < previous);
    assert.ok(new Set(samples.map((value) => value.toFixed(2))).size > 100);
    previous = mean;
  }
  reset();
});

check("Special gaps are exponential, non-periodic, and respond to the configured mean", () => {
  const lightning = isolated();
  const sample = (type, mean) => {
    S.settings[`${type}lightninginterval`] = mean;
    return Array.from({ length: 5000 }, () => lightning.specialGap(type));
  };
  const double300 = sample("double", 300);
  const triple420 = sample("triple", 420);
  assert.ok(new Set(double300.map((value) => value.toFixed(2))).size > 4000);
  assert.ok(double300.some((value) => Math.abs(value - 300) > 100));
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.abs(average(double300) - 300) < 15);
  assert.ok(Math.abs(average(triple420) - 420) < 22);
  assert.ok(average(sample("double", 80)) < average(sample("double", 400)) * 0.35);
  reset();
});

check("Disabled double/triple controls prevent their special events", () => {
  S.applySettings({ doublelightningenabled: false, triplelightningenabled: false });
  const lightning = new S.Lightning();
  lightning.next = Infinity;
  lightning.nextDouble = 0;
  lightning.nextTriple = 0;
  lightning.update(0.1, 0.1);
  assert.equal(lightning.eventCounts.double, 0);
  assert.equal(lightning.eventCounts.triple, 0);
  assert.equal(lightning.pending.length, 0);
  reset();
});

check("Bolt geometry is unique, finite, bounded, and progress-annotated", () => {
  const hashes = new Set();
  for (let index = 0; index < 300; index++) {
    const paths = S.generateLightningBolt(0.5, 0.2, 0.6, 0.9);
    assert.ok(paths.length >= 3 && paths.length <= 9);
    assert.equal(paths[0].points[0].progress, 0);
    assert.equal(paths[0].points.at(-1).progress, 1);
    for (const path of paths) for (const point of path.points) assert.ok(point.every(Number.isFinite));
    hashes.add(JSON.stringify(paths[0].points));
  }
  assert.equal(hashes.size, 300);
});

check("Leader progress grows and branches activate only after their parent threshold", () => {
  const lightning = isolated();
  const event = lightning.createStrike(lightning.makeStrikeSpec({ depth: 2 }));
  assert.equal(event.leaderProgress, 0);
  lightning.update(event.leaderDuration * 0.2, event.leaderDuration * 0.2);
  const first = event.leaderProgress;
  lightning.update(event.leaderDuration * 0.3, event.leaderDuration * 0.3);
  assert.ok(event.leaderProgress > first && event.leaderProgress < 1);
  const branch = event.paths.find((path) => path.level > 0);
  assert.equal(S.lightningPathProgress(branch, Math.max(0, branch.activation - 0.01)), 0);
  assert.ok(S.lightningPathProgress(branch, Math.min(1, branch.activation + 0.15)) > 0);
  lightning.update(event.leaderDuration, event.leaderDuration);
  assert.equal(event.leaderProgress, 1);
});

check("Return stroke waits for the leader, is faster and brighter, then finishes", () => {
  const lightning = isolated();
  const event = lightning.createStrike(lightning.makeStrikeSpec({ depth: 2, strength: 1 }));
  lightning.update(event.leaderDuration * 0.75, 0.1);
  const leaderPower = event.power;
  assert.equal(event.phase, "leader");
  assert.equal(event.returnProgress, 0);
  lightning.update(event.leaderDuration * 0.3, 0.1);
  assert.equal(event.phase, "return");
  assert.ok(event.power > leaderPower);
  assert.ok(event.returnDuration < event.leaderDuration * 0.4);
  lightning.update(event.returnDuration + 0.01, 0.1);
  assert.notEqual(event.phase, "return");
});

check("Re-strike probability and maximum are respected while geometry is reused", () => {
  const lightning = isolated();
  S.applySettings({ restrikechance: 0, maxrestrikes: "3" });
  assert.equal(lightning.createStrike(lightning.makeStrikeSpec()).restrikeCount, 0);
  S.applySettings({ restrikechance: 100, maxrestrikes: "0" });
  assert.equal(lightning.createStrike(lightning.makeStrikeSpec()).restrikeCount, 0);
  S.applySettings({ restrikechance: 100, maxrestrikes: "3" });
  const event = lightning.createStrike(lightning.makeStrikeSpec());
  const geometry = event.paths;
  assert.equal(event.restrikeCount, 3);
  assert.strictEqual(event.paths, geometry);
  reset();
});

check("Fade components remain bounded and dead events are removed", () => {
  const lightning = isolated();
  const event = lightning.createStrike(lightning.makeStrikeSpec());
  lightning.update(event.returnEnd + event.decayDuration * 0.7, 0.2);
  assert.ok(event.corePower <= event.glowPower || event.corePower < 0.01);
  assert.ok(event.residualPower >= 0);
  lightning.update(event.duration + 0.1, 0.2);
  assert.equal(lightning.active.includes(event), false);
});

check("A deterministic 60-minute storm is bounded with singles dominant and triples rarer", () => {
  const lightning = new S.Lightning();
  let maximumActive = 0;
  let maximumPending = 0;
  for (let index = 0; index < 36000; index++) {
    lightning.update(0.1, 0.1);
    maximumActive = Math.max(maximumActive, lightning.active.length);
    maximumPending = Math.max(maximumPending, lightning.pending.length);
    assert.ok(lightning.active.length <= 8);
    assert.ok(lightning.pending.length <= 6);
  }
  assert.ok(lightning.eventCounts.single > lightning.eventCounts.double * 5);
  assert.ok(lightning.eventCounts.double > lightning.eventCounts.triple);
  assert.ok(lightning.specialHistory.double.length >= 8);
  assert.ok(lightning.specialHistory.triple.length >= 2);
  const gaps = (values) => values.slice(1).map((value, index) => value - values[index]);
  const doubleGaps = gaps(lightning.specialHistory.double);
  const tripleGaps = gaps(lightning.specialHistory.triple);
  assert.ok(new Set(doubleGaps.map((value) => value.toFixed(1))).size > 5);
  assert.ok(new Set(tripleGaps.map((value) => value.toFixed(1))).size > 1);
  console.log(`  singles ${lightning.eventCounts.single}; doubles ${lightning.eventCounts.double}; triples ${lightning.eventCounts.triple}; max active ${maximumActive}; max queued ${maximumPending}`);
});

check("Reduced Flash suppresses multi-strikes and enforces the 10-second wall-time interval", () => {
  S.applySettings({ reducedflash: true, lightningfrequency: "storm", restrikechance: 100, maxrestrikes: "3" });
  const lightning = new S.Lightning();
  let last = -100;
  for (let index = 0; index < 15000; index++) {
    const before = lightning.totalEvents;
    lightning.update(2 / 60, 1 / 60);
    if (lightning.totalEvents > before) {
      assert.ok(lightning.wallTime - last >= 10 - 1e-8);
      last = lightning.wallTime;
    }
    for (const event of lightning.active) {
      assert.ok(event.restrikeCount <= 1);
      assert.ok(event.power <= 0.3);
    }
  }
  assert.equal(lightning.eventCounts.double, 0);
  assert.equal(lightning.eventCounts.triple, 0);
  reset();
});

check("Disabled lightning clears queues and active events", () => {
  const lightning = isolated();
  lightning.createEvent();
  lightning.queuePlan(lightning.planMultiEvent("double"));
  S.settings.lightningenabled = false;
  lightning.update(0.1, 0.1);
  assert.equal(lightning.active.length, 0);
  assert.equal(lightning.pending.length, 0);
  assert.equal(lightning.trigger(), false);
  reset();
});

check("Thunder pure logic handles distance, delay, intensity, pan, silence, and voice limits", () => {
  const near = { depth: 2, x: 0.1, y: 0.2, endY: 0.95, strength: 1 };
  const far = { depth: 0, x: 0.9, y: 0.2, endY: 0.45, strength: 0.6 };
  assert.ok(S.thunderDistance(near) < S.thunderDistance(far));
  assert.ok(S.thunderDelay(near, 0.5) < S.thunderDelay(far, 0.5));
  assert.ok(S.thunderProfile(near).crack > S.thunderProfile(far).crack);
  assert.ok(S.thunderPan(near) < 0 && S.thunderPan(far) > 0);
  S.settings.spatialthunder = false;
  assert.equal(S.thunderPan(near), 0);
  assert.equal(S.canAdmitThunderVoice(0, true, 0), false);
  assert.equal(S.canAdmitThunderVoice(S.MAX_THUNDER_VOICES, true, 40), false);
  assert.equal(S.canAdmitThunderVoice(0, false, 40), false);
  assert.equal(S.canAdmitThunderVoice(0, true, 40), true);
  reset();
});

console.log(`\n${checks} checks passed.`);
