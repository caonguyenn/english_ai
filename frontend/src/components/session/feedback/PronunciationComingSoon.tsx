export function PronunciationComingSoon() {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px dashed var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 16,
      }}>
        🎙
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          Pronunciation
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Coming soon — requires audio analysis
        </div>
      </div>
    </div>
  );
}
