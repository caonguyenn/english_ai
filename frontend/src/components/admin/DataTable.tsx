import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
}

const skeletonStyle: React.CSSProperties = {
  height: '14px',
  borderRadius: '4px',
  background: 'linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.4s infinite',
};

export function DataTable<T extends object>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onRowClick,
  isLoading,
}: DataTableProps<T>) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '14px',
    color: 'var(--fg)',
    borderBottom: '1px solid var(--border)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .admin-table-row:hover {
          background: var(--surface3) !important;
        }
      `}</style>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={thStyle}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={col.key} style={tdStyle}>
                        <div style={skeletonStyle} />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
              ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', padding: '40px 16px' }}
                  >
                    No results found
                  </td>
                </tr>
              )
              : data.map((row, i) => (
                  <tr
                    key={i}
                    className={onRowClick ? 'admin-table-row' : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      background: 'var(--surface)',
                    }}
                  >
                    {columns.map((col) => {
                      const value = col.render
                        ? col.render(row)
                        : (row as Record<string, unknown>)[col.key] as React.ReactNode;
                      return (
                        <td key={col.key} style={tdStyle}>{value}</td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 4px',
          fontSize: '13px',
          color: 'var(--muted)',
        }}
      >
        <span>
          {total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0 || isLoading}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: page === 0 ? 'var(--muted)' : 'var(--fg)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            Prev
          </button>
          <span style={{ color: 'var(--muted)', minWidth: '60px', textAlign: 'center' }}>
            {totalPages === 0 ? '—' : `${page + 1} / ${totalPages}`}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1 || isLoading}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: page >= totalPages - 1 ? 'var(--muted)' : 'var(--fg)',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
