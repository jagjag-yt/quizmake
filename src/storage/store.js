import {
  LEGACY_BOOKMARKS_KEY,
  LEGACY_STATS_KEY,
  LIMITS,
  STORAGE_KEY,
} from '../constants'
import {
  clamp,
  dateKey,
  isDateKey,
  isPlainObject,
  safeJsonParse,
  sanitizeMap,
  toNumber,
  toText,
} from '../utils/safe'
import { MAX_BOX } from '../utils/srs'

/**
 * 学習データの保存層。
 *
 * 保存先は localStorage 1キー（STORAGE_KEY）に集約し、形は下記のとおり。
 * 旧バージョン（ブックマーク・正答率を別キーに保存）からは自動移行する。
 *
 * ```
 * {
 *   version: 2,
 *   records: { [問題キー]: Record },   // 問題ごとの履歴・SRS・メモ・ブックマーク
 *   daily:   { 'YYYY-MM-DD': { answered, correct } },
 *   totals:  { answered, correct },
 * }
 * ```
 *
 * 外部から来た値（localStorage の中身・インポートJSON）は
 * すべて normalize を通してから使う（型崩れ・巨大データ・汚染キー対策）。
 */

export const DATA_VERSION = 2

/** 1問あたりの学習記録の初期値。 */
export function emptyRecord() {
  return {
    attempts: 0,
    correct: 0,
    lastResult: null,
    lastAnsweredAt: null,
    box: 0,
    dueAt: null,
    note: '',
    bookmarked: false,
    // 虫食い問題を最後に開いた日（採点しないため attempts とは別に持つ）
    viewedAt: null,
  }
}

/** 空の学習データ。 */
export function emptyData() {
  return {
    version: DATA_VERSION,
    records: Object.create(null),
    daily: Object.create(null),
    totals: { answered: 0, correct: 0 },
  }
}

/** 1件の記録を安全な形へ整える。壊れていれば null。 */
function normalizeRecord(raw) {
  if (!isPlainObject(raw)) return null
  const attempts = clamp(Math.floor(toNumber(raw.attempts, 0)), 0, 1_000_000)
  const correct = clamp(Math.floor(toNumber(raw.correct, 0)), 0, attempts)
  const lastResult =
    raw.lastResult === 'correct' || raw.lastResult === 'incorrect' ? raw.lastResult : null
  return {
    attempts,
    correct,
    lastResult,
    lastAnsweredAt: isDateKey(raw.lastAnsweredAt) ? raw.lastAnsweredAt : null,
    box: clamp(Math.floor(toNumber(raw.box, 0)), 0, MAX_BOX),
    dueAt: isDateKey(raw.dueAt) ? raw.dueAt : null,
    note: toText(raw.note, LIMITS.NOTE_CHARS),
    bookmarked: raw.bookmarked === true,
    viewedAt: isDateKey(raw.viewedAt) ? raw.viewedAt : null,
  }
}

/** records マップ全体を整える（件数上限つき）。 */
function normalizeRecords(raw) {
  const src = sanitizeMap(raw)
  const out = Object.create(null)
  let count = 0
  for (const [key, value] of Object.entries(src)) {
    if (count >= LIMITS.RECORDS) break
    if (typeof key !== 'string' || !key) continue
    const rec = normalizeRecord(value)
    // 何も情報が無い記録は保存しない（容量の無駄）
    if (!rec) continue
    if (!rec.attempts && !rec.bookmarked && !rec.note && !rec.viewedAt) continue
    out[key] = rec
    count += 1
  }
  return out
}

/** daily マップを整える（日付キーの形式チェックつき）。 */
function normalizeDaily(raw) {
  const src = sanitizeMap(raw)
  const out = Object.create(null)
  for (const [key, value] of Object.entries(src)) {
    if (!isDateKey(key) || !isPlainObject(value)) continue
    const answered = clamp(Math.floor(toNumber(value.answered, 0)), 0, 1_000_000)
    const correct = clamp(Math.floor(toNumber(value.correct, 0)), 0, answered)
    if (answered === 0 && correct === 0) continue
    out[key] = { answered, correct }
  }
  return out
}

/** データ全体を整える。 */
export function normalizeData(raw) {
  if (!isPlainObject(raw)) return emptyData()
  const records = normalizeRecords(raw.records)
  const daily = normalizeDaily(raw.daily)
  const totalsRaw = isPlainObject(raw.totals) ? raw.totals : {}
  const answered = clamp(Math.floor(toNumber(totalsRaw.answered, 0)), 0, 10_000_000)
  const correct = clamp(Math.floor(toNumber(totalsRaw.correct, 0)), 0, answered)
  return { version: DATA_VERSION, records, daily, totals: { answered, correct } }
}

/**
 * 旧バージョン（v1）のキーからの移行。
 * ブックマークは配列、正答率は {answered, correct} で保存されていた。
 */
