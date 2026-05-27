import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import AppShell from '../../components/layout/AppShell';
import type { ModuleResponse, ClassResponse } from '../../types';

const SKILL_COLORS: Record<string, string> = {
  speaking: 'var(--skill-speaking)',
  listening: 'var(--skill-listening)',
  grammar: 'var(--skill-grammar)',
  pronunciation: 'var(--skill-pronunciation)',
};

function SkeletonBlock({ w = '100%', h = 20 }: { w?: string | number; h?: number }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}

export default function ModulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: module, isLoading: modLoading } = useQuery<ModuleResponse>({
    queryKey: ['module', id],
    queryFn: async () => (await api.get<ModuleResponse>(`/modules/${id}`)).data,
    enabled: !!id,
  });

  const { data: classes, isLoading: classLoading } = useQuery<ClassResponse[]>({
    queryKey: ['classes', id],
    queryFn: async () => (await api.get<ClassResponse[]>(`/modules/${id}/classes`)).data,
    enabled: !!id,
  });

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-animate]', {
        duration: 0.3, opacity: 0, y: 12,
        ease: 'expo.out', stagger: 0.06,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const completedCount = (classes ?? []).filter((c) => c.completed).length;
  const totalCount = (classes ?? []).length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isLoading = modLoading || classLoading;

  return (
    <AppShell pageTitle={module?.title ?? 'Module'}>
      <div ref={containerRef}>
        {/* Header */}
        <div data-animate style={{ marginBottom: 32 }}>
          {isLoading ? (
            <>
              <SkeletonBlock h={36} w="50%" /><div style={{ height: 10 }} />
              <SkeletonBlock h={16} w="70%" />
            </>
          ) : module ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {module.title}
                </h1>
                <span style={{
                  background: 'var(--accent-gold-muted)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--accent-gold)',
                  whiteSpace: 'nowrap',
                }}>
                  IELTS {module.band_min} – {module.band_max}
                </span>
              </div>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 600, marginBottom: 20 }}>
                {module.description}
              </p>

              {/* Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <span>{completedCount} of {totalCount} classes complete</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(progressPct)}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', maxWidth: 400 }}>
                  <div style={{
                    height: '100%', width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-gold-bright))',
                    borderRadius: 'inherit',
                    boxShadow: '0 0 8px var(--accent-gold-glow)',
                    transition: 'width 600ms var(--ease-out-expo)',
                  }} />
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Class cards grid */}
        <div data-animate style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', height: 140 }}>
                <SkeletonBlock h={16} w="40%" /><div style={{ height: 10 }} />
                <SkeletonBlock h={20} w="70%" /><div style={{ height: 8 }} />
                <SkeletonBlock h={14} w="90%" />
              </div>
            ))
            : (classes ?? []).map((cls) => (
              <ClassCard key={cls.id} cls={cls} onStart={() => navigate(`/class/${cls.id}`)} />
            ))
          }
        </div>
      </div>
    </AppShell>
  );
}

function ClassCard({ cls, onStart }: { cls: ClassResponse; onStart: () => void }) {
  const skillColor = SKILL_COLORS[cls.skill_type] ?? 'var(--accent-gold)';

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderLeft: `3px solid ${skillColor}`,
      borderRadius: `0 var(--radius-lg) var(--radius-lg) 0`,
      padding: '20px 24px',
      opacity: cls.completed ? 0.65 : 1,
      transition: 'box-shadow 200ms, border-color 200ms',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
          background: `${skillColor}20`,
          border: `1px solid ${skillColor}50`,
          borderRadius: 'var(--radius-pill)',
          padding: '2px 8px',
          color: skillColor,
        }}>
          {cls.skill_type}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          background: 'var(--accent-gold-muted)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 'var(--radius-pill)',
          padding: '2px 8px',
          color: 'var(--accent-gold)',
        }}>
          +{cls.xp_reward} XP
        </span>
        {cls.completed && (
          <CheckCircle size={16} strokeWidth={1.5} style={{ color: 'var(--status-success)', marginLeft: 'auto' }} />
        )}
      </div>

      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
        {cls.title}
      </h3>
      <p style={{
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        marginBottom: 16,
      }}>
        {cls.description}
      </p>

      {cls.completed ? (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Completed</span>
      ) : (
        <button
          onClick={onStart}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-pill)',
            padding: '7px 16px',
            color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
            transition: 'border-color 200ms, color 200ms',
          }}
        >
          Start Class <ArrowRight size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

export function WeakAreasCallout({ areas }: { areas: string[] }) {
  if (!areas.length) return null;
  return (
    <div style={{
      background: 'rgba(251,191,36,0.08)',
      border: '1px solid rgba(251,191,36,0.2)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <AlertTriangle size={16} strokeWidth={1.5} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Your recent scores suggest focusing on:{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{areas.join(', ')}</strong>
      </p>
    </div>
  );
}
