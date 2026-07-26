import { addDays, dateKey } from './safe'

/**
 * 間隔反復（SRS）: Leitner ボックス方式。
 *
 * 正解するほど箱が上がり、次に出題されるまでの間隔が延びる。
 * 間違えると箱0に戻り、その日のうちに再出題される。
 * 「間隔を空けて思い出す」ほど長期記憶に残りやすい、という間隔効果に基づく。
 */

/** 箱ごとの復習間隔（日）。索引がボックス番号。 */
export const BOX_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35]

export const MAX_BOX = BOX_INTERVALS_DAYS.length - 1

/** 箱の説明ラベル（ダッシュボード表示用）。 */
export const BOX_LABELS = ['未定着', '1日後', '3日後', '1週間後', '約2週間後', '約1か月後']

/**
 * 回答結果から次のボックス番号を求める。
 * @param {number} box 現在のボックス（未学習は 0 扱い）
 * @param {boolean} correct 正解だったか
 */
export function nextBox(box, correct) {
  const current = Number.isInteger(box) ? box : 0
  return correct ? Math.min(MAX_BOX, current + 1) : 0
}

/**
 * ボックス番号から次回復習日（YYYY-MM-DD）を求める。
 * @param {number} box
 * @param {string} [from] 起点の日付キー（既定は今日）
 */
export function dueDateFor(box, from = dateKey()) {
  const idx = Math.min(Math.max(0, Number(box) || 0), MAX_BOX)
  return addDays(from, BOX_INTERVALS_DAYS[idx])
}

/**
 * その記録が今日復習すべきか。
 * 一度も学習していない問題は「新規」であり、ここでは対象外とする。
 *
 * @param {{ attempts?: number, dueAt?: string }} record
 * @param {string} [today]
 */
export function isDue(record, today = dateKey()) {
  if (!record || !record.attempts) return false
  if (!record.dueAt) return true
  return record.dueAt <= today
}
