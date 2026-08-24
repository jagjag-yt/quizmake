import { API_BASE, SYNC_KEY } from '../constants'

/**
 * バックアップ API との受け渡し（段階6a）。
 *
 * 方針:
 *   ・送るのは利用者が押したときだけ。ここに自動で走る処理は置かない。
 *   ・この端末に置くのは鍵（トークン）とメールアドレスだけ。問題は置かない。
 *   ・失敗の理由は日本語のまま画面に出す。原因が分からないまま終わらせない。
 *
 * サーバー側の仕様は api/src/index.js を見ること。
 */

/**
 * ユーザー名の上限（文字数）。
 * サーバー側（api/src/lib.js の NAME_MAX）と同じ値にしておく。
 * 画面で先に止めるためのもので、本当の判定はサーバーが行う。
 */
export const NAME_MAX = 20

/** 通信の待ち時間の上限（ミリ秒）。返らないまま止まって見えるのを防ぐ。 */
const TIMEOUT_MS = 20000

/** 保存している鍵を読む。壊れていたら無いものとして扱う。 */
export function loadSession() {
  try {
    const raw = localStorage.getItem(SYNC_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token) return null
    return {
      token: parsed.token,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      deviceLabel: typeof parsed.deviceLabel === 'string' ? parsed.deviceLabel : '',
    }
  } catch {
    return null
  }
}

/** 鍵を保存する。 */
export function saveSession(session) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(session))
  } catch {
    // 保存できなくても、その回の操作は続けられる
  }
}

/** 鍵を捨てる（ログアウト・退会・鍵が無効になったとき）。 */
export function clearSession() {
  try {
    localStorage.removeItem(SYNC_KEY)
  } catch {
    // 消せなくても呼び出し側は続ける
  }
}

/**
 * 通信の失敗。画面にそのまま出せる日本語を message に持つ。
 * signedOut が true のときは、この端末の鍵が使えなくなっている。
 */
export class SyncError extends Error {
  constructor(message, { status = 0, signedOut = false } = {}) {
    super(message)
    this.name = 'SyncError'
    this.status = status
    this.signedOut = signedOut
  }
}

/**
 * API を1回呼ぶ。
 *
 * @param {string} path `/backup` など
 * @param {{method?: string, body?: object, token?: string, query?: object}} [options]
 */
async function call(path, { method = 'GET', body, token, query } = {}) {
  const url = new URL(`${API_BASE}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value != null) url.searchParams.set(key, String(value))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new SyncError(
      aborted
        ? '時間内に応答がありませんでした。電波の良いところでお試しください。'
        : '通信できませんでした。ネットワークにつながっているかご確認ください。',
    )
  } finally {
    clearTimeout(timer)
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    // 本文が無い・壊れている場合は status だけで判断する
  }

  if (!res.ok) {
    // 401 は鍵が使えないとき。端末が3台を超えて外された場合もここに来る
    if (res.status === 401) {
      clearSession()
      throw new SyncError('この端末のログインが解除されています。もう一度ログインしてください。', {
        status: 401,
        signedOut: true,
      })
    }
    throw new SyncError(
      typeof data?.message === 'string' && data.message
        ? data.message
        : `うまくいきませんでした（${res.status}）。時間をおいてお試しください。`,
      { status: res.status },
    )
  }

  return data ?? {}
}

/** 鍵が要る呼び出し。ログインしていなければその場で止める。 */
async function callAuthed(path, options = {}) {
  const session = loadSession()
  if (!session) {
    throw new SyncError('ログインが必要です。', { status: 401, signedOut: true })
  }
  return call(path, { ...options, token: session.token })
}

/** 6桁の数字をメールで送ってもらう。 */
export async function sendCode(email) {
  const data = await call('/otp/send', { method: 'POST', body: { email } })
  // 開発用（localhost）でだけ 6桁が返る。本番では undefined
  return { expiresInMinutes: data.expiresInMinutes ?? 10, devCode: data.devCode }
}

/**
 * 6桁の数字を確かめ、この端末に鍵を保存する。
 *
 * 名前がまだ無い（初めて作るアカウント）ときは name が空になる。
 * 呼び出し側はそれを見て、名前を決める画面を出す。
 *
 * @returns {{email: string, name: string, deviceLabel: string, removedDevices: number}}
 */
export async function verifyCode(email, code) {
  const data = await call('/otp/verify', { method: 'POST', body: { email, code } })
  if (!data.token) throw new SyncError('ログインできませんでした。もう一度お試しください。')
  const session = {
    token: data.token,
    email: data.email ?? email,
    name: typeof data.name === 'string' ? data.name : '',
    deviceLabel: data.deviceLabel ?? '',
  }
  saveSession(session)
  return {
    email: session.email,
    name: session.name,
    deviceLabel: session.deviceLabel,
    removedDevices: Number(data.removedDevices ?? 0),
  }
}

/** アカウントの中身（名前・メール・作成日）。 */
export async function fetchAccount() {
  const data = await callAuthed('/me')
  return {
    email: data.email ?? '',
    name: typeof data.name === 'string' ? data.name : '',
    createdAt: data.createdAt ?? null,
  }
}

/**
 * 名前を決める・変える。
 * この端末に覚えている名前も同時に更新する（画面がすぐ追いつくように）。
 */
export async function saveName(name) {
  const data = await callAuthed('/me', { method: 'POST', body: { name } })
  const session = loadSession()
  if (session) saveSession({ ...session, name: data.name ?? '' })
  return data.name ?? ''
}

/**
 * 預ける。同じ日に何度押しても、その日の1件を上書きする。
 *
 * @param {object} payload 書き出しと同じ形（buildExport の戻り値）
 * @param {string} day `YYYY-MM-DD`。端末の日付を使う
 */
export async function putBackup(payload, day) {
  return callAuthed('/backup', { method: 'POST', body: { payload, day } })
}

/** 預けたものの一覧（中身は含まない）。 */
export async function listBackups() {
  const data = await callAuthed('/backups')
  return Array.isArray(data.backups) ? data.backups : []
}

/** 取り戻す。日付を省くと、いちばん新しいもの。 */
export async function getBackup(day) {
  const data = await callAuthed('/backup', { query: { day } })
  return { day: data.day, payload: data.payload }
}

/** ログインしている端末の一覧。 */
export async function listDevices() {
  const data = await callAuthed('/devices')
  return Array.isArray(data.devices) ? data.devices : []
}

/** この端末だけログアウトする。預けたものは消さない。 */
export async function logout() {
  try {
    await callAuthed('/logout', { method: 'POST' })
  } finally {
    // サーバー側で消せなくても、この端末からは必ず鍵を落とす
    clearSession()
  }
}

/** 退会。預けたものも端末もすべて消える。 */
export async function deleteAccount() {
  try {
    await callAuthed('/account', { method: 'DELETE' })
  } finally {
    clearSession()
  }
}
