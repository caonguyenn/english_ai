import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { EditStudentForm } from '../../components/admin/EditStudentForm';
import type { ModuleResponse } from '../../types';

interface AdminStudentDetail {
  id: number;
  cognito_sub: string;
  name: string | null;
  email: string;
  xp_total: number;
  current_module_id: number | null;
  placement_band: number | null;
  placement_completed_at: string | null;
  created_at: string;
}

interface UpdateStudentPayload {
  xp_total?: number;
  current_module_id?: number;
  placement_band?: number;
}

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState('');

  const { data: student, isLoading: studentLoading } = useQuery<AdminStudentDetail>({
    queryKey: ['admin-student', id],
    queryFn: async () => {
      const res = await api.get<AdminStudentDetail>(`/admin/students/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: modules } = useQuery<ModuleResponse[]>({
    queryKey: ['modules'],
    queryFn: async () => {
      const res = await api.get<ModuleResponse[]>('/modules');
      return res.data;
    },
  });

  const mutation = useMutation<AdminStudentDetail, unknown, UpdateStudentPayload>({
    mutationFn: async (payload) => {
      const res = await api.put<AdminStudentDetail>(`/admin/students/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-student', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      setSuccessMsg('Changes saved successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 403) {
        navigate('/');
      }
    },
  });

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '24px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '4px',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--fg)',
    marginBottom: '16px',
    wordBreak: 'break-all',
  };

  if (studentLoading) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading student…</div>
    );
  }

  if (!student) {
    return (
      <div style={{ color: '#F87171', fontSize: '14px' }}>Student not found.</div>
    );
  }

  const currentModule = modules?.find((m) => m.id === student.current_module_id);

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', fontSize: '14px', color: 'var(--muted)' }}>
        <Link to="/admin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
          Students
        </Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: 'var(--fg)' }}>{student.name ?? student.email}</span>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>
        {student.name ?? <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No name</span>}
      </h1>

      {/* Success toast */}
      {successMsg && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            background: 'rgba(52, 211, 153, 0.12)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            borderRadius: '8px',
            color: '#34D399',
            fontSize: '14px',
          }}
        >
          {successMsg}
        </div>
      )}

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Profile card (read-only) */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Profile</h2>

          <div style={labelStyle}>Email</div>
          <div style={valueStyle}>{student.email}</div>

          <div style={labelStyle}>Cognito Sub</div>
          <div style={{ ...valueStyle, fontFamily: 'var(--mono)', fontSize: '12px' }}>
            {student.cognito_sub}
          </div>

          <div style={labelStyle}>Current Module</div>
          <div style={valueStyle}>
            {currentModule
              ? `${currentModule.order_index}. ${currentModule.title}`
              : <span style={{ color: 'var(--muted)' }}>—</span>}
          </div>

          <div style={labelStyle}>Placement Band</div>
          <div style={valueStyle}>
            {student.placement_band != null ? student.placement_band : <span style={{ color: 'var(--muted)' }}>—</span>}
          </div>

          <div style={labelStyle}>XP Total</div>
          <div style={valueStyle}>{student.xp_total.toLocaleString()}</div>

          <div style={labelStyle}>Joined</div>
          <div style={valueStyle}>{new Date(student.created_at).toLocaleString()}</div>

          {student.placement_completed_at && (
            <>
              <div style={labelStyle}>Placement Completed</div>
              <div style={valueStyle}>{new Date(student.placement_completed_at).toLocaleString()}</div>
            </>
          )}
        </div>

        {/* Edit form */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Edit Student</h2>
          <EditStudentForm
            student={student}
            modules={modules ?? []}
            onSave={(data) => mutation.mutate(data)}
            isSaving={mutation.isPending}
          />
        </div>
      </div>

      {/* Navigation links */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <Link
          to={`/admin/students/${id}/sessions`}
          style={{
            padding: '9px 18px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--fg)',
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          Session History
        </Link>
        <Link
          to={`/admin/students/${id}/audit-log`}
          style={{
            padding: '9px 18px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--fg)',
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          Audit Log
        </Link>
      </div>
    </div>
  );
}
