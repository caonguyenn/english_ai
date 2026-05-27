import { useState, useEffect } from 'react';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  initialValue?: string;
}

export function SearchBar({ placeholder = 'Search…', onSearch, debounceMs = 300, initialValue = '' }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value);
    }, debounceMs);
    return () => clearTimeout(timer);
  // onSearch identity changes on every render if caller doesn't memoize — intentionally omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        style={{
          position: 'absolute',
          left: '12px',
          color: 'var(--muted)',
          fontSize: '14px',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{
          paddingLeft: '36px',
          paddingRight: value ? '36px' : '12px',
          paddingTop: '8px',
          paddingBottom: '8px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          color: 'var(--fg)',
          fontSize: '14px',
          outline: 'none',
          width: '280px',
        }}
      />
      {value && (
        <button
          onClick={() => setValue('')}
          style={{
            position: 'absolute',
            right: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted)',
            fontSize: '16px',
            lineHeight: 1,
            padding: '2px',
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
