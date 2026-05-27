import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { ModuleResponse } from '../../types';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

interface ModulesResponse {
  modules: ModuleResponse[];
  current_module_id?: number | null;
}

export default function AppShell({ children, pageTitle = '' }: AppShellProps) {
  const profile = useAuthStore((s) => s.profile);

  const { data: modulesData } = useQuery<ModulesResponse>({
    queryKey: ['modules'],
    queryFn: async () => {
      const res = await api.get<ModulesResponse>('/modules');
      return res.data;
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
  });

  const currentModule = modulesData?.modules?.find(
    (m) => m.id === profile?.current_module_id,
  );

  return (
    <>
      <Sidebar
        profile={profile}
        currentModuleXp={0}
        moduleXpThreshold={currentModule?.xp_threshold ?? 500}
      />

      {/* Main content */}
      <div style={{
        marginLeft: 240,
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <TopBar pageTitle={pageTitle} />

        <main style={{
          flex: 1,
          padding: 32,
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}>
          {children}
        </main>
      </div>

      {/* Mobile: simple bottom bar */}
      <style>{`
        @media (max-width: 768px) {
          aside { display: none !important; }
          div[style*="margin-left: 240px"] { margin-left: 0 !important; }
          main { padding: 16px !important; padding-bottom: 80px !important; }
        }
      `}</style>
    </>
  );
}
