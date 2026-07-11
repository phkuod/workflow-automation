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

  it('shows all 4 categories', () => {
    render(<NodeLibrary {...defaultProps} />);
    expect(screen.getByText('📌 When it starts')).toBeInTheDocument();
    expect(screen.getByText('⚙️ Do something')).toBeInTheDocument();
    expect(screen.getByText('🔀 Flow control')).toBeInTheDocument();
    expect(screen.getByText('🛠️ Advanced')).toBeInTheDocument();
  });

  it('search filter shows only matching nodes', () => {
    render(<NodeLibrary {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search nodes...');
    fireEvent.change(searchInput, { target: { value: 'java' } });

    expect(screen.getByText('Custom Script (JavaScript)')).toBeInTheDocument();
    expect(screen.queryByText('Start manually')).not.toBeInTheDocument();
    expect(screen.queryByText('Call an external service')).not.toBeInTheDocument();
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

    // All categories are expanded by default; click the "Start manually" node button
    fireEvent.click(screen.getByText('Start manually'));

    expect(defaultProps.onAddStepToStation).toHaveBeenCalledTimes(1);
    expect(defaultProps.onAddStepToStation).toHaveBeenCalledWith('s1', 'trigger-manual');
  });
});
