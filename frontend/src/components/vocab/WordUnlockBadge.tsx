import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface Props {
  word: string
  xpAwarded: number
}

export function WordUnlockBadge({ word, xpAwarded }: Props) {
  const badgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(badgeRef.current, {
        scale: 0.5, opacity: 0, rotation: -10,
        duration: 0.6, ease: 'back.out(1.7)',
      })
    })
    return () => ctx.revert()
  }, [word])

  return (
    <div
      ref={badgeRef}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderRadius: 24,
        background: '#fef9c3', border: '2px solid #fbbf24',
        fontWeight: 600,
      }}
    >
      🔓 <span>Word unlocked: <em>{word}</em></span>
      <span style={{ color: '#16a34a' }}>+{xpAwarded} XP</span>
    </div>
  )
}
