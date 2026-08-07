import {
  DEFAULT_GROUP_NAME,
  GROUP_NAME_MAX,
  LEGACY_POOL_KEY,
  LIMITS,
  ORIGIN,
  POOL_KEY,
} from '../constants'
import { SEED_QUESTIONS, newQuestionId, normalizeQuestion } from '../data/questions'
import { isPlainObject, safeJsonParse, toText } from '../utils/safe'

/**
 * 出題プールの保存層。
 *
 * 問題は必ずいずれかの「グループ」に属する（旧「科目」の置き換え）。
 * グループは Excel の1ファイル、あるいはアプリ内で作った1まとまりに対応する。
 *
 * 形:  { version: 2, groups: Group[], questions: Question[] }
 *      Group { id, name, createdAt }
 */

export const POOL_VERSION = 2

/** グループIDを発行する。 */
export function newGroupId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `g_${crypto.randomUUID()}`
  }
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** グループを作る。 */
export function makeGroup(name) {
  return {
    id: newGroupId(),
    name: toText(name, GROUP_NAME_MAX) || DEFAULT_GROUP_NAME,
    createdAt: new Date().toISOString(),
  }
}

/** 同梱の問題で初期プールを作る（種の group 名がそのままグループになる）。 */
export function seedPool() {
  const groups = []
  const byName = new Map()
  const questions = SEED_QUESTIONS.map((raw, i) => {
    const name = raw.group || DEFAULT_GROUP_NAME
    if (!byName.has(name)) {
      const group = makeGroup(name)
      byName.set(name, group)
      groups.push(group)
    }
    return normalizeQuestion(
      { ...raw, groupId: byName.get(name).id, origin: ORIGIN.IMPORTED },
      i,
    )
  })
  return { groups, questions }
}

/** グループ配列を安全な形へ整える。 */
function normalizeGroups(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const g of raw.slice(0, 500)) {
    if (!isPlainObject(g)) continue
    const id = toText(g.id, 40)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      name: toText(g.name, GROUP_NAME_MAX) || DEFAULT_GROUP_NAME,
      createdAt: toText(g.createdAt, 40) || new Date().toISOString(),
    })
  }
  return out
}

/**
 * 旧形式（v1：問題に「科目」を持ち、グループが無い）からの移行。
 * 科目名をそのままグループ名に読み替える。
 */
function migrateFromV1() {
  try {
    const raw = localStorage.getItem(LEGACY_POOL_KEY)
    if (!raw) return null
    const parsed = safeJsonParse(raw)
    if (!isPlainObject(parsed) || !Array.isArray(parsed.questions)) return null

    const groups = []
    const byName = new Map()
    const ensure = (name) => {
      const key = name || DEFAULT_GROUP_NAME
      if (!byName.has(key)) {
        const group = makeGroup(key)
        byName.set(key, group)
        groups.push(group)
      }
      return byName.get(key).id
    }

    const questions = parsed.questions
      .slice(0, LIMITS.QUESTIONS)
      .map((q, i) =>
        normalizeQuestion({ ...q, groupId: ensure(toText(q?.subject, GROUP_NAME_MAX)) }, i),
      )

    return questions.length ? { groups, questions } : null
  } catch {
    return null
  }
}

/** 保存されたプールを読み込む（無ければ移行、それも無ければ同梱問題）。 */
export function loadPool() {
  try {
    const raw = localStorage.getItem(POOL_KEY)
    if (raw) {
      const parsed = safeJsonParse(raw)
      if (isPlainObject(parsed) && Array.isArray(parsed.questions)) {
        const groups = normalizeGroups(parsed.groups)
        const questions = parsed.questions
          .slice(0, LIMITS.QUESTIONS)
          .map((q, i) => normalizeQuestion(q, i))
        return ensureIntegrity({ groups, questions })
      }
    }
    const migrated = migrateFromV1()
    if (migrated) {
      savePool(migrated)
      return ensureIntegrity(migrated)
    }
  } catch {
    // 壊れていても起動は止めない
  }
  return seedPool()
}

/**
 * 参照の整合性をとる。
 * 存在しないグループを指す問題は「未分類」グループへ寄せる。
 */
export function ensureIntegrity({ groups, questions }) {
  const ids = new Set(groups.map((g) => g.id))
  const orphan = questions.some((q) => !ids.has(q.groupId))
  if (!orphan) return { groups, questions }

  let fallback = groups.find((g) => g.name === DEFAULT_GROUP_NAME)
  const nextGroups = [...groups]
  if (!fallback) {
    fallback = makeGroup(DEFAULT_GROUP_NAME)
    nextGroups.push(fallback)
  }
  return {
    groups: nextGroups,
    questions: questions.map((q) => (ids.has(q.groupId) ? q : { ...q, groupId: fallback.id })),
  }
}

/**
 * プールを保存する。
 * @returns {{ ok: boolean, error?: string }}
 */
export function savePool({ groups, questions }) {
  try {
    localStorage.setItem(
      POOL_KEY,
      JSON.stringify({ version: POOL_VERSION, groups, questions }),
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
    const candidate = String(q.questionNumber)
    if (!used.has(candidate)) {
      used.add(candidate)
      return q
    }
    const base = numberBase(q.questionNumber)
    let branch = 2
    while (used.has(`${base}-${branch}`)) branch += 1
    used.add(`${base}-${branch}`)
    return { ...q, questionNumber: `${base}-${branch}` }
  })
}

/** 同じ名前のグループがあれば連番を付けて重複を避ける。 */
export function uniqueGroupName(name, groups) {
  const base = toText(name, GROUP_NAME_MAX) || DEFAULT_GROUP_NAME
  const used = new Set(groups.map((g) => g.name))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base} (${n})`)) n += 1
  return `${base} (${n})`
}

/** 問題を複製する（IDは振り直す）。 */
export const cloneQuestion = (q, patch = {}) => ({ ...q, id: newQuestionId(), ...patch })
