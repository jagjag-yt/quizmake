import { addDays, dateKey } from './safe'
import { MAX_BOX } from './srs'

/**
 * 学習記録の集計。ダッシュボード表示に必要な形へ変換する。
 * 集計は毎レンダー走るため、いずれも O(記録数) 程度に抑えている。
 */

/** 正答率（%）。分母0のときは0。 */
export function accuracyOf(correct, answered) {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0
}

/**
 * 直近 days 日分の日別学習量を、古い順の配列で返す（学習が無い日も0で埋める）。
 * @param {Record<string, {answered:number, correct:number}>} daily
 * @param {number} days
 */
export function dailySeries(daily, days = 30) {
  const today = dateKey()
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const key = addDays(today, -i)
    const d = daily?.[key]
    const answered = d?.answered ?? 0
    const correct = d?.correct ?? 0
    out.push({ key, answered, correct, accuracy: accuracyOf(correct, answered) })
  }
  return out
}

/**
 * 連続学習日数。今日まだ学習していない場合は昨日までの連続数を返す
 * （その日のうちに再開すれば途切れない扱い）。
 */
export function streakDays(daily) {
  if (!daily) return 0
  const today = dateKey()
  let cursor = daily[today]?.answered > 0 ? today : addDays(today, -1)
  let count = 0
  // 記録が無い日に当たったら終了。上限365日で打ち切り。
  while (count < 365 && daily[cursor]?.answered > 0) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

/**
 * 科目別の成績。出題データと記録を突き合わせる。
 * @param {import('../data/questions').Question[]} questions
 * @param {Record<string, object>} records
 * @param {(q: any) => string} keyOf
 */
export function subjectStats(questions, records, keyOf) {
  const map = new Map()
  for (const q of questions) {
    const subject = q.subject || '未分類'
    const cur = map.get(subject) ?? { subject, total: 0, studied: 0, answered: 0, correct: 0 }
    cur.total += 1
    const r = records[keyOf(q)]
    if (r?.attempts) {
      cur.studied += 1
      cur.answered += r.attempts
      cur.correct += r.correct
    }
    map.set(subject, cur)
  }
  return [...map.values()]
    .map((s) => ({ ...s, accuracy: accuracyOf(s.correct, s.answered) }))
    .sort((a, b) => b.total - a.total)
}

/**
 * SRS のボックス分布（定着度の可視化）。
 * 出題データに存在する問題だけを数える。
 */
export function boxDistribution(questions, records, keyOf) {
  const counts = Array.from({ length: MAX_BOX + 1 }, () => 0)
  let unstudied = 0
  for (const q of questions) {
    const r = records[keyOf(q)]
    if (!r?.attempts) {
      unstudied += 1
      continue
    }
    const box = Math.min(Math.max(0, r.box ?? 0), MAX_BOX)
    counts[box] += 1
  }
  return { counts, unstudied }
}

/** 出題データ全体の学習カバー率など、概要指標をまとめる。 */
export function overview(questions, records, keyOf, totals) {
  let studied = 0
  let bookmarked = 0
  let wrong = 0
  for (const q of questions) {
    const r = records[keyOf(q)]
    if (r?.bookmarked) bookmarked += 1
    if (r?.attempts) {
      studied += 1
      if (r.lastResult === 'incorrect') wrong += 1
    }
  }
  return {
    totalQuestions: questions.length,
    studied,
    bookmarked,
    wrong,
    answered: totals?.answered ?? 0,
    correct: totals?.correct ?? 0,
    accuracy: accuracyOf(totals?.correct ?? 0, totals?.answered ?? 0),
  }
}
