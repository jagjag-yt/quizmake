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
  const now = new Date().toISOString()
  return {
    id: newGroupId(),
    name: toText(name, GROUP_NAME_MAX) || DEFAULT_GROUP_NAME,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 中身が変わったグループに updatedAt を打つ。「更新順」の並べ替えに使う。
 *
 * プールの変更はすべて setPool を通るので、判定はここ1か所で足りる。
 * 変更の有無は「問題オブジェクトの同一性」で見る。React の更新は不変更新なので、
 * 触っていない問題は同じ参照のまま残り、書き換えた問題だけ別物になる。
 *
 * @param {{groups:Array, questions:Array}} prev 変更前
 * @param {{groups:Array, questions:Array}} next 変更後（連番の振り直し済み）
 */
export function stampUpdatedGroups(prev, next, now = new Date().toISOString()) {
  if (prev === next) return next

  const touched = new Set()
  const before = new Map()
  for (const q of prev.questions) before.set(q.id, q)

  for (const q of next.questions) {
    const was = before.get(q.id)
    // 追加された・中身が書き換わった
    if (was !== q) touched.add(q.groupId)
    // 別のグループから移ってきた（移動元も「変わった」）
    if (was && was.groupId !== q.groupId) touched.add(was.groupId)
    before.delete(q.id)
  }
  // 残ったものは消された問題
  for (const q of before.values()) touched.add(q.groupId)

  const prevGroups = new Map(prev.groups.map((g) => [g.id, g]))
  let changed = false
  const groups = next.groups.map((g) => {
    const was = prevGroups.get(g.id)
    // 新しいグループは makeGroup が updatedAt を入れている
    if (!was) return g
    if (was.name === g.name && !touched.has(g.id)) return g
    changed = true
    return { ...g, updatedAt: now }
  })

  return changed ? { ...next, groups } : next
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
      // 更新順の並べ替え用。旧データには無いので、作成日時で埋めておく
      updatedAt:
        toText(g.updatedAt, 40) || toText(g.createdAt, 40) || new Date().toISOString(),
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
  // 同梱データも同じ規則（グループごとに1から）で番号を振る
  return ensureIntegrity(seedPool())
}

/**
 * 参照の整合性をとる。
 * 存在しないグループを指す問題は「未分類」グループへ寄せる。
 */
export function ensureIntegrity({ groups, questions }) {
  const ids = new Set(groups.map((g) => g.id))
  const orphan = questions.some((q) => !ids.has(q.groupId))
  if (!orphan) return { groups, questions: renumberByGroup(questions) }

  let fallback = groups.find((g) => g.name === DEFAULT_GROUP_NAME)
  const nextGroups = [...groups]
  if (!fallback) {
    fallback = makeGroup(DEFAULT_GROUP_NAME)
    nextGroups.push(fallback)
  }
  return {
    groups: nextGroups,
    questions: renumberByGroup(
      questions.map((q) => (ids.has(q.groupId) ? q : { ...q, groupId: fallback.id })),
    ),
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

/**
 * グループごとに 1, 2, 3… の連番を振り直す。
 *
 * 番号はグループ内での並び順そのもの（配列の順）を表す。追加・削除・移動・
 * 並べ替え・取り込みのあと必ずここを通し、常に欠番のない連番になるようにする。
 * 学習記録は問題番号ではなく本文から作るキーで紐づけているため、振り直しても
 * 正答率やブックマークは失われない。
 */
export function renumberByGroup(questions) {
  const counters = new Map()
  let changed = false

  const next = questions.map((q) => {
    const n = (counters.get(q.groupId) ?? 0) + 1
    counters.set(q.groupId, n)
    if (q.questionNumber === n) return q
    changed = true
    return { ...q, questionNumber: n }
  })

  return changed ? next : questions
}

/** 次に作成する問題に振る番号（そのグループの問題数＋1）。 */
export function nextQuestionNumber(questions, groupId) {
  return questions.filter((q) => q.groupId === groupId).length + 1
}

/**
 * 配列のうち条件に合う要素だけを並べ替える。
 * 条件に合わない要素（他グループ・読込分）の位置は動かさない。
 */
export function reorderSubset(items, match, fromIndex, toIndex) {
  const slots = []
  items.forEach((item, i) => {
    if (match(item)) slots.push(i)
  })
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= slots.length ||
    toIndex >= slots.length ||
    fromIndex === toIndex
  ) {
    return items
  }
  const picked = slots.map((i) => items[i])
  const [moved] = picked.splice(fromIndex, 1)
  picked.splice(toIndex, 0, moved)
  const next = [...items]
  slots.forEach((slot, i) => {
    next[slot] = picked[i]
  })
  return next
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
