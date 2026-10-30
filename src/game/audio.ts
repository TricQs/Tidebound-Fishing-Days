export type SoundKind =
  | "cast"
  | "splash"
  | "nibble"
  | "bite"
  | "hook"
  | "catch"
  | "fanfare"
  | "jump"
  | "droplet"
  | "perfect"
  | "reel_tick"
  | "drag"
  | "snap"
  | "jig"
  | "coin";

/** Procedural lakeside audio: flowing water, wildlife, weather, and realistic angling acoustics. */
export class LakeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambienceVolume = 1;
  private effectsVolume = 0.8;
  private night = false;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private lastTickAt = 0;

  start() {
    if (typeof window === "undefined" || !window.AudioContext) return;
    if (!this.ctx) {
      this.ctx = new window.AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.ambience = this.ctx.createGain();
      this.effects = this.ctx.createGain();
      this.ambience.gain.value = this.ambienceVolume;
      this.effects.gain.value = this.effectsVolume;
      this.master.connect(this.ctx.destination);
      this.ambience.connect(this.master);
      this.effects.connect(this.master);
      this.startWater();
      window.setInterval(() => {
        if (this.night) this.cricketCall();
        else this.birdCall();
      }, 7000 + Math.random() * 6000);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setNight(night: boolean) {
    this.night = night;
  }

  setVolumes(ambience: number, effects: number) {
    this.ambienceVolume = Math.max(0, Math.min(1, ambience));
    this.effectsVolume = Math.max(0, Math.min(1, effects));
    if (!this.ctx || !this.ambience || !this.effects) return;
    const now = this.ctx.currentTime;
    this.ambience.gain.setTargetAtTime(this.ambienceVolume, now, 0.04);
    this.effects.gain.setTargetAtTime(this.effectsVolume, now, 0.04);
  }

  setRain(raining: boolean) {
    this.setRainLevel(raining ? 1 : 0);
  }

  /** Rain ambience follows the visual intensity (0 = dry, 1 = full shower) so drizzle sounds soft. */
  setRainLevel(level: number) {
    const ctx = this.ctx;
    const out = this.ambience;
    if (!ctx || !out) return;
    const clamped = Math.max(0, Math.min(1, level));
    const raining = clamped > 0.01;
    if (raining && !this.rainSource) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const swell = 0.65 + Math.sin((i / ctx.sampleRate) * Math.PI * 2 * 0.22) * 0.16;
        data[i] = (Math.random() * 2 - 1) * swell;
      }
      const source = ctx.createBufferSource();
      const high = ctx.createBiquadFilter();
      const low = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      high.type = "highpass";
      high.frequency.value = 350;
      low.type = "lowpass";
      low.frequency.value = 7200;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      source.connect(high).connect(low).connect(gain).connect(out);
      source.start();
      this.rainSource = source;
      this.rainGain = gain;
    }
    if (raining && this.rainGain) {
      // Quadratic curve keeps the first drizzle barely audible
      this.rainGain.gain.setTargetAtTime(Math.max(0.0001, 0.32 * clamped * clamped), ctx.currentTime, 0.6);
    } else if (!raining && this.rainSource && this.rainGain) {
      const source = this.rainSource;
      this.rainGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.7);
      window.setTimeout(() => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      }, 2800);
      this.rainSource = null;
      this.rainGain = null;
    }
  }

  play(kind: SoundKind) {
    this.start();
    const ctx = this.ctx,
      out = this.effects;
    if (!ctx || !out) return;

    if (kind === "reel_tick" || kind === "drag") {
      if (ctx.currentTime - this.lastTickAt < 0.055) return;
      this.lastTickAt = ctx.currentTime;
    }

    const tone = (
      frequency: number,
      duration: number,
      type: OscillatorType,
      volume: number,
      endFrequency = frequency,
      delay = 0,
    ) => {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(out);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    };
    const noise = (duration: number, volume: number, lowpass: number, highpass = 0, delay = 0) => {
      const now = ctx.currentTime + delay;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(),
        low = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      source.buffer = buffer;
      low.type = "lowpass";
      low.frequency.value = lowpass;
      if (highpass > 0) {
        const high = ctx.createBiquadFilter();
        high.type = "highpass";
        high.frequency.value = highpass;
        source.connect(high).connect(low);
      } else source.connect(low);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      low.connect(gain).connect(out);
      source.start(now);
    };

    switch (kind) {
      case "cast":
        noise(0.42, 0.13, 5000, 900);
        tone(480, 0.3, "sine", 0.045, 180);
        break;
      case "perfect":
        tone(587.33, 0.16, "triangle", 0.09, 587.33, 0);
        tone(880, 0.22, "triangle", 0.1, 880, 0.06);
        tone(1174.66, 0.35, "sine", 0.11, 1240, 0.12);
        break;
      case "splash":
        noise(0.6, 0.3, 2100, 120);
        noise(0.24, 0.17, 6800, 1800, 0.03);
        tone(320, 0.42, "sine", 0.11, 85);
        for (let i = 0; i < 5; i++)
          tone(1000 + Math.random() * 1500, 0.12, "sine", 0.045, 500 + Math.random() * 250, 0.06 + i * 0.035);
        break;
      case "nibble":
        tone(420, 0.09, "sine", 0.065, 290);
        noise(0.08, 0.05, 1600, 300);
        break;
      case "jig":
        tone(340, 0.08, "sine", 0.05, 510);
        noise(0.07, 0.045, 2200, 400);
        break;
      case "bite":
        tone(680, 0.16, "sine", 0.12, 960);
        tone(880, 0.22, "sine", 0.11, 1180, 0.12);
        noise(0.18, 0.1, 2400, 200);
        break;
      case "hook":
        tone(190, 0.25, "triangle", 0.18, 390);
        noise(0.16, 0.08, 1800);
        break;
      case "reel_tick":
        tone(950 + Math.random() * 180, 0.028, "triangle", 0.045, 620);
        noise(0.02, 0.025, 3800, 1200);
        break;
      case "drag":
        tone(1350 + Math.random() * 250, 0.035, "sawtooth", 0.038, 980);
        break;
      case "snap":
        tone(340, 0.28, "sawtooth", 0.12, 95);
        noise(0.15, 0.11, 3200, 600);
        break;
      case "catch":
        tone(520, 0.4, "sine", 0.11, 780);
        tone(780, 0.55, "sine", 0.1, 1040, 0.1);
        noise(0.24, 0.07, 2200);
        break;
      case "fanfare":
        tone(523.25, 0.18, "triangle", 0.11, 523.25, 0);
        tone(659.25, 0.18, "triangle", 0.11, 659.25, 0.11);
        tone(783.99, 0.22, "triangle", 0.11, 783.99, 0.22);
        tone(1046.5, 0.55, "sine", 0.13, 1060, 0.34);
        break;
      case "coin":
        tone(987.77, 0.09, "sine", 0.08, 987.77, 0);
        tone(1318.5, 0.24, "sine", 0.09, 1318.5, 0.07);
        break;
      case "jump":
        noise(0.42, 0.14, 1900, 140);
        noise(0.18, 0.12, 6000, 1500, 0.05);
        tone(420, 0.3, "sine", 0.07, 120);
        break;
      case "droplet":
        tone(1200 + Math.random() * 450, 0.11, "sine", 0.035, 720);
        break;
    }
  }

  private startWater() {
    const ctx = this.ctx!,
      out = this.ambience!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const flow = 0.55 + Math.sin(t * Math.PI * 2 * 0.16) * 0.2 + Math.sin(t * Math.PI * 2 * 0.43) * 0.1;
      data[i] = (Math.random() * 2 - 1) * flow;
    }
    const source = ctx.createBufferSource();
    const low = ctx.createBiquadFilter(),
      high = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    const lfo = ctx.createOscillator(),
      lfoDepth = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    low.type = "lowpass";
    low.frequency.value = 620;
    high.type = "highpass";
    high.frequency.value = 100;
    lfo.type = "sine";
    lfo.frequency.value = 0.12;
    lfoDepth.gain.value = 230;
    lfo.connect(lfoDepth).connect(low.frequency);
    gain.gain.value = 0.44;
    source.connect(low).connect(high).connect(gain).connect(out);
    source.start();
    lfo.start();

    const trickleBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const trickleData = trickleBuffer.getChannelData(0);
    for (let i = 0; i < trickleData.length; i++) {
      const t = i / ctx.sampleRate;
      trickleData[i] = (Math.random() * 2 - 1) * (0.48 + Math.sin(t * Math.PI * 2 * 0.28) * 0.18);
    }
    const trickle = ctx.createBufferSource(),
      band = ctx.createBiquadFilter(),
      sparkle = ctx.createGain();
    const ripple = ctx.createOscillator(),
      rippleDepth = ctx.createGain();
    trickle.buffer = trickleBuffer;
    trickle.loop = true;
    band.type = "bandpass";
    band.frequency.value = 1250;
    band.Q.value = 0.55;
    ripple.type = "sine";
    ripple.frequency.value = 0.19;
    rippleDepth.gain.value = 420;
    ripple.connect(rippleDepth).connect(band.frequency);
    sparkle.gain.value = 0.12;
    trickle.connect(band).connect(sparkle).connect(out);
    trickle.start();
    ripple.start();
  }

  private birdCall() {
    const ctx = this.ctx,
      out = this.ambience;
    if (!ctx || !out || ctx.state !== "running") return;
    const now = ctx.currentTime,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = "sine";
    const start = 1800 + Math.random() * 500;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(start * 1.55, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(start * 1.15, now + 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);
    osc.connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  private cricketCall() {
    const ctx = this.ctx,
      out = this.ambience;
    if (!ctx || !out || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const at = now + i * 0.075,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(4100 + Math.random() * 500, at);
      osc.frequency.exponentialRampToValueAtTime(3600, at + 0.045);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.025, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 0.06);
    }
  }
}
