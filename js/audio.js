// ═══════════════════════════════════════════════════════════════════
//  AUDIO MANAGER  —  Web Audio API
// ═══════════════════════════════════════════════════════════════════
class AudioManager {
    constructor() {
        this._ctx    = null;
        this._master = null;
        this._ready  = false;
    }

    // Call once on first user gesture to unlock AudioContext
    init() {
        if (this._ready) return;
        try {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._master = this._ctx.createGain();
            this._master.gain.value = 0.32;
            this._master.connect(this._ctx.destination);
            this._ready = true;
        } catch (e) {
            console.warn('Web Audio unavailable');
        }
    }

    _t() { return this._ctx.currentTime; }

    // ── Core helpers ──────────────────────────────────────────────────────────

    // Shaped oscillator: freq sweep with attack/decay envelope
    _osc(freq, type, dur, vol, freqEnd = null, delay = 0) {
        if (!this._ready) return;
        const ctx = this._ctx;
        const t   = this._t() + delay;

        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.connect(env);
        env.connect(this._master);

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (freqEnd !== null) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + dur);
        }

        const atk = Math.min(0.012, dur * 0.12);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(vol, t + atk);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    // Band-pass filtered white noise burst
    _noise(dur, vol, bpFreq = 1000, q = 1, delay = 0) {
        if (!this._ready) return;
        const ctx     = this._ctx;
        const t       = this._t() + delay;
        const samples = Math.max(1, Math.ceil(ctx.sampleRate * dur));
        const buf     = ctx.createBuffer(1, samples, ctx.sampleRate);
        const data    = buf.getChannelData(0);
        for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;

        const src  = ctx.createBufferSource();
        src.buffer = buf;

        const filt       = ctx.createBiquadFilter();
        filt.type        = 'bandpass';
        filt.frequency.value = bpFreq;
        filt.Q.value     = q;

        const env = ctx.createGain();
        src.connect(filt);
        filt.connect(env);
        env.connect(this._master);

        env.gain.setValueAtTime(vol, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        src.start(t);
        src.stop(t + dur + 0.05);
    }

    // ── Ability SFX ───────────────────────────────────────────────────────────

    shootAuto() {
        this._osc(900, 'sine', 0.08, 0.25, 450);
    }

    shootQ() {
        // Golden crack
        this._osc(700, 'sawtooth', 0.13, 0.22, 180);
        this._osc(1000, 'sine', 0.07, 0.12, 500, 0.01);
    }

    shootW() {
        // Blue pulsing wave
        this._osc(340, 'sine', 0.22, 0.28, 170);
        this._osc(460, 'triangle', 0.18, 0.18, 230, 0.02);
    }

    blinkE() {
        // Teleport: quick upward sweep then scatter
        this._osc(180, 'sine', 0.04, 0.35, 1400);
        this._osc(1400, 'sine', 0.14, 0.28, 380, 0.04);
        this._noise(0.09, 0.18, 2200, 2.5);
    }

    chargeR() {
        // Rising hum during 1s charge
        this._osc(90, 'sawtooth', 0.95, 0.28, 360);
        this._osc(70, 'sine', 0.95, 0.18, 180, 0.08);
    }

    shootR() {
        // Deep cannon blast
        this._osc(70, 'sawtooth', 0.45, 0.55, 35);
        this._osc(140, 'sine', 0.32, 0.35, 70, 0.02);
        this._noise(0.18, 0.25, 220, 0.6, 0.06);
    }

    // ── Hit / death ───────────────────────────────────────────────────────────

    enemyHit() {
        this._osc(210, 'sine', 0.07, 0.18, 85);
        this._noise(0.05, 0.12, 900, 2);
    }

    enemyDeath() {
        this._osc(280, 'sawtooth', 0.14, 0.28, 70);
        this._noise(0.16, 0.22, 650, 1.5);
    }

    bossDeath() {
        this._osc(55, 'sawtooth', 0.65, 0.6, 28);
        this._osc(110, 'square', 0.45, 0.38, 38, 0.06);
        this._noise(0.45, 0.38, 280, 0.5, 0.1);
        // High ring-off
        this._osc(880, 'sine', 0.4, 0.22, 220, 0.18);
    }

    playerHit() {
        this._osc(140, 'sawtooth', 0.16, 0.38, 45);
        this._noise(0.12, 0.22, 420, 1);
    }

    // ── Pickups / room events ─────────────────────────────────────────────────

    roomClear() {
        // Bright major-chord arpeggio: C E G
        [523, 659, 784].forEach((f, i) => {
            this._osc(f, 'sine', 0.32, 0.22, f * 0.85, i * 0.1);
        });
    }

    pickup() {
        // Ascending sparkle: C E G C'
        [523, 659, 784, 1047].forEach((f, i) => {
            this._osc(f, 'sine', 0.16, 0.2, f, i * 0.07);
        });
    }

    itemChosen() {
        // 5-note ascending run
        [392, 494, 587, 698, 880].forEach((f, i) => {
            this._osc(f, 'triangle', 0.22, 0.2, f, i * 0.07);
        });
        this._osc(880, 'sine', 0.4, 0.15, 660, 0.35);
    }

    // ── End-game ──────────────────────────────────────────────────────────────

    gameOver() {
        // Descending minor: A G F D
        [440, 392, 349, 294].forEach((f, i) => {
            this._osc(f, 'triangle', 0.45, 0.28, f * 0.88, i * 0.2);
        });
        this._osc(147, 'sine', 0.6, 0.18, 110, 0.65);
    }

    victory() {
        // Triumphant ascending fanfare
        [523, 659, 784, 1047, 1318].forEach((f, i) => {
            this._osc(f, 'triangle', 0.38, 0.25, f, i * 0.1);
        });
        // Held chord finish
        [523, 659, 784].forEach((f, i) => {
            this._osc(f, 'sine', 0.7, 0.15, f * 0.95, 0.55 + i * 0.04);
        });
    }
}

const SFX = new AudioManager();
