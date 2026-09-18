(() => {
  const S = Storm;
  class Weather {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.time = 0;
      this.wasActive = false;
      this.rain = Array.from({ length: 360 }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: S.random(0.35, 1),
        speed: S.random(0.6, 1.1),
      }));
      this.images = [];
      for (const path of S.cloudTextures.slice(0, 8)) {
        const image = new Image();
        image.onload = () => this.images.push(image);
        image.onerror = () =>
          console.warn("Optional cloud texture could not load:", path);
        image.src = path;
      }
    }
    resize(w, h) {
      this.canvas.width = Math.min(w, 2200);
      this.canvas.height = Math.round((h * this.canvas.width) / w);
      this.wasActive = true;
    }
    render(dt, lights) {
      const c = S.settings,
        count = [0, 70, 160, 320][Number(c.rainamount)],
        ctx = this.ctx,
        w = this.canvas.width,
        h = this.canvas.height;
      if (!count && !this.images.length && !this.wasActive) return;
      ctx.clearRect(0, 0, w, h);
      this.wasActive = !!count || !!this.images.length;
      this.time += (dt * c.cloudspeed) / 100;
      for (let i = 0; i < this.images.length; i++) {
        const img = this.images[i],
          width = w * 0.85,
          height = (width * img.height) / img.width,
          x =
            ((((i * w * 0.4 + this.time * (i % 2 ? 2 : -2)) % (w + width)) +
              (w + width)) %
              (w + width)) -
            width;
        ctx.globalAlpha = (0.22 * c.clouddensity) / 100;
        ctx.drawImage(img, x, h * (0.08 + i * 0.09), width, height);
      }
      ctx.globalAlpha = 1;
      if (!count) return;
      const flash = Math.min(
        0.22,
        lights.reduce((a, e) => a + e.power * 0.07, 0),
      );
      ctx.strokeStyle = `rgba(150,183,212,${0.13 + flash})`;
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const p = this.rain[i];
        p.y += dt * p.speed * 0.55;
        p.x -= dt * p.speed * 0.052;
        if (p.y > 1.06) {
          p.y = -0.06;
          p.x = Math.random() * 1.1;
        }
        if (p.x < -0.1) p.x = 1.1;
        const length = ((7 + 16 * p.z) * h) / 1080;
        ctx.moveTo(p.x * w, p.y * h);
        ctx.lineTo(p.x * w - length * 0.35, p.y * h + length);
      }
      ctx.stroke();
    }
  }
  S.Weather = Weather;
})();
