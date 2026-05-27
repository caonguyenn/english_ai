import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { DataTable } from '../../components/admin/DataTable';
import { SearchBar } from '../../components/admin/SearchBar';
import type { Column } from '../../components/admin/DataTable';
import type { ModuleResponse } from '../../types';

interface AdminStudent {
  id: number;
  name: string | null;
  email: string;
  current_module_id: number | null;
  placement_band: number | null;
  xp_total: number;
  created_at: string;
}

interface AdminStudentsResponse {
  items: AdminStudent[];
  total: number;
}

const PAGE_SIZE = 20;

export default function StudentList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const page = parseInt(searchParams.get('page') ?? '0', 10);
  const moduleFilter = searchParams.get('module_id') ?? '';
  const bandMin = searchParams.get('band_min') ?? '';
  const bandMax = searchParams.get('band_max') ?? '';

  const { data: studentsData, isLoading: studentsLoading } = useQuery<AdminStudentsResponse>({
    queryKey: ['admin-students', q, page, moduleFilter, bandMin, bandMax],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (q) params.q = q;
      if (moduleFilter) params.module_id = moduleFilter;
      if (bandMin) params.band_min = bandMin;
      if (bandMax) params.band_max = bandMax;
      const res = await api.get<AdminStudentsResponse>('/admin/students', { params });
      return res.data;
    },
  });

  const { data: modulesData } = useQuery<ModuleResponse[]>({
    queryKey: ['modules'],
    queryFn: async () => {
      const res = await api.get<ModuleResponse[]>('/modules');
      return res.data;
    },
  });

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      if (key !== 'page') next.set('page', '0');
      return next;
    });
  };

  const handleSearch = useCallback((query: string) => {
    setParam('q', query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: Column<AdminStudent>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => row.name ?? <span style={{ color: 'var(--muted)' }}>—</span>,
    },
    { key: 'email', header: 'Email' },
    {
      key: 'current_module_id',
      header: 'Module',
      render: (row) => {
        if (!row.current_module_id || !modulesData) return <span style={{ color: 'var(--muted)' }}>—</span>;
        const mod = modulesData.find((m) => m.id === row.current_module_id);
        return mod ? `${mod.order_index}. ${mod.title}` : String(row.current_module_id);
      },
    },
    {
      key: 'placement_band',
      header: 'Band',
      render: (row) => row.placement_band != null
        ? String(row.placement_band)
        : <span style={{ color: 'var(--muted)' }}>—</span>,
    },
    {
      key: 'xp_total',
      header: 'XP',
      render: (row) => row.xp_total.toLocaleString(),
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  const sortedModules = [...(modulesData ?? [])].sort((a, b) => a.order_index - b.order_index);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Students</h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
          {studentsData ? `${studentsData.total.toLocaleString()} total` : 'Loading…'}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <SearchBar
          placeholder="Search name or email…"
          onSearch={handleSearch}
          initialValue={q}
        />

        <select
          value={moduleFilter}
          onChange={(e) => setParam('module_id', e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: moduleFilter ? 'var(--fg)' : 'var(--muted)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <option value="">All Modules</option>
          {sortedModules.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.order_index}. {m.title}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="number"
            min={0}
            max={9}
            step={0.5}
            placeholder="Band min"
            value={bandMin}
            onChange={(e) => setParam('band_min', e.target.value)}
            style={{
              width: '100px',
              padding: '8px 10px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--fg)',
              fontSize: '14px',
            }}
          />
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>–</span>
          <input
            type="number"
            min={0}
            max={9}
            step={0.5}
            placeholder="Band max"
            value={bandMax}
            onChange={(e) => setParam('band_max', e.target.value)}
            style={{
              width: '100px',
              padding: '8px 10px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--fg)',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={studentsData?.items ?? []}
        total={studentsData?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={(p) => setParam('page', String(p))}
        onRowClick={(row) => navigate(`/admin/students/${row.id}`)}
        isLoading={studentsLoading}
      />
    </div>
  );
}
