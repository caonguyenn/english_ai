import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import AppShell from '../../components/layout/AppShell';
import type { PlaygroundTopic } from '../../types';

const TOPIC_EMOJIS: Record<string, string> = {
  'nature-environment':   '🌿',
  'family-relationships': '👨‍👩‍👧',
  'travel-places':        '✈️',
  'technology-science':   '🔬',
  'food-culture':         '🍜',
  'current-events':       '📰',
  'health-wellbeing':     '💚',
  'sports-hobbies':       '🏄',
  'work-career':          '💼',
  'animals-wildlife':     '🦋',
};

const DIFFICULTY_LABELS: Record<number, string> = {
  0: 'All levels',
  4: 'Band 4+',
  5: 'Band 5+',
  6: 'Band 6+',
  7: 'Band 7+',
};

function difficultyLabel(band: number): string {
  return DIFFICULTY_LABELS[Math.floor(band)] ?? `Band ${band}+`;
}

function SkeletonCard() {
  return (
    <div className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-xl)' }} />
  );
}

export default function PlaygroundHome() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: topics, isLoading } = useQuery<PlaygroundTopic[]>({
    queryKey: ['topics'],
    queryFn: async () => (await api.get<PlaygroundTopic[]>('/playground/topics')).data,
    staleTime: 10 * 60 * 1000,
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

  return (
    <AppShell pageTitle="Speaking Playground">
      <div ref={containerRef}>
        {/* Header */}
        <div data-animate style={{ marginBottom: 36 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}>
            Speaking Playground
          </h1>
          <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
            Choose a topic. Just talk. No pressure.
          </p>
        </div>

        {/* Topic grid */}
        <div data-animate style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : (topics ?? []).map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onSelect={() => navigate(`/playground/${topic.slug}`)}
              />
            ))
          }
        </div>
      </div>
    </AppShell>
  );
}

function TopicCard({ topic, onSelect }: { topic: PlaygroundTopic; onSelect: () => void }) {
  const emoji = TOPIC_EMOJIS[topic.slug] ?? '💬';

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 24px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 250ms var(--ease-out-expo)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--border-gold)';
        el.style.boxShadow = 'var(--shadow-gold)';
        el.style.transform = 'translateY(-2px)';
        el.style.background = 'linear-gradient(135deg, var(--bg-surface), rgba(201,168,76,0.03))';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--border-subtle)';
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0)';
        el.style.background = 'var(--bg-surface)';
      }}
    >
      {/* Decorative emoji bg */}
      <div style={{
        position: 'absolute',
        top: 12, right: 16,
        fontSize: 48,
        opacity: 0.12,
        transform: 'rotate(15deg)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {emoji}
      </div>

      <div style={{ fontSize: 36, marginBottom: 12 }}>{emoji}</div>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 8,
        lineHeight: 1.3,
      }}>
        {topic.title}
      </h3>
      <p style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        marginBottom: 20,
      }}>
        {topic.description}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          background: 'var(--accent-teal-muted)',
          border: '1px solid rgba(45,212,191,0.2)',
          borderRadius: 'var(--radius-pill)',
          padding: '2px 10px',
          color: 'var(--accent-teal)',
        }}>
          {difficultyLabel(topic.difficulty_band)}
        </span>
        <ArrowRight
          size={16}
          strokeWidth={1.5}
          style={{ color: 'var(--text-secondary)', transition: 'transform 250ms var(--ease-out-expo)' }}
        />
      </div>
    </div>
  );
}
