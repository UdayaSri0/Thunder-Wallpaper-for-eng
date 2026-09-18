(() => {
  const S = Storm;
  const rand = S.random;
  const NORMAL_RANGES = {
    veryrare: [20, 60],
    rare: [12, 30],
    normal: [5, 18],
    frequent: [2, 8],
    storm: [0.5, 4],
  };
  const MAX_ACTIVE = 8;

  function annotate(points) {
    let distance = 0;
    points[0].distance = 0;
    for (let index = 1; index < points.length; index++) {
      distance += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
      points[index].distance = distance;
    }
    for (const point of points) point.progress = distance ? point.distance / distance : 0;
    return distance;
  }

  function generateLightningBolt(startX, startY, endX, endY) {
    const paths = [];
    function grow(sx, sy, ex, ey, width, level, activation) {
      const distance = Math.hypot(ex - sx, ey - sy);
      const points = [[sx, sy]];
      function subdivide(ax, ay, bx, by, displacement, steps) {
        if (!steps) {
          points.push([bx, by]);
          return;
        }
        const ratio = rand(0.35, 0.65);
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.hypot(dx, dy) || 1;
        const offset = rand(-displacement, displacement);
        const mx = ax + dx * ratio + (dy / length) * offset;
        const my = ay + dy * ratio - (dx / length) * offset * 0.35;
        subdivide(ax, ay, mx, my, displacement * 0.51, steps - 1);
        subdivide(mx, my, bx, by, displacement * 0.51, steps - 1);
      }
      subdivide(sx, sy, ex, ey, distance * 0.21, level === 0 ? 7 : 5);
      const path = {
        points,
        width,
        alpha: level === 0 ? 1 : rand(0.28, 0.62),
        level,
        activation,
        speed: level === 0 ? 1 : rand(0.85, 1.25),
        length: annotate(points),
      };
      paths.push(path);
      if (level < 2 && distance > 0.07) {
        const branches = level === 0 ? Math.floor(rand(2, 5)) : Math.floor(rand(0, 2));
        for (let index = 0; index < branches; index++) {
          const point = points[Math.floor(rand((points.length - 1) * 0.2, (points.length - 1) * 0.78))];
          const side = Math.random() < 0.5 ? -1 : 1;
          const branchLength = distance * rand(level ? 0.1 : 0.12, level ? 0.22 : 0.34);
          const childActivation = level === 0
            ? point.progress
            : S.clamp(activation + point.progress * (1 - activation) * 0.24, activation, 0.94);
          grow(
            point[0], point[1],
            point[0] + branchLength * side * rand(0.5, 1.3),
            point[1] + branchLength * rand(0.35, 0.95),
            width * 0.45,
            level + 1,
            childActivation,
          );
        }
      }
    }
    grow(startX, startY, endX, endY, rand(0.8, 1.5), 0, 0);
    return paths;
  }

  function pointAt(path, progress) {
    progress = S.clamp(progress, 0, 1);
    for (let index = 1; index < path.points.length; index++) {
      const a = path.points[index - 1];
      const b = path.points[index];
      if (b.progress >= progress) {
        const span = b.progress - a.progress || 1;
        const amount = (progress - a.progress) / span;
        return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
      }
    }
    return path.points[path.points.length - 1].slice(0, 2);
  }

  function exponentialGap(mean, minimum = 0) {
    const scale = Math.max(0.001, mean - minimum);
    return minimum - Math.log(1 - Math.min(0.999999, Math.random())) * scale;
  }

  function selectStrikeColours(count) {
    const enabled = S.enabledColours();
    const result = [];
    const preferDifferent = enabled.length > 1 && Math.random() < 0.84;
    let pool = enabled.slice();
    for (let index = 0; index < count; index++) {
      if (preferDifferent && !pool.length) pool = enabled.slice();
      const source = preferDifferent ? pool : enabled;
      const chosenIndex = Math.floor(Math.random() * source.length);
      const chosen = source[chosenIndex];
      result.push({ slot: chosen.slot, value: chosen.value.slice() });
      if (preferDifferent) pool.splice(chosenIndex, 1);
    }
    return result;
  }

  function pathProgress(path, leaderProgress) {
    if (path.level === 0) return leaderProgress;
    if (leaderProgress <= path.activation) return 0;
    return S.clamp(((leaderProgress - path.activation) / Math.max(0.04, 1 - path.activation)) * path.speed, 0, 1);
  }

  function chooseDestination(depth, x, y) {
    const modeRoll = Math.random();
    let destination = "cloud-to-ground";
    let endX;
    let endY;
    if (depth === 0) {
      destination = modeRoll < 0.55 ? "intra-cloud" : modeRoll < 0.86 ? "cloud-to-cloud" : "partial-descending";
      endX = S.clamp(x + rand(-0.35, 0.35), 0.05, 0.95);
      endY = S.clamp(y + rand(0.08, 0.3), 0.14, 0.76);
    } else if (depth === 1) {
      destination = modeRoll < 0.38 ? "cloud-to-cloud" : modeRoll < 0.74 ? "partial-descending" : "cloud-to-ground";
      endX = S.clamp(x + rand(-0.27, 0.27), 0.04, 0.96);
      endY = destination === "cloud-to-ground" ? rand(0.7, 0.94) : S.clamp(y + rand(0.16, 0.48), 0.3, 0.86);
    } else {
      destination = modeRoll < 0.72 ? "cloud-to-ground" : modeRoll < 0.88 ? "diagonal-discharge" : "partial-descending";
      endX = S.clamp(x + rand(-0.2, 0.2), 0.04, 0.96);
      endY = destination === "cloud-to-ground" ? rand(0.76, 1.02) : rand(0.58, 0.88);
    }
    return { endX, endY, destination };
  }

  class Lightning {
    constructor() {
      this.time = 0;
      this.wallTime = 0;
      this.lastStrike = -100;
      this.lastManual = -100;
      this.pending = [];
      this.active = [];
      this.frameLights = [];
      this.totalEvents = 0;
      this.eventCounts = { single: 0, double: 0, triple: 0 };
      this.specialHistory = { double: [], triple: [] };
      this.groupId = 0;
      this.next = this.delay();
      this.nextDouble = this.specialGap("double");
      this.nextTriple = this.specialGap("triple");
      this.canvas = document.createElement("canvas");
      this.canvas.id = "lightning";
      this.canvas.setAttribute?.("aria-hidden", "true");
      this.ctx = this.canvas.getContext("2d");
      this.depthCanvas = document.createElement("canvas");
      this.depthCtx = this.depthCanvas.getContext("2d");
      const scene = document.getElementById?.("scene");
      const weather = document.getElementById?.("weather");
      if (scene && !document.getElementById("lightning")) scene.insertBefore(this.canvas, weather || null);
      this.dirty = false;
    }

    resize(width, height) {
      const scale = Math.min(1.3, 1800 / width, 1200 / height);
      this.canvas.width = Math.round(width * scale);
      this.canvas.height = Math.round(height * scale);
      this.depthCanvas.width = this.canvas.width;
      this.depthCanvas.height = this.canvas.height;
      this.dirty = false;
    }

    delay() {
      const range = NORMAL_RANGES[S.settings.lightningfrequency] || NORMAL_RANGES.normal;
      let wait = rand(range[0], range[1]);
      const roll = Math.random();
      if (roll < 0.13) wait *= rand(1.3, 1.85);
      else if (roll < 0.24 && S.settings.lightningfrequency !== "veryrare") wait *= rand(0.35, 0.6);
      return S.settings.reducedflash ? Math.max(10, wait) : wait;
    }

    specialGap(type) {
      const mean = Number(S.settings[`${type}lightninginterval`]);
      return exponentialGap(mean, Math.max(6, mean * 0.08));
    }

    chooseDepth() {
      const weights = [S.settings.cloudlightningfrequency, S.settings.middleboltfrequency, S.settings.visibleboltfrequency];
      const sum = weights.reduce((total, weight) => total + weight, 0);
      if (!sum) return 0;
      let roll = Math.random() * sum;
      for (let index = 0; index < weights.length; index++) {
        roll -= weights[index];
        if (roll < 0) return index;
      }
      return 2;
    }

    makeStrikeSpec(options = {}) {
      const depth = options.depth ?? this.chooseDepth();
      const x = options.x ?? rand(0.2, 0.8);
      const y = options.y ?? rand(0.12, 0.5);
      const destination = chooseDestination(depth, x, y);
      return {
        depth,
        x,
        y,
        strength: options.strength ?? rand(0.76, 1.08),
        colour: options.colour ? options.colour.slice() : selectStrikeColours(1)[0].value,
        colourSlot: options.colourSlot || 1,
        eventType: options.eventType || "single",
        groupId: options.groupId || ++this.groupId,
        strikeIndex: options.strikeIndex || 0,
        destination: destination.destination,
        endX: destination.endX,
        endY: destination.endY,
        paths: generateLightningBolt(x, y, destination.endX, destination.endY),
      };
    }

    planMultiEvent(type) {
      const count = type === "triple" ? 3 : 2;
      const groupId = ++this.groupId;
      const colours = selectStrikeColours(count);
      const centre = rand(0.22, 0.78);
      const spread = 0.035 + (S.settings.multistrikespread / 100) * 0.38;
      const strikes = [];
      let offset = 0;
      for (let index = 0; index < count; index++) {
        let x = S.clamp(centre + rand(-spread, spread), 0.08, 0.92);
        for (let attempt = 0; attempt < 6 && strikes.some((strike) => Math.abs(x - strike.x) < 0.025); attempt++)
          x = S.clamp(centre + rand(-spread, spread), 0.08, 0.92);
        if (strikes.some((strike) => Math.abs(x - strike.x) < 0.025))
          x = S.clamp(centre + (index - (count - 1) / 2) * 0.055, 0.08, 0.92);
        if (index) offset += rand(S.settings.multistrikemingap, S.settings.multistrikemaxgap) / 1000;
        strikes.push(this.makeStrikeSpec({
          x,
          y: rand(0.1, 0.5),
          colour: colours[index].value,
          colourSlot: colours[index].slot,
          eventType: type,
          groupId,
          strikeIndex: index,
          strength: rand(0.72, 1.1),
        }));
        strikes[index].offset = offset;
      }
      return { type, groupId, strikes };
    }

    queuePlan(plan) {
      this.eventCounts[plan.type]++;
      this.specialHistory[plan.type].push(this.time);
      for (const strike of plan.strikes) this.pending.push({ at: this.time + strike.offset, spec: strike });
      this.pending.sort((a, b) => a.at - b.at);
      return plan;
    }

    createStrike(spec = {}) {
      if (!spec.paths) spec = this.makeStrikeSpec(spec);
      const reduced = S.settings.reducedflash;
      const travelScale = (100 / S.settings.lightningtravelspeed) * rand(0.86, 1.16);
      const fadeScale = (100 / S.settings.lightningfadespeed) * rand(0.86, 1.16);
      const leaderDuration = (spec.depth === 0 ? rand(0.42, 0.82) : rand(0.3, 0.68)) * travelScale;
      const returnDuration = rand(0.045, 0.095) * Math.min(1.2, travelScale);
      const decayDuration = (reduced ? rand(0.65, 0.95) : rand(0.3, 0.58)) * fadeScale;
      const residualDuration = rand(0.22, 0.48) * fadeScale;
      const maximum = reduced ? Math.min(1, Number(S.settings.maxrestrikes)) : Number(S.settings.maxrestrikes);
      const chance = reduced ? Math.min(0.08, S.settings.restrikechance / 100) : S.settings.restrikechance / 100;
      let restrikeCount = 0;
      while (restrikeCount < maximum && Math.random() < chance) restrikeCount++;
      const returnStart = leaderDuration;
      const returnEnd = returnStart + returnDuration;
      const restrikes = [];
      let cursor = returnEnd + decayDuration * 0.62;
      for (let index = 0; index < restrikeCount; index++) {
        cursor += rand(0.08, reduced ? 0.5 : 0.3);
        const duration = rand(0.045, 0.085);
        restrikes.push({ start: cursor, end: cursor + duration, intensity: Math.pow(0.84, index + 1) });
        cursor += duration + decayDuration * 0.45;
      }
      const event = {
        ...spec,
        age: 0,
        leaderDuration,
        returnStart,
        returnEnd,
        returnDuration,
        decayDuration,
        residualDuration,
        restrikes,
        restrikeCount,
        duration: (restrikes.length ? cursor : returnEnd + decayDuration) + residualDuration,
        leaderProgress: 0,
        returnProgress: 0,
        phase: "leader",
        power: 0,
        corePower: 0,
        glowPower: 0,
        residualPower: 0,
        visible: spec.depth > 0 || Math.random() < 0.28,
        thunderFired: false,
        lightSamples: [],
      };
      this.active.push(event);
      this.lastStrike = this.wallTime;
      this.totalEvents++;
      return event;
    }

    createEvent(depth = this.chooseDepth(), x = rand(0.2, 0.8), y = rand(0.12, 0.5), strength = 1) {
      this.eventCounts.single++;
      return this.createStrike(this.makeStrikeSpec({ depth, x, y, strength, eventType: "single" }));
    }

    specialAllowed(type) {
      return !S.settings.reducedflash && !!S.settings[`${type}lightningenabled`];
    }

    trigger(x, y) {
      if (!S.settings.lightningenabled || S.settings.animationspeed === 0 || this.wallTime - this.lastManual < 1.2) return false;
      if (S.settings.reducedflash && this.wallTime - this.lastStrike < 10) return false;
      this.lastManual = this.wallTime;
      this.createEvent(
        this.chooseDepth(),
        x === undefined ? rand(0.2, 0.8) : S.clamp(x, 0.08, 0.92),
        y === undefined ? rand(0.12, 0.48) : S.clamp(y, 0.08, 0.58),
      );
      this.next = this.time + this.delay();
      return true;
    }

    resetSchedule() {
      this.pending.length = 0;
      this.active.length = 0;
      this.next = this.time + this.delay();
      this.nextDouble = this.time + this.specialGap("double");
      this.nextTriple = this.time + this.specialGap("triple");
    }

    updateState(event, previousAge) {
      const intensity = (S.settings.lightningintensity / 100) * event.strength;
      const safety = S.settings.reducedflash ? 0.26 : 1;
      event.leaderProgress = S.clamp(event.age / event.leaderDuration, 0, 1);
      event.returnProgress = 0;
      event.corePower = 0;
      event.glowPower = 0;
      event.residualPower = 0;
      if (event.age < event.returnStart) {
        event.phase = "leader";
        const shimmer = 0.78 + Math.sin(event.age * 93) * 0.12;
        event.power = intensity * safety * (0.22 + event.leaderProgress * 0.28) * shimmer;
        event.corePower = event.power * 0.35;
        event.glowPower = event.power;
      } else if (event.age < event.returnEnd) {
        event.phase = "return";
        event.returnProgress = S.clamp((event.age - event.returnStart) / event.returnDuration, 0, 1);
        event.power = intensity * safety * (S.settings.reducedflash ? 0.75 : 1.55);
        event.corePower = event.power;
        event.glowPower = event.power * 0.9;
      } else {
        let activeRestrike = null;
        for (const restrike of event.restrikes)
          if (event.age >= restrike.start && event.age < restrike.end) activeRestrike = restrike;
        if (activeRestrike) {
          event.phase = "restrike";
          event.returnProgress = 1;
          event.power = intensity * safety * 1.35 * activeRestrike.intensity;
          event.corePower = event.power;
          event.glowPower = event.power * 0.82;
        } else {
          event.phase = "fade";
          const mostRecentEnd = event.restrikes.filter((entry) => entry.end <= event.age).reduce((latest, entry) => Math.max(latest, entry.end), event.returnEnd);
          const fade = S.clamp((event.age - mostRecentEnd) / event.decayDuration, 0, 1);
          event.corePower = intensity * safety * 0.52 * Math.pow(1 - fade, 4.2);
          event.glowPower = intensity * safety * 0.58 * Math.pow(1 - fade, 2.1);
          const overall = S.clamp((event.duration - event.age) / event.residualDuration, 0, 1);
          event.residualPower = intensity * safety * 0.12 * Math.max(overall, Math.pow(1 - fade, 0.72));
          event.power = Math.max(event.glowPower, event.residualPower);
        }
      }
      if (!event.thunderFired && previousAge < event.returnStart && event.age >= event.returnStart) {
        event.thunderFired = true;
        window.dispatchEvent(new CustomEvent("stormthunder", { detail: event }));
      }
      this.buildLightSamples(event);
    }

    buildLightSamples(event) {
      const samples = event.lightSamples;
      samples.length = 0;
      const main = event.paths[0];
      const add = (progress, power) => {
        const point = pointAt(main, progress);
        samples.push({ x: point[0], y: point[1], power, depth: event.depth, colour: event.colour });
      };
      if (event.phase === "leader") {
        add(event.leaderProgress, event.power * 1.35);
        if (event.leaderProgress > 0.18) add(event.leaderProgress * 0.62, event.power * 0.55);
      } else if (event.phase === "return" || event.phase === "restrike") {
        add(1, event.power * 1.05);
        add(0.58, event.power * 0.72);
        add(0.2, event.power * 0.48);
      } else if (event.power > 0.002) {
        add(0.72, event.power * 0.62);
        add(0.3, event.power * 0.34);
      }
    }

    update(dt, realDt) {
      this.time += dt;
      this.wallTime += realDt;
      this.frameLights.length = 0;
      if (!S.settings.lightningenabled) {
        this.pending.length = 0;
        this.active.length = 0;
        return this.frameLights;
      }
      if (dt === 0) return this.frameLights;

      if (this.time >= this.next) {
        if (!S.settings.reducedflash || this.wallTime - this.lastStrike >= 10) this.createEvent();
        this.next = this.time + this.delay();
      }
      if (this.time >= this.nextDouble) {
        if (this.specialAllowed("double")) this.queuePlan(this.planMultiEvent("double"));
        this.nextDouble = this.time + this.specialGap("double");
      }
      if (this.time >= this.nextTriple) {
        if (this.specialAllowed("triple")) this.queuePlan(this.planMultiEvent("triple"));
        this.nextTriple = this.time + this.specialGap("triple");
      }
      while (this.pending.length && this.pending[0].at <= this.time) {
        const pending = this.pending.shift();
        if (this.active.length < MAX_ACTIVE) this.createStrike(pending.spec);
      }
      for (let index = this.active.length - 1; index >= 0; index--) {
        const event = this.active[index];
        const previousAge = event.age;
        event.age += dt;
        if (event.age >= event.duration) {
          this.active.splice(index, 1);
          continue;
        }
        this.updateState(event, previousAge);
        if (event.power > 0.001) this.frameLights.push(event);
      }
      return this.frameLights;
    }

    traceRange(ctx, path, startProgress, endProgress, width, height) {
      const start = pointAt(path, startProgress);
      ctx.beginPath();
      ctx.moveTo(start[0] * width, start[1] * height);
      for (const point of path.points) {
        if (point.progress <= startProgress) continue;
        if (point.progress >= endProgress) {
          const end = pointAt(path, endProgress);
          ctx.lineTo(end[0] * width, end[1] * height);
          break;
        }
        ctx.lineTo(point[0] * width, point[1] * height);
      }
    }

    paint(ctx, path, start, end, alpha, lineWidth, blur, colour) {
      if (end <= start || alpha <= 0) return;
      this.traceRange(ctx, path, start, end, this.canvas.width, this.canvas.height);
      ctx.strokeStyle = `rgb(${colour})`;
      ctx.shadowColor = `rgb(${colour})`;
      ctx.globalAlpha = S.clamp(alpha, 0, 1);
      ctx.shadowBlur = blur;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    stroke(path, event, start, end, alpha, lineWidth, blur) {
      const colour = event.colour.map((part) => Math.round(part * 255)).join(",");
      const depthColour = ["255,0,0", "0,255,0", "0,0,255"][event.depth];
      this.paint(this.ctx, path, start, end, alpha, lineWidth, blur, colour);
      this.paint(this.depthCtx, path, start, end, alpha, lineWidth, blur, depthColour);
    }

    draw(encoded = false) {
      if (!this.frameLights.length && !this.dirty) return;
      this.dirty = !!this.frameLights.length;
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      ctx.clearRect(0, 0, width, height);
      this.depthCtx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      this.depthCtx.lineCap = "round";
      this.depthCtx.lineJoin = "round";
      this.canvas.style && (this.canvas.style.opacity = encoded ? "0" : "1");
      const scale = Math.max(0.7, width / 1500);
      for (const event of this.frameLights) {
        if (!event.visible) continue;
        const depthAlpha = [0.09, 0.5, 1][event.depth];
        for (const path of event.paths) {
          let visible = pathProgress(path, event.leaderProgress);
          if (event.phase !== "leader") visible = 1;
          if (!visible) continue;
          const base = depthAlpha * path.alpha;
          this.stroke(path, event, 0, visible, base * event.residualPower * 1.8, 0.65 * path.width * scale, 0);
          this.stroke(path, event, 0, visible, base * event.glowPower * 0.2 * (S.settings.lightningglow / 100), 7 * path.width * scale, 22 * scale);
          this.stroke(path, event, 0, visible, base * event.glowPower * 0.44, 2.4 * path.width * scale, 7 * scale);
          let coreStart = 0;
          if (event.phase === "return") coreStart = 1 - event.returnProgress;
          this.stroke(path, event, coreStart, visible, base * event.corePower, 0.8 * path.width * scale, 1.5 * scale);
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      this.depthCtx.globalAlpha = 1;
      this.depthCtx.shadowBlur = 0;
    }
  }

  S.Lightning = Lightning;
  S.generateLightningBolt = generateLightningBolt;
  S.lightningPointAt = pointAt;
  S.lightningPathProgress = pathProgress;
  S.exponentialGap = exponentialGap;
  S.selectStrikeColours = selectStrikeColours;
})();
