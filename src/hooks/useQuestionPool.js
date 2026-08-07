import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LIMITS, ORIGIN } from '../constants'
import { newQuestionId, normalizeQuestion } from '../data/questions'
import {
  loadPool,
  nextQuestionNumber,
  resolveNumberCollisions,
  savePool,
} from '../storage/pool'

/** 作成直後の空の問題。 */
function emptyQuestion(questionNumber) {
  return normalizeQuestion(
    {
      id: newQuestionId(),
      questionNumber,
      segments: [{ text: '', u: false }],
      choices: ['', ''],
      correctIndexes: [],
      explanation: '',
      keyPoints: [],
      subject: '',
      tags: [],
      imageUrl: null,
      origin: ORIGIN.AUTHORED,
    },
    0,
  )
}

/** 出題・編集の対象として妥当か（不備があると書き出し時に警告する）。 */
export function validateQuestion(q) {
  const errors = []
  const text = (q.segments ?? []).map((s) => s.text).join('').trim()
  const choices = (q.choices ?? []).filter((c) => c.trim())
  if (!text) errors.push('問題文が未入力')
  if (choices.length < 2) errors.push('選択肢が1つのみ')
  if (!(q.correctIndexes ?? []).length) errors.push('正解が未設定')
  return errors
}

/**
 * 出題プール（作成分＋読込分）の管理。
 *
 * 変更は 600ms のデバウンスで localStorage に保存し、
 * 保存時刻をヘッダーの「✓ 自動保存済み hh:mm」に出す。
 */
export function useQuestionPool() {
  const [questions, setQuestions] = useState(loadPool)
  const [savedAt, setSavedAt] = useState(null)
  const [saveError, setSaveError] = useState('')
  const timerRef = useRef(null)
  const questionsRef = useRef(questions)
  const firstRun = useRef(true)

  useEffect(() => {
    questionsRef.current = questions
    // 初回マウント時は読み込んだ内容そのままなので保存しない
    if (firstRun.current) {
      firstRun.current = false
      return undefined
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const result = savePool(questions)
      if (result.ok) {
        setSavedAt(new Date())
        setSaveError('')
      } else {
        setSaveError(result.error ?? '')
      }
    }, 600)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [questions])

  const authored = useMemo(
    () => questions.filter((q) => q.origin === ORIGIN.AUTHORED),
    [questions],
  )
  const imported = useMemo(
    () => questions.filter((q) => q.origin !== ORIGIN.AUTHORED),
    [questions],
  )

  /** 問題を1問追加して、その id を返す。 */
  const addQuestion = useCallback(() => {
    const created = emptyQuestion(nextQuestionNumber(questionsRef.current))
    setQuestions((prev) => [...prev, created])
    return created.id
  }, [])

  const updateQuestion = useCallback((id, patch) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q
        const merged = { ...q, ...(typeof patch === 'function' ? patch(q) : patch) }
        // 正規化で id と origin と番号は維持する
        return normalizeQuestion(
          { ...merged, id: q.id, origin: q.origin, questionNumber: merged.questionNumber },
          0,
        )
      }),
    )
  }, [])

  const removeQuestion = useCallback((id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }, [])

  /** 複製した問題を末尾に追加し、その id を返す。 */
  const duplicateQuestion = useCallback((id) => {
    const source = questionsRef.current.find((q) => q.id === id)
    if (!source) return null
    const copy = {
      ...source,
      id: newQuestionId(),
      questionNumber: nextQuestionNumber(questionsRef.current),
      origin: ORIGIN.AUTHORED,
    }
    setQuestions((prev) => [...prev, copy])
    return copy.id
  }, [])

  /**
   * 作成分の並べ替え。並べ替え後、作成分の問題番号を振り直す
   * （読込分の番号には触れない）。
   */
  const reorderAuthored = useCallback((fromIndex, toIndex) => {
    setQuestions((prev) => {
      const list = prev.filter((q) => q.origin === ORIGIN.AUTHORED)
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= list.length ||
        toIndex >= list.length ||
        fromIndex === toIndex
      ) {
        return prev
      }
      const moved = [...list]
      const [item] = moved.splice(fromIndex, 1)
      moved.splice(toIndex, 0, item)

      // 作成分が元々持っていた番号の並びを、新しい順序に割り当て直す
      const numbers = list.map((q) => q.questionNumber)
      const renumbered = moved.map((q, i) => ({ ...q, questionNumber: numbers[i] }))
      const byId = new Map(renumbered.map((q) => [q.id, q]))
      return prev.map((q) => byId.get(q.id) ?? q)
    })
  }, [])

  /**
   * Excel から読み込んだ問題をプールへ追加する。
   * 既存の番号と衝突したら枝番（12-2）を振り、既存は決して振り直さない。
   */
  const importQuestions = useCallback((incoming, { replace = false } = {}) => {
    setQuestions((prev) => {
      const tagged = incoming.map((q) => ({
        ...q,
        id: newQuestionId(),
        origin: ORIGIN.IMPORTED,
      }))
      if (replace) return tagged.slice(0, LIMITS.QUESTIONS)
      const kept = prev
      const resolved = resolveNumberCollisions(tagged, kept)
      return [...kept, ...resolved].slice(0, LIMITS.QUESTIONS)
    })
  }, [])

  /** 一括でブックマーク以外の属性を更新する（タグ付与など）。 */
  const addTagToQuestions = useCallback((ids, tag) => {
    const value = String(tag ?? '').trim()
    if (!value) return
    const idSet = new Set(ids)
    setQuestions((prev) =>
      prev.map((q) =>
        idSet.has(q.id) && !q.tags.includes(value)
          ? { ...q, tags: [...q.tags, value].slice(0, 10) }
          : q,
      ),
    )
  }, [])

  return {
    questions,
    questionsRef,
    authored,
    imported,
    savedAt,
    saveError,
    addQuestion,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    reorderAuthored,
    importQuestions,
    addTagToQuestions,
  }
}
