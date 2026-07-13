import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CoachMarks from './CoachMarks';

describe('CoachMarks', () => {
  it('walks through 3 steps with Next and calls onDone at the end', () => {
    const onDone = vi.fn();
    render(<CoachMarks onDone={onDone} />);
    expect(screen.getByText('This is your plan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Click .* to change any action/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Press Test/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('can be skipped from any step', () => {
    const onDone = vi.fn();
    render(<CoachMarks onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalled();
  });
});
