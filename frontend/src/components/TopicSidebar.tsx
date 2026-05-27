import type { TopicId } from '../types';

interface Topic {
  id: TopicId;
  label: string;
  icon: string;
  sessions: number;
}

const TOPICS: Topic[] = [
  { id: 'daily',      label: 'Daily English',    icon: '☀️', sessions: 24 },
  { id: 'interview',  label: 'Job Interview',    icon: '💼', sessions: 18 },
  { id: 'devops',     label: 'DevOps English',   icon: '⚙️', sessions: 12 },
  { id: 'travel',     label: 'Travel',           icon: '✈️', sessions: 8  },
  { id: 'ielts',      label: 'IELTS Prep',       icon: '📝', sessions: 6  },
  { id: 'small-talk', label: 'Small Talk',       icon: '💬', sessions: 15 },
  { id: 'business',   label: 'Business English', icon: '📊', sessions: 9  },
];

interface Props {
  activeTopic: TopicId;
  onSelect: (id: TopicId) => void;
  sessionSeconds: number;
  streak: number;
  totalMinutes: number;
  wordsLearned: number;
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function TopicSidebar({
  activeTopic,
  onSelect,
  sessionSeconds,
  streak,
  totalMinutes,
  wordsLearned,
}: Props) {
  return (
    <aside style={{
      width: 220,
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-surface)',
      flexShrink: 0,
    }}>
      {/* Practice Topics */}
      <div style={{ padding: '16px 12px 12px', overflowY: 'auto', flex: 1 }}>
        <p style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          padding: '0 4px',
          marginBottom: 8,
        }}>
          Topics
        </p>
        {TOPICS.map((t) => (
          <div
            key={t.id}
            className={`topic-card ${activeTopic === t.id ? 'active' : ''}`}
            onClick={() => onSelect(t.id)}
            role="button"
            tabIndex={0}
            aria-pressed={activeTopic === t.id}
            aria-label={`Select topic: ${t.label}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id); } }}
          >
            <div className="topic-icon">{t.icon}</div>
            <div>
              <div style={{
                fontWeight: 500,
                lineHeight: 1.2,
                color: activeTopic === t.id ? 'var(--accent-gold)' : 'var(--text-primary)',
                fontSize: 13,
              }}>
                {t.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {t.sessions} sessions
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div style={{
        padding: '12px 12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        {/* Streak badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 10,
          background: 'var(--accent-gold-muted)',
          border: '1px solid var(--border-gold)',
        }}>
          <span style={{ fontSize: 18 }}>🔥</span>
          <div>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent-gold-bright)',
            }}>
              {streak}-day streak
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keep it up!</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="stat-mini">
            <div className="stat-mini-val">{fmtTime(sessionSeconds)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Session</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">{totalMinutes}m</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Total</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">{wordsLearned}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Words</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">{streak}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Streak</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
