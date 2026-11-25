import { GodId } from './data';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.14,
    slideToFreq?: number,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideToFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playPulse() {
    this.playTone(460, 0.14, 'triangle', 0.13, 210);
    this.playTone(920, 0.09, 'sine', 0.06, 620);
  }

  public playDash() {
    this.playTone(260, 0.16, 'sine', 0.1, 520);
  }

  public playGlyphPickup(step: number, isCombo: boolean) {
    // Hijaz / Double Harmonic scale frequencies (D E♭ F# G A B♭ C# D)
    const scale = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 554.37, 587.33];
    const base = scale[step % scale.length];
    this.playTone(base, 0.28, 'triangle', 0.15);
    if (isCombo) {
      this.playTone(base * 1.5, 0.34, 'sine', 0.12, undefined, 0.06);
    }
  }

  public playBanish() {
    this.playTone(220, 0.12, 'sawtooth', 0.08, 110);
    this.playTone(587.33, 0.18, 'triangle', 0.09, 740, 0.02);
  }

  public playHit() {
    this.playTone(135, 0.24, 'sawtooth', 0.18, 55);
    this.playTone(95, 0.28, 'square', 0.1, 45);
  }

  public playGodPower(godId: GodId) {
    switch (godId) {
      case 'bastet':
        this.playTone(523.25, 0.22, 'triangle', 0.14);
        this.playTone(659.25, 0.28, 'sine', 0.12, undefined, 0.07);
        break;
      case 'anubis':
        this.playTone(185, 0.4, 'sawtooth', 0.14, 92);
        this.playTone(369.99, 0.35, 'triangle', 0.12, undefined, 0.05);
        break;
      case 'osiris':
        this.playTone(392, 0.3, 'sine', 0.13);
        this.playTone(493.88, 0.35, 'triangle', 0.12, undefined, 0.08);
        this.playTone(587.33, 0.42, 'sine', 0.12, undefined, 0.16);
        break;
      case 'horus':
        this.playTone(880, 0.26, 'sawtooth', 0.1, 440);
        this.playTone(1174.66, 0.22, 'sine', 0.11, 880, 0.03);
        break;
      case 'ra':
        this.playTone(293.66, 0.35, 'triangle', 0.14);
        this.playTone(440, 0.4, 'triangle', 0.13, undefined, 0.06);
        this.playTone(587.33, 0.5, 'sine', 0.14, undefined, 0.12);
        break;
    }
  }

  public playPortalOpen() {
    const notes = [293.66, 369.99, 440.0, 587.33];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.38, 'triangle', 0.13, undefined, idx * 0.08);
    });
  }

  public playVictory() {
    const notes = [293.66, 369.99, 440.0, 554.37, 587.33, 739.99, 880.0];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.45, 'triangle', 0.13, undefined, idx * 0.09);
    });
  }

  public playGameOver() {
    const notes = [293.66, 261.63, 220.0, 146.83];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.42, 'sawtooth', 0.1, undefined, idx * 0.13);
    });
  }
}

export const soundEngine = new SoundEngine();
