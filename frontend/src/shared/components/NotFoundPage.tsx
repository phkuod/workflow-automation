import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '1rem',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)',
    }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>
        Page not found
      </p>
      <Link
        to="/dashboard"
        style={{
          padding: '0.5rem 1.5rem',
          borderRadius: '8px',
          background: 'var(--accent-primary)',
          color: 'white',
          textDecoration: 'none',
          fontSize: '0.875rem',
        }}
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
