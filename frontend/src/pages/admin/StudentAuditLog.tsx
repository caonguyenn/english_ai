import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface AuditLogEntry {
  id: string;
  from_module_id: string | null;
  to_module_id: string;
  from_module_title: string | null;
  to_module_title: string | null;
  session_id: string | null;
  reason_text: string;
  evidence_json: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
}

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: '32px',
        paddingBottom: '28px',
      }}
    >
      {/* Timeline dot */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: '4px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: 'var(--accent)',
          border: '2px solid var(--bg)',
          zIndex: 1,
        }}
      />

      {/* Entry card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '16px 20px',
        }}
      >
        {/* Date */}
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
          {new Date(entry.created_at).toLocaleString()}
        </div>

        {/* Promotion label */}
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>
          {entry.from_module_title
            ? <>Promoted from <span style={{ color: 'var(--accent-hi)' }}>{entry.from_module_title}</span> to <span style={{ color: '#34D399' }}>{entry.to_module_title ?? `Module #${entry.to_module_id}`}</span></>
            : <>Placed into <span style={{ color: '#34D399' }}>{entry.to_module_title ?? `Module #${entry.to_module_id}`}</span></>}
        </div>

        {/* Reason */}
        <div style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic', marginBottom: entry.evidence_json || entry.session_id ? '12px' : 0 }}>
          "{entry.reason_text}"
        </div>

        {/* Session link */}
        {entry.session_id && (
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
            Session:{' '}
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--fg)' }}>
              #{entry.session_id}
            </span>
          </div>
        )}

        {/* Evidence collapsible */}
        {entry.evidence_json && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '12px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              >
                ▶
              </span>
              Evidence JSON
            </button>

            {expanded && (
              <pre
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'var(--surface2)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--fg)',
                  fontFamily: 'var(--mono)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(entry.evidence_json, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentAuditLog() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<AuditLogResponse>({
    queryKey: ['admin-student-audit-log', id],
    queryFn: async () => {
      const res = await api.get<AuditLogResponse>(`/admin/students/${id}/audit-log`);
      return res.data;
    },
    enabled: !!id,
    throwOnError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 403) {
        navigate('/');
      }
      return false;
    },
  });

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', fontSize: '14px', color: 'var(--muted)' }}>
        <Link to="/admin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Students</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <Link to={`/admin/students/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Student #{id}</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: 'var(--fg)' }}>Audit Log</span>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '32px' }}>Level-Up Audit Log</h1>

      {isLoading && (
        <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading audit log…</div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
          }}
        >
          No level-up events recorded yet.
        </div>
      )}

      {data && data.items.length > 0 && (
        <div
          style={{
            position: 'relative',
            maxWidth: '680px',
          }}
        >
          {/* Connecting vertical line */}
          <div
            style={{
              position: 'absolute',
              left: '5px',
              top: '10px',
              bottom: '28px',
              width: '2px',
              background: 'var(--border)',
            }}
          />

          {data.items.map((entry) => (
            <AuditEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
