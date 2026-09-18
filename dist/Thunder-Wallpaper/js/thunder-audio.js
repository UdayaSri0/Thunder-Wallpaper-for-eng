(() => {
  const S = Storm;
  const MAX_VOICES = 8;

  function thunderDistance(event) {
    const depthBase = [0.82, 0.5, 0.18][event.depth] ?? 0.5;
    const vertical = S.clamp(0.72 - (event.endY ?? event.y ?? 0.4), -0.18, 0.25);
    const horizontal = Math.abs((event.x ?? 0.5) - 0.5) * 0.12;
    return S.clamp(depthBase + vertical + horizontal, 0, 1);
  }

  function thunderDelay(event, randomValue = Math.random()) {
    const minimum = S.settings.thundermindelay;
    const maximum = S.settings.thundermaxdelay;
    const distance = thunderDistance(event);
    const shaped = Math.pow(distance, 0.82);
    const jitter = (randomValue - 0.5) * Math.min(0.65, (maximum - minimum) * 0.18);
    return S.clamp(minimum + shaped * (maximum - minimum) + jitter, minimum, maximum);
  }

  function thunderPan(event) {
    return S.settings.spatialthunder ? S.clamp(((event.x ?? 0.5) - 0.5) * 1.25, -0.62, 0.62) : 0;
  }

  function thunderProfile(event) {
    const distance = thunderDistance(event);
    const setting = S.settings.thunderintensity / 100;
    const strike = S.clamp(event.strength ?? 1, 0.2, 1.3);
    return {
      distance,
      power: S.clamp((0.35 + setting * 0.65) * strike * (1 - distance * 0.42), 0.08, 1),
      crack: S.clamp((1 - distance) * (0.32 + setting * 0.68) * strike, 0.02, 1),
      lowEnd: S.clamp((0.48 + distance * 0.35) * (0.45 + setting * 0.55) * strike, 0.08, 1),
      duration: 2.4 + distance * 3.4 + setting * 1.2,
      cutoff: 420 + (1 - distance) * 1550,
      pan: thunderPan(event),
    };
  }

  function canAdmitVoice(activeCount, enabled = S.settings.thunderaudioenabled, volume = S.settings.thundervolume) {
    return !!enabled && volume > 0 && activeCount < MAX_VOICES;
  }

  class ThunderAudio {
    constructor() {
      this.context = null;
      this.master = null;
      this.compressor = null;
      this.noiseBuffer = null;
      this.active = new Set();
      this.pending = new Set();
      this.paused = false;
      this.blocked = false;
      window.addEventListener("stormthunder", (event) => this.schedule(event.detail));
      window.addEventListener("stormpause", () => this.setPaused(S.hostPaused || document.hidden));
      window.addEventListener("stormsettings", (event) => {
        if (event.detail.includes("thundervolume")) this.syncVolume();
        if (event.detail.includes("thunderaudioenabled") && !S.settings.thunderaudioenabled) this.silence();
      });
      document.addEventListener("visibilitychange", () => this.setPaused(S.hostPaused || document.hidden));
      const unlock = () => this.unlock();
      document.addEventListener("pointerdown", unlock, { passive: true });
      document.addEventListener("keydown", unlock);
    }

    ensureContext() {
      if (this.context) return this.context;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      try {
        const context = new AudioContextClass();
        const master = context.createGain();
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 18;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.32;
        master.connect(compressor);
        compressor.connect(context.destination);
        this.context = context;
        this.master = master;
        this.compressor = compressor;
        this.syncVolume();
        this.noiseBuffer = this.makeNoiseBuffer(8);
        return context;
      } catch (error) {
        console.warn("Thunder audio is unavailable.", error);
        return null;
      }
    }

    makeNoiseBuffer(seconds) {
      const context = this.context;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
      const data = buffer.getChannelData(0);
      let brown = 0;
      for (let index = 0; index < data.length; index++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.018 * white) / 1.018;
        data[index] = S.clamp(white * 0.23 + brown * 3.1, -1, 1);
      }
      return buffer;
    }

    syncVolume() {
      if (!this.master || !this.context) return;
      const value = S.settings.thunderaudioenabled ? S.settings.thundervolume / 100 : 0;
      this.master.gain.setTargetAtTime(value === 0 ? 0 : value * 0.3, this.context.currentTime, 0.025);
    }

    async unlock() {
      if (!S.settings.thunderaudioenabled || S.settings.thundervolume === 0) return;
      const context = this.ensureContext();
      if (!context) return;
      try {
        if (context.state === "suspended") await context.resume();
        this.blocked = context.state !== "running";
      } catch (_) {
        this.blocked = true;
      }
    }

    schedule(event) {
      if (this.paused || !canAdmitVoice(this.active.size)) return false;
      const delay = thunderDelay(event);
      const timer = setTimeout(() => {
        this.pending.delete(timer);
        if (!this.paused) this.play(event);
      }, delay * 1000);
      this.pending.add(timer);
      return delay;
    }

    routeNode(node, profile) {
      if (S.settings.spatialthunder && this.context.createStereoPanner) {
        const panner = this.context.createStereoPanner();
        panner.pan.value = profile.pan;
        node.connect(panner);
        panner.connect(this.master);
        return panner;
      }
      node.connect(this.master);
      return null;
    }

    play(event) {
      if (this.paused || !canAdmitVoice(this.active.size)) return false;
      const context = this.ensureContext();
      if (!context || context.state !== "running") {
        this.blocked = true;
        return false;
      }
      this.syncVolume();
      const profile = thunderProfile(event);
      const now = context.currentTime;
      const voice = { sources: [], nodes: [], remaining: 0, power: profile.power };
      const finish = () => {
        voice.remaining--;
        if (voice.remaining > 0) return;
        for (const node of voice.nodes) try { node.disconnect(); } catch (_) {}
        this.active.delete(voice);
      };

      const rumble = context.createBufferSource();
      rumble.buffer = this.noiseBuffer;
      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(profile.cutoff, now);
      lowpass.frequency.exponentialRampToValueAtTime(Math.max(110, profile.cutoff * 0.26), now + profile.duration);
      lowpass.Q.value = 0.7;
      const rumbleGain = context.createGain();
      rumbleGain.gain.setValueAtTime(0.0001, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.18 * profile.lowEnd * profile.power, now + 0.12);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
      rumble.connect(lowpass);
      lowpass.connect(rumbleGain);
      const rumblePan = this.routeNode(rumbleGain, profile);

      const crack = context.createBufferSource();
      crack.buffer = this.noiseBuffer;
      const bandpass = context.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 750 + (1 - profile.distance) * 1700 + Math.random() * 500;
      bandpass.Q.value = 0.65 + Math.random() * 0.7;
      const crackGain = context.createGain();
      crackGain.gain.setValueAtTime(Math.max(0.0001, 0.16 * profile.crack), now);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12 + profile.distance * 0.16);
      crack.connect(bandpass);
      bandpass.connect(crackGain);
      const crackPan = this.routeNode(crackGain, profile);

      const sub = context.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(34 + Math.random() * 18, now);
      sub.frequency.exponentialRampToValueAtTime(24 + Math.random() * 10, now + profile.duration * 0.75);
      const subGain = context.createGain();
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.exponentialRampToValueAtTime(0.055 * profile.lowEnd, now + 0.2);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration * 0.8);
      sub.connect(subGain);
      const subPan = this.routeNode(subGain, profile);

      voice.sources.push(rumble, crack, sub);
      voice.nodes.push(rumble, lowpass, rumbleGain, crack, bandpass, crackGain, sub, subGain);
      if (rumblePan) voice.nodes.push(rumblePan);
      if (crackPan) voice.nodes.push(crackPan);
      if (subPan) voice.nodes.push(subPan);
      voice.remaining = voice.sources.length;
      for (const source of voice.sources) source.onended = finish;
      this.active.add(voice);
      rumble.start(now, Math.random() * 1.5, profile.duration);
      crack.start(now, Math.random() * 1.5, 0.3);
      sub.start(now);
      sub.stop(now + profile.duration * 0.82);
      return true;
    }

    silence() {
      for (const timer of this.pending) clearTimeout(timer);
      this.pending.clear();
      for (const voice of this.active) for (const source of voice.sources) try { source.stop(); } catch (_) {}
      this.active.clear();
      this.syncVolume();
    }

    setPaused(paused) {
      this.paused = !!paused;
      if (this.paused) {
        this.silence();
        if (this.context?.state === "running") this.context.suspend().catch(() => {});
      } else if (S.settings.thunderaudioenabled) {
        this.unlock();
      }
    }

    preview(depth = 1, x = 0.5, strength = 1) {
      return this.schedule({ depth, x, y: 0.25, endY: depth === 2 ? 0.92 : 0.55, strength });
    }
  }

  S.ThunderAudio = ThunderAudio;
  S.thunderDistance = thunderDistance;
  S.thunderDelay = thunderDelay;
  S.thunderPan = thunderPan;
  S.thunderProfile = thunderProfile;
  S.canAdmitThunderVoice = canAdmitVoice;
  S.MAX_THUNDER_VOICES = MAX_VOICES;
})();
