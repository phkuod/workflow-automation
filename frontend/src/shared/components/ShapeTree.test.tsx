import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShapeTree } from './ShapeTree';
import type { ShapeNode } from '../types/shapes';

const shape: ShapeNode = {
  name: '', type: 'object',
  children: [
    { name: 'orderId', type: 'number', sample: '10023' },
    {
      name: 'rows', type: 'array', sample: '3 items',
      children: [{
        name: '[0]', type: 'object',
        children: [{ name: 'id', type: 'number', sample: '1' }],
      }],
    },
    { name: 'content-type', type: 'string', sample: 'application/json' },
    { name: 'big', type: 'object', truncated: true, omittedCount: 12 },
  ],
};

describe('ShapeTree', () => {
  it('renders field names, types, and samples', () => {
    render(<ShapeTree shape={shape} />);
    expect(screen.getByText('orderId')).toBeInTheDocument();
    expect(screen.queryAllByText('number').length).toBeGreaterThan(0);
    expect(screen.getByText('10023')).toBeInTheDocument();
  });

  it('shows omitted-field notice for truncated nodes', () => {
    render(<ShapeTree shape={shape} />);
    expect(screen.getByText('12 more fields omitted')).toBeInTheDocument();
  });

  it('calls onSelectPath with a dot path for identifier-safe fields', () => {
    const onSelectPath = vi.fn();
    render(<ShapeTree shape={shape} onSelectPath={onSelectPath} />);
    fireEvent.click(screen.getByRole('button', { name: /orderId/ }));
    expect(onSelectPath).toHaveBeenCalledWith('orderId');
  });

  it('builds array element paths with [0]', () => {
    const onSelectPath = vi.fn();
    render(<ShapeTree shape={shape} onSelectPath={onSelectPath} />);
    fireEvent.click(screen.getByRole('button', { name: /^id/ }));
    expect(onSelectPath).toHaveBeenCalledWith('rows[0].id');
  });

  it('brackets non-identifier field names', () => {
    const onSelectPath = vi.fn();
    render(<ShapeTree shape={shape} onSelectPath={onSelectPath} />);
    fireEvent.click(screen.getByRole('button', { name: /content-type/ }));
    expect(onSelectPath).toHaveBeenCalledWith("['content-type']");
  });

  it('escapes single quotes in bracketed field names', () => {
    const quoteShape: ShapeNode = {
      name: '', type: 'object',
      children: [{ name: "user's-id", type: 'string', sample: '42' }],
    };
    const onSelectPath = vi.fn();
    render(<ShapeTree shape={quoteShape} onSelectPath={onSelectPath} />);
    fireEvent.click(screen.getByRole('button', { name: /user's-id/ }));
    expect(onSelectPath).toHaveBeenCalledWith("['user\\'s-id']");
  });

  it('renders plain text (no buttons) when onSelectPath is not provided', () => {
    render(<ShapeTree shape={shape} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
