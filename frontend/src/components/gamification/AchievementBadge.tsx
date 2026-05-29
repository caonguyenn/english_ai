import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface Props {
  title: string
  description?: string
  earned: boolean
  earnedAt?: string
}

export function AchievementBadge({ title, description, earned, earnedAt }: Props) {
  const badgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!earned) return
    const ctx = gsap.context(() => {
      gsap.from(badgeRef.current, { scale: 0.6, opacity: 0, duration: 0.5, ease: 'back.out(1.7)' })
    })
    return () => ctx.revert()
  }, [earned])

  return (
    <div
      ref={badgeRef}
      className="achievement-badge"
      style={{
        opacity: earned ? 1 : 0.4,
        border: earned ? '2px solid gold' : '2px solid var(--border-subtle, #e5e7eb)',
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 140,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
      {description && <div style={{ fontSize: 12, opacity: 0.7 }}>{description}</div>}
      {earned && earnedAt && (
        <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
          Earned {new Date(earnedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
