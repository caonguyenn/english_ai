import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import gsap from 'gsap'
import { api, getClassStages, patchSessionStage } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { StageStepper } from '../../components/session/stages/StageStepper'
import { VocabIntroStage } from '../../components/session/stages/VocabIntroStage'
import { GrammarFocusStage } from '../../components/session/stages/GrammarFocusStage'
import { SpeakingStage } from '../../components/session/stages/SpeakingStage'
import { FeedbackStage } from '../../components/session/stages/FeedbackStage'
import type { ClassResponse, LessonStages } from '../../types'

type Stage = 1 | 2 | 3 | 4

export default function ClassRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profile = useAuthStore(s => s.profile)
  const [stage, setStage] = useState<Stage>(1)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: cls } = useQuery<ClassResponse>({
    queryKey: ['class', id],
    queryFn: async () => (await api.get<ClassResponse>(`/classes/${id}`)).data,
    enabled: !!id,
  })

  const { data: stages } = useQuery<LessonStages>({
    queryKey: ['class-stages', id],
    queryFn: () => getClassStages(id!) as Promise<LessonStages>,
    enabled: !!id,
  })

  // If no stage_content, skip directly to Stage 3 once stages data loaded
  const hasVocab = (stages?.vocab?.length ?? 0) > 0
  const hasGrammar = !!stages?.grammar_focus
  const hasStageContent = hasVocab || hasGrammar

  useEffect(() => {
    if (stages !== undefined && !hasStageContent) {
      setStage(3)
    }
  }, [stages, hasStageContent])

  function advanceStage(next: Stage, sid?: string) {
    const ctx = gsap.context(() => {
      gsap.to(containerRef.current, {
        opacity: 0,
        x: -20,
        duration: 0.2,
        onComplete: () => {
          setStage(next)
          if (sid) setSessionId(sid)
          gsap.fromTo(
            containerRef.current,
            { opacity: 0, x: 20 },
            { opacity: 1, x: 0, duration: 0.3 },
          )
        },
      })
    })
    // Patch stage on server when we have a sessionId and entering stage 3+
    const activeSid = sid ?? sessionId
    if (activeSid && next >= 3) {
      patchSessionStage(activeSid, next).catch(() => { /* best-effort */ })
    }
    return ctx
  }

  function handleClose() {
    void queryClient.invalidateQueries({ queryKey: ['modules'] })
    void queryClient.invalidateQueries({ queryKey: ['classes', String(cls?.module_id ?? '')] })
    navigate(`/modules/${cls?.module_id ?? ''}`, { replace: true })
  }

  if (!id || !profile) return null

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
      {hasStageContent && <StageStepper stage={stage} />}

      <div ref={containerRef}>
        {stage === 1 && hasVocab && stages?.vocab && (
          <VocabIntroStage
            vocab={stages.vocab}
            onContinue={() => advanceStage(hasGrammar ? 2 : 3)}
          />
        )}

        {stage === 2 && hasGrammar && stages?.grammar_focus && (
          <GrammarFocusStage
            studentId={profile.id}
            grammarCategory={stages.grammar_focus.category}
            onContinue={() => advanceStage(3)}
          />
        )}

        {stage === 3 && (
          <SpeakingStage
            classId={id}
            studentId={profile.id}
            className={cls?.title}
            classDescription={cls?.description}
            onComplete={(sid) => advanceStage(4, sid)}
          />
        )}

        {stage === 4 && sessionId && (
          <FeedbackStage
            sessionId={sessionId}
            studentId={profile.id}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  )
}
