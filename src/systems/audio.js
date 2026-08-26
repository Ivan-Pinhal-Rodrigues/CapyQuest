// Chiptune SFX synthesised at runtime. No audio files ship with the game.
//
// Browsers block audio until a user gesture — which for a clicker is the very
// first tap — so the context is created lazily on first play().

const NOTES = { C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 };

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.5;
    this.lastPlay = 0;
    this.voices = 0;

    // --- music, which is a separate opt-in from the effects
    this.musicEnabled = false;
    this.musicTimer = null;
    this.musicGain = null;
    this.track = null;
    this.wantedTrack = null;
    this.step = 0;
    this.nextNoteAt = 0;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on && this.ctx) this.master.gain.value = 0;
    else if (this.master) this.master.gain.value = this.volume * 0.25;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.enabled ? this.volume * 0.25 : 0;
  }

  ensure() {
    if (this.ctx) {
      // A context can be created suspended, or get suspended when the tab is
      // backgrounded. Without this the game goes silent and never recovers.
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume * 0.25 : 0;
      this.master.connect(this.ctx.destination);
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** One oscillator with an envelope. The building block for everything below. */
  tone(freq, { type = 'square', duration = 0.09, attack = 0.005, gain = 0.5, detune = 0, delay = 0, slideTo = null } = {}) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    // Hard cap on simultaneous voices — a frenzy of clicks must not turn into
    // a wall of noise or starve the audio thread.
    if (this.voices > 12) return;

    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    osc.detune.value = detune;

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(env);
    env.connect(this.master);

    this.voices++;
    osc.onended = () => { this.voices--; };
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Tap blip. Pitch rises with combo so a streak audibly climbs. */
  click(comboRatio = 0) {
    const base = 420 + comboRatio * 380;
    this.tone(base, { type: 'square', duration: 0.055, gain: 0.32 });
  }

  crit() {
    this.tone(NOTES.C5, { type: 'square', duration: 0.09, gain: 0.4 });
    this.tone(NOTES.G5, { type: 'square', duration: 0.12, gain: 0.32, delay: 0.05 });
  }

  buy() {
    this.tone(NOTES.E4, { type: 'triangle', duration: 0.08, gain: 0.4 });
    this.tone(NOTES.C5, { type: 'triangle', duration: 0.11, gain: 0.35, delay: 0.06 });
  }

  denied() {
    this.tone(150, { type: 'sawtooth', duration: 0.12, gain: 0.18, slideTo: 90 });
  }

  achievement() {
    [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6].forEach((f, i) => {
      this.tone(f, { type: 'triangle', duration: 0.16, gain: 0.36, delay: i * 0.07 });
    });
  }

  golden() {
    [NOTES.G4, NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6].forEach((f, i) => {
      this.tone(f, { type: 'square', duration: 0.13, gain: 0.34, delay: i * 0.05 });
    });
  }

  levelUp() {
    [NOTES.C4, NOTES.G4, NOTES.C5].forEach((f, i) => {
      this.tone(f, { type: 'triangle', duration: 0.2, gain: 0.4, delay: i * 0.09 });
    });
  }

  nap() {
    this.tone(NOTES.C4, { type: 'sine', duration: 0.4, gain: 0.4, slideTo: NOTES.C5 });
  }

  // ------------------------------------------------------------------ combat
  //
  // The RPG half of the game was silent — not quiet, silent. Eight sounds on
  // the clicker side and none at all in the tab you are meant to live in.
  //
  // These are deliberately small. A fight can run for minutes at several
  // attacks a second, so anything with a tail becomes a drone; every hit sound
  // is under 60ms and the loud ones are reserved for things that happen once.

  /** An ordinary landed attack. Quiet on purpose — it plays constantly. */
  hit() {
    this.tone(220, { type: 'square', duration: 0.035, gain: 0.16, slideTo: 170 });
  }

  /** Taking one. Lower and duller, so it never reads as progress. */
  hurt() {
    this.tone(160, { type: 'sawtooth', duration: 0.05, gain: 0.14, slideTo: 120 });
  }

  /** A skill going off, pitched up by how much Focus it spent. */
  skill(charge = 0) {
    const base = NOTES.E4 + charge * 160;
    this.tone(base, { type: 'triangle', duration: 0.09, gain: 0.3 });
    this.tone(base * 1.5, { type: 'triangle', duration: 0.11, gain: 0.24, delay: 0.05 });
  }

  /** The wind-up. A rising tell you learn to hear rather than watch. */
  windup() {
    this.tone(300, { type: 'sine', duration: 0.7, gain: 0.2, slideTo: 620 });
  }

  /** A read wind-up. Short, bright, immediately satisfying. */
  brace() {
    this.tone(NOTES.G5, { type: 'square', duration: 0.06, gain: 0.34 });
    this.tone(NOTES.C6, { type: 'square', duration: 0.08, gain: 0.26, delay: 0.04 });
  }

  /** A missed one. The heavy lands in full. */
  heavy() {
    this.tone(110, { type: 'sawtooth', duration: 0.18, gain: 0.32, slideTo: 60 });
  }

  /** A boss arriving with a pattern attached. */
  bossRoar() {
    this.tone(90, { type: 'sawtooth', duration: 0.5, gain: 0.3, slideTo: 140 });
    this.tone(70, { type: 'square', duration: 0.6, gain: 0.2, delay: 0.08, slideTo: 110 });
  }

  /** A ward going up, and the same figure inverted when it comes down. */
  ward() {
    this.tone(NOTES.C5, { type: 'sine', duration: 0.22, gain: 0.26, slideTo: NOTES.G5 });
  }

  wardBroke() {
    this.tone(NOTES.G5, { type: 'square', duration: 0.16, gain: 0.32, slideTo: NOTES.C5 });
  }

  victory() {
    [NOTES.C5, NOTES.E5, NOTES.G5].forEach((f, i) => {
      this.tone(f, { type: 'triangle', duration: 0.12, gain: 0.3, delay: i * 0.06 });
    });
  }

  defeat() {
    [NOTES.G4, NOTES.E4, NOTES.C4].forEach((f, i) => {
      this.tone(f, { type: 'triangle', duration: 0.18, gain: 0.26, delay: i * 0.09 });
    });
  }

  // ------------------------------------------------------------------- music
  //
  // Three loops, synthesised from the same oscillators as the sound effects —
  // still no audio files anywhere in the repository.
  //
  // An idle game runs for hours in a background tab, which makes music a
  // liability as much as an asset. Three things follow from that: it has its
  // own toggle separate from the sound effects, it is mixed well under them,
  // and it stops entirely while the tab is hidden rather than playing to an
  // empty room.
  //
  // The scheduler is the standard WebAudio lookahead: a timer wakes a few times
  // a second and schedules any note falling inside the next window. Scheduling
  // note-by-note off setTimeout would drift audibly within a bar.

  setMusicEnabled(on) {
    this.musicEnabled = !!on;
    if (!on) this.stopMusic();
    else if (this.wantedTrack) this.playMusic(this.wantedTrack);
  }

  /**
   * Ask for a track. Idempotent: asking for the one already playing does
   * nothing, so callers can drive this straight from game state every frame.
   */
  playMusic(track) {
    this.wantedTrack = track;
    if (!this.musicEnabled || !track) return this.stopMusic();
    if (this.track === track && this.musicTimer) return;

    this.stopMusic();
    const ctx = this.ensure();
    if (!ctx) return;

    this.track = track;
    this.musicGain = ctx.createGain();
    // Well under the effects, which sit at master * 0.25. Music that competes
    // with the feedback layer is music that gets switched off.
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);

    this.step = 0;
    this.nextNoteAt = ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 60);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.track = null;
    if (this.musicGain) {
      try { this.musicGain.disconnect(); } catch { /* already gone */ }
      this.musicGain = null;
    }
  }

  scheduleMusic() {
    const ctx = this.ctx;
    const def = TRACKS[this.track];
    if (!ctx || !def || !this.musicGain) return this.stopMusic();

    const beat = 60 / def.bpm;
    // Schedule anything starting inside the next fifth of a second.
    while (this.nextNoteAt < ctx.currentTime + 0.2) {
      const index = this.step % def.notes.length;
      const note = def.notes[index];
      if (note) this.musicNote(note, this.nextNoteAt, beat * def.hold, def.wave);

      // The bass moves at a quarter of the melody, which is what stops a
      // sixteen-note loop from sounding like a sixteen-note loop.
      if (def.bass && index % 4 === 0) {
        const bass = def.bass[(index / 4) % def.bass.length];
        if (bass) this.musicNote(bass / 2, this.nextNoteAt, beat * 3.4, 'sine', 0.5);
      }

      this.nextNoteAt += beat;
      this.step++;
    }
  }

  musicNote(freq, at, duration, wave, level = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      // A soft envelope: a square wave with a hard edge is a sound effect, and
      // a hundred of those in a row is not music.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.34 * level, at + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(at);
      osc.stop(at + duration + 0.05);
    } catch { /* the context went away mid-schedule */ }
  }
}

