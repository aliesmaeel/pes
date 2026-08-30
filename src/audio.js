export class AudioBus {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  unlock() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.22;
  }

  tone(freq, dur = 0.12, type = "sine", gain = 0.18, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur = 0.16, gain = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    src.buffer = buffer;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  kick() {
    this.noise(0.1, 0.1);
    this.tone(180, 0.1, "triangle", 0.12, -80);
  }

  whistle() {
    this.tone(1760, 0.18, "sine", 0.08);
    setTimeout(() => this.tone(1480, 0.22, "sine", 0.08), 160);
  }

  goal() {
    this.tone(392, 0.28, "sawtooth", 0.08, 80);
    this.tone(523, 0.4, "square", 0.05, 40);
    this.noise(0.5, 0.08);
  }

  ui() {
    this.tone(660, 0.06, "square", 0.05);
  }

  tackle() {
    this.noise(0.14, 0.16);
    this.tone(90, 0.12, "sine", 0.14);
  }

  whiff() {
    this.noise(0.08, 0.06);
    this.tone(140, 0.08, "sine", 0.05, -40);
  }
}
