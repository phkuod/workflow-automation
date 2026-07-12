import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TemplateGalleryPage from './TemplateGalleryPage';
import { AUTOMATION_TEMPLATES } from './templates';
import { workflowApi, aiApi } from '../../shared/api/workflowApi';
import { useAiEnabled } from '../../shared/hooks/useAiEnabled';
import { toast } from '../../shared/stores/toastStore';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('../../shared/api/workflowApi', () => ({
  workflowApi: { create: vi.fn() },
  aiApi: { draft: vi.fn() },
}));
vi.mock('../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: vi.fn() }));
vi.mock('../../shared/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function renderPage() {
  return render(<MemoryRouter><TemplateGalleryPage /></MemoryRouter>);
}

describe('TemplateGalleryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAiEnabled).mockReturnValue(false);
  });

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

describe('AI describe-it box', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is hidden when AI is disabled', () => {
    vi.mocked(useAiEnabled).mockReturnValue(false);
    renderPage();
    expect(screen.queryByPlaceholderText('Describe what you want to automate…')).not.toBeInTheDocument();
  });

  it('drafts an automation and navigates to the editor', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.draft).mockResolvedValue({ id: 'wf-ai' } as never);
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Describe what you want to automate…'), {
      target: { value: 'email me the weather every morning' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Draft it for me' }));
    await waitFor(() => {
      expect(aiApi.draft).toHaveBeenCalledWith('email me the weather every morning');
      expect(navigateMock).toHaveBeenCalledWith('/editor/wf-ai');
    });
  });

  it('shows the graceful error toast when drafting fails', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.draft).mockRejectedValue(new Error('bad'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Describe what you want to automate…'), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Draft it for me' }));
    await waitFor(() => {
      expect(aiApi.draft).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('AI draft failed — try a template instead');
    });
  });
});
