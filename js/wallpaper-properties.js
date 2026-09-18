(() => {
  const S = Storm;
  const STORAGE_V1 = "thunder.settings.v1";
  const STORAGE_V2 = "thunder.settings.v2";
  S.hostPaused = false;
  S.hostFPS = 0;
  S.inHost = false;

  function migrate(values) {
    const result = { ...(values || {}) };
    if (result.lightningcolour1 === undefined && result.lightningcolour !== undefined)
      result.lightningcolour1 = result.lightningcolour;
    delete result.lightningcolour;
    return result;
  }

  function normalizePair(first, second) {
    if (S.settings[first] > S.settings[second])
      [S.settings[first], S.settings[second]] = [S.settings[second], S.settings[first]];
  }

  S.applySettings = (incoming, persist = false) => {
    const values = migrate(incoming);
    const changed = [];
    for (const [key, raw] of Object.entries(values)) {
      const def = S.schema[key];
      if (!def) continue;
      let value = raw;
      if (def.type === "slider") {
        value = Number(raw);
        if (!Number.isFinite(value)) continue;
        value = S.clamp(value, def.min, def.max);
      } else if (def.type === "bool") {
        if (typeof raw !== "boolean") continue;
      } else if (def.type === "combo") {
        value = String(raw);
        if (!def.options.some((option) => option[1] === value)) continue;
      } else if (def.type === "color") {
        const colour = String(raw).trim().split(/\s+/).map(Number);
        if (colour.length !== 3 || colour.some((part) => !Number.isFinite(part))) continue;
        value = colour.map((part) => S.clamp(part, 0, 1)).join(" ");
      }
      if (S.settings[key] !== value) {
        S.settings[key] = value;
        changed.push(key);
      }
    }
    const keys = ["multistrikemingap", "multistrikemaxgap", "thundermindelay", "thundermaxdelay"];
    const before = keys.map((key) => S.settings[key]);
    normalizePair("multistrikemingap", "multistrikemaxgap");
    normalizePair("thundermindelay", "thundermaxdelay");
    keys.forEach((key, index) => {
      if (before[index] !== S.settings[key] && !changed.includes(key)) changed.push(key);
    });
    if (persist && !S.inHost) {
      try { localStorage.setItem(STORAGE_V2, JSON.stringify(S.settings)); } catch (_) {}
    }
    if (changed.length) window.dispatchEvent(new CustomEvent("stormsettings", { detail: changed }));
    return changed;
  };

  window.wallpaperPropertyListener = {
    applyUserProperties(properties) {
      if (!S.inHost) {
        S.inHost = true;
        S.applySettings(Object.fromEntries(Object.entries(S.schema).map(([key, def]) => [key, def.value])));
      }
      document.body.classList.add("wallpaper-host");
      const values = Object.fromEntries(Object.entries(properties || {})
        .filter(([, entry]) => entry && "value" in entry)
        .map(([key, entry]) => [key, entry.value]));
      S.applySettings(migrate(values));
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
    const savedV2 = JSON.parse(localStorage.getItem(STORAGE_V2) || "null");
    const savedV1 = savedV2 ? null : JSON.parse(localStorage.getItem(STORAGE_V1) || "null");
    if (savedV2 || savedV1) {
      S.applySettings(migrate(savedV2 || savedV1));
      if (savedV1) localStorage.setItem(STORAGE_V2, JSON.stringify(S.settings));
    } else if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      S.settings.reducedflash = true;
    }
  } catch (_) {}
})();
