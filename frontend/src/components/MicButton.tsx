interface Props {
  isActive: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  onClick: () => void;
}

export function MicButton({ isActive, isSpeaking, isConnecting, onClick }: Props) {
  let ringClass = '';
  let bgClass = 'bg-gray-700 hover:bg-gray-600';
  let scaleClass = '';

  if (isConnecting) {
    bgClass = 'bg-yellow-600';
    ringClass = 'ring-4 ring-yellow-400 ring-offset-4 ring-offset-gray-950 animate-pulse';
  } else if (isActive && isSpeaking) {
    bgClass = 'bg-green-500';
    ringClass = 'ring-4 ring-green-400 ring-offset-4 ring-offset-gray-950';
    scaleClass = 'scale-110';
  } else if (isActive) {
    bgClass = 'bg-blue-600 hover:bg-blue-500';
    ringClass = 'ring-4 ring-blue-400 ring-offset-4 ring-offset-gray-950 animate-pulse';
  }

  return (
    <button
      onClick={onClick}
      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${bgClass} ${ringClass} ${scaleClass}`}
      title={isActive ? 'Stop session' : 'Start session'}
    >
      {isActive ? (
        // Stop icon
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        // Mic icon
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 15.93A7.002 7.002 0 0 1 5 12H3a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12h-2a7 7 0 0 1-5.5 5.93z" />
        </svg>
      )}
    </button>
  );
}
