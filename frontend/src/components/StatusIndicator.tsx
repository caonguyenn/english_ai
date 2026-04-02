import type { ConnectionStatus } from '../types';

const statusConfig: Record<ConnectionStatus, { label: string; dot: string }> = {
  disconnected: { label: 'Disconnected', dot: 'bg-gray-500' },
  connecting: { label: 'Connecting…', dot: 'bg-yellow-400 animate-pulse' },
  connected: { label: 'Connected', dot: 'bg-green-400' },
  error: { label: 'Error', dot: 'bg-red-500' },
};

export function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const { label, dot } = statusConfig[status];
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  );
}
