import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { AUTOMATION_TEMPLATES, TEMPLATE_CATEGORIES } from './templates';
import type { AutomationTemplate } from './templates';
import { workflowApi } from '../../shared/api/workflowApi';
import { STEP_TYPE_INFO } from '../../shared/types/workflow';
import { toast } from '../../shared/stores/toastStore';

function iconSequence(template: AutomationTemplate): string[] {
  return template.definition.stations
    .flatMap(s => s.steps)
    .map(step => STEP_TYPE_INFO[step.type]?.icon ?? '📦');
}

export default function TemplateGalleryPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const createFrom = async (name: string, description: string | undefined, definition: AutomationTemplate['definition']) => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const created = await workflowApi.create({ name, description, definition });
      navigate(`/editor/${created.id}`);
    } catch {
      toast.error('Failed to create automation');
      setIsCreating(false);
    }
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')} title="Back to dashboard">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>
              <Sparkles size={24} style={{ marginRight: '10px', color: 'var(--accent-primary)' }} />
              New Automation
            </h1>
            <p className="text-sm text-muted">Pick a template that's close to what you need — you can change everything after.</p>
          </div>
        </div>
      </header>

      <main className="main-content">
        {TEMPLATE_CATEGORIES.map(category => {
          const templates = AUTOMATION_TEMPLATES.filter(t => t.category === category);
          if (templates.length === 0) return null;
          return (
            <section key={category} style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '12px' }}>{category}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {templates.map(t => (
                  <button
                    key={t.id}
                    className="card"
                    onClick={() => createFrom(t.name, t.description, t.definition)}
                    disabled={isCreating}
                    style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '8px', letterSpacing: '4px' }} aria-hidden>
                      {iconSequence(t).join(' → ')}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t.name}</div>
                    <div className="text-sm text-muted">{t.description}</div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <section style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button
            className="btn btn-secondary"
            onClick={() => createFrom('Untitled Automation', undefined, { stations: [] })}
            disabled={isCreating}
          >
            <Plus size={16} /> Start from scratch
          </button>
        </section>
      </main>
    </div>
  );
}
