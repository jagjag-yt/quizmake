/**
 * 小さな道具。外部の依存を増やさず、Workers に元からあるものだけで組む。
 */

/** JSON を返す。 */
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  })
}

/** 失敗を返す。理由は利用者に見せる日本語で持つ。 */
export function fail(status, message, extra = {}) {
  return json({ ok: false, message }, status, extra)
}

/** いまの時刻（ISO8601）。 */
export const nowIso = () => new Date().toISOString()

/** id を作る。用途ごとに接頭辞を付けて、ログで見分けられるようにする。 */
export function newId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${hex}`
}

/**
 * 6桁の数字を作る。
 * Math.random ではなく暗号用の乱数を使う（推測されないため）。
 */
export function newOtpCode() {
  const buf = crypto.getRandomValues(new Uint32Array(1))
  return String(buf[0] % 1000000).padStart(6, '0')
}

/**
 * 秘密の値をハッシュにする。
 *
 * 数字やトークンをそのまま保存すると、データベースが漏れたときにそのまま使われる。
 * 照合できれば十分なので、ハッシュだけを持つ。
 */
export async function hashSecret(value, pepper) {
  const data = new TextEncoder().encode(`${pepper}:${value}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 長さを揃えて比べる（応答時間の差から中身を推測されないため）。 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** メールアドレスを揃える。大文字と前後の空白で別人にしない。 */
export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

/** 形だけ確かめる。厳密な検証はメールが届くかどうかに任せる。 */
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

/** ユーザー名の上限（文字数）。長い名前は画面が崩れるだけで、得がない。 */
export const NAME_MAX = 20

/**
 * ユーザー名を整える。
 *
 * 前後の空白を落とし、連続する空白を1つにまとめ、改行や制御文字は取り除く。
 * 整えた結果が空なら null を返す（未設定として扱う）。
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeName(value) {
  if (typeof value !== 'string') return null
  // 制御文字（改行やタブを含む）は空白にしてから、連続する空白を1つにまとめる
  const cleaned = value
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  if (!cleaned) return null
  // 絵文字などを途中で切らないため、コードポイント単位で数える
  return [...cleaned].slice(0, NAME_MAX).join('')
}

/**
 * 使いすぎを止める。
 *
 * @param {D1Database} db
 * @param {string} bucket 数える単位（例: otp:send:foo@example.com）
 * @param {number} limit 上限
 * @param {number} windowSec 数え直すまでの秒数
 * @returns {Promise<boolean>} まだ許してよいか
 */
export async function allowRate(db, bucket, limit, windowSec) {
  const now = Date.now()
  const row = await db.prepare('SELECT count, reset_at FROM rate_limits WHERE bucket = ?')
    .bind(bucket)
    .first()

  if (!row || new Date(row.reset_at).getTime() <= now) {
    const resetAt = new Date(now + windowSec * 1000).toISOString()
    await db
      .prepare(
        'INSERT INTO rate_limits (bucket, count, reset_at) VALUES (?, 1, ?) ' +
          'ON CONFLICT(bucket) DO UPDATE SET count = 1, reset_at = excluded.reset_at',
      )
      .bind(bucket, resetAt)
      .run()
    return true
  }

  if (row.count >= limit) return false

  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE bucket = ?').bind(bucket).run()
  return true
}

/** 端末の名前を、User-Agent からそれらしく作る。見分けが付けば十分。 */
export function deviceLabel(userAgent) {
  const ua = String(userAgent ?? '')
  const os =
    /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : '不明な端末'
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'ブラウザ'
  return `${os} の ${browser}`
}
