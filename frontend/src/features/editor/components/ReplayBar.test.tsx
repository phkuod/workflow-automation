import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayBar } from './ReplayBar';

const baseProps = {
  index: 1, total: 3, isPlaying: false, currentLabel: 'Stage 1 · Fetch',
  onPrev: vi.fn(), onNext: vi.fn(), onToggle: vi.fn(), onSeek: vi.fn(), onExit: vi.fn(),
};

describe('ReplayBar', () => {
  it('shows position as 1-based of total and the current label', () => {
    render(<ReplayBar {...baseProps} />);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('Stage 1 · Fetch')).toBeInTheDocument();
  });

  it('play/pause button reflects isPlaying and calls onToggle', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ReplayBar {...baseProps} isPlaying={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(onToggle).toHaveBeenCalled();
    rerender(<ReplayBar {...baseProps} isPlaying onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('prev/next/exit fire their handlers', () => {
    const onPrev = vi.fn(), onNext = vi.fn(), onExit = vi.fn();
    render(<ReplayBar {...baseProps} onPrev={onPrev} onNext={onNext} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /previous action/i }));
    fireEvent.click(screen.getByRole('button', { name: /next action/i }));
    fireEvent.click(screen.getByRole('button', { name: /exit run/i }));
    expect(onPrev).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
  });

  it('scrubber reports the seeked index', () => {
    const onSeek = vi.fn();
    render(<ReplayBar {...baseProps} onSeek={onSeek} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } });
    expect(onSeek).toHaveBeenCalledWith(2);
  });
});
