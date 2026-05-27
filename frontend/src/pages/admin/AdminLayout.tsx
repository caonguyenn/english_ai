import { Outlet } from 'react-router-dom';
import { AdminNav } from '../../components/admin/AdminNav';

export default function AdminLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <AdminNav />
      <main
        style={{
          flex: 1,
          padding: '32px',
          marginLeft: '200px',
          color: 'var(--fg)',
          overflowY: 'auto',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
