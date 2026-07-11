import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TemplateGalleryPage from './TemplateGalleryPage';
import { AUTOMATION_TEMPLATES } from './templates';
import { workflowApi } from '../../shared/api/workflowApi';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('../../shared/api/workflowApi', () => ({
  workflowApi: { create: vi.fn() },
}));

function renderPage() {
  return render(<MemoryRouter><TemplateGalleryPage /></MemoryRouter>);
}

describe('TemplateGalleryPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders every template as a card', () => {
    renderPage();
    for (const t of AUTOMATION_TEMPLATES) {
      expect(screen.getByText(t.name)).toBeInTheDocument();
    }
  });

  it('renders a start-from-scratch entry', () => {
    renderPage();
    expect(screen.getByText(/start from scratch/i)).toBeInTheDocument();
  });

  it('creates a draft from a template and navigates to the editor', async () => {
    vi.mocked(workflowApi.create).mockResolvedValue({ id: 'wf-new' } as never);
    renderPage();
    fireEvent.click(screen.getByText(AUTOMATION_TEMPLATES[0].name));
    await waitFor(() => {
      expect(workflowApi.create).toHaveBeenCalledWith({
        name: AUTOMATION_TEMPLATES[0].name,
        description: AUTOMATION_TEMPLATES[0].description,
        definition: AUTOMATION_TEMPLATES[0].definition,
      });
      expect(navigateMock).toHaveBeenCalledWith('/editor/wf-new');
    });
  });

  it('creates an empty draft from scratch', async () => {
    vi.mocked(workflowApi.create).mockResolvedValue({ id: 'wf-blank' } as never);
    renderPage();
    fireEvent.click(screen.getByText(/start from scratch/i));
    await waitFor(() => {
      expect(workflowApi.create).toHaveBeenCalledWith({
        name: 'Untitled Automation',
        description: undefined,
        definition: { stations: [] },
      });
      expect(navigateMock).toHaveBeenCalledWith('/editor/wf-blank');
    });
  });
});
