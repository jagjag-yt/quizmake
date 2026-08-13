import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LIMITS } from '../constants'
import {
  buildExport,
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

  const exportJson = useCallback(
    () => JSON.stringify(buildExport(dataRef.current), null, 2),
    [],
  )

  const actions = useMemo(
    () => ({
      recordAnswer,
      markViewed,
      toggleBookmark,
      setNote,
      resetStats,
      resetAll,
      importData,
      exportJson,
    }),
    [recordAnswer, markViewed, toggleBookmark, setNote, resetStats, resetAll, importData, exportJson],
  )

  return { data, dataRef, getRecord, saveError, ...actions }
}
