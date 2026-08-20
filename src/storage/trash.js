import { LIMITS, TRASH_KEY } from '../constants'
import { normalizeQuestion } from '../data/questions'
import { isPlainObject, safeJsonParse } from '../utils/safe'

/**
 * ごみ箱。
 *
 * 消した問題とグループを、すぐには捨てずにここへ移す。
 * 削除は取り返しがつかない操作で、しかも一度に何十問も消せてしまうため、
 * 「戻せる場所」を1つ挟む。
 *
 * 形: { version: 1, items: TrashItem[] }
 *   TrashItem = { id, deletedAt, kind: 'question'|'group', group?, questions }
 *     kind='question' … 1問だけ消した。group は元のグループ（復元先が無いとき作り直す）
 *     kind='group'    … グループごと消した。中の問題もまとめて1件として持つ
 *
 * 新しいものが先頭。上限を超えたら古いものから落とす（保存容量を食い潰さないため）。
 */

/** ごみ箱に置いておける最大件数。 */
export const TRASH_MAX = 100

/** 空のごみ箱。 */
export function emptyTrash() {
  return { version: 1, items: [] }
}

/** ごみ箱の1件を作る。 */
function makeItem(kind, { group = null, questions = [] }) {
  return {
    id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    deletedAt: new Date().toISOString(),
    kind,
    group,
    questions,
  }
}

/** 保存されている形かどうかを確かめて整える。 */
function normalizeItem(raw) {
  if (!isPlainObject(raw)) return null
  const kind = raw.kind === 'group' ? 'group' : 'question'
  const questions = Array.isArray(raw.questions)
    ? raw.questions.slice(0, LIMITS.QUESTIONS).map((q, i) => normalizeQuestion(q, i))
    : []
  if (!questions.length && kind === 'question') return null
  return {
    id: typeof raw.id === 'string' ? raw.id : `t_${Math.random().toString(36).slice(2, 10)}`,
    deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : new Date().toISOString(),
    kind,
    group: isPlainObject(raw.group) ? raw.group : null,
    questions,
  }
}

/** ごみ箱を読み込む。壊れていても起動は止めない。 */
export function loadTrash() {
  try {
    const raw = localStorage.getItem(TRASH_KEY)
    if (!raw) return emptyTrash()
    const parsed = safeJsonParse(raw)
    if (!isPlainObject(parsed) || !Array.isArray(parsed.items)) return emptyTrash()
    const items = parsed.items.map(normalizeItem).filter(Boolean).slice(0, TRASH_MAX)
    return { version: 1, items }
  } catch {
    return emptyTrash()
  }
}

/**
 * ごみ箱を保存する。
 * 容量を超えたら古いものから落として、もう一度だけ試す
 * （ごみ箱のせいで問題そのものが保存できなくなるのを避ける）。
 */
export function saveTrash(trash) {
  const write = (items) => {
    localStorage.setItem(TRASH_KEY, JSON.stringify({ version: 1, items }))
  }
  // 読み込み側だけで切ると、保存領域には上限を超えた分が残り続ける
  const capped = trash.items.slice(0, TRASH_MAX)
  try {
    write(capped)
    return { ok: true }
  } catch {
    try {
      write(capped.slice(0, Math.floor(capped.length / 2)))
      return { ok: true, trimmed: true }
    } catch {
      return { ok: false }
    }
  }
}

/** 問題を1問ぶんごみ箱へ入れる。 */
export function trashQuestion(trash, question, group) {
  const item = makeItem('question', { group: group ?? null, questions: [question] })
  return { version: 1, items: [item, ...trash.items].slice(0, TRASH_MAX) }
}

/** グループを中身ごとごみ箱へ入れる。 */
export function trashGroup(trash, group, questions) {
  const item = makeItem('group', { group, questions })
  return { version: 1, items: [item, ...trash.items].slice(0, TRASH_MAX) }
}

/** 指定した1件を取り除いた新しいごみ箱を返す。 */
export function removeItem(trash, itemId) {
  return { version: 1, items: trash.items.filter((it) => it.id !== itemId) }
}

/** 中身の件数（問題の数）。 */
export function countQuestions(trash) {
  return trash.items.reduce((sum, it) => sum + it.questions.length, 0)
}
