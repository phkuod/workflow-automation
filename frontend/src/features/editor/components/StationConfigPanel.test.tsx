import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StationConfigPanel from './StationConfigPanel';
import type { Station, Workflow } from '../../../shared/types/workflow';

vi.mock('../../../shared/api/workflowApi', () => ({
  workflowApi: { getDataShapes: vi.fn().mockResolvedValue({ source: { kind: 'none' }, steps: {} }) },
  aiApi: { inferShape: vi.fn() },
}));
vi.mock('../../../shared/hooks/useAiEnabled', () => ({
  useAiEnabled: vi.fn().mockReturnValue(false),
}));

const earlierStation: Station = {
  id: 'st0',
  name: 'Before',
  position: { x: 0, y: 0 },
  steps: [
    { id: 's0', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
  ],
};

const baseStation: Station = {
  id: 'st1',
  name: 'Stage 1',
  position: { x: 0, y: 0 },
  steps: [
    { id: 's1', name: 'Do Nothing', type: 'set-variable', config: {}, position: { x: 0, y: 0 } },
  ],
};

const workflow: Workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [earlierStation, baseStation] },
};

function renderPanel(station: Station) {
  return render(
    <StationConfigPanel
      station={station}
      workflow={workflow}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

function openConditionPicker() {
  const input = screen.getByPlaceholderText("steps['Prev'].output.success === true");
  const pickerButton = input.parentElement!.querySelector('button')!;
  fireEvent.click(pickerButton);
}

describe('StationConfigPanel condition picker brace handling', () => {
  it('unwraps a ${...} interpolated insert into a bare path, not "$steps[...]"', async () => {
    const station: Station = { ...baseStation, condition: { type: 'expression', expression: '' } };
    renderPanel(station);
    openConditionPicker();

    fireEvent.click(await screen.findByRole('button', { name: 'whole result (as text)' }));

    const conditionInput = screen.getByPlaceholderText("steps['Prev'].output.success === true") as HTMLInputElement;
    expect(conditionInput.value).toBe("steps['Fetch'].output");
  });

  it('leaves a bare (non-interpolated) insert unchanged', async () => {
    const station: Station = { ...baseStation, condition: { type: 'expression', expression: '' } };
    renderPanel(station);
    openConditionPicker();

    fireEvent.click(await screen.findByRole('button', { name: 'response body' }));

    const conditionInput = screen.getByPlaceholderText("steps['Prev'].output.success === true") as HTMLInputElement;
    expect(conditionInput.value).toBe("steps['Fetch'].output.data");
  });
});
