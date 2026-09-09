// Paisaje sonoro generado por síntesis (sin archivos externos): viento, agua y campanas suaves.
export class Soundscape {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.started = false;
  }

  _ensureContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.65;
    this.master.connect(this.ctx.destination);
  }

  _noiseBuffer(seconds, colorExponent) {
    const ctx = this.ctx;
    const bufferSize = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Filtro simple para obtener ruido rosado/marrón según colorExponent (0 = blanco, 1 = marrón)
      lastOut = (lastOut + colorExponent * white) / (1 + colorExponent);
      data[i] = lastOut * 3.2;
    }
    return buffer;
  }

  async start() {
    this._ensureContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.started) return;
    this.started = true;

    // --- Capa de viento: ruido marrón filtrado, con LFO lento en el filtro ---
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = this._noiseBuffer(4, 0.98);
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.7;

    const windLFO = this.ctx.createOscillator();
    windLFO.frequency.value = 0.06;
    const windLFOGain = this.ctx.createGain();
    windLFOGain.gain.value = 220;
    windLFO.connect(windLFOGain);
    windLFOGain.connect(windFilter.frequency);
    windLFO.start();

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.22;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.master);
    windSource.start();

    // --- Capa de agua: ruido blanco filtrado en banda, con oleaje lento ---
    const waterSource = this.ctx.createBufferSource();
    waterSource.buffer = this._noiseBuffer(4, 0.5);
    waterSource.loop = true;

    const waterFilter = this.ctx.createBiquadFilter();
    waterFilter.type = 'bandpass';
    waterFilter.frequency.value = 900;
    waterFilter.Q.value = 0.9;

    const waterLFO = this.ctx.createOscillator();
    waterLFO.frequency.value = 0.13;
    const waterLFOGain = this.ctx.createGain();
    waterLFOGain.gain.value = 0.12;
    const waterGainBase = this.ctx.createGain();
    waterGainBase.gain.value = 0.16;
    waterLFO.connect(waterLFOGain);
    waterLFOGain.connect(waterGainBase.gain);
    waterLFO.start();

    waterSource.connect(waterFilter);
    waterFilter.connect(waterGainBase);
    waterGainBase.connect(this.master);
    waterSource.start();

    // --- Pad armónico muy suave (fondo cálido) ---
    const padFreqs = [130.81, 164.81, 196.0]; // Do3, Mi3, Sol3 - acorde cálido
    this.padOscillators = padFreqs.map((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      // Entrada suave (fade-in)
      g.gain.linearRampToValueAtTime(0.035 - i * 0.006, this.ctx.currentTime + 4 + i);
      return { osc, gain: g };
    });

    this._windGain = windGain;
    this._waterGain = waterGainBase;
  }

  setVolume(percent01) {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(percent01 * 0.65, this.ctx?.currentTime || 0, 0.4);
  }

  // Campanilla suave para marcar cada transición de fase de respiración
  chime(frequency = 528) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 3.3);
  }

  stopAll() {
    if (!this.ctx) return;
    this.ctx.suspend();
  }
}
