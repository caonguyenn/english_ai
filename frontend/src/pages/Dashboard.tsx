import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { ArrowRight, Gamepad2, Flame } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import AppShell from '../components/layout/AppShell';
import type { ModuleResponse, SessionResponse } from '../types';

interface ProgressResponse {
  xp_total: number;
  current_module_id: number | null;
  weak_areas: string[];
  skill_averages: Record<string, number>;
}

interface ModulesResponse {
  modules: ModuleResponse[];
  current_module_id?: number | null;
}

const SKILL_COLORS: Record<string, string> = {
  speaking: 'var(--skill-speaking)',
  listening: 'var(--skill-listening)',
  grammar: 'var(--skill-grammar)',
  pronunciation: 'var(--skill-pronunciation)',
};
const SKILLS = ['speaking', 'listening', 'grammar', 'pronunciation'];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function SkeletonBlock({ w = '100%', h = 20 }: { w?: string | number; h?: number }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: modulesData, isLoading: modLoading } = useQuery<ModulesResponse>({
    queryKey: ['modules'],
    queryFn: async () => (await api.get<ModulesResponse>('/modules')).data,
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
  });

  const { data: history, isLoading: histLoading } = useQuery<SessionResponse[]>({
    queryKey: ['history', profile?.id],
    queryFn: async () => (await api.get<SessionResponse[]>(`/students/${profile!.id}/history`)).data,
    enabled: !!profile,
  });

  const { data: progress, isLoading: progLoading } = useQuery<ProgressResponse>({
    queryKey: ['progress', profile?.id],
    queryFn: async () => (await api.get<ProgressResponse>(`/students/${profile!.id}/progress`)).data,
    enabled: !!profile,
  });

  const currentModule = modulesData?.modules?.find(
    (m) => m.id === profile?.current_module_id,
  );

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-animate]', {
        duration: 0.3,
        opacity: 0,
        y: 12,
        ease: 'expo.out',
        stagger: 0.06,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const isLoading = modLoading || histLoading || progLoading;

  return (
    <AppShell pageTitle="Dashboard">
      <div ref={containerRef}>
        {/* Greeting */}
        <div data-animate style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}>
            {greeting()}, {profile?.name ?? profile?.email?.split('@')[0] ?? 'there'}
          </h1>
          <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={18} style={{ color: 'var(--status-warning)' }} />
            Keep the streak alive — practice every day
          </p>
        </div>

        {/* 8+4 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Current module card */}
            <div data-animate>
              {isLoading ? (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                  <SkeletonBlock h={24} w="60%" /><div style={{ height: 12 }} />
                  <SkeletonBlock h={14} w="80%" /><div style={{ height: 16 }} />
                  <SkeletonBlock h={6} /><div style={{ height: 12 }} />
                  <SkeletonBlock h={36} w={160} />
                </div>
              ) : currentModule ? (
                <div style={{
                  background: 'linear-gradient(135deg, var(--bg-surface), rgba(201,168,76,0.05))',
                  border: '1px solid var(--border-gold)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 24,
                  boxShadow: 'var(--shadow-gold)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
                        Current Module
                      </div>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {currentModule.title}
                      </h2>
                    </div>
                    <span style={{
                      background: 'var(--accent-gold-muted)',
                      border: '1px solid var(--border-gold)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--accent-gold)',
                      whiteSpace: 'nowrap',
                    }}>
                      IELTS {currentModule.band_min}–{currentModule.band_max}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                    {currentModule.description}
                  </p>
                  {/* XP bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <span>{profile?.xp_total ?? 0} / {currentModule.xp_threshold} XP</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(((profile?.xp_total ?? 0) / currentModule.xp_threshold) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-gold-bright))',
                        borderRadius: 'inherit',
                        boxShadow: '0 0 8px var(--accent-gold-glow)',
                        transition: 'width 600ms var(--ease-out-expo)',
                      }} />
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/modules/${currentModule.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px',
                      background: 'var(--accent-gold)',
                      border: 'none', borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-inverse)', fontSize: 14, fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Continue Learning <ArrowRight size={16} strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 24,
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}>
                  No active module — complete your placement first.
                </div>
              )}
            </div>

            {/* Recent sessions */}
            <div data-animate>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Recent Sessions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between' }}>
                      <SkeletonBlock h={16} w="50%" /><SkeletonBlock h={16} w={60} />
                    </div>
                  ))
                  : (history ?? []).slice(0, 5).map((s) => (
                    <SessionRow key={s.id} session={s} />
                  ))
                }
                {!isLoading && (history ?? []).length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>
                    No sessions yet. Start your first one!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Skill bars */}
            <div data-animate style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Skill Performance
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {SKILLS.map((skill) => {
                  const score = progress?.skill_averages?.[skill] ?? 0;
                  return (
                    <div key={skill}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{skill}</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: SKILL_COLORS[skill] }}>
                          {isLoading ? '—' : `${Math.round(score)}/100`}
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                        {!isLoading && (
                          <div style={{
                            height: '100%',
                            width: `${score}%`,
                            background: SKILL_COLORS[skill],
                            borderRadius: 'inherit',
                            animation: 'bar-grow 0.9s ease 0.2s both',
                          }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick actions */}
            <div data-animate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => navigate('/playground')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'var(--accent-teal-muted)',
                  border: '1px solid rgba(45,212,191,0.2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 18px',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <Gamepad2 size={20} strokeWidth={1.5} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Speaking Playground</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Jump into free talk →</div>
                </div>
              </button>
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 18px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Today's Goal
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Complete 1 class · earn 80 XP</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SessionRow({ session }: { session: SessionResponse }) {
  const label = session.session_type === 'class' ? 'Class'
    : session.session_type === 'playground' ? 'Playground'
    : 'Placement';

  const typeColor = session.session_type === 'class' ? 'var(--skill-speaking)'
    : session.session_type === 'playground' ? 'var(--accent-teal)'
    : 'var(--skill-grammar)';

  const date = new Date(session.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      transition: 'background 200ms',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
          background: `${typeColor}20`,
          border: `1px solid ${typeColor}50`,
          borderRadius: 'var(--radius-pill)',
          padding: '2px 8px',
          color: typeColor,
        }}>
          {label}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{date}</span>
      </div>
      {session.xp_awarded !== null && session.xp_awarded > 0 && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent-gold)',
        }}>
          +{session.xp_awarded} XP
        </span>
      )}
    </div>
  );
}
