import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JsonTreeView from './JsonTreeView';

describe('JsonTreeView', () => {
  it('renders string primitives with quotes', () => {
    const { container } = render(<JsonTreeView data="hello world" />);
    expect(container.textContent).toContain('"hello world"');
    // String values are rendered in a span with green color
    const spans = container.querySelectorAll('span');
    const stringSpan = Array.from(spans).find(s => s.textContent === '"hello world"');
    expect(stringSpan).toBeDefined();
  });

  it('renders numbers in blue', () => {
    const { container } = render(<JsonTreeView data={42} />);
    expect(container.textContent).toContain('42');
    // Number values are rendered in a span
    const spans = container.querySelectorAll('span');
    const numSpan = Array.from(spans).find(s => s.textContent === '42');
    expect(numSpan).toBeDefined();
  });

  it('renders null as italic "null"', () => {
    const { container } = render(<JsonTreeView data={null} />);
    const span = container.querySelector('span[style*="italic"]');
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('null');
  });

  it('renders expandable objects with key count summary when collapsed', () => {
    const { container } = render(
      <JsonTreeView data={{ a: 1, b: 2, c: 3 }} defaultExpanded={false} />
    );
    // At depth 0 the node is always expanded, so click to collapse it first.
    const toggleRow = container.querySelector('div[style*="cursor: pointer"]') as HTMLElement;
    fireEvent.click(toggleRow);
    expect(container.textContent).toContain('{3 keys}');
  });

  it('toggles expand/collapse by clicking on an object node', () => {
    const { container } = render(
      <JsonTreeView data={{ name: 'test', value: 99 }} />
    );
    // Initially depth-0 is always expanded — child keys should be visible.
    expect(screen.getByText('"test"')).toBeTruthy();

    // Click the toggle row to collapse.
    const toggleRow = container.querySelector('div[style*="cursor: pointer"]') as HTMLElement;
    fireEvent.click(toggleRow);

    // After collapse the summary should appear and child content should be gone.
    expect(container.textContent).toContain('{2 keys}');
    expect(container.textContent).not.toContain('"test"');

    // Click again to re-expand.
    fireEvent.click(toggleRow);
    expect(screen.getByText('"test"')).toBeTruthy();
    expect(container.textContent).not.toContain('{2 keys}');
  });
});
