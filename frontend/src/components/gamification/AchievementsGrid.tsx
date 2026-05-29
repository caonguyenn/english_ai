import { AchievementBadge } from './AchievementBadge'

interface Achievement {
  id: string
  slug: string
  title: string
  description?: string
  earned: boolean
  earned_at?: string
  criteria_json?: { deferred?: boolean }
}

interface Props {
  achievements: Achievement[]
}

export function AchievementsGrid({ achievements }: Props) {
  if (!achievements.length) return null
  return (
    <div
      className="achievements-grid"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
    >
      {achievements.map(a => (
        <AchievementBadge
          key={a.id}
          title={a.title}
          description={a.description}
          earned={a.earned}
          earnedAt={a.earned_at}
        />
      ))}
    </div>
  )
}
