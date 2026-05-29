import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'

interface Props {
  seconds: number
  label: string
  onComplete?: () => void
}

export function PrepTimer({ seconds, label, onComplete }: Props) {
  const [remaining, setRemaining] = useState(seconds)
  const barRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Animate progress bar shrinking over full duration
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(barRef.current, { width: '0%', duration: seconds, ease: 'none' })
    })
    return () => ctx.revert()
  }, [seconds])

  // Countdown tick
  useEffect(() => {
    if (remaining <= 0) {
      onCompleteRef.current?.()
      return
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct = Math.round((remaining / seconds) * 100)
  const isWarning = remaining < 30

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 36,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color: isWarning ? '#ef4444' : '#111827',
      }}>
        {mins}:{secs.toString().padStart(2, '0')}
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb', marginTop: 8, overflow: 'hidden' }}>
        <div
          ref={barRef}
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 3,
            background: isWarning ? '#ef4444' : '#6366f1',
            transition: 'background 0.3s',
          }}
        />
      </div>
    </div>
  )
}
