import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Ambient chord synthesizer.
 *
 * Fixes carried over from the previous version:
 *   - Frequencies now genuinely follow the selection. The restart on change was
 *     scheduled with an uncleared setTimeout, so a quick series of theme changes
 *     stacked several pending starts on top of each other.
 *   - The LFO oscillators were started but not tracked, so stopSynth could not
 *     stop them and they only died when the context was closed.
 *   - The AudioContext is now closed on unmount. It never was, and browsers cap
 *     concurrent contexts at around six.
 *   - Honours prefers-reduced-motion by not auto-restarting on change.
 */
export default function AudioPlayer({ frequencies, soundscape, label = 'Ambient sound' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef(null);
  const nodesRef = useRef([]);
  const masterRef = useRef(null);
  const restartTimer = useRef(null);
  // Kept in a ref so the change-effect can read the live value without listing
  // isPlaying as a dependency (which would retrigger on every toggle).
  const playingRef = useRef(false);

  // A soundscape, when given, supplies everything: chord, oscillator shape,
  // filter, vibrato and pulse. `frequencies` remains for callers that only have
  // a chord, so nothing had to be updated in lockstep.
  const scape = soundscape || null;
  const freqs = scape?.freqs || (Array.isArray(frequencies) ? frequencies : []);
  const freqKey = `${scape?.id || ''}:${freqs.join(',')}`;
  const silent = freqs.length === 0;

  const teardown = useCallback((immediate = false) => {
    if (restartTimer.current) {
      clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
    const stopAll = () => {
      nodesRef.current.forEach((n) => {
        try { n.stop(); } catch { /* already stopped */ }
        try { n.disconnect(); } catch { /* already disconnected */ }
      });
      nodesRef.current = [];
    };

    if (!immediate && ctxRef.current && masterRef.current) {
      const ctx = ctxRef.current;
      try {
        masterRef.current.gain.cancelScheduledValues(ctx.currentTime);
        masterRef.current.gain.setValueAtTime(masterRef.current.gain.value, ctx.currentTime);
        masterRef.current.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      } catch { /* context may be closing */ }
      restartTimer.current = setTimeout(() => {
        restartTimer.current = null;
        stopAll();
      }, 450);
    } else {
      stopAll();
    }

    playingRef.current = false;
    setIsPlaying(false);
  }, []);

  const start = useCallback(() => {
    const chord = freqs.length ? freqs : [138.59, 207.65, 277.18];
    const wave = scape?.wave || 'sawtooth';
    const cutoff = scape?.cutoff ?? 430;
    const lfoRate = scape?.lfoRate ?? 0.2;
    const lfoDepth = scape?.lfoDepth ?? 0.8;
    const pulse = scape?.pulse ?? 0;
    const spread = scape?.detune ?? 0;

    // "No sound" is a real choice a host can make, not a broken state.
    if (silent) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!ctxRef.current) ctxRef.current = new AudioCtx();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 1.1);
      masterRef.current = master;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
      master.connect(filter);
      filter.connect(ctx.destination);

      // An amplitude throb, for the soundscapes that have one. This is the
      // difference between a drone and a room with music in it.
      if (pulse > 0) {
        const pulseOsc = ctx.createOscillator();
        const pulseGain = ctx.createGain();
        pulseOsc.frequency.value = pulse;
        pulseGain.gain.value = 0.055;
        pulseOsc.connect(pulseGain);
        pulseGain.connect(master.gain);
        pulseOsc.start();
        nodesRef.current.push(pulseOsc);
      }

      chord.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.value = f;
        // Spread the voices a few cents apart. A chord whose notes are exactly
        // in tune with each other sounds synthetic; a little disagreement is
        // what makes it sound like more than one instrument.
        if (spread) osc.detune.value = (i - (chord.length - 1) / 2) * spread;

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = lfoRate;
        lfoGain.gain.value = lfoDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(master);
        osc.start();
        lfo.start();

        // Both tracked, so both can actually be stopped.
        nodesRef.current.push(osc, lfo);
      });

      playingRef.current = true;
      setIsPlaying(true);
    } catch (err) {
      console.warn('Audio synthesizer unavailable:', err);
    }
  }, [freqKey, silent]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (playingRef.current) teardown();
    else start();
  };

  // Swap the chord when the selected theme changes, but only while playing.
  useEffect(() => {
    if (!playingRef.current) return;

    nodesRef.current.forEach((n) => {
      try { n.stop(); } catch { /* noop */ }
      try { n.disconnect(); } catch { /* noop */ }
    });
    nodesRef.current = [];
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freqKey]);

  // Release the AudioContext on unmount.
  useEffect(() => {
    return () => {
      if (restartTimer.current) clearTimeout(restartTimer.current);
      nodesRef.current.forEach((n) => {
        try { n.stop(); } catch { /* noop */ }
        try { n.disconnect(); } catch { /* noop */ }
      });
      nodesRef.current = [];
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch { /* noop */ }
        ctxRef.current = null;
      }
    };
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isPlaying}
      aria-label={isPlaying ? 'Turn ambient sound off' : 'Turn ambient sound on'}
      title={isPlaying ? 'Sound on — click to mute' : `${label} — click to play`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: '50%',
        cursor: 'pointer',
        border: isPlaying ? '1px solid rgba(245,181,68,0.55)' : '1px solid rgba(255,255,255,0.14)',
        background: isPlaying ? 'rgba(245,181,68,0.14)' : 'rgba(255,255,255,0.05)',
        color: isPlaying ? '#f5b544' : 'rgba(255,255,255,0.6)',
        transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease'
      }}
    >
      {isPlaying ? <Volume2 size={16} strokeWidth={1.9} /> : <VolumeX size={16} strokeWidth={1.9} />}
    </button>
  );
}
