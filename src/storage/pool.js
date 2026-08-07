import { LIMITS, ORIGIN, POOL_KEY } from '../constants'
import { QUESTIONS, normalizeQuestion } from '../data/questions'
import { isPlainObject, safeJsonParse } from '../utils/safe'

/**
 * 出題プールの保存層。
 *
 * 作成分（authored）と読込分（imported）を1つのプールとして持ち、
 * origin フラグだけで区別する。どちらも編集・削除できる。
 *
 * 形:  { version: 1, questions: Question[] }
 */

export const POOL_VERSION = 1

/** 初期プール。同梱の問題を「読込」扱いで入れておく。 */
export function seedPool() {
  return QUESTIONS.map((q) => ({ ...q, origin: ORIGIN.IMPORTED }))
}

/** localStorage からプールを読み込む（無ければ同梱問題で初期化）。 */
export function loadPool() {
  try {
    const raw = localStorage.getItem(POOL_KEY)
    if (!raw) return seedPool()
    const parsed = safeJsonParse(raw)
    if (!isPlainObject(parsed) || !Array.isArray(parsed.questions)) return seedPool()
    const list = parsed.questions
      .slice(0, LIMITS.QUESTIONS)
      .map((q, i) => normalizeQuestion(q, i))
      .filter((q) => q.choices.length >= 2 || q.origin === ORIGIN.AUTHORED)
    return list.length ? list : seedPool()
  } catch {
    // 壊れていても起動は止めない
    return seedPool()
  }
}

/**
 * プールを保存する。
 * @returns {{ ok: boolean, error?: string }}
 */
export function savePool(questions) {
  try {
    localStorage.setItem(
      POOL_KEY,
      JSON.stringify({ version: POOL_VERSION, questions }),
    )
    return { ok: true }
  } catch (err) {
    const quota = err instanceof DOMException && /quota/i.test(err.name || err.message || '')
    return {
      ok: false,
      error: quota
        ? '保存容量の上限に達しました。不要な問題を削除するか、Excelに書き出してください。'
        : '問題を保存できませんでした（ブラウザの設定をご確認ください）。',
    }
  }
}

/** 問題番号の数値部分（「12-2」なら 12）。 */
export const numberBase = (value) => {
  const n = parseInt(String(value ?? '').split('-')[0], 10)
  return Number.isFinite(n) ? n : 0
}

/** 次に作成する問題に振る番号（プール全体の最大＋1）。 */
export function nextQuestionNumber(questions) {
  const max = questions.reduce((acc, q) => Math.max(acc, numberBase(q.questionNumber)), 0)
  return max + 1
}

/**
 * 取り込む問題の番号が既存と衝突する場合、枝番（12-2, 12-3…）を振る。
 * 既存の番号は決して振り直さない。
 */
export function resolveNumberCollisions(incoming, existing) {
  const used = new Set(existing.map((q) => String(q.questionNumber)))
  return incoming.map((q) => {
    let candidate = String(q.questionNumber)
    if (!used.has(candidate)) {
      used.add(candidate)
      return q
    }
    const base = numberBase(q.questionNumber)
    let branch = 2
    while (used.has(`${base}-${branch}`)) branch += 1
    candidate = `${base}-${branch}`
    used.add(candidate)
    return { ...q, questionNumber: candidate }
  })
}
