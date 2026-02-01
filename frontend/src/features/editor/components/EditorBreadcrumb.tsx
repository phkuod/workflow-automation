import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Home from 'lucide-react/dist/esm/icons/home';

interface BreadcrumbItem {
  id: string;
  label: string;
  onClick?: () => void;
}

interface EditorBreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function EditorBreadcrumb({ items }: EditorBreadcrumbProps) {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 0',
    }}>
      {items.map((item, index) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {index > 0 && (
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          )}
          <button
            onClick={item.onClick}
            disabled={!item.onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: index === items.length - 1 ? 'var(--bg-tertiary)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: index === items.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: index === items.length - 1 ? 600 : 400,
              cursor: item.onClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              if (item.onClick) {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseOut={(e) => {
              if (index !== items.length - 1) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {index === 0 && <Home size={14} />}
            {item.label}
          </button>
        </div>
      ))}
    </nav>
  );
}
