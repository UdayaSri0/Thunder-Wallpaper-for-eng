(() => {
  const S = Storm,
    rand = S.random;
  const ranges = {
    veryrare: [20, 60],
    rare: [12, 30],
    normal: [5, 18],
    frequent: [2, 8],
    storm: [0.5, 4],
  };
  function generateLightningBolt(startX, startY, endX, endY) {
    const paths = [];
    function grow(sx, sy, ex, ey, width, level) {
      const distance = Math.hypot(ex - sx, ey - sy),
        points = [[sx, sy]];
      function subdivide(ax, ay, bx, by, displacement, steps) {
        if (!steps) {
          points.push([bx, by]);
          return;
        }
        const ratio = rand(0.35, 0.65),
          dx = bx - ax,
          dy = by - ay,
          length = Math.hypot(dx, dy) || 1,
          offset = rand(-displacement, displacement);
        const mx = ax + dx * ratio + (dy / length) * offset,
          my = ay + dy * ratio - (dx / length) * offset * 0.35;
        subdivide(ax, ay, mx, my, displacement * 0.51, steps - 1);
        subdivide(mx, my, bx, by, displacement * 0.51, steps - 1);
      }
      subdivide(sx, sy, ex, ey, distance * 0.21, level === 0 ? 7 : 5);
      const count = points.length - 1;
      paths.push({ points, width, alpha: level === 0 ? 1 : rand(0.3, 0.65) });
      if (level < 2 && distance > 0.07) {
        const branches =
          level === 0 ? Math.floor(rand(2, 5)) : Math.floor(rand(0, 2));
        for (let i = 0; i < branches; i++) {
          const p = points[Math.floor(rand(count * 0.2, count * 0.78))],
            side = Math.random() < 0.5 ? -1 : 1,
            length = distance * rand(0.12, 0.34);
          grow(
            p[0],
            p[1],
            p[0] + length * side * rand(0.5, 1.3),
            p[1] + length * rand(0.4, 0.95),
            width * 0.45,
            level + 1,
          );
        }
      }
    }
    grow(startX, startY, endX, endY, rand(0.8, 1.5), 0);
    return paths;
  }
  class Lightning {
    constructor() {
      this.time = 0;
      this.wallTime = 0;
      this.lastStrike = -100;
      this.lastManual = -100;
      this.pending = [];
      this.active = [];
      this.next = this.delay();
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.frameLights = [];
      this.totalEvents = 0;
    }
    resize(w, h) {
      const scale = Math.min(1.3, 1800 / w, 1200 / h);
      this.canvas.width = Math.round(w * scale);
      this.canvas.height = Math.round(h * scale);
      this.dirty = false;
    }
    delay() {
      const c = S.settings,
        [lo, hi] = ranges[c.lightningfrequency];
      let delay = rand(lo, hi);
      const roll = Math.random();
      if (roll < 0.13) delay *= rand(1.3, 1.85);
      else if (roll < 0.24 && c.lightningfrequency !== "veryrare")
        delay *= rand(0.35, 0.6);
      return c.reducedflash ? Math.max(10, delay) : delay;
    }
    chooseDepth() {
      const c = S.settings,
        weights = [
          c.cloudlightningfrequency,
          c.middleboltfrequency,
          c.visibleboltfrequency,
        ],
        sum = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum;
      if (!sum) return 0;
      for (let i = 0; i < 3; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return 2;
    }
    createEvent(
      depth = this.chooseDepth(),
      x = rand(0.2, 0.8),
      y = rand(0.12, 0.53),
      strength = 1,
    ) {
      const reduced = S.settings.reducedflash;
      const pulseCount = reduced
        ? 1
        : Math.random() < 0.4
          ? 1
          : Math.floor(rand(2, 5));
      const pulses = [];
      let time = 0;
      for (let i = 0; i < pulseCount; i++) {
        const duration = reduced ? rand(0.5, 0.8) : rand(0.04, 0.13);
        pulses.push({
          start: time,
          duration,
          amplitude:
            (i === pulseCount - 1 ? rand(0.75, 1) : rand(0.24, 0.78)) *
            strength,
        });
        time += duration + rand(0.018, 0.105);
      }
      const endX = S.clamp(x + rand(-0.15, 0.15), 0.08, 0.92),
        endY =
          depth === 2
            ? rand(0.65, 0.96)
            : S.clamp(y + rand(0.12, 0.42), 0, 0.87);
      const event = {
        x,
        y,
        depth,
        age: 0,
        pulses,
        duration: time + 0.09,
        power: 0,
        visible: depth > 0 || Math.random() < 0.22,
        paths: generateLightningBolt(x, y, endX, endY),
      };
      this.active.push(event);
      this.lastStrike = this.wallTime;
      this.totalEvents++;
      return event;
    }
    cluster() {
      const c = S.settings,
        roll = Math.random();
      const size = c.reducedflash
        ? 1
        : roll < (c.lightningfrequency === "storm" ? 0.55 : 0.24)
          ? Math.floor(rand(2, 5))
          : 1;
      const center = rand(0.22, 0.78);
      let offset = 0;
      for (let i = 0; i < size; i++) {
        const depth = size > 1 && i === 0 ? 0 : this.chooseDepth();
        this.pending.push({
          at: this.time + offset,
          depth,
          x: S.clamp(center + rand(-0.15, 0.15), 0.2, 0.8),
          y: rand(0.12, 0.5),
          strength: size > 1 && i === 0 ? 0.5 : rand(0.65, 1.1),
        });
        offset += rand(0.24, 1.1);
      }
      this.next = this.time + offset + this.delay();
    }
    trigger(x, y) {
      if (
        !S.settings.lightningenabled ||
        S.settings.animationspeed === 0 ||
        this.wallTime - this.lastManual < 1.2
      )
        return false;
      if (S.settings.reducedflash && this.wallTime - this.lastStrike < 10)
        return false;
      this.lastManual = this.wallTime;
      this.pending.length = 0;
      this.createEvent(
        this.chooseDepth(),
        x === undefined ? rand(0.2, 0.8) : S.clamp(x, 0.2, 0.8),
        y === undefined ? rand(0.15, 0.45) : S.clamp(y, 0.1, 0.55),
      );
      this.next = this.time + this.delay();
      return true;
    }
    resetSchedule() {
      this.pending.length = 0;
      this.active.length = 0;
      this.next = this.time + this.delay();
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
      if (this.time >= this.next) this.cluster();
      while (this.pending.length && this.pending[0].at <= this.time) {
        const p = this.pending.shift();
        if (
          (!S.settings.reducedflash || this.wallTime - this.lastStrike >= 10) &&
          this.active.length < 4
        )
          this.createEvent(p.depth, p.x, p.y, p.strength);
      }
      for (let i = this.active.length - 1; i >= 0; i--) {
        const e = this.active[i];
        const previousAge = e.age;
        e.age += dt;
        if (previousAge > e.duration) {
          this.active.splice(i, 1);
          continue;
        }
        let amplitude = 0;
        for (const p of e.pulses) {
          // Sample the strongest part crossed by this frame so short pulses
          // remain visible at 30 FPS or when master speed is increased.
          const attack = S.settings.reducedflash ? 0.28 : 0.075;
          const sampleTime = S.clamp(
            p.start + p.duration * attack,
            previousAge,
            e.age,
          );
          const t = (sampleTime - p.start) / p.duration;
          if (t >= 0 && t < 1) {
            const envelope =
              t < attack
                ? t / attack
                : Math.pow(1 - (t - attack) / (1 - attack), 1.7);
            amplitude = Math.max(amplitude, envelope * p.amplitude);
          }
        }
        e.power =
          ((amplitude * S.settings.lightningintensity) / 100) *
          (S.settings.reducedflash ? 0.26 : 1.6);
        if (e.power > 0.001) this.frameLights.push(e);
      }
      return this.frameLights;
    }
    draw(encoded = true) {
      if (!this.frameLights.length && !this.dirty) return;
      this.dirty = !!this.frameLights.length;
      const ctx = this.ctx,
        w = this.canvas.width,
        h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const color = S.color().map((n) => Math.round(n * 255));
      for (const e of this.frameLights) {
        if (!e.visible) continue;
        const channel = encoded
          ? ["255,0,0", "0,255,0", "0,0,255"][e.depth]
          : color.join(",");
        for (const path of e.paths) {
          ctx.beginPath();
          path.points.forEach((p, i) => {
            if (i) ctx.lineTo(p[0] * w, p[1] * h);
            else ctx.moveTo(p[0] * w, p[1] * h);
          });
          const scale = Math.max(0.7, w / 1500),
            alpha =
              Math.min(1, e.power) *
              path.alpha *
              (encoded ? 1 : [0.08, 0.36, 1][e.depth]);
          ctx.strokeStyle = `rgb(${channel})`;
          ctx.shadowColor = `rgb(${channel})`;
          ctx.globalAlpha = (alpha * 0.22 * S.settings.lightningglow) / 100;
          ctx.shadowBlur = 18 * scale;
          ctx.lineWidth = 5 * path.width * scale;
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.5;
          ctx.shadowBlur = 5 * scale;
          ctx.lineWidth = 2 * path.width * scale;
          ctx.stroke();
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 0;
          ctx.lineWidth = 0.8 * path.width * scale;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }
  S.Lightning = Lightning;
  S.generateLightningBolt = generateLightningBolt;
})();
