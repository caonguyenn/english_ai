import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface Props {
  currentLen: number
  longestLen?: number
}

export function StreakFlame({ currentLen, longestLen }: Props) {
  const flameRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(flameRef.current,
        { scale: 1.0, filter: 'brightness(1)' },
        { scale: 1.15, filter: 'brightness(1.3)', duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' }
      )
    })
    return () => ctx.revert()
  }, [])

  return (
    <div className="streak-flame" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span ref={flameRef} style={{ fontSize: 28 }}>🔥</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 20 }}>{currentLen}</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>day streak</div>
      </div>
      {longestLen !== undefined && longestLen > 0 && (
        <div style={{ fontSize: 12, opacity: 0.5, marginLeft: 8 }}>
          Best: {longestLen}
        </div>
      )}
    </div>
  )
}
