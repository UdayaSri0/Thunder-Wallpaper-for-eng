(() => {
  "use strict";
  const S = Storm,
    clouds = new S.Clouds(document.getElementById("clouds")),
    lightning = new S.Lightning(),
    thunder = new S.ThunderAudio(),
    weather = new S.Weather(document.getElementById("weather"));
  const panel = document.getElementById("settings"),
    toggle = document.getElementById("settings-toggle"),
    controls = document.getElementById("controls");
  let animation = 0,
    last = 0,
    accumulator = 0,
    frames = 0,
    simulationTime = 0,
    uiTimer = 0;
  function resize() {
    clouds.resize(innerWidth, innerHeight);
    lightning.resize(innerWidth, innerHeight);
    weather.resize(innerWidth, innerHeight);
  }
  function effectiveFPS() {
    const own = Number(S.settings.animationfps);
    return S.hostFPS > 0
      ? own > 0
        ? Math.min(own, S.hostFPS)
        : S.hostFPS
      : own;
  }
  function tick(now) {
    animation = requestAnimationFrame(tick);
    if (!last) {
      last = now;
      return;
    }
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    const fps = effectiveFPS(),
      interval = fps > 0 ? 1 / fps : 0;
    if (interval && accumulator + 0.0001 < interval) return;
    accumulator = interval ? Math.max(0, accumulator - interval) % interval : 0;
    // The remainder schedules the next frame but must not be simulated twice.
    const realDt = elapsedSinceRender(now),
      dt = (realDt * S.settings.animationspeed) / 100;
    const lights = lightning.update(dt, realDt);
    lightning.draw(!!clouds.gl);
    clouds.render(dt, lights, lightning.canvas, lightning.depthCanvas);
    weather.render(dt, lights);
    frames++;
    simulationTime += dt;
  }
  let renderedAt = 0;
  function elapsedSinceRender(now) {
    const dt = renderedAt ? Math.min(0.15, (now - renderedAt) / 1000) : 1 / 60;
    renderedAt = now;
    return dt;
  }
  function resume() {
    cancelAnimationFrame(animation);
    animation = 0;
    last = 0;
    renderedAt = 0;
    accumulator = 0;
    if (!document.hidden && !S.hostPaused)
      animation = requestAnimationFrame(tick);
  }
  function setPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) document.getElementById("close").focus();
    else toggle.focus({ preventScroll: true });
  }
  function syncControls() {
    for (const [key, def] of Object.entries(S.schema)) {
      const input = document.getElementById(key);
      if (!input) continue;
      const value = S.settings[key];
      if (def.type === "bool") input.checked = value;
      else if (def.type === "color")
        input.value =
          "#" +
          value
            .split(" ")
            .map((n) =>
              Math.round(Number(n) * 255)
                .toString(16)
                .padStart(2, "0"),
            )
            .join("");
      else input.value = value;
      const output = document.getElementById(key + "-value");
      if (output) output.value = value + (def.suffix || "%");
    }
  }
  for (const [key, def] of Object.entries(S.schema)) {
    if (def.group) {
      const title = document.createElement("h2");
      title.className = "group-title";
      title.textContent = def.group;
      controls.append(title);
    }
    const row = document.createElement("div");
    row.className = "control";
    const label = document.createElement("label");
    label.htmlFor = key;
    label.textContent = def.label;
    const input = document.createElement(
      def.type === "combo" ? "select" : "input",
    );
    input.id = key;
    if (def.type === "combo")
      for (const [text, value] of def.options) {
        const option = document.createElement("option");
        option.textContent = text;
        option.value = value;
        input.append(option);
      }
    else
      input.type = { bool: "checkbox", slider: "range", color: "color" }[
        def.type
      ];
    if (def.type === "slider") {
      input.min = def.min;
      input.max = def.max;
      input.step = def.step || 1;
      const output = document.createElement("output");
      output.id = key + "-value";
      label.append(output);
      row.append(label, input);
    } else {
      label.append(input);
      row.append(label);
    }
    input.addEventListener("input", () => {
      let value = def.type === "bool" ? input.checked : input.value;
      if (def.type === "color")
        value = [1, 3, 5]
          .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
          .join(" ");
      S.applySettings({ [key]: value }, true);
    });
    controls.append(row);
  }
  toggle.addEventListener("click", () => setPanel(panel.hidden));
  document
    .getElementById("close")
    .addEventListener("click", () => setPanel(false));
  document
    .getElementById("preview")
    .addEventListener("click", () => lightning.trigger());
  document
    .getElementById("reset")
    .addEventListener("click", () =>
      S.applySettings(
        Object.fromEntries(
          Object.entries(S.schema).map(([k, v]) => [k, v.value]),
        ),
        true,
      ),
    );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setPanel(false);
    if (
      e.key.toLowerCase() === "s" &&
      !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
    )
      setPanel(panel.hidden);
  });
  document.getElementById("scene").addEventListener("pointerdown", (e) => {
    if (S.settings.interactive && e.button === 0)
      lightning.trigger(e.clientX / innerWidth, e.clientY / innerHeight);
  });
  document.addEventListener(
    "pointermove",
    () => {
      document.body.classList.add("controls-visible");
      clearTimeout(uiTimer);
      uiTimer = setTimeout(
        () => document.body.classList.remove("controls-visible"),
        2200,
      );
    },
    { passive: true },
  );
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("stormpause", resume);
  window.addEventListener("stormsettings", (e) => {
    syncControls();
    if (e.detail.includes("quality")) resize();
    if (
      e.detail.some((k) =>
        [
          "lightningenabled",
          "reducedflash",
          "lightningfrequency",
          "animationspeed",
          "doublelightningenabled",
          "doublelightninginterval",
          "triplelightningenabled",
          "triplelightninginterval",
        ].includes(k),
      )
    )
      lightning.resetSchedule();
  });
  document.getElementById("renderer-status").textContent =
    clouds.mode === "WebGL" ? "PROCEDURAL ATMOSPHERE" : "CANVAS ATMOSPHERE";
  syncControls();
  resize();
  clouds.render(0, [], lightning.canvas, lightning.depthCanvas);
  resume();
  // Small diagnostics surface for local verification; no network or timers.
  S.app = {
    clouds,
    lightning,
    thunder,
    weather,
    getStats: () => ({
      renderer: clouds.mode,
      frames,
      simulationTime,
      fpsLimit: effectiveFPS(),
      paused: document.hidden || S.hostPaused,
      activeEvents: lightning.active.length,
      queuedEvents: lightning.pending.length,
      totalEvents: lightning.totalEvents,
      resolution: [clouds.canvas.width, clouds.canvas.height],
    }),
  };
  if (new URLSearchParams(location.search).has("settings")) setPanel(true);
})();
