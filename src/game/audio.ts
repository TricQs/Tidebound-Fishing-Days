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

/** Generate warm -3dB/octave pink noise using Paul Kellet's filter so water and rain never sound like harsh static. */
function fillPinkNoise(data: Float32Array, modFn?: (t: number, i: number) => number, sampleRate = 44100) {
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    const env = modFn ? modFn(i / sampleRate, i) : 1;
    data[i] = pink * env;
  }
}

/** Procedural lakeside audio: organic pink-noise water lapping, wildlife, weather, and realistic angling acoustics. */
export class LakeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambienceVolume = 1;
  private effectsVolume = 0.8;
  private night = false;
  private muted = false;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainLowpass: BiquadFilterNode | null = null;
  private lastTickAt = 0;

  start() {
    if (typeof window === "undefined" || !window.AudioContext) return;
    if (!this.ctx) {
      this.ctx = new window.AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.25;
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
      }, 6200 + Math.random() * 5500);
    }
    if (!this.muted && this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Automatically silence all ambience & SFX when idle or in a background tab, restoring smoothly on return. */
  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.25, now, muted ? 0.05 : 0.08);
    if (!muted && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
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

  /** Rain ambience follows the visual intensity (0 = dry, 1 = full shower) so drizzle sounds soft and builds naturally. */
  setRainLevel(level: number) {
    const ctx = this.ctx;
    const out = this.ambience;
    if (!ctx || !out) return;
    const clamped = Math.max(0, Math.min(1, level));
    const raining = clamped > 0.01;
    if (raining && !this.rainSource) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      fillPinkNoise(
        data,
        (t) => 0.72 + Math.sin(t * Math.PI * 2 * 0.2) * 0.16 + Math.sin(t * Math.PI * 2 * 0.47) * 0.1,
        ctx.sampleRate,
      );
      const source = ctx.createBufferSource();
      const high = ctx.createBiquadFilter();
      const low = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      high.type = "highpass";
      high.frequency.value = 280;
      low.type = "lowpass";
      low.frequency.value = 2400;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      source.connect(high).connect(low).connect(gain).connect(out);
      source.start();
      this.rainSource = source;
      this.rainGain = gain;
      this.rainLowpass = low;
    }
    if (raining && this.rainGain && this.rainLowpass) {
      // As drizzle builds into full rain, both volume and high-frequency patter open up smoothly
      const targetGain = Math.max(0.0001, 0.42 * Math.pow(clamped, 1.55));
      const targetFreq = 1900 + clamped * 4600;
      this.rainGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.55);
      this.rainLowpass.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.55);
    } else if (!raining && this.rainSource && this.rainGain) {
      const source = this.rainSource;
      this.rainGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.75);
      window.setTimeout(() => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      }, 2800);
      this.rainSource = null;
      this.rainGain = null;
      this.rainLowpass = null;
    }
  }

  play(kind: SoundKind) {
    if (this.muted) return;
    this.start();
    const ctx = this.ctx,
      out = this.effects;
    if (!ctx || !out) return;

    if (kind === "reel_tick" || kind === "drag") {
      if (ctx.currentTime - this.lastTickAt < 0.052) return;
      this.lastTickAt = ctx.currentTime;
    }

    const tone = (
      frequency: number,
      duration: number,
      type: OscillatorType,
      volume: number,
      endFrequency = frequency,
      delay = 0,
      attack = 0.005,
    ) => {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, frequency), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + Math.min(attack, duration * 0.4));
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
      osc.connect(gain).connect(out);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    };

    const pinkBurst = (
      duration: number,
      volume: number,
      lowpass: number,
      highpass = 0,
      delay = 0,
      endLowpass = lowpass,
    ) => {
      const now = ctx.currentTime + delay;
      const len = Math.max(64, Math.ceil(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      fillPinkNoise(buffer.getChannelData(0), undefined, ctx.sampleRate);
      const source = ctx.createBufferSource(),
        low = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      source.buffer = buffer;
      low.type = "lowpass";
      low.frequency.setValueAtTime(lowpass, now);
      if (endLowpass !== lowpass) {
        low.frequency.exponentialRampToValueAtTime(Math.max(40, endLowpass), now + duration);
      }
      if (highpass > 0) {
        const high = ctx.createBiquadFilter();
        high.type = "highpass";
        high.frequency.value = highpass;
        source.connect(high).connect(low);
      } else {
        source.connect(low);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.015, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
      low.connect(gain).connect(out);
      source.start(now);
    };

    /** Authentic Minnaert bubble/droplet plink: upward pitch sweep as a water bubble detaches. */
    const waterPlink = (baseFreq: number, volume: number, delay = 0, dur = 0.068) => {
      tone(baseFreq, dur, "sine", volume, baseFreq * 1.42, delay, 0.003);
      tone(baseFreq * 2.02, dur * 0.65, "sine", volume * 0.22, baseFreq * 2.5, delay, 0.002);
    };

    switch (kind) {
      case "cast":
        // Bamboo/carbon rod whip whoosh + silky fishing line peeling off the spool
        pinkBurst(0.36, 0.24, 1800, 180, 0, 520);
        pinkBurst(0.28, 0.14, 5800, 1600, 0.04, 2400);
        tone(310, 0.22, "sine", 0.055, 680, 0, 0.015);
        tone(680, 0.2, "sine", 0.04, 210, 0.14, 0.01);
        break;
      case "perfect":
        // Warm harmonic chime with fifth & octave shimmer
        tone(587.33, 0.24, "sine", 0.1, 587.33, 0, 0.006);
        tone(880, 0.28, "sine", 0.1, 880, 0.055, 0.006);
        tone(1174.66, 0.42, "sine", 0.11, 1174.66, 0.11, 0.006);
        tone(1760, 0.45, "triangle", 0.05, 1768, 0.14, 0.01);
        break;
      case "splash":
        // Deep cavity plunge + broadband spray + cascading bubble plinks
        tone(165, 0.26, "sine", 0.16, 46, 0, 0.004);
        tone(280, 0.14, "triangle", 0.08, 72, 0.01, 0.004);
        pinkBurst(0.52, 0.34, 2400, 110, 0, 680);
        pinkBurst(0.28, 0.2, 6400, 1400, 0.025, 2200);
        for (let i = 0; i < 6; i++) {
          waterPlink(680 + Math.random() * 820, 0.042 - i * 0.004, 0.045 + i * 0.042, 0.065);
        }
        break;
      case "nibble":
        // Subtle hollow bobber dip & single bubble bloop
        tone(240, 0.085, "sine", 0.075, 155, 0, 0.004);
        waterPlink(560 + Math.random() * 160, 0.055, 0.025, 0.06);
        pinkBurst(0.09, 0.08, 1500, 220, 0);
        break;
      case "jig":
        // Crisp rod-tip twitch & underwater lure dart
        tone(290, 0.075, "sine", 0.055, 520, 0, 0.004);
        pinkBurst(0.08, 0.09, 2600, 380, 0.01, 1100);
        waterPlink(740, 0.04, 0.03, 0.05);
        break;
      case "bite":
        // Urgent submerged bobber "glug-bloop!" + bright strike cue
        tone(265, 0.14, "sine", 0.15, 78, 0, 0.003);
        waterPlink(480, 0.11, 0.04, 0.085);
        waterPlink(690, 0.1, 0.11, 0.09);
        pinkBurst(0.22, 0.2, 2600, 160, 0, 900);
        tone(740, 0.15, "triangle", 0.085, 987.77, 0.02, 0.005);
        tone(987.77, 0.22, "sine", 0.095, 1174.66, 0.1, 0.005);
        break;
      case "hook":
        // Solid rod-set thump + taut line twang + water thrash
        tone(138, 0.22, "triangle", 0.18, 54, 0, 0.003);
        tone(230, 0.18, "sine", 0.11, 490, 0.015, 0.004);
        pinkBurst(0.22, 0.18, 2200, 180, 0.01, 820);
        break;
      case "reel_tick": {
        // Crisp mechanical ratchet pawl click
        const pitch = 1350 + Math.random() * 220;
        tone(pitch, 0.022, "triangle", 0.052, pitch * 0.58, 0, 0.001);
        tone(pitch * 2.15, 0.014, "sine", 0.028, pitch * 1.4, 0, 0.001);
        pinkBurst(0.018, 0.045, 4200, 1500, 0);
        break;
      }
      case "drag": {
        // Metallic spinning-reel drag clicker under high line tension
        const f = 1850 + Math.random() * 280;
        tone(f, 0.028, "sawtooth", 0.036, f * 0.72, 0, 0.001);
        tone(f * 1.5, 0.02, "sine", 0.025, f, 0.004, 0.001);
        pinkBurst(0.025, 0.04, 5200, 2000, 0);
        break;
      }
      case "snap":
        // Sharp high-tension line whip & slack recoil
        pinkBurst(0.08, 0.24, 6500, 1200, 0, 1800);
        tone(760, 0.22, "sawtooth", 0.11, 88, 0.01, 0.002);
        tone(390, 0.26, "triangle", 0.09, 72, 0.03, 0.004);
        break;
      case "catch":
        // Splashy lift + warm marimba-like victory chord
        pinkBurst(0.24, 0.15, 2400, 200, 0, 900);
        waterPlink(760, 0.05, 0.04);
        tone(523.25, 0.32, "sine", 0.11, 523.25, 0.02, 0.006);
        tone(659.25, 0.36, "sine", 0.1, 659.25, 0.09, 0.006);
        tone(783.99, 0.48, "sine", 0.11, 783.99, 0.16, 0.006);
        tone(1046.5, 0.55, "triangle", 0.06, 1046.5, 0.16, 0.008);
        break;
      case "fanfare":
        // Rich harmonic arpeggio for rare / mutated catches
        for (const [freq, delay, dur] of [
          [523.25, 0, 0.22],
          [659.25, 0.1, 0.22],
          [783.99, 0.2, 0.24],
          [1046.5, 0.31, 0.62],
        ] as const) {
          tone(freq, dur, "sine", 0.12, freq, delay, 0.006);
          tone(freq * 2, dur * 0.75, "triangle", 0.045, freq * 2, delay, 0.006);
        }
        tone(1318.5, 0.55, "sine", 0.065, 1318.5, 0.35, 0.01);
        break;
      case "coin":
        tone(1046.5, 0.09, "sine", 0.08, 1046.5, 0, 0.002);
        tone(1567.98, 0.26, "sine", 0.09, 1567.98, 0.065, 0.002);
        tone(3135.96, 0.16, "triangle", 0.03, 3135.96, 0.065, 0.002);
        break;
      case "jump":
        // Fish breach & re-entry splash
        tone(190, 0.2, "sine", 0.08, 68, 0, 0.005);
        pinkBurst(0.36, 0.22, 2200, 150, 0, 720);
        pinkBurst(0.18, 0.14, 5400, 1400, 0.04, 1900);
        waterPlink(690, 0.045, 0.06);
        waterPlink(920, 0.04, 0.12);
        break;
      case "droplet":
        // Gentle raindrop plink on lake surface
        waterPlink(780 + Math.random() * 620, 0.032 + Math.random() * 0.015, 0, 0.062);
        break;
    }
  }

  private startWater() {
    const ctx = this.ctx!,
      out = this.ambience!;

    // Layer 1: Warm deep lake current (pink noise shaped with slow wave swells)
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
    fillPinkNoise(
      buffer.getChannelData(0),
      (t) => 0.58 + Math.sin(t * Math.PI * 2 * (1 / 6)) * 0.22 + Math.sin(t * Math.PI * 2 * (1 / 3)) * 0.12,
      ctx.sampleRate,
    );
    const source = ctx.createBufferSource();
    const low = ctx.createBiquadFilter(),
      high = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    const lfo = ctx.createOscillator(),
      lfoDepth = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    low.type = "lowpass";
    low.frequency.value = 420;
    high.type = "highpass";
    high.frequency.value = 85;
    lfo.type = "sine";
    lfo.frequency.value = 0.11;
    lfoDepth.gain.value = 155;
    lfo.connect(lfoDepth).connect(low.frequency);
    gain.gain.value = 0.46;
    source.connect(low).connect(high).connect(gain).connect(out);
    source.start();
    lfo.start();

    // Layer 2: Gentle shoreline & boat-hull lapping wavelets + distant waterfall murmur
    const lapBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    fillPinkNoise(
      lapBuffer.getChannelData(0),
      (t) => {
        const wave = Math.max(0, Math.sin(t * Math.PI * 2 * 0.25));
        return 0.28 + Math.pow(wave, 1.8) * 0.55;
      },
      ctx.sampleRate,
    );
    const lap = ctx.createBufferSource(),
      band = ctx.createBiquadFilter(),
      lapGain = ctx.createGain();
    const ripple = ctx.createOscillator(),
      rippleDepth = ctx.createGain();
    lap.buffer = lapBuffer;
    lap.loop = true;
    band.type = "bandpass";
    band.frequency.value = 780;
    band.Q.value = 0.75;
    ripple.type = "sine";
    ripple.frequency.value = 0.22;
    rippleDepth.gain.value = 280;
    ripple.connect(rippleDepth).connect(band.frequency);
    lapGain.gain.value = 0.18;
    lap.connect(band).connect(lapGain).connect(out);
    lap.start();
    ripple.start();
  }

  private birdCall() {
    const ctx = this.ctx,
      out = this.ambience;
    if (this.muted || !ctx || !out || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const variant = Math.random();

    const chirpNote = (startF: number, midF: number, endF: number, startAt: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator(),
        overtone = ctx.createOscillator(),
        overGain = ctx.createGain(),
        gain = ctx.createGain();
      osc.type = "sine";
      overtone.type = "sine";
      osc.frequency.setValueAtTime(startF, startAt);
      osc.frequency.exponentialRampToValueAtTime(midF, startAt + dur * 0.45);
      osc.frequency.exponentialRampToValueAtTime(endF, startAt + dur);
      overtone.frequency.setValueAtTime(startF * 2, startAt);
      overtone.frequency.exponentialRampToValueAtTime(midF * 2, startAt + dur * 0.45);
      overtone.frequency.exponentialRampToValueAtTime(endF * 2, startAt + dur);
      overGain.gain.value = 0.15;

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(vol, startAt + dur * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
      osc.connect(gain);
      overtone.connect(overGain).connect(gain);
      gain.connect(out);
      osc.start(startAt);
      overtone.start(startAt);
      osc.stop(startAt + dur + 0.02);
      overtone.stop(startAt + dur + 0.02);
    };

    if (variant < 0.45) {
      // Multi-note lakeside songbird phrase
      const base = 2100 + Math.random() * 550;
      chirpNote(base, base * 1.32, base * 1.12, now, 0.13, 0.036);
      chirpNote(base * 1.18, base * 1.48, base * 1.25, now + 0.16, 0.15, 0.04);
      if (Math.random() < 0.65) {
        chirpNote(base * 1.35, base * 1.05, base * 1.22, now + 0.34, 0.18, 0.032);
      }
    } else if (variant < 0.8) {
      // Sweet two-tone chickadee call (high -> warm lower step)
      const hi = 2750 + Math.random() * 320;
      chirpNote(hi, hi * 1.03, hi * 0.98, now, 0.18, 0.034);
      chirpNote(hi * 0.78, hi * 0.76, hi * 0.74, now + 0.22, 0.24, 0.038);
    } else {
      // Distant lakeside loon / mourning call
      const lo = 780 + Math.random() * 140;
      chirpNote(lo, lo * 1.28, lo * 0.96, now, 0.48, 0.028);
    }
  }

  private cricketCall() {
    const ctx = this.ctx,
      out = this.ambience;
    if (this.muted || !ctx || !out || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const count = 4 + Math.floor(Math.random() * 3);
    const baseFreq = 4150 + Math.random() * 380;
    for (let i = 0; i < count; i++) {
      const at = now + i * 0.062,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, at);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, at + 0.042);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.022, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.048);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 0.055);
    }
    // Occasional distant bullfrog croak in the reeds at night
    if (Math.random() < 0.28) {
      const frogAt = now + 0.45;
      const osc = ctx.createOscillator(),
        band = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(145, frogAt);
      osc.frequency.linearRampToValueAtTime(195, frogAt + 0.09);
      osc.frequency.exponentialRampToValueAtTime(130, frogAt + 0.24);
      band.type = "bandpass";
      band.frequency.value = 380;
      band.Q.value = 2.2;
      gain.gain.setValueAtTime(0.0001, frogAt);
      gain.gain.linearRampToValueAtTime(0.035, frogAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, frogAt + 0.26);
      osc.connect(band).connect(gain).connect(out);
      osc.start(frogAt);
      osc.stop(frogAt + 0.28);
    }
  }
}
