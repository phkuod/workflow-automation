import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NodeLibrary from './NodeLibrary';

const defaultProps = {
  onAddStep: vi.fn(),
  stations: [
    { id: 's1', name: 'Stage 1', steps: [], position: { x: 0, y: 0 }, condition: { type: 'always' as const } },
  ],
  onAddStepToStation: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NodeLibrary', () => {
  it('renders "Node Library" title', () => {
    render(<NodeLibrary {...defaultProps} />);
    expect(screen.getByText('Node Library')).toBeInTheDocument();
  });

  it('shows all 3 categories', () => {
    render(<NodeLibrary {...defaultProps} />);
    expect(screen.getByText('📌 Triggers')).toBeInTheDocument();
    expect(screen.getByText('⚙️ Actions')).toBeInTheDocument();
    expect(screen.getByText('🔀 Flow Control')).toBeInTheDocument();
  });

  it('search filter shows only matching nodes', () => {
    render(<NodeLibrary {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search nodes...');
    fireEvent.change(searchInput, { target: { value: 'java' } });

    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.queryByText('Manual Trigger')).not.toBeInTheDocument();
    expect(screen.queryByText('HTTP Request')).not.toBeInTheDocument();
  });

  it('close button calls onClose', () => {
    render(<NodeLibrary {...defaultProps} />);

    // The close button contains only the X icon; find by querying the button next to the title
    const header = screen.getByText('Node Library').closest('div')!;
    const closeButton = header.querySelector('button')!;
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a node calls onAddStepToStation with the station id and step type', () => {
    render(<NodeLibrary {...defaultProps} />);

    // All categories are expanded by default; click the "Manual Trigger" node button
    fireEvent.click(screen.getByText('Manual Trigger'));

    expect(defaultProps.onAddStepToStation).toHaveBeenCalledTimes(1);
    expect(defaultProps.onAddStepToStation).toHaveBeenCalledWith('s1', 'trigger-manual');
  });
});
