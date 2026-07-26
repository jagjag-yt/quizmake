/**
 * 外部入力（Excel・インポートJSON・localStorage）を扱うための安全側ユーティリティ。
 *
 * このアプリはユーザーが用意したファイルをブラウザ内で解析するため、
 * 「壊れた入力」「悪意ある入力」の両方を想定して防御する。
 */

/** プロトタイプ汚染に使われるキー。取り込み時に落とす。 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * プロトタイプ汚染対策つきの JSON.parse。
 * `__proto__` などのキーは reviver で捨てる。
 *
 * @param {string} text
 * @returns {unknown}
 * @throws {SyntaxError} JSON として不正な場合
 */
export function safeJsonParse(text) {
  return JSON.parse(text, (key, value) => (DANGEROUS_KEYS.has(key) ? undefined : value))
}

/**
 * プロトタイプを持たない素のオブジェクトへコピーする（キーの安全化つき）。
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
export function sanitizeMap(obj) {
  const out = Object.create(null)
  if (!isPlainObject(obj)) return out
  for (const [k, v] of Object.entries(obj)) {
    if (DANGEROUS_KEYS.has(k)) continue
    out[k] = v
  }
  return out
}

/** 配列でもnullでもない、素のオブジェクトかどうか。 */
export function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 画像URLとして安全か判定する。
 *
 * 許可するのは http / https と、画像の data URL のみ。
 * `javascript:` などのスクリプト実行につながるスキームは拒否する。
 * （値は必ず <img src> にのみ渡し、HTMLとして挿入しない）
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export function isSafeImageUrl(url) {
  if (typeof url !== 'string') return false
  const s = url.trim()
  if (!s) return false
  if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(s)) return true
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const u = new URL(s, base)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** 安全でないURLは null にして返す。 */
export function sanitizeImageUrl(url) {
  return isSafeImageUrl(url) ? String(url).trim() : null
}

/** 文字列化し、前後の空白を除き、最大長で切り詰める。 */
export function toText(value, maxChars) {
  if (value == null) return ''
  const s = String(value).trim()
  return maxChars && s.length > maxChars ? s.slice(0, maxChars) : s
}

/** 数値として妥当なら number、そうでなければ fallback。 */
export function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** min..max に収める。 */
export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/** ローカルタイムの YYYY-MM-DD。日付キーとして使う。 */
export function dateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** dateKey に days 日を加えた dateKey。 */
export function addDays(key, days) {
  const [y, m, d] = String(key).split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + days)
  return dateKey(dt)
}

/** YYYY-MM-DD 形式かどうか。 */
export function isDateKey(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/** 秒数を mm:ss（1時間以上は h:mm:ss）に整形。 */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
