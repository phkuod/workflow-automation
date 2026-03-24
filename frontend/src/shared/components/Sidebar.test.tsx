import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

// Force desktop mode so desktop-only elements (sidebar-toggle, logo, labels) are visible
function renderDesktop(initialPath = '/dashboard') {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  window.dispatchEvent(new Event('resize'));

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar>
        <div>Content</div>
      </Sidebar>
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    // Ensure desktop viewport for each test
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders navigation links for Dashboard, Executions, and Monitoring', () => {
    renderDesktop();

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /executions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /monitoring/i })).toBeInTheDocument();
  });

  it('renders children inside the main content area', () => {
    renderDesktop();

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent('Content');
  });

  it('collapses the sidebar when the toggle button is clicked', () => {
    renderDesktop();

    const aside = document.querySelector('aside.sidebar');
    expect(aside).not.toHaveClass('collapsed');

    const toggleButton = document.querySelector('.sidebar-toggle') as HTMLElement;
    expect(toggleButton).toBeInTheDocument();
    fireEvent.click(toggleButton);

    expect(aside).toHaveClass('collapsed');
  });

  it('applies the active class to the link matching the current route', () => {
    renderDesktop('/executions');

    const executionsLink = screen.getByRole('link', { name: /executions/i });
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });

    expect(executionsLink).toHaveClass('active');
    expect(dashboardLink).not.toHaveClass('active');
  });

  it('shows the sidebar logo text "Workflow"', () => {
    renderDesktop();

    expect(screen.getByText('Workflow')).toBeInTheDocument();
  });
});
