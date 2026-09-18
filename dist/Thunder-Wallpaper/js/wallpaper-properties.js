(() => {
  const S = Storm;
  S.hostPaused = false;
  S.hostFPS = 0;
  S.inHost = false;
  S.applySettings = (values, persist = false) => {
    const changed = [];
    for (const [key, raw] of Object.entries(values)) {
      const def = S.schema[key];
      if (!def) continue;
      let value = raw;
      if (def.type === "slider") {
        value = Number(raw);
        if (!Number.isFinite(value)) continue;
        value = S.clamp(value, def.min, def.max);
      }
      if (def.type === "bool") {
        if (typeof raw !== "boolean") continue;
      }
      if (def.type === "combo") {
        value = String(raw);
        if (!def.options.some((o) => o[1] === value)) continue;
      }
      if (def.type === "color") {
        const c = String(raw).trim().split(/\s+/).map(Number);
        if (c.length !== 3 || c.some((n) => !Number.isFinite(n))) continue;
        value = c.map((n) => S.clamp(n, 0, 1)).join(" ");
      }
      if (S.settings[key] !== value) {
        S.settings[key] = value;
        changed.push(key);
      }
    }
    if (persist && !S.inHost)
      try {
        localStorage.setItem("thunder.settings.v1", JSON.stringify(S.settings));
      } catch (_) {}
    if (changed.length)
      window.dispatchEvent(
        new CustomEvent("stormsettings", { detail: changed }),
      );
  };
  // Install synchronously: the host can deliver settings before DOMContentLoaded.
  window.wallpaperPropertyListener = {
    applyUserProperties(properties) {
      if (!S.inHost) {
        S.inHost = true;
        S.applySettings(
          Object.fromEntries(
            Object.entries(S.schema).map(([k, v]) => [k, v.value]),
          ),
        );
      }
      document.body.classList.add("wallpaper-host");
      S.applySettings(
        Object.fromEntries(
          Object.entries(properties || {})
            .filter(([, v]) => v && "value" in v)
            .map(([k, v]) => [k, v.value]),
        ),
      );
    },
    applyGeneralProperties(properties) {
      const fps = Number(properties.fps);
      if (Number.isFinite(fps) && fps >= 0) S.hostFPS = fps;
    },
    setPaused(paused) {
      S.hostPaused = !!paused;
      window.dispatchEvent(new Event("stormpause"));
    },
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem("thunder.settings.v1") || "null",
    );
    if (saved) S.applySettings(saved);
    else if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      S.settings.reducedflash = true;
  } catch (_) {}
})();
