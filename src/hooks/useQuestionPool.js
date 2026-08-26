import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_GROUP_NAME, GROUP_NAME_MAX, LIMITS, ORIGIN, QUESTION_TYPES } from '../constants'
import { newQuestionId, normalizeQuestion } from '../data/questions'
import {
  cloneQuestion,
  ensureIntegrity,
  loadPool,
  makeGroup,
  nextQuestionNumber,
  renumberByGroup,
  reorderSubset,
  appendPool,
  savePool,
  seedPool,
  stampUpdatedGroups,
  uniqueGroupName,
} from '../storage/pool'
import { toText } from '../utils/safe'
import {
  countQuestions,
  loadTrash,
  removeItem,
  saveTrash,
  trashGroup,
  trashQuestion,
} from '../storage/trash'

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
  // 0個と1個で言い方を分ける。「1つのみ」だけだと、何も入れていない人に通じない
  if (choices.length === 0) errors.push('選択肢が未入力')
  else if (choices.length < 2) errors.push('選択肢が1つのみ')
  if (!(q.correctIndexes ?? []).length) errors.push('正解が未設定')
  return errors
}

/**
 * 出題プール（グループ＋問題）の管理。
 * 変更は 600ms のデバウンスで localStorage に保存する。
 */
export function useQuestionPool() {
  const [pool, setPoolState] = useState(loadPool)

  /**
   * プールの更新はすべてここを通す。
   * 追加・削除・移動・並べ替え・取り込みのどれであっても、最後にグループごとの
   * 連番（1,2,3…）を振り直し、欠番や重複が残らないようにする。
   * あわせて、中身が変わったグループに updatedAt を打つ（「更新順」の並べ替え用）。
   */
  const setPool = useCallback((updater) => {
    setPoolState((prev) => {
      const raw = typeof updater === 'function' ? updater(prev) : updater
      const questions = renumberByGroup(raw.questions)
      const next = questions === raw.questions ? raw : { ...raw, questions }
      return stampUpdatedGroups(prev, next)
    })
  }, [])

  /**
   * ごみ箱。消した問題とグループはここへ移す。
   * 保存はその場で行う（プールと違って更新が多くないため、遅らせる必要がない）。
   */
  const [trash, setTrashState] = useState(loadTrash)
  const trashRef = useRef(trash)
  trashRef.current = trash

  const setTrash = useCallback((next) => {
    setTrashState(next)
    saveTrash(next)
  }, [])

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
  }, [setPool])

  const renameGroup = useCallback((groupId, name) => {
    const clean = toText(name, GROUP_NAME_MAX)
    if (!clean) return
    setPool((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, name: clean } : g)),
    }))
  }, [setPool])

  /** グループを削除する。中の問題も一緒に消える。 */
  const removeGroup = useCallback((groupId) => {
    const current = poolRef.current
    const group = current.groups.find((g) => g.id === groupId)
    if (group) {
      const inside = current.questions.filter((q) => q.groupId === groupId)
      setTrash(trashGroup(trashRef.current, group, inside))
    }
    setPool((prev) => ({
      groups: prev.groups.filter((g) => g.id !== groupId),
      questions: prev.questions.filter((q) => q.groupId !== groupId),
    }))
  }, [setPool, setTrash])

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
  }, [setPool])

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
  }, [setPool])

  /** 問題を別のグループへ移す。 */
  const moveQuestionsToGroup = useCallback((questionIds, groupId) => {
    const idSet = new Set(questionIds)
    setPool((prev) =>
      // 移動先で番号が重なることがあるため、整合性チェック（グループ内の重複解消）を通す
      ensureIntegrity({
        ...prev,
        questions: prev.questions.map((q) => (idSet.has(q.id) ? { ...q, groupId } : q)),
      }),
    )
  }, [setPool])

  // ---------- 問題 ----------

  /**
   * 問題を追加して、**最初の1問の id** を返す（そこから編集を始める）。
   *
   * まとめて足せるようにしてあるのは、同じ形の問題を続けて作るとき、
   * 1問ごとにダイアログへ戻るのが手間になるため（利用者の要望・2026-08-26）。
   *
   * @param {string} groupId 追加先のグループ
   * @param {'choice'|'cloze'} type 問題タイプ
   * @param {number} count 追加する問題数（1以上。プールの上限までで打ち切る）
   */
  const addQuestion = useCallback((groupId, type = QUESTION_TYPES.CHOICE, count = 1) => {
    const current = poolRef.current
    const target = groupId ?? current.groups[0]?.id
    if (!target) return null
    const room = Math.max(0, LIMITS.QUESTIONS - current.questions.length)
    const wanted = Math.min(Math.max(1, Math.floor(count) || 1), room)
    if (!wanted) return null

    const start = nextQuestionNumber(current.questions, target)
    const created = Array.from({ length: wanted }, (_, i) =>
      emptyQuestion(start + i, target, type),
    )
    setPool((prev) => ({ ...prev, questions: [...prev.questions, ...created] }))
    return created[0].id
  }, [setPool])

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
  }, [setPool])

  const removeQuestion = useCallback((id) => {
    const current = poolRef.current
    const question = current.questions.find((q) => q.id === id)
    if (question) {
      const group = current.groups.find((g) => g.id === question.groupId) ?? null
      setTrash(trashQuestion(trashRef.current, question, group))
    }
    setPool((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }))
  }, [setPool, setTrash])

  /**
   * ごみ箱から戻す。
   * 元のグループが残っていればそこへ、無ければ消したときのグループを作り直す。
   */
  const restoreFromTrash = useCallback((itemId) => {
    const item = trashRef.current.items.find((it) => it.id === itemId)
    if (!item) return null
    // 上限に当たると戻しきれない。呼び出し側で伝えられるよう件数を数えておく
    const room = Math.max(0, LIMITS.QUESTIONS - poolRef.current.questions.length)
    const dropped = Math.max(0, item.questions.length - room)
    setPool((prev) => {
      const groups = [...prev.groups]
      let targetId = item.group?.id ?? null
      const alive = targetId ? groups.some((g) => g.id === targetId) : false
      if (item.group && !alive) {
        // 同じ id で戻すと、その中の問題の所属もそのまま合う
        groups.push({ ...item.group, name: uniqueGroupName(item.group.name, groups) })
        targetId = item.group.id
      }
      const restored = item.questions.map((q) => ({
        ...q,
        groupId: targetId ?? prev.groups[0]?.id ?? q.groupId,
      }))
      return ensureIntegrity({
        groups,
        questions: [...prev.questions, ...restored].slice(0, LIMITS.QUESTIONS),
      })
    })
    setTrash(removeItem(trashRef.current, itemId))
    return { ...item, dropped }
  }, [setPool, setTrash])

  /** ごみ箱から完全に消す。 */
  const purgeFromTrash = useCallback((itemId) => {
    setTrash(removeItem(trashRef.current, itemId))
  }, [setTrash])

  /** ごみ箱を空にする。 */
  const emptyTrashNow = useCallback(() => {
    setTrash({ version: 1, items: [] })
  }, [setTrash])

  /** 複製した問題を末尾に追加し、その id を返す。 */
  const duplicateQuestion = useCallback((id) => {
    const current = poolRef.current
    const source = current.questions.find((q) => q.id === id)
    if (!source) return null
    const copy = cloneQuestion(source, {
      questionNumber: nextQuestionNumber(current.questions, source.groupId),
      origin: ORIGIN.AUTHORED,
    })
    setPool((prev) => ({ ...prev, questions: [...prev.questions, copy] }))
    return copy.id
  }, [setPool])

  /**
   * 作成分の並べ替え（グループ内の表示順を入れ替える）。
   * 配列の並び自体を動かし、番号は setPool の振り直しが追従する。
   */
  const reorderAuthored = useCallback((fromIndex, toIndex, groupId) => {
    setPool((prev) => ({
      ...prev,
      questions: reorderSubset(
        prev.questions,
        (q) => q.origin === ORIGIN.AUTHORED && (!groupId || q.groupId === groupId),
        fromIndex,
        toIndex,
      ),
    }))
  }, [setPool])

  /**
   * 読み込んだ問題を取り込む。
   *
   * 既定は「1ファイル＝1グループ」で新しいグループを作る。
   * groupId を渡した場合は、そのグループの**末尾に足す**（問題作成の途中に読み込んだとき）。
   * 末尾に足すのは、番号の振り直しが配列順で走るため、既存の問題の番号を動かさずに
   * 続き番号を振れるから。前に挿すと既存の番号がずれて、覚えている番号と食い違う。
   *
   * @param {Array} incoming 取り込む問題
   * @param {{groupName?: string, groupId?: string|null}} options
   * @returns {string} 取り込み先グループの id
   */
  const importQuestions = useCallback((incoming, { groupName, groupId = null } = {}) => {
    const current = poolRef.current
    const existing = groupId ? current.groups.find((g) => g.id === groupId) : null
    const group = existing ?? makeGroup(uniqueGroupName(groupName || DEFAULT_GROUP_NAME, current.groups))

    setPool((prev) => {
      const tagged = incoming.map((q) => ({
        ...q,
        id: newQuestionId(),
        groupId: group.id,
        origin: ORIGIN.IMPORTED,
      }))
      // 末尾に足す。番号は配列順で振り直されるので、既存の続きから振られる
      const questions = [...prev.questions, ...tagged].slice(0, LIMITS.QUESTIONS)
      return existing
        ? { ...prev, questions }
        : { groups: [...prev.groups, group], questions }
    })
    return group.id
  }, [setPool])

  /**
   * 書き出したファイルから読み込んだ問題を反映する。
   * merge=true なら今のプールに足し（グループは別名で新設）、false なら丸ごと置き換える。
   */
  /**
   * 読み込んだプールを反映する。
   * 上限で切り捨てが起きたら、その件数を返す（黙って減らさない）。
   *
   * @returns {{dropped: number}}
   */
  const importPool = useCallback((incoming, { merge = true } = {}) => {
    if (!incoming) return { dropped: 0 }
    const before = poolRef.current.questions.length
    const wanted = merge ? before + incoming.questions.length : incoming.questions.length
    setPool((prev) => (merge ? appendPool(prev, incoming) : ensureIntegrity(incoming)))
    return { dropped: Math.max(0, wanted - Math.min(wanted, LIMITS.QUESTIONS)) }
  }, [setPool])

  /**
   * すべての問題とグループを消し、初期状態（同梱のサンプル）に戻す。
   *
   * 消す前にごみ箱へ移す。ここだけ素通りしていると、いちばん被害の大きい操作が
   * いちばん戻せない、という食い違いになる。
   * 本当に消したいときは、そのあとごみ箱を空にしてもらう。
   */
  const resetPool = useCallback(() => {
    const current = poolRef.current
    let next = trashRef.current
    for (const group of current.groups) {
      const inside = current.questions.filter((q) => q.groupId === group.id)
      next = trashGroup(next, group, inside)
    }
    if (next !== trashRef.current) setTrash(next)
    setPool(seedPool())
  }, [setPool, setTrash])

  return {
    groups,
    questions,
    poolRef,
    resetPool,
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
    importPool,
    trash,
    trashCount: countQuestions(trash),
    restoreFromTrash,
    purgeFromTrash,
    emptyTrash: emptyTrashNow,
  }
}
