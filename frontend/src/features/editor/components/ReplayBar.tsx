import { SkipBack, ChevronLeft, Play, Pause, ChevronRight, SkipForward, X } from 'lucide-react';

export interface ReplayBarProps {
  index: number;
  total: number;
  isPlaying: boolean;
  currentLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onSeek: (i: number) => void;
  onExit: () => void;
}

export function ReplayBar({ index, total, isPlaying, currentLabel, onPrev, onNext, onToggle, onSeek, onExit }: ReplayBarProps) {
  const max = Math.max(0, total - 1);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '8px 16px', borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}
    >
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Jump to first action" onClick={() => onSeek(0)}>
        <SkipBack size={16} />
      </button>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Previous action" onClick={onPrev}>
        <ChevronLeft size={16} />
      </button>
      <button className="btn btn-primary btn-icon btn-sm" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={onToggle}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Next action" onClick={onNext}>
        <ChevronRight size={16} />
      </button>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Jump to last action" onClick={() => onSeek(max)}>
        <SkipForward size={16} />
      </button>

      <input
        type="range"
        role="slider"
        min={0}
        max={max}
        value={index}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ flex: 1 }}
        aria-label="Playback position"
      />

      <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{index + 1} / {total}</span>
      <span className="text-xs" style={{ whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {currentLabel}
      </span>

      <button className="btn btn-secondary btn-sm" aria-label="Exit run" onClick={onExit}>
        <X size={14} /> Exit replay
      </button>
    </div>
  );
}
