import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import StepCanvas from './StepCanvas';
import type { Station } from '../../../shared/types/workflow';

// React Flow needs these globals in jsdom; setup.ts provides ResizeObserver/matchMedia.
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: (props: Record<string, unknown>) => (
      <div
        data-testid="reactflow"
        data-nodesdraggable={String(props.nodesDraggable)}
        data-nodesconnectable={String(props.nodesConnectable)}
      />
    ),
  };
});

const station: Station = {
  id: 'st1', name: 'S', position: { x: 0, y: 0 },
  steps: [{ id: 's1', name: 'A', type: 'http-request', config: {}, position: { x: 0, y: 0 } }],
};

describe('StepCanvas readOnly', () => {
  it('disables dragging and connecting when readOnly', () => {
    const { getByTestId } = render(<StepCanvas station={station} readOnly onStepClick={vi.fn()} />);
    expect(getByTestId('reactflow').getAttribute('data-nodesdraggable')).toBe('false');
    expect(getByTestId('reactflow').getAttribute('data-nodesconnectable')).toBe('false');
  });

  it('allows dragging and connecting by default', () => {
    const { getByTestId } = render(<StepCanvas station={station} onStepClick={vi.fn()} />);
    expect(getByTestId('reactflow').getAttribute('data-nodesdraggable')).toBe('true');
    expect(getByTestId('reactflow').getAttribute('data-nodesconnectable')).toBe('true');
  });
});
