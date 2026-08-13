import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_GROUP_NAME, GROUP_NAME_MAX, LIMITS, ORIGIN, QUESTION_TYPES } from '../constants'
import { newQuestionId, normalizeQuestion } from '../data/questions'
import {
  cloneQuestion,
  ensureIntegrity,
  loadPool,
  makeGroup,
  nextQuestionNumber,
  resolveNumberCollisions,
  savePool,
  uniqueGroupName,
} from '../storage/pool'
import { toText } from '../utils/safe'

/** 作成直後の空の問題（タイプごとに必要な項目だけ持たせる）。 */
function emptyQuestion(questionNumber, groupId, type = QUESTION_TYPES.CHOICE) {
  if (type === QUESTION_TYPES.CLOZE) {
    return normalizeQuestion(
      {
        id: newQuestionId(),
        type: QUESTION_TYPES.CLOZE,
        questionNumber,
        groupId,
        title: '',
        paras: [[]],
        tags: [],
        origin: ORIGIN.AUTHORED,
      },
      0,
    )
  }
  return normalizeQuestion(
    {
      id: newQuestionId(),
      questionNumber,
      segments: [{ text: '', u: false }],
      choices: ['', ''],
      correctIndexes: [],
      explanation: '',
      keyPoints: [],
      groupId,
      tags: [],
      imageUrl: null,
      origin: ORIGIN.AUTHORED,
    },
    0,
  )
}

/** 出題・書き出しの対象として妥当か（不備があると書き出し時に警告する）。 */
export function validateQuestion(q) {
  const errors = []
  if (q.type === QUESTION_TYPES.CLOZE) {
    const body = (q.paras ?? [])
      .map((para) => (para ?? []).map((r) => r.text).join(''))
      .join('')
      .trim()
    if (!body) errors.push('文章が未入力')
    // 隠す箇所0か所はエラーにしない（あとから隠す使い方を妨げないため）
    return errors
  }
  const text = (q.segments ?? []).map((s) => s.text).join('').trim()
  const choices = (q.choices ?? []).filter((c) => c.trim())
  if (!text) errors.push('問題文が未入力')
  if (choices.length < 2) errors.push('選択肢が1つのみ')
  if (!(q.correctIndexes ?? []).length) errors.push('正解が未設定')
  return errors
}

/**
 * 出題プール（グループ＋問題）の管理。
 * 変更は 600ms のデバウンスで localStorage に保存する。
 */
