import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { api, getStreak, getAchievements, getVocabulary } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import AppShell from '../../components/layout/AppShell';
import { StreakFlame } from '../../components/gamification/StreakFlame';
import { AchievementsGrid } from '../../components/gamification/AchievementsGrid';
import { VocabularyGrowthWidget } from '../../components/vocab/VocabularyGrowthWidget';
import type { Streak, Achievement, VocabularyWord } from '../../types';

interface ProgressResponse {
  xp_total: number;
  current_module_id: string | null;
  weak_areas: string[];
  skill_averages: Record<string, number>;
  total_sessions: number;
  current_streak: number;
}

interface AuditEntry {
  id: string;
  from_module_id: string | null;
  to_module_id: string;
  reason_text: string;
  created_at: string;
  from_module_title?: string;
  to_module_title?: string;
}

const SKILL_COLORS: Record<string, string> = {
  speaking:      'var(--skill-speaking)',
  listening:     'var(--skill-listening)',
  grammar:       'var(--skill-grammar)',
  pronunciation: 'var(--skill-pronunciation)',
};

const SKILLS = ['speaking', 'listening', 'grammar', 'pronunciation'];

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return email.slice(0, 2).toUpperCase();
}

function SkeletonBlock({ w = '100%', h = 20 }: { w?: string | number; h?: number }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}

export default function ProfilePage() {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [editName, setEditName] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: progress, isLoading: progLoading } = useQuery<ProgressResponse>({
    queryKey: ['progress', profile?.id],
    queryFn: async () => (await api.get<ProgressResponse>(`/students/${profile!.id}/progress`)).data,
    enabled: !!profile,
  });

  const { data: auditLog, isLoading: auditLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit-log', profile?.id],
    queryFn: async () => (await api.get<AuditEntry[]>(`/students/${profile!.id}/audit-log`)).data,
    enabled: !!profile,
  });

  const { data: streak } = useQuery<Streak>({
    queryKey: ['streak', profile?.id],
    queryFn: () => getStreak(profile!.id) as Promise<Streak>,
    enabled: !!profile?.id,
  });

  const { data: achievements } = useQuery<Achievement[]>({
    queryKey: ['achievements', profile?.id],
    queryFn: () => getAchievements(profile!.id) as Promise<Achievement[]>,
    enabled: !!profile?.id,
  });

  const { data: vocab } = useQuery<VocabularyWord[]>({
    queryKey: ['vocabulary', profile?.id],
    queryFn: () => getVocabulary(profile!.id) as Promise<VocabularyWord[]>,
    enabled: !!profile?.id,
  });

  const totalWords = vocab?.length ?? 0;
  const masteredWords = vocab?.filter((v) => v.mastery_score >= 80).length ?? 0;

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-animate]', {
        duration: 0.3, opacity: 0, y: 12,
        ease: 'expo.out', stagger: 0.06,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !editName.trim()) return;
    setSaving(true);
    try {
      await api.put(`/students/${profile.id}`, { name: editName.trim() });
      setProfile({ ...profile, name: editName.trim() });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditOpen(false);
    } catch {
      // show error in future
    } finally {
      setSaving(false);
    }
  }

  const isLoading = progLoading || auditLoading;
  const initials = profile ? getInitials(profile.name, profile.email) : '??';
  const memberSince = profile
    ? new Date(/* no created_at in profile type; use placement date or now */
        Date.now()
      ).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : '—';

  return (
    <AppShell pageTitle="Profile">
      <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* LEFT */}
        <div data-animate style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Avatar + identity */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-gold-muted), rgba(45,212,191,0.1))',
                border: '2px solid var(--accent-gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, color: 'var(--accent-gold)',
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {profile?.name ?? profile?.email?.split('@')[0] ?? '—'}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>
                  Member since {memberSince}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {profile?.email}
                </p>
              </div>
            </div>

            {/* Stats 2x2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Total Sessions', value: isLoading ? '—' : String(progress?.total_sessions ?? 0) },
                { label: 'Total XP', value: isLoading ? '—' : String(profile?.xp_total ?? 0) },
                { label: 'Streak', value: isLoading ? '—' : `${progress?.current_streak ?? 0} days` },
                { label: 'IELTS Band', value: profile?.placement_band != null ? String(profile.placement_band) : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.875rem',
                    fontWeight: 700,
                    color: 'var(--accent-gold)',
                    lineHeight: 1,
                    marginBottom: 6,
                  }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit profile */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => { setEditOpen((v) => !v); setEditName(profile?.name ?? ''); }}
              style={{
                width: '100%', padding: '16px 20px',
                background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14, fontWeight: 500,
              }}
            >
              Edit Profile
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{editOpen ? '▲' : '▼'}</span>
            </button>
            {editOpen && (
              <form onSubmit={(e) => { void handleSaveName(e); }} style={{ padding: '0 20px 20px' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Display name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                    padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14,
                    fontFamily: 'var(--font-body)', marginBottom: 12, boxSizing: 'border-box',
                  }}
                />
                <button
                  type="submit" disabled={saving}
                  style={{
                    padding: '9px 20px', background: 'var(--accent-gold)',
                    border: 'none', borderRadius: 'var(--radius-pill)',
                    color: 'var(--text-inverse)', fontSize: 13, fontWeight: 500,
                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div data-animate style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Level journey */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
              Level Journey
            </h3>
            {auditLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} h={56} />)}
              </div>
            ) : (auditLog ?? []).length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                No level-ups yet. Keep practicing!
              </p>
            ) : (
              <div style={{ position: 'relative' }}>
                {(auditLog ?? []).slice(0, 5).map((entry, idx) => (
                  <AuditEntry key={entry.id} entry={entry} isFirst={idx === 0} />
                ))}
              </div>
            )}
          </div>

          {/* Skill performance */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
              Skill Performance
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {SKILLS.map((skill) => {
                const score = progress?.skill_averages?.[skill] ?? 0;
                const pct = Math.round(score);
                return (
                  <div key={skill}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{skill}</span>
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: SKILL_COLORS[skill] }}>
                        {isLoading ? '—' : `${pct}%`}
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                      {!isLoading && (
                        <div style={{
                          height: '100%', width: `${pct}%`,
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

          {/* Streak */}
          {streak && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Streak
              </h3>
              <StreakFlame currentLen={streak.current_len} longestLen={streak.longest_len} />
            </div>
          )}

          {/* Achievements */}
          {achievements && achievements.length > 0 && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Achievements
              </h3>
              <AchievementsGrid achievements={achievements} />
            </div>
          )}

          {/* Vocabulary Growth (Phase 5) */}
          <div>
            <VocabularyGrowthWidget totalWords={totalWords} masteredWords={masteredWords} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function AuditEntry({ entry, isFirst }: { entry: AuditEntry; isFirst: boolean }) {
  const date = new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20, position: 'relative' }}>
      {/* Timeline dot */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: isFirst ? 'var(--accent-gold)' : 'var(--border-strong)',
          border: isFirst ? '2px solid var(--accent-gold)' : '2px solid var(--border-default)',
          animation: isFirst ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          marginTop: 2,
        }} />
        <div style={{ width: 2, flex: 1, background: 'var(--border-subtle)', marginTop: 4 }} />
      </div>

      <div style={{ flex: 1, paddingBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          Module {entry.from_module_id} → Module {entry.to_module_id}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{date}</div>
        {entry.reason_text && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
            {entry.reason_text}
          </p>
        )}
      </div>
    </div>
  );
}
