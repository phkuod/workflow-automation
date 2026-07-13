import { useState } from 'react';

const STEPS = [
  {
    title: 'This is your plan',
    body: 'Your automation reads top to bottom: when it starts, then what happens stage by stage.',
  },
  {
    title: 'Edit anything',
    body: 'Click ✏️ to change any action — what it does, who it emails, where it calls.',
  },
  {
    title: 'Try it safely',
    body: 'Press Test in the toolbar to do a practice run and watch each stage happen.',
  },
];

export default function CoachMarks({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-label="Editor introduction"
      style={{
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, width: 'min(420px, calc(100vw - 32px))',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '12px', padding: '16px 18px', boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{step.title}</div>
      <div className="text-sm text-muted" style={{ marginBottom: '12px' }}>{step.body}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="text-sm text-muted" style={{ flex: 1 }}>{index + 1} / {STEPS.length}</span>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>Skip</button>
        {isLast ? (
          <button className="btn btn-primary btn-sm" onClick={onDone}>Got it</button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => setIndex(i => i + 1)}>Next</button>
        )}
      </div>
    </div>
  );
}
