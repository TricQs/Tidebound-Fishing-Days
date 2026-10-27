type SoundKind = "cast" | "splash" | "bite" | "hook" | "catch";

/** A synthesized lakeside soundscape that starts on the player's first gesture. */
export class LakeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  start() {
    if (typeof window === "undefined" || !window.AudioContext) return;
    if (!this.ctx) {
      this.ctx = new window.AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this.startWater();
      window.setInterval(() => this.birdCall(), 7000 + Math.random() * 6000);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }
  play(kind: SoundKind) {
    this.start();
    const ctx = this.ctx, out = this.master;
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const tone = (frequency: number, duration: number, type: OscillatorType, volume: number, endFrequency = frequency) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(out);
      osc.start(now); osc.stop(now + duration + 0.02);
    };
    const noise = (duration: number, volume: number, cutoff: number) => {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer; filter.type = "lowpass"; filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.connect(filter).connect(gain).connect(out); source.start(now);
    };
    switch (kind) {
      case "cast": tone(520, 0.28, "sine", 0.12, 210); noise(0.32, 0.09, 1500); break;
      case "splash": noise(0.7, 0.24, 1100); tone(340, 0.42, "sine", 0.09, 105); break;
      case "bite": tone(680, 0.16, "sine", 0.1, 920); window.setTimeout(() => tone(840, 0.2, "sine", 0.09, 1120), 130); break;
      case "hook": tone(190, 0.25, "triangle", 0.18, 390); noise(0.16, 0.08, 1800); break;
      case "catch": tone(520, 0.4, "sine", 0.11, 780); window.setTimeout(() => tone(780, 0.55, "sine", 0.1, 1040), 100); noise(0.24, 0.07, 2200); break;
    }
  }
  private startWater() {
    const ctx = this.ctx!, buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    const source = ctx.createBufferSource(), low = ctx.createBiquadFilter(), high = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = buffer; source.loop = true;
    low.type = "lowpass"; low.frequency.value = 520; high.type = "highpass"; high.frequency.value = 100;
    gain.gain.value = 0.11;
    source.connect(low).connect(high).connect(gain).connect(this.master!); source.start();
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
}
