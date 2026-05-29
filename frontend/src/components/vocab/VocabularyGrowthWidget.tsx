import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface Props {
  totalWords: number
  masteredWords: number
}

export function VocabularyGrowthWidget({ totalWords, masteredWords }: Props) {
  const countRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(countRef.current, { textContent: 0, duration: 1.2, snap: { textContent: 1 }, ease: 'power2.out' })
    })
    return () => ctx.revert()
  }, [totalWords])

  const masteryPct = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0

  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle, #e5e7eb)' }}>
      <h4 style={{ margin: 0 }}>Vocabulary</h4>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>
        <span ref={countRef}>{totalWords}</span>
        <span style={{ fontSize: 14, opacity: 0.5, marginLeft: 4 }}>words</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
        {masteredWords} mastered ({masteryPct}%)
      </div>
      <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: '#e5e7eb' }}>
        <div style={{ width: `${masteryPct}%`, height: '100%', borderRadius: 3, background: '#16a34a', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}
