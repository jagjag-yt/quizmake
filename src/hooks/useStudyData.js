import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LIMITS } from '../constants'
import {
  emptyData,
  emptyRecord,
  loadData,
  mergeData,
  saveData,
} from '../storage/store'
import { dateKey, toText } from '../utils/safe'
import { dueDateFor, nextBox } from '../utils/srs'

/** 問題キーを安全に差し替えた records を作る（プロトタイプ汚染を避ける）。 */
function withRecord(records, key, record) {
  const next = Object.assign(Object.create(null), records)
  next[key] = record
  return next
}

/**
 * 学習データ（問題別履歴・SRS・メモ・ブックマーク・日別統計）を管理するフック。
 * 変更のたびに localStorage へ保存する。
 */
export function useStudyData() {
  const [data, setData] = useState(loadData)
  const [saveError, setSaveError] = useState('')

  // セッション構築など「その時点の値」が欲しい箇所から参照する（再レンダーを誘発しない）
  const dataRef = useRef(data)

  useEffect(() => {
    dataRef.current = data
    const result = saveData(data)
    setSaveError(result.ok ? '' : (result.error ?? ''))
  }, [data])

  const getRecord = useCallback((key) => data.records[key] ?? emptyRecord(), [data])

  /** 回答を記録する。正誤に応じて SRS のボックスと次回復習日を更新。 */
  const recordAnswer = useCallback((key, correct) => {
    if (!key) return
    setData((prev) => {
      const cur = prev.records[key] ?? emptyRecord()
      const today = dateKey()
      const box = nextBox(cur.box, correct)
      const record = {
        ...cur,
        attempts: cur.attempts + 1,
        correct: cur.correct + (correct ? 1 : 0),
        lastResult: correct ? 'correct' : 'incorrect',
        lastAnsweredAt: today,
        box,
        dueAt: dueDateFor(box, today),
      }

      const prevDay = prev.daily[today] ?? { answered: 0, correct: 0 }
      const daily = Object.assign(Object.create(null), prev.daily)
      daily[today] = {
        answered: prevDay.answered + 1,
        correct: prevDay.correct + (correct ? 1 : 0),
      }

      return {
        ...prev,
        records: withRecord(prev.records, key, record),
        daily,
        totals: {
          answered: prev.totals.answered + 1,
          correct: prev.totals.correct + (correct ? 1 : 0),
        },
      }
    })
  }, [])

  /**
   * 虫食い問題を「見た」ことだけを記録する。
   * 採点はしないので attempts / correct / box / totals には一切触れない（SPEC R1）。
   */
  const markViewed = useCallback((key) => {
    if (!key) return
    setData((prev) => {
      const cur = prev.records[key] ?? emptyRecord()
      const today = dateKey()
      if (cur.viewedAt === today) return prev
      return {
        ...prev,
        records: withRecord(prev.records, key, { ...cur, viewedAt: today }),
      }
    })
  }, [])

  const toggleBookmark = useCallback((key) => {
    if (!key) return
    setData((prev) => {
      const cur = prev.records[key] ?? emptyRecord()
      return {
        ...prev,
        records: withRecord(prev.records, key, { ...cur, bookmarked: !cur.bookmarked }),
      }
    })
  }, [])

  const setNote = useCallback((key, note) => {
    if (!key) return
    setData((prev) => {
      const cur = prev.records[key] ?? emptyRecord()
      return {
        ...prev,
        records: withRecord(prev.records, key, {
          ...cur,
          note: toText(note, LIMITS.NOTE_CHARS),
        }),
      }
    })
  }, [])

  /**
   * 記録のキーを付け替える。
   *
   * 記録は問題文をキーにしているため、問題文を直すと別の問題として扱われ、
   * 正答率・定着度・ブックマーク・メモが行き先を失う（誤字を直しただけで消える）。
   * 問題文が変わったときはここで記録を引っ越す。
   *
   * @param {string} fromKey 変更前のキー
   * @param {string} toKey 変更後のキー
   */
  const moveRecord = useCallback((fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return
    setData((prev) => {
      const moving = prev.records[fromKey]
      if (!moving) return prev
      const records = Object.create(null)
      for (const [key, value] of Object.entries(prev.records)) {
        if (key === fromKey) continue
        records[key] = value
      }
      // 引っ越し先に既に記録があるなら、解いた回数が多いほうを残す
      const existing = prev.records[toKey]
      records[toKey] =
        existing && existing.attempts > moving.attempts ? existing : moving
      return { ...prev, records }
    })
  }, [])

  /** 正答率・日別統計のみリセット（ブックマーク・メモ・SRSは残す）。 */
  const resetStats = useCallback(() => {
    setData((prev) => ({
      ...prev,
      daily: Object.create(null),
      totals: { answered: 0, correct: 0 },
    }))
  }, [])

  /** 学習記録をすべて消す（ブックマーク・メモも含む）。 */
  const resetAll = useCallback(() => setData(emptyData()), [])

  /** インポート：置き換え、または既存データへ統合。 */
  const importData = useCallback((incoming, { merge = false } = {}) => {
    setData((prev) => (merge ? mergeData(prev, incoming) : incoming))
  }, [])

  const actions = useMemo(
    () => ({
      recordAnswer,
      markViewed,
      toggleBookmark,
      setNote,
      resetStats,
      resetAll,
      importData,
      moveRecord,
    }),
    [
      recordAnswer,
      markViewed,
      toggleBookmark,
      setNote,
      resetStats,
      resetAll,
      importData,
      moveRecord,
    ],
  )

  return { data, dataRef, getRecord, saveError, ...actions }
}