// Pentatonic throughout, so nothing can land on a sour interval however the
// bass and melody line up — the cheapest way to make a generated loop pleasant.
const S = {
  C3: 130.81, D3: 146.83, F3: 174.61, G3: 196.0, A3: 220.0,
  C4: 261.63, D4: 293.66, F4: 349.23, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, F5: 698.46, G5: 783.99, A5: 880.0,
};

/**
 * `notes` is one loop; a null is a rest. `hold` is how much of a beat a note
 * sustains, which is most of what separates the three tracks from each other.
 */
const TRACKS = {
  // The pond. Slow, mostly rests, meant to be forgettable in the good way.
  pond: {
    bpm: 68, hold: 2.6, wave: 'sine',
    notes: [S.C4, null, S.G4, null, S.A4, null, S.G4, null, S.F4, null, S.D4, null, S.C4, null, null, null],
    bass: [S.C3, S.F3, S.A3, S.G3],
  },
  // Downstream. Faster, fuller, moving somewhere.
  descent: {
    bpm: 104, hold: 1.1, wave: 'triangle',
    notes: [S.A4, S.C5, S.D5, S.C5, S.A4, S.G4, S.A4, null, S.F4, S.A4, S.C5, S.A4, S.G4, S.F4, S.D4, null],
    bass: [S.A3, S.F3, S.D3, S.G3],
  },
  // A boss. Low, insistent, and it does not resolve.
  boss: {
    bpm: 132, hold: 0.85, wave: 'square',
    notes: [S.D4, S.D4, S.F4, S.D4, S.G4, S.F4, S.D4, S.C4, S.D4, S.D4, S.A4, S.G4, S.F4, S.D4, S.C4, S.D4],
    bass: [S.D3, S.D3, S.F3, S.C3],
  },
};

export const audio = new Audio();
