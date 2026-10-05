import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { QuestionView } from '@/components/QuestionView'
import { QUESTIONS } from '@/config/bank'
import { applyAnswerResult, applyCorrectAnswer, applyWrongAnswer } from '@/lib/domain/progress'
import { nowMs } from '@/lib/clock'
import { buildStudyQueue, moveStudyPosition } from '@/lib/study-session'
import { useRepository } from '@/hooks/useRepository'
import { useSettings } from '@/hooks/useSettings'
import type { QuestionProgress, WrongRecord } from '@/types/persistence'

export default function StudyPage() {
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'back' ? 'back' : 'practice'
  const source = params.get('source')
  const requestedQuestion = params.get('question')
  const [order, setOrder] = useState<'sequential' | 'random'>('sequential')
  const [position, setPosition] = useState(0)
  const [progress, setProgress] = useState<Map<string, QuestionProgress>>(new Map())
  const [wrongBook, setWrongBook] = useState<Map<string, WrongRecord>>(new Map())
  const [restored, setRestored] = useState(false)
  const repository = useRepository()
  const { settings } = useSettings()

  const queue = useMemo(() => {
    const questions = source === 'wrong'
      ? QUESTIONS.filter((question) => wrongBook.has(question.id))
      : QUESTIONS
    return buildStudyQueue(questions, order)
  }, [order, source, wrongBook])

  const current = queue[position]

  useEffect(() => {
    let cancelled = false
    Promise.all([repository.getProgress(), repository.getWrongRecords(), repository.getStudyPosition()]).then(
      ([storedProgress, storedWrongBook, storedPosition]) => {
        if (cancelled) return
        setProgress(storedProgress)
        setWrongBook(storedWrongBook)
        if (requestedQuestion) {
          const requestedIndex = QUESTIONS.findIndex((question) => question.id === requestedQuestion)
          if (requestedIndex >= 0) setPosition(requestedIndex)
        } else if (source !== 'wrong' && storedPosition?.mode === mode) {
          const storedIndex = QUESTIONS.findIndex((question) => question.id === storedPosition.questionId)
          if (storedIndex >= 0) setPosition(storedIndex)
        }
        setRestored(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [mode, repository, requestedQuestion, source])

  useEffect(() => {
    if (!current) return
    repository.saveStudyPosition({
      mode,
      questionId: current.id,
      updatedAt: Date.now(),
    })
  }, [current, mode, repository])

  const handleConfirm = async (correct: boolean) => {
    if (!current) return
    const now = nowMs()
    const nextProgress = applyAnswerResult(progress.get(current.id), current.id, correct, now)
    const nextProgressMap = new Map(progress)
    nextProgressMap.set(current.id, nextProgress)
    setProgress(nextProgressMap)
    await repository.saveProgress(nextProgress)

    const existingWrong = wrongBook.get(current.id)
    if (!correct) {
      const nextWrong = applyWrongAnswer(current.id, existingWrong, now)
      const nextWrongBook = new Map(wrongBook)
      nextWrongBook.set(current.id, nextWrong)
      setWrongBook(nextWrongBook)
      await repository.saveWrongRecord(nextWrong)
    } else if (existingWrong) {
      const nextWrong = applyCorrectAnswer(existingWrong, settings.wrongRemovalRule, now)
      const nextWrongBook = new Map(wrongBook)
      if (nextWrong) {
        nextWrongBook.set(current.id, nextWrong)
        await repository.saveWrongRecord(nextWrong)
      } else {
        nextWrongBook.delete(current.id)
        await repository.deleteWrongRecord(current.id)
      }
      setWrongBook(nextWrongBook)
    }

    if (correct && settings.autoNextAfterCorrect) {
      window.setTimeout(() => goNext(), 450)
    }
  }

  const goPrevious = () => {
    setPosition((currentPosition) => moveStudyPosition(currentPosition, queue.length, -1))
  }

  const goNext = () => {
    setPosition((currentPosition) => moveStudyPosition(currentPosition, queue.length, 1))
  }

  if (!restored) return <p className="text-sm text-slate-500">正在读取学习记录…</p>
  if (!current) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        {source === 'wrong' ? '错题集为空，暂时没有可复习的题目。' : '题库为空。'}
      </p>
    )
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'back' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setParams({ mode: 'back', ...(source ? { source } : {}) })}
          >
            背题模式
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'practice' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setParams({ mode: 'practice', ...(source ? { source } : {}) })}
          >
            做题模式
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          顺序
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-3"
            value={order}
            onChange={(event) => {
              setOrder(event.target.value as typeof order)
              setPosition(0)
            }}
          >
            <option value="sequential">顺序</option>
            <option value="random">随机</option>
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <QuestionView
          key={`${current.id}-${mode}`}
          question={current}
          mode={mode}
          index={position}
          total={queue.length}
          onConfirm={handleConfirm}
          onPrevious={position > 0 ? goPrevious : undefined}
          onNext={goNext}
          isLast={position === queue.length - 1}
        />
      </div>
    </section>
  )
}



