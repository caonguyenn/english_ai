import { NavLink } from 'react-router-dom';

export function AdminNav() {
  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: 'block',
    padding: '8px 16px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '14px',
    color: isActive ? 'var(--fg)' : 'var(--muted)',
    background: isActive ? 'var(--surface3)' : 'transparent',
    fontWeight: isActive ? 600 : 400,
  });

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '200px',
        height: '100vh',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        zIndex: 100,
      }}
    >
      <div style={{ marginBottom: '24px', padding: '0 4px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '4px' }}>
          EnglishAI
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)' }}>
          Admin Panel
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <NavLink to="/admin" end style={navLinkStyle}>
          Students
        </NavLink>
      </nav>

      <NavLink
        to="/dashboard"
        style={{
          display: 'block',
          padding: '8px 16px',
          borderRadius: '6px',
          textDecoration: 'none',
          fontSize: '13px',
          color: 'var(--muted)',
          borderTop: '1px solid var(--border)',
          paddingTop: '16px',
          marginTop: '8px',
        }}
      >
        ← Back to App
      </NavLink>
    </aside>
  );
}
