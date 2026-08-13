import { isGraded } from '../data/questions'
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
 * グループ別の成績。出題データと記録を突き合わせる。
 * @param {import('../data/questions').Question[]} questions
 * @param {Record<string, object>} records
 * @param {(q: any) => string} keyOf
 * @param {Array<{id: string, name: string}>} groups
 */
export function groupStats(questions, records, keyOf, groups = []) {
  const names = new Map(groups.map((g) => [g.id, g.name]))
  const map = new Map()
  // 採点しない虫食いは正答率の母数に入れない（SPEC R1）
  for (const q of questions.filter(isGraded)) {
    const id = q.groupId
    const name = names.get(id) ?? '未分類'
    const cur = map.get(id) ?? { id, name, total: 0, studied: 0, answered: 0, correct: 0 }
    cur.total += 1
    const r = records[keyOf(q)]
    if (r?.attempts) {
      cur.studied += 1
      cur.answered += r.attempts
      cur.correct += r.correct
    }
    map.set(id, cur)
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
  // 定着度は採点結果から決まるため、虫食いは数えない（SPEC R1）
  for (const q of questions.filter(isGraded)) {
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
  // 学習済み・要復習の集計は採点対象（選択式）のみ。ブックマークは両方数える
  for (const q of questions.filter(isGraded)) {
    const r = records[keyOf(q)]
    if (r?.bookmarked) bookmarked += 1
    if (r?.attempts) {
      studied += 1
      if (r.lastResult === 'incorrect') wrong += 1
    }
  }
  const graded = questions.filter(isGraded)
  bookmarked = questions.filter((q) => records[keyOf(q)]?.bookmarked).length

  return {
    totalQuestions: graded.length,
    studied,
    bookmarked,
    wrong,
    answered: totals?.answered ?? 0,
    correct: totals?.correct ?? 0,
    accuracy: accuracyOf(totals?.correct ?? 0, totals?.answered ?? 0),
  }
}

/**
 * 虫食いの集計（採点しないため、正答率などとは別枠で出す）。
 * @returns {{ total:number, viewedThisWeek:number, unviewed:number, lastViewedAt:string|null }}
 */
export function clozeStats(questions, records, keyOf) {
  const list = questions.filter((q) => !isGraded(q))
  const today = dateKey()
  const weekAgo = addDays(today, -6)
  let viewedThisWeek = 0
  let unviewed = 0
  let lastViewedAt = null

  for (const q of list) {
    const viewedAt = records[keyOf(q)]?.viewedAt ?? null
    if (!viewedAt) {
      unviewed += 1
      continue
    }
    if (viewedAt >= weekAgo) viewedThisWeek += 1
    if (!lastViewedAt || viewedAt > lastViewedAt) lastViewedAt = viewedAt
  }
  return { total: list.length, viewedThisWeek, unviewed, lastViewedAt }
}
