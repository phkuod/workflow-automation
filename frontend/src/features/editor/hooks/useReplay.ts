import { useState, useEffect, useCallback } from 'react';

export interface UseReplay {
  index: number;
  isPlaying: boolean;
  total: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (i: number) => void;
}

/**
 * Playback state machine over a fixed-length step sequence.
 * @param resetKey Identity of the sequence being played (e.g. the replay execution
 *   id). Switching to a different execution that happens to have the same `total`
 *   step count would otherwise leave a stale index/playback state behind, since the
 *   reset effect only keys off `total`.
 */
export function useReplay(total: number, tickMs = 1000, resetKey?: string): UseReplay {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const clamp = useCallback((i: number) => Math.max(0, Math.min(i, Math.max(0, total - 1))), [total]);

  const pause = useCallback(() => setIsPlaying(false), []);
  const play = useCallback(() => {
    if (total === 0) return;
    setIndex((i) => (i >= total - 1 ? 0 : i)); // restart if at the end
    setIsPlaying(true);
  }, [total]);
  const toggle = useCallback(() => { if (isPlaying) pause(); else play(); }, [isPlaying, pause, play]);
  const next = useCallback(() => { setIsPlaying(false); setIndex((i) => clamp(i + 1)); }, [clamp]);
  const prev = useCallback(() => { setIsPlaying(false); setIndex((i) => clamp(i - 1)); }, [clamp]);
  const seek = useCallback((i: number) => { setIsPlaying(false); setIndex(clamp(i)); }, [clamp]);

  // Advance while playing; auto-pause at the end.
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i >= total - 1) { setIsPlaying(false); return i; }
        return i + 1;
      });
    }, tickMs);
    return () => clearInterval(timer);
  }, [isPlaying, total, tickMs]);

  // Reset when the sequence length changes, or when resetKey identifies a different
  // execution (even one with the same step count).
  useEffect(() => { setIndex(0); setIsPlaying(false); }, [total, resetKey]);

  return { index, isPlaying, total, play, pause, toggle, next, prev, seek };
}
