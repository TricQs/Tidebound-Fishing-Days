type SoundKind = "cast" | "splash" | "bite" | "hook" | "catch" | "jump" | "droplet";

/** Procedural lakeside audio: flowing water, wildlife, weather, and fishing sounds. */
export class LakeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private night = false;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  start() {
    if (typeof window === "undefined" || !window.AudioContext) return;
    if (!this.ctx) {
      this.ctx = new window.AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
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

  setRain(raining: boolean) {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
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
      high.type = "highpass"; high.frequency.value = 350;
      low.type = "lowpass"; low.frequency.value = 7200;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 2.5);
      source.connect(high).connect(low).connect(gain).connect(out);
      source.start();
      this.rainSource = source;
      this.rainGain = gain;
    } else if (!raining && this.rainSource && this.rainGain) {
      const source = this.rainSource;
      this.rainGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.7);
      window.setTimeout(() => { try { source.stop(); } catch { /* already stopped */ } }, 2800);
      this.rainSource = null;
      this.rainGain = null;
    }
  }

  play(kind: SoundKind) {
    this.start();
    const ctx = this.ctx, out = this.master;
    if (!ctx || !out) return;
    const tone = (frequency: number, duration: number, type: OscillatorType, volume: number, endFrequency = frequency, delay = 0) => {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(out);
      osc.start(now); osc.stop(now + duration + 0.02);
    };
    const noise = (duration: number, volume: number, lowpass: number, highpass = 0, delay = 0) => {
      const now = ctx.currentTime + delay;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(), low = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer;
      low.type = "lowpass"; low.frequency.value = lowpass;
      if (highpass > 0) {
        const high = ctx.createBiquadFilter();
        high.type = "highpass"; high.frequency.value = highpass;
        source.connect(high).connect(low);
      } else source.connect(low);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      low.connect(gain).connect(out); source.start(now);
    };
    switch (kind) {
      case "cast":
        noise(0.42, 0.13, 5000, 900);
        tone(480, 0.3, "sine", 0.045, 180);
        break;
      case "splash":
        noise(0.6, 0.3, 2100, 120);
        noise(0.24, 0.17, 6800, 1800, 0.03);
        tone(320, 0.42, "sine", 0.11, 85);
        for (let i = 0; i < 5; i++) tone(1000 + Math.random() * 1500, 0.12, "sine", 0.045, 500 + Math.random() * 250, 0.06 + i * 0.035);
        break;
      case "bite":
        tone(680, 0.16, "sine", 0.1, 920);
        tone(840, 0.2, "sine", 0.09, 1120, 0.13);
        break;
      case "hook":
        tone(190, 0.25, "triangle", 0.18, 390);
        noise(0.16, 0.08, 1800);
        break;
      case "catch":
        tone(520, 0.4, "sine", 0.11, 780);
        tone(780, 0.55, "sine", 0.1, 1040, 0.1);
        noise(0.24, 0.07, 2200);
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
    const ctx = this.ctx!, out = this.master!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const flow = 0.55 + Math.sin(t * Math.PI * 2 * 0.16) * 0.2 + Math.sin(t * Math.PI * 2 * 0.43) * 0.1;
      data[i] = (Math.random() * 2 - 1) * flow;
    }
    const source = ctx.createBufferSource();
    const low = ctx.createBiquadFilter(), high = ctx.createBiquadFilter(), gain = ctx.createGain();
    const lfo = ctx.createOscillator(), lfoDepth = ctx.createGain();
    source.buffer = buffer; source.loop = true;
    low.type = "lowpass"; low.frequency.value = 620; high.type = "highpass"; high.frequency.value = 100;
    lfo.type = "sine"; lfo.frequency.value = 0.12; lfoDepth.gain.value = 230;
    lfo.connect(lfoDepth).connect(low.frequency);
    gain.gain.value = 0.44; // Four times the original water ambience gain.
    source.connect(low).connect(high).connect(gain).connect(out);
    source.start(); lfo.start();

    const trickleBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const trickleData = trickleBuffer.getChannelData(0);
    for (let i = 0; i < trickleData.length; i++) {
      const t = i / ctx.sampleRate;
      trickleData[i] = (Math.random() * 2 - 1) * (0.48 + Math.sin(t * Math.PI * 2 * 0.28) * 0.18);
    }
    const trickle = ctx.createBufferSource(), band = ctx.createBiquadFilter(), sparkle = ctx.createGain();
    const ripple = ctx.createOscillator(), rippleDepth = ctx.createGain();
    trickle.buffer = trickleBuffer; trickle.loop = true;
    band.type = "bandpass"; band.frequency.value = 1250; band.Q.value = 0.55;
    ripple.type = "sine"; ripple.frequency.value = 0.19; rippleDepth.gain.value = 420;
    ripple.connect(rippleDepth).connect(band.frequency);
    sparkle.gain.value = 0.12;
    trickle.connect(band).connect(sparkle).connect(out);
    trickle.start(); ripple.start();
  }

  private birdCall() {
    const ctx = this.ctx, out = this.master;
    if (!ctx || !out || ctx.state !== "running") return;
    const now = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sine";
    const start = 1800 + Math.random() * 500;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(start * 1.55, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(start * 1.15, now + 0.2);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.linearRampToValueAtTime(0.045, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);
    osc.connect(gain).connect(out); osc.start(now); osc.stop(now + 0.23);
  }

  private cricketCall() {
    const ctx = this.ctx, out = this.master;
    if (!ctx || !out || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const at = now + i * 0.075, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(4100 + Math.random() * 500, at);
      osc.frequency.exponentialRampToValueAtTime(3600, at + 0.045);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.025, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
      osc.connect(gain).connect(out); osc.start(at); osc.stop(at + 0.06);
    }
  }
}