function migrateFromLegacy() {
  const data = emptyData()
  let found = false

  try {
    const rawBookmarks = localStorage.getItem(LEGACY_BOOKMARKS_KEY)
    if (rawBookmarks) {
      const list = safeJsonParse(rawBookmarks)
      if (Array.isArray(list)) {
        for (const key of list.slice(0, LIMITS.RECORDS)) {
          if (typeof key !== 'string' || !key) continue
          data.records[key] = { ...emptyRecord(), bookmarked: true }
          found = true
        }
      }
    }
  } catch {
    // 壊れていれば無視して続行
  }

  try {
    const rawStats = localStorage.getItem(LEGACY_STATS_KEY)
    if (rawStats) {
      const stats = safeJsonParse(rawStats)
      if (isPlainObject(stats)) {
        const answered = clamp(Math.floor(toNumber(stats.answered, 0)), 0, 10_000_000)
        const correct = clamp(Math.floor(toNumber(stats.correct, 0)), 0, answered)
        if (answered > 0) {
          data.totals = { answered, correct }
          // 日別内訳は残っていないため、移行日にまとめて計上する
          data.daily[dateKey()] = { answered, correct }
          found = true
        }
      }
    }
  } catch {
    // 同上
  }

  return found ? data : null
}

/** localStorage から学習データを読み込む（無ければ移行、それも無ければ空）。 */
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeData(safeJsonParse(raw))
    const migrated = migrateFromLegacy()
    if (migrated) {
      saveData(migrated)
      return migrated
    }
  } catch {
    // 読めない・壊れている場合は空データで起動する（アプリを止めない）
  }
  return emptyData()
}

/**
 * localStorage へ保存する。
 * @returns {{ ok: boolean, error?: string }}
 */
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return { ok: true }
  } catch (err) {
    // 容量超過やプライベートモードでの失敗を握りつぶさず、呼び出し側へ返す
    const quota = err instanceof DOMException && /quota/i.test(err.name || err.message || '')
    return {
      ok: false,
      error: quota
        ? '保存容量の上限に達しました。学習データを書き出してから記録をリセットしてください。'
        : '学習データを保存できませんでした（ブラウザの設定をご確認ください）。',
    }
  }
}

/** エクスポート用のオブジェクト（メタ情報つき）。 */
export function buildExport(data) {
  return {
    app: 'quizmake',
    kind: 'study-data',
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { records: data.records, daily: data.daily, totals: data.totals },
  }
}

/**
 * インポートされた文字列を検証して学習データへ変換する。
 * 想定外の内容は例外にして、UI 側でメッセージを出す。
 *
 * @param {string} text
 * @returns {ReturnType<typeof emptyData>}
 */
export function parseImport(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('ファイルが空です。')
  }
  if (text.length > LIMITS.IMPORT_BYTES) {
    throw new Error('ファイルが大きすぎます（8MBまで）。')
  }

  let parsed
  try {
    parsed = safeJsonParse(text)
  } catch {
    throw new Error('JSON として読み取れませんでした。書き出したファイルを選んでください。')
  }
  if (!isPlainObject(parsed)) throw new Error('学習データの形式ではありません。')

  // 書き出し形式（data を内包）と、data 部分だけの両方を受け付ける
  const body = isPlainObject(parsed.data) ? parsed.data : parsed
  if (!isPlainObject(body.records) && !isPlainObject(body.daily) && !isPlainObject(body.totals)) {
    throw new Error('学習データが含まれていません。')
  }
  return normalizeData(body)
}

/**
 * 2つの学習データを統合する（インポート時の「追加」用）。
 * 記録は回答数の多い方を優先し、ブックマーク・メモは失わないように残す。
 */
export function mergeData(base, incoming) {
  const records = Object.assign(Object.create(null), base.records)
  for (const [key, inc] of Object.entries(incoming.records)) {
    const cur = records[key]
    if (!cur) {
      records[key] = inc
      continue
    }
    const newer = (inc.lastAnsweredAt ?? '') > (cur.lastAnsweredAt ?? '') ? inc : cur
    records[key] = {
      attempts: cur.attempts + inc.attempts,
      correct: cur.correct + inc.correct,
      lastResult: newer.lastResult,
      lastAnsweredAt: newer.lastAnsweredAt,
      box: newer.box,
      dueAt: newer.dueAt,
      note: cur.note || inc.note,
      bookmarked: cur.bookmarked || inc.bookmarked,
      viewedAt:
        (inc.viewedAt ?? '') > (cur.viewedAt ?? '') ? inc.viewedAt : cur.viewedAt,
    }
  }

  const daily = Object.assign(Object.create(null), base.daily)
  for (const [key, inc] of Object.entries(incoming.daily)) {
    const cur = daily[key]
    daily[key] = cur
      ? { answered: cur.answered + inc.answered, correct: cur.correct + inc.correct }
      : inc
  }

  return normalizeData({
    records,
    daily,
    totals: {
      answered: base.totals.answered + incoming.totals.answered,
      correct: base.totals.correct + incoming.totals.correct,
    },
  })
}
