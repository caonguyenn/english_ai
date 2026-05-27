import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';

interface TopBarProps {
  pageTitle: string;
}

export default function TopBar({ pageTitle }: TopBarProps) {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = profile
    ? (profile.name ?? profile.email).slice(0, 2).toUpperCase()
    : '??';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() {
    signOut();
    navigate('/auth/login', { replace: true });
  }

  return (
    <header style={{
      height: 64,
      background: 'transparent',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(8px)',
    }}>
      <h1 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
      }}>
        {pageTitle}
      </h1>

      {/* Avatar menu */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 12px 6px 6px',
            cursor: 'pointer',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--accent-gold-muted)',
            border: '1.5px solid var(--accent-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--accent-gold)',
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {profile?.name ?? profile?.email?.split('@')[0] ?? 'Account'}
          </span>
          <ChevronDown size={14} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 160,
            overflow: 'hidden',
          }}>
            <button
              onClick={() => { navigate('/profile'); setMenuOpen(false); }}
              style={menuItemStyle}
            >
              <User size={14} strokeWidth={1.5} />
              Profile
            </button>
            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
            <button onClick={handleLogout} style={{ ...menuItemStyle, color: 'var(--status-error)' }}>
              <LogOut size={14} strokeWidth={1.5} />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '10px 16px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  textAlign: 'left',
};
