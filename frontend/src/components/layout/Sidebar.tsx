import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Gamepad2, User } from 'lucide-react';
import type { StudentProfile } from '../../types';

interface SidebarProps {
  profile: StudentProfile | null;
  currentModuleXp?: number;
  moduleXpThreshold?: number;
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/modules', label: 'My Modules', icon: BookOpen },
  { to: '/playground', label: 'Speaking Playground', icon: Gamepad2 },
  { to: '/profile', label: 'Profile', icon: User },
] as const;

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export default function Sidebar({ profile, currentModuleXp = 0, moduleXpThreshold = 500 }: SidebarProps) {
  const xpPct = moduleXpThreshold > 0 ? Math.min((currentModuleXp / moduleXpThreshold) * 100, 100) : 0;
  const initials = profile ? getInitials(profile.name, profile.email) : '??';

  return (
    <aside style={{
      width: 240,
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', fontWeight: 600 }}>
          EnglishAI
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
          Speak. Learn. Level up.
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
              color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-gold-muted)' : 'transparent',
              border: isActive ? '1px solid var(--border-gold)' : '1px solid transparent',
              transition: 'all 200ms var(--ease-out-expo)',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={1.5} style={{ opacity: isActive ? 1 : 0.7 }} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      {profile && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--accent-gold-muted)',
              border: '1.5px solid var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent-gold)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.name ?? profile.email.split('@')[0]}
              </div>
              {profile.placement_band !== null && (
                <div style={{
                  display: 'inline-block',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: 'var(--accent-gold)',
                  background: 'var(--accent-gold-muted)',
                  border: '1px solid rgba(201,168,76,0.3)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '1px 6px',
                  marginTop: 2,
                }}>
                  IELTS {profile.placement_band}
                </div>
              )}
            </div>
          </div>
          {/* XP bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>XP</span>
            <span>{profile.xp_total} total</span>
          </div>
          <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${xpPct}%`,
              background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-gold-bright))',
              borderRadius: 'inherit',
              boxShadow: '0 0 8px var(--accent-gold-glow)',
              transition: 'width 600ms var(--ease-out-expo)',
            }} />
          </div>
        </div>
      )}
    </aside>
  );
}
