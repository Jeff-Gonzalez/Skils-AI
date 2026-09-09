// Patrones de respiración disponibles. Cada fase declara su nombre visible,
// duración en segundos y el color/escala objetivo del guía visual.
export const BREATH_PATTERNS = {
  box: {
    label: 'Respiración en caja',
    phases: [
      { name: 'Inhala', seconds: 4, scale: 1.45, color: 0x9fd8e0 },
      { name: 'Sostén', seconds: 4, scale: 1.45, color: 0xc9a6e6 },
      { name: 'Exhala', seconds: 4, scale: 1.0, color: 0xf2b880 },
      { name: 'Sostén', seconds: 4, scale: 1.0, color: 0x8fb8d8 },
    ],
  },
  478: {
    label: '4-7-8',
    phases: [
      { name: 'Inhala', seconds: 4, scale: 1.45, color: 0x9fd8e0 },
      { name: 'Sostén', seconds: 7, scale: 1.45, color: 0xc9a6e6 },
      { name: 'Exhala', seconds: 8, scale: 1.0, color: 0xf2b880 },
    ],
  },
  coherent: {
    label: 'Respiración coherente',
    phases: [
      { name: 'Inhala', seconds: 5, scale: 1.45, color: 0x9fd8e0 },
      { name: 'Exhala', seconds: 5, scale: 1.0, color: 0xf2b880 },
    ],
  },
};

// Controla el avance de fases de respiración en el tiempo, independiente del render loop.
export class BreathingSession {
  constructor(patternKey, onPhaseChange) {
    this.pattern = BREATH_PATTERNS[patternKey] || BREATH_PATTERNS.coherent;
    this.onPhaseChange = onPhaseChange;
    this.phaseIndex = -1;
    this.phaseElapsed = 0;
    this.paused = false;
    this._advancePhase();
  }

  _advancePhase() {
    this.phaseIndex = (this.phaseIndex + 1) % this.pattern.phases.length;
    this.phaseElapsed = 0;
    const phase = this.pattern.phases[this.phaseIndex];
    if (this.onPhaseChange) this.onPhaseChange(phase, this.phaseIndex);
  }

  get currentPhase() {
    return this.pattern.phases[this.phaseIndex];
  }

  // Progreso 0..1 dentro de la fase actual, útil para interpolar escala/color.
  get phaseProgress() {
    const phase = this.currentPhase;
    return Math.min(this.phaseElapsed / phase.seconds, 1);
  }

  update(deltaSeconds) {
    if (this.paused) return;
    this.phaseElapsed += deltaSeconds;
    if (this.phaseElapsed >= this.currentPhase.seconds) {
      this.phaseElapsed -= this.currentPhase.seconds;
      this._advancePhase();
    }
  }

  setPaused(value) {
    this.paused = value;
  }
}
