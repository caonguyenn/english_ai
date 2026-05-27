import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Column } from '../../components/admin/DataTable';

interface SkillScore {
  skill: string;
  score: number;
  notes: string | null;
  recorded_at: string;
}

interface TranscriptEntry {
  role: string;
  content: string;
}

interface AdminSession {
  id: number;
  session_type: string;
  class_id: number | null;
  topic_id: number | null;
  class_title: string | null;
  topic_title: string | null;
  started_at: string;
  ended_at: string | null;
  xp_awarded: number | null;
  transcript_json: TranscriptEntry[] | null;
  skill_scores: SkillScore[];
}

interface AdminSessionsResponse {
  items: AdminSession[];
  total: number;
}

const PAGE_SIZE = 20;

function durationLabel(started: string, ended: string | null): string {
  if (!ended) return '—';
  const ms = new Date(ended).getTime() - new Date(started).getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function ExpandedSession({ session }: { session: AdminSession }) {
  return (
    <tr>
      <td
        colSpan={6}
        style={{
          background: 'var(--surface2)',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Transcript */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Transcript
            </div>
            {session.transcript_json && session.transcript_json.length > 0 ? (
              <div
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  fontFamily: 'var(--mono)',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: 'var(--fg)',
                }}
              >
                {session.transcript_json.map((entry, i) => {
                  const isAI = entry.role?.toUpperCase() === 'ASSISTANT';
                  return (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <span style={{ color: isAI ? 'var(--accent-hi)' : '#34D399', fontWeight: 600 }}>
                        {isAI ? 'AI' : 'Student'}:
                      </span>{' '}
                      <span style={{ color: 'var(--fg)' }}>{entry.content}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>No transcript available</span>
            )}
          </div>

          {/* Skill scores */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Skill Scores
            </div>
            {session.skill_scores.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Skill', 'Score', 'Notes', 'Recorded'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--muted)', fontSize: '11px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {session.skill_scores.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 8px', textTransform: 'capitalize' }}>{s.skill}</td>
                      <td style={{ padding: '6px 8px', color: s.score >= 70 ? '#34D399' : '#F87171', fontWeight: 600 }}>{s.score}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{s.notes ?? '—'}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{new Date(s.recorded_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>No skill scores recorded</span>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function StudentSessions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<AdminSessionsResponse>({
    queryKey: ['admin-student-sessions', id, page],
    queryFn: async () => {
      const res = await api.get<AdminSessionsResponse>(`/admin/students/${id}/sessions`, {
        params: { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
      });
      return res.data;
    },
    enabled: !!id,
    // redirect on 403
    throwOnError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 403) {
        navigate('/');
      }
      return false;
    },
  });

  const columns: Column<AdminSession>[] = [
    {
      key: 'started_at',
      header: 'Date',
      render: (row) => new Date(row.started_at).toLocaleString(),
    },
    {
      key: 'session_type',
      header: 'Type',
      render: (row) => (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            background:
              row.session_type === 'class'
                ? 'rgba(99,102,241,0.2)'
                : row.session_type === 'placement'
                ? 'rgba(251,191,36,0.2)'
                : 'rgba(52,211,153,0.2)',
            color:
              row.session_type === 'class'
                ? '#818CF8'
                : row.session_type === 'placement'
                ? '#FCD34D'
                : '#34D399',
          }}
        >
          {row.session_type}
        </span>
      ),
    },
    {
      key: 'class_title',
      header: 'Class / Topic',
      render: (row) =>
        row.class_title ?? row.topic_title ?? <span style={{ color: 'var(--muted)' }}>—</span>,
    },
    {
      key: 'ended_at',
      header: 'Duration',
      render: (row) => durationLabel(row.started_at, row.ended_at),
    },
    {
      key: 'xp_awarded',
      header: 'XP',
      render: (row) =>
        row.xp_awarded != null ? (
          <span style={{ color: '#FCD34D', fontWeight: 600 }}>+{row.xp_awarded}</span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>—</span>
        ),
    },
    {
      key: 'skill_scores',
      header: 'Scores',
      render: (row) => (
        <span style={{ color: 'var(--muted)' }}>{row.skill_scores.length}</span>
      ),
    },
  ];

  // Custom rendering to support expandable rows — wrap DataTable output manually
  const sessions = data?.items ?? [];

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', fontSize: '14px', color: 'var(--muted)' }}>
        <Link to="/admin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Students</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <Link to={`/admin/students/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Student #{id}</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: 'var(--fg)' }}>Sessions</span>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Session History</h1>

      {/* Expandable table — custom render bypassing DataTable for row expansion */}
      <div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--muted)',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {columns.map((col) => (
                        <td key={col.key} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ height: '14px', borderRadius: '4px', background: 'var(--surface2)' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : sessions.length === 0
                ? (
                  <tr>
                    <td colSpan={columns.length} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                      No sessions found
                    </td>
                  </tr>
                )
                : sessions.map((session) => (
                    <>
                      <tr
                        key={session.id}
                        onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                        style={{ cursor: 'pointer', background: expandedId === session.id ? 'var(--surface2)' : 'var(--surface)' }}
                        className="admin-table-row"
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            style={{
                              padding: '12px 16px',
                              fontSize: '14px',
                              color: 'var(--fg)',
                              borderBottom: expandedId === session.id ? 'none' : '1px solid var(--border)',
                            }}
                          >
                            {col.render ? col.render(session) : String((session as unknown as Record<string, unknown>)[col.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                      {expandedId === session.id && <ExpandedSession key={`exp-${session.id}`} session={session} />}
                    </>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', fontSize: '13px', color: 'var(--muted)' }}>
          <span>
            {data
              ? `Showing ${data.total === 0 ? 0 : page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, data.total)} of ${data.total}`
              : '—'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: page === 0 ? 'var(--muted)' : 'var(--fg)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '13px' }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data || (page + 1) * PAGE_SIZE >= data.total}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: (!data || (page + 1) * PAGE_SIZE >= data.total) ? 'var(--muted)' : 'var(--fg)', cursor: (!data || (page + 1) * PAGE_SIZE >= data.total) ? 'not-allowed' : 'pointer', fontSize: '13px' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