export function useQuestionPool() {
  const [pool, setPool] = useState(loadPool)
  const [savedAt, setSavedAt] = useState(null)
  const [saveError, setSaveError] = useState('')
  const timerRef = useRef(null)
  const poolRef = useRef(pool)
  const firstRun = useRef(true)

  useEffect(() => {
    poolRef.current = pool
    if (firstRun.current) {
      firstRun.current = false
      return undefined
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const result = savePool(pool)
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
  }, [pool])

  const { groups, questions } = pool

  const authored = useMemo(
    () => questions.filter((q) => q.origin === ORIGIN.AUTHORED),
    [questions],
  )
  const imported = useMemo(
    () => questions.filter((q) => q.origin !== ORIGIN.AUTHORED),
    [questions],
  )

  /** グループIDごとの問題数。 */
  const countsByGroup = useMemo(() => {
    const map = new Map()
    for (const q of questions) map.set(q.groupId, (map.get(q.groupId) ?? 0) + 1)
    return map
  }, [questions])

  // ---------- グループ ----------

  /** グループを作成し、その id を返す。 */
  const addGroup = useCallback((name) => {
    const group = makeGroup(uniqueGroupName(name, poolRef.current.groups))
    setPool((prev) => ({ ...prev, groups: [...prev.groups, group] }))
    return group.id
  }, [])

  const renameGroup = useCallback((groupId, name) => {
    const clean = toText(name, GROUP_NAME_MAX)
    if (!clean) return
    setPool((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, name: clean } : g)),
    }))
  }, [])

  /** グループを削除する。中の問題も一緒に消える。 */
  const removeGroup = useCallback((groupId) => {
    setPool((prev) => ({
      groups: prev.groups.filter((g) => g.id !== groupId),
      questions: prev.questions.filter((q) => q.groupId !== groupId),
    }))
  }, [])

  /**
   * 複数のグループを1つに統合する。
   * 先頭のグループに問題を寄せ、残りのグループを削除する。
   */
  const mergeGroups = useCallback((groupIds, name) => {
    if (groupIds.length < 2) return null
    const [targetId, ...rest] = groupIds
    const restSet = new Set(rest)
    setPool((prev) => {
      const merged = {
        groups: prev.groups
          .filter((g) => !restSet.has(g.id))
          .map((g) =>
            g.id === targetId && name ? { ...g, name: toText(name, GROUP_NAME_MAX) } : g,
          ),
        questions: prev.questions.map((q) =>
          restSet.has(q.groupId) ? { ...q, groupId: targetId } : q,
        ),
      }
      return ensureIntegrity(merged)
    })
    return targetId
  }, [])

  /**
   * 指定した問題を新しいグループへ切り出す（分割）。
   * @param {string[]} questionIds
   * @param {string} name 新しいグループ名
   * @param {{ copy?: boolean }} opts copy=true なら元にも残す
   */
  const splitGroup = useCallback((questionIds, name, { copy = false } = {}) => {
    if (!questionIds.length) return null
    const idSet = new Set(questionIds)
    const group = makeGroup(uniqueGroupName(name, poolRef.current.groups))
    setPool((prev) => {
      const questions = copy
        ? [
            ...prev.questions,
            ...prev.questions
              .filter((q) => idSet.has(q.id))
              .map((q) => cloneQuestion(q, { groupId: group.id })),
          ]
        : prev.questions.map((q) => (idSet.has(q.id) ? { ...q, groupId: group.id } : q))
      return ensureIntegrity({ groups: [...prev.groups, group], questions })
    })
    return group.id
  }, [])

  /** 問題を別のグループへ移す。 */
  const moveQuestionsToGroup = useCallback((questionIds, groupId) => {
    const idSet = new Set(questionIds)
    setPool((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (idSet.has(q.id) ? { ...q, groupId } : q)),
    }))
  }, [])

  // ---------- 問題 ----------

  /** 問題を1問追加して、その id を返す。 */
  const addQuestion = useCallback((groupId, type = QUESTION_TYPES.CHOICE) => {
    const current = poolRef.current
    const target = groupId ?? current.groups[0]?.id
    if (!target) return null
    const created = emptyQuestion(nextQuestionNumber(current.questions), target, type)
    setPool((prev) => ({ ...prev, questions: [...prev.questions, created] }))
    return created.id
  }, [])

  const updateQuestion = useCallback((id, patch) => {
    setPool((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== id) return q
        const merged = { ...q, ...(typeof patch === 'function' ? patch(q) : patch) }
        return normalizeQuestion(
          { ...merged, id: q.id, origin: q.origin, questionNumber: merged.questionNumber },
          0,
        )
      }),
    }))
  }, [])

  const removeQuestion = useCallback((id) => {
    setPool((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }))
  }, [])

  /** 複製した問題を末尾に追加し、その id を返す。 */
  const duplicateQuestion = useCallback((id) => {
    const current = poolRef.current
    const source = current.questions.find((q) => q.id === id)
    if (!source) return null
    const copy = cloneQuestion(source, {
      questionNumber: nextQuestionNumber(current.questions),
      origin: ORIGIN.AUTHORED,
    })
    setPool((prev) => ({ ...prev, questions: [...prev.questions, copy] }))
    return copy.id
  }, [])

  /** 作成分の並べ替え（グループ内の表示順を入れ替える）。 */
  const reorderAuthored = useCallback((fromIndex, toIndex, groupId) => {
    setPool((prev) => {
      const list = prev.questions.filter(
        (q) => q.origin === ORIGIN.AUTHORED && (!groupId || q.groupId === groupId),
      )
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

      const numbers = list.map((q) => q.questionNumber)
      const renumbered = moved.map((q, i) => ({ ...q, questionNumber: numbers[i] }))
      const byId = new Map(renumbered.map((q) => [q.id, q]))
      return { ...prev, questions: prev.questions.map((q) => byId.get(q.id) ?? q) }
    })
  }, [])

  /**
   * Excel から読み込んだ問題を、1ファイル＝1グループとして取り込む。
   * @returns {string} 作成したグループの id
   */
  const importQuestions = useCallback((incoming, { groupName } = {}) => {
    const current = poolRef.current
    const group = makeGroup(uniqueGroupName(groupName || DEFAULT_GROUP_NAME, current.groups))
    setPool((prev) => {
      const tagged = incoming.map((q) => ({
        ...q,
        id: newQuestionId(),
        groupId: group.id,
        origin: ORIGIN.IMPORTED,
      }))
      const resolved = resolveNumberCollisions(tagged, prev.questions)
      return {
        groups: [...prev.groups, group],
        questions: [...prev.questions, ...resolved].slice(0, LIMITS.QUESTIONS),
      }
    })
    return group.id
  }, [])

  /** 一括でタグを付与する。 */
  const addTagToQuestions = useCallback((ids, tag) => {
    const value = String(tag ?? '').trim()
    if (!value) return
    const idSet = new Set(ids)
    setPool((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        idSet.has(q.id) && !q.tags.includes(value)
          ? { ...q, tags: [...q.tags, value].slice(0, 10) }
          : q,
      ),
    }))
  }, [])

  return {
    groups,
    questions,
    poolRef,
    authored,
    imported,
    countsByGroup,
    savedAt,
    saveError,
    addGroup,
    renameGroup,
    removeGroup,
    mergeGroups,
    splitGroup,
    moveQuestionsToGroup,
    addQuestion,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    reorderAuthored,
    importQuestions,
    addTagToQuestions,
  }
}
