import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { ArrowRight, Lock, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import AppShell from '../../components/layout/AppShell';
import type { ModuleWithProgress } from '../../types';

function SkeletonCard() {
  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', height: 150 }}>
      <div className="skeleton" style={{ width: '40%', height: 16 }} /><div style={{ height: 12 }} />
      <div className="skeleton" style={{ width: '70%', height: 22 }} /><div style={{ height: 10 }} />
      <div className="skeleton" style={{ width: '90%', height: 14 }} />
    </div>
  );
}

export default function ModulesList() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: modules, isLoading } = useQuery<ModuleWithProgress[]>({
    queryKey: ['modules'],
    queryFn: async () => (await api.get<ModuleWithProgress[]>('/modules')).data,
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-animate]', {
        duration: 0.3, opacity: 0, y: 12,
        ease: 'expo.out', stagger: 0.06,
      });
    }, containerRef);
    return () => ctx.revert();
  }, [modules]);

  const currentOrder = modules?.find((m) => m.id === profile?.current_module_id)?.order_index ?? 0;

  return (
    <AppShell pageTitle="My Modules">
      <div ref={containerRef}>
        <div data-animate style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Learning Path
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
            Progress through each module as your IELTS band improves.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : (modules ?? []).map((m) => {
              const isCurrent = m.id === profile?.current_module_id;
              const isLocked = currentOrder > 0 && m.order_index > currentOrder;
              const isPast = currentOrder > 0 && m.order_index < currentOrder;
              return (
                <ModuleCard
                  key={m.id}
                  module={m}
                  isCurrent={isCurrent}
                  isLocked={isLocked}
                  isPast={isPast}
                  onOpen={() => navigate(`/modules/${m.id}`)}
                />
              );
            })}
        </div>
      </div>
    </AppShell>
  );
}

interface ModuleCardProps {
  module: ModuleWithProgress;
  isCurrent: boolean;
  isLocked: boolean;
  isPast: boolean;
  onOpen: () => void;
}

function ModuleCard({ module, isCurrent, isLocked, isPast, onOpen }: ModuleCardProps) {
  const border = isCurrent ? 'var(--border-gold)' : 'var(--border-subtle)';
  const xpPct = module.xp_threshold > 0
    ? Math.min((module.xp_earned / module.xp_threshold) * 100, 100)
    : 0;

  return (
    <div
      data-animate
      onClick={isLocked ? undefined : onOpen}
      style={{
        background: isCurrent
          ? 'linear-gradient(135deg, var(--bg-surface), rgba(201,168,76,0.05))'
          : 'var(--bg-surface)',
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.55 : 1,
        boxShadow: isCurrent ? 'var(--shadow-gold)' : 'none',
        transition: 'border-color 200ms, box-shadow 200ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 500,
          background: 'var(--accent-gold-muted)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-pill)',
          padding: '2px 10px',
          color: 'var(--accent-gold)',
          whiteSpace: 'nowrap',
        }}>
          IELTS {module.band_min}–{module.band_max}
        </span>
        {isCurrent && (
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>
            Current
          </span>
        )}
        {isPast && <CheckCircle size={16} strokeWidth={1.5} style={{ color: 'var(--status-success)', marginLeft: 'auto' }} />}
        {isLocked && <Lock size={15} strokeWidth={1.5} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />}
      </div>

      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        {module.title}
      </h3>
      {module.description && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
          {module.description}
        </p>
      )}

      {!isLocked && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>{module.xp_earned} / {module.xp_threshold} XP</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(xpPct)}%</span>
          </div>
          <div style={{ height: 5, background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{
              height: '100%', width: `${xpPct}%`,
              background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-gold-bright))',
              borderRadius: 'inherit',
              transition: 'width 600ms var(--ease-out-expo)',
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            {isCurrent ? 'Continue' : isPast ? 'Review' : 'Open'} <ArrowRight size={14} strokeWidth={1.5} />
          </div>
        </>
      )}
      {isLocked && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Unlocks as you level up
        </span>
      )}
    </div>
  );
}
