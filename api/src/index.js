import {
  NAME_MAX,
  allowRate,
  deviceLabel,
  fail,
  hashSecret,
  json,
  looksLikeEmail,
  newId,
  newOtpCode,
  normalizeEmail,
  normalizeName,
  nowIso,
  safeEqual,
} from './lib.js'

/**
 * quizmake のバックアップ API（段階6a）。
 *
 * できること: メールでログインし、問題と学習記録を預け、日付を選んで取り戻す。
 * やらないこと: 自動同期（6b）。合流の判断が要る処理はここには入れない。
 *
 * 方針:
 *   ・預かるのは利用者が「預ける」を押したときだけ。勝手に送らない。
 *   ・上書きの前に必ず残す。1日1件・7日分。
 *   ・秘密（6桁の数字・トークン）はハッシュだけを保存する。
 */

/**
 * 配信されている版。
 *
 * `/health` に載せて、外から「どれが動いているか」を確かめられるようにする。
 * これが無かったため、デプロイし忘れに気づけず、アプリだけが新しくなって
 * 「見つかりません」が返る状態になった（2026-08-24）。
 * 受け口を足したり応答を変えたりしたら、この文字列も更新すること。
 */
const API_VERSION = '2026-08-24-account'

/** 預かる上限。1件あたり。問題5000問でも数MBに収まる想定。 */
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024

/** 何日ぶん残すか。 */
const KEEP_DAYS = 7

/** 1人が同時に使える端末の数。 */
const MAX_DEVICES = 3

/**
 * 続けて送れないようにする間隔（秒）。
 *
 * 開発中だけ短くできるようにしてある（通し試験で毎回1分待てないため）。
 * 本番では設定しない＝60秒。
 */
const otpBurstSeconds = (env) => Number(env.OTP_BURST_SECONDS ?? 60)

/**
 * 開発中に、送ったはずの6桁を応答に含めるか。
 *
 * 通し試験でメールを読めないため、**ローカルの dev から呼ばれたときに限り**返す。
 * 本番では、この設定を入れても返さない（取り違えても漏れない）。
 */
function shouldEchoOtp(request, env) {
  if (String(env.DEV_ECHO_OTP) !== '1') return false
  // Cloudflare のネットワークを通った要求には必ず cf-connecting-ip が付く。
  // ローカルの wrangler dev では付かないので、これが無いときだけ返す。
  // （以前はホスト名で見ていたが、wrangler.jsonc に routes を入れてから
  //   dev でもホストが api.quiz-make.com になり、判定できなくなった）
  return !request.headers.get('cf-connecting-ip')
}

/** 6桁の数字の有効期限（分）。 */
const OTP_MINUTES = 10

/** 数字を間違えられる回数。 */
const OTP_MAX_ATTEMPTS = 5

/** 許可する呼び出し元。 */
const ALLOWED_ORIGINS = new Set([
  'https://app.quiz-make.com',
  'https://quiz-make.com',
  'http://localhost:5173',
])

function corsHeaders(request) {
  const origin = request.headers.get('origin') ?? ''
  if (!ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

/** 送られてきた JSON を読む。壊れていたら null。 */
async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Authorization ヘッダーから端末を引く。 */
async function authenticate(request, env) {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  const tokenHash = await hashSecret(token, env.SECRET_PEPPER)
  const device = await env.DB.prepare(
    'SELECT d.id, d.user_id, d.label, u.email, u.display_name, u.created_at AS user_created_at ' +
      'FROM devices d JOIN users u ON u.id = d.user_id WHERE d.token_hash = ?',
  )
    .bind(tokenHash)
    .first()
  if (!device) return null

  await env.DB.prepare('UPDATE devices SET last_used_at = ? WHERE id = ?')
    .bind(nowIso(), device.id)
    .run()
  return device
}

/**
 * 6桁の数字を送る。
 *
 * 「そのアドレスが登録されているか」は返さない。返すと、どのアドレスが使われているかを
 * 調べられてしまう。存在してもしなくても同じ応答にする。
 */
async function handleOtpSend(request, env) {
  const body = await readJson(request)
  const email = normalizeEmail(body?.email)
  if (!looksLikeEmail(email)) return fail(400, 'メールアドレスの形式が正しくありません。')

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const okEmail = await allowRate(env.DB, `otp:send:${email}`, 20, 24 * 60 * 60)
  const okIp = await allowRate(env.DB, `otp:ip:${ip}`, 30, 60 * 60)
  const okBurst = await allowRate(env.DB, `otp:burst:${email}`, 1, otpBurstSeconds(env))
  if (!okEmail || !okIp) {
    return fail(429, '送信の回数が上限に達しました。しばらく待ってからお試しください。')
  }
  if (!okBurst) {
    return fail(429, '続けて送信できません。1分ほど待ってからお試しください。')
  }

  const code = newOtpCode()
  const codeHash = await hashSecret(code, env.SECRET_PEPPER)
  const expiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000).toISOString()

  await env.DB.prepare(
    'INSERT INTO otp_requests (id, email, code_hash, expires_at, attempts, created_at) ' +
      'VALUES (?, ?, ?, ?, 0, ?)',
  )
    .bind(newId('otp'), email, codeHash, expiresAt, nowIso())
    .run()

  const echo = shouldEchoOtp(request, env)
  const sent = echo ? { ok: true } : await sendOtpMail(env, email, code)
  if (!sent.ok) {
    // 送れなかったことは伝える。黙って成功にすると、届かない理由が分からなくなる
    return fail(502, 'メールを送れませんでした。時間をおいてお試しください。')
  }

  return json({
    ok: true,
    expiresInMinutes: OTP_MINUTES,
    ...(echo ? { devCode: code } : {}),
  })
}

/** Resend でメールを送る。 */
async function sendOtpMail(env, email, code) {
  const body = {
    from: env.MAIL_FROM,
    to: [email],
    subject: `quizmake のログイン番号：${code}`,
    text: [
      'quizmake のログイン番号は次のとおりです。',
      '',
      `    ${code}`,
      '',
      `この番号は ${OTP_MINUTES} 分で使えなくなります。`,
      'お心当たりがない場合は、このメールを破棄してください。',
      '',
      'quizmake https://quiz-make.com',
    ].join('\n'),
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.log('resend failed', res.status, await res.text())
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.log('resend error', String(err))
    return { ok: false }
  }
}

/** 6桁の数字を確かめ、端末に鍵を渡す。 */
async function handleOtpVerify(request, env) {
  const body = await readJson(request)
  const email = normalizeEmail(body?.email)
  const code = String(body?.code ?? '').trim()
  if (!looksLikeEmail(email) || !/^\d{6}$/.test(code)) {
    return fail(400, '入力の形式が正しくありません。')
  }

  const row = await env.DB.prepare(
    'SELECT id, code_hash, expires_at, attempts, consumed_at FROM otp_requests ' +
      'WHERE email = ? ORDER BY created_at DESC LIMIT 1',
  )
    .bind(email)
    .first()

  if (!row || row.consumed_at) return fail(400, '番号が見つかりません。送り直してください。')
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return fail(400, '番号の有効期限が切れています。送り直してください。')
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return fail(429, '間違いが続いたため、この番号は使えません。送り直してください。')
  }

  const codeHash = await hashSecret(code, env.SECRET_PEPPER)
  if (!safeEqual(codeHash, row.code_hash)) {
    await env.DB.prepare('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = ?')
      .bind(row.id)
      .run()
    const left = OTP_MAX_ATTEMPTS - (row.attempts + 1)
    return fail(400, `番号が違います。あと${Math.max(0, left)}回まで試せます。`)
  }

  await env.DB.prepare('UPDATE otp_requests SET consumed_at = ? WHERE id = ?')
    .bind(nowIso(), row.id)
    .run()

  // 利用者を用意する（初回はここで作られる）
  let user = await env.DB.prepare('SELECT id, display_name FROM users WHERE email = ?')
    .bind(email)
    .first()
  if (!user) {
    const id = newId('u')
    await env.DB.prepare(
      'INSERT INTO users (id, email, created_at, last_seen_at) VALUES (?, ?, ?, ?)',
    )
      .bind(id, email, nowIso(), nowIso())
      .run()
    user = { id, display_name: null }
  } else {
    await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
      .bind(nowIso(), user.id)
      .run()
  }

  // 端末が多いときは、いちばん古いものを外す
  const devices = await env.DB.prepare(
    'SELECT id FROM devices WHERE user_id = ? ORDER BY last_used_at ASC',
  )
    .bind(user.id)
    .all()
  const removed = []
  const over = devices.results.length - (MAX_DEVICES - 1)
  for (let i = 0; i < over; i += 1) {
    await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(devices.results[i].id).run()
    removed.push(devices.results[i].id)
  }

  const token = `${newId('t')}${newId('k')}`
  const tokenHash = await hashSecret(token, env.SECRET_PEPPER)
  const label = deviceLabel(request.headers.get('user-agent'))
  await env.DB.prepare(
    'INSERT INTO devices (id, user_id, token_hash, label, created_at, last_used_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(newId('d'), user.id, tokenHash, label, nowIso(), nowIso())
    .run()

  return json({
    ok: true,
    token,
    email,
    // 名前がまだ無い＝この画面で決めてもらう（アプリ側はここを見て入力を出す）
    name: user.display_name ?? null,
    deviceLabel: label,
    removedDevices: removed.length,
  })
}

/** 預ける。同じ日に何度押しても、その日の1件を上書きする。 */
async function handleBackupPut(request, env, device) {
  const body = await readJson(request)
  const payload = body?.payload
  if (!payload || typeof payload !== 'object') return fail(400, '預ける内容がありません。')

  const text = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(text).length
  if (bytes > MAX_PAYLOAD_BYTES) {
    return fail(413, '内容が大きすぎます（8MBまで）。不要な問題を減らしてお試しください。')
  }

  const questionCount = Array.isArray(payload?.pool?.questions)
    ? payload.pool.questions.length
    : 0
  const groupCount = Array.isArray(payload?.pool?.groups) ? payload.pool.groups.length : 0
  if (!questionCount) return fail(400, '問題が1問も入っていません。')

  // 日付は端末のものを使う。日付が変わる時刻は利用者の感覚に合わせる
  const day = /^\d{4}-\d{2}-\d{2}$/.test(body?.day) ? body.day : nowIso().slice(0, 10)

  await env.DB.prepare(
    'INSERT INTO backups (id, user_id, day, payload, question_count, group_count, bytes, device_id, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(user_id, day) DO UPDATE SET ' +
      'payload = excluded.payload, question_count = excluded.question_count, ' +
      'group_count = excluded.group_count, bytes = excluded.bytes, ' +
      'device_id = excluded.device_id, updated_at = excluded.updated_at',
  )
    .bind(
      newId('b'),
      device.user_id,
      day,
      text,
      questionCount,
      groupCount,
      bytes,
      device.id,
      nowIso(),
      nowIso(),
    )
    .run()

  // 古いものを落とす。残すのは新しい7日分
  await env.DB.prepare(
    'DELETE FROM backups WHERE user_id = ? AND day NOT IN ' +
      '(SELECT day FROM backups WHERE user_id = ? ORDER BY day DESC LIMIT ?)',
  )
    .bind(device.user_id, device.user_id, KEEP_DAYS)
    .run()

  return json({ ok: true, day, questionCount, groupCount, bytes })
}

/** 預けたものの一覧（中身は返さない。選ぶための情報だけ）。 */
async function handleBackupList(env, device) {
  const rows = await env.DB.prepare(
    'SELECT day, question_count, group_count, bytes, updated_at FROM backups ' +
      'WHERE user_id = ? ORDER BY day DESC',
  )
    .bind(device.user_id)
    .all()

  return json({
    ok: true,
    backups: rows.results.map((r) => ({
      day: r.day,
      questionCount: r.question_count,
      groupCount: r.group_count,
      bytes: r.bytes,
      updatedAt: r.updated_at,
    })),
  })
}

/** 取り戻す。日付を指定しなければ、いちばん新しいもの。 */
async function handleBackupGet(url, env, device) {
  const day = url.searchParams.get('day')
  const row = day
    ? await env.DB.prepare('SELECT day, payload FROM backups WHERE user_id = ? AND day = ?')
        .bind(device.user_id, day)
        .first()
    : await env.DB.prepare(
        'SELECT day, payload FROM backups WHERE user_id = ? ORDER BY day DESC LIMIT 1',
      )
        .bind(device.user_id)
        .first()

  if (!row) return fail(404, '預けたものが見つかりません。')

  let payload
  try {
    payload = JSON.parse(row.payload)
  } catch {
    return fail(500, '預けた内容を読み取れませんでした。')
  }
  return json({ ok: true, day: row.day, payload })
}

/** アカウントの中身（名前・メール・いつ作ったか）。 */
function handleMeGet(device) {
  return json({
    ok: true,
    email: device.email,
    name: device.display_name ?? null,
    createdAt: device.user_created_at,
    deviceLabel: device.label,
  })
}

/**
 * 名前を決める・変える。
 *
 * 本人確認には使わない見た目だけの名前なので、重複は許す。
 * 同姓同名を禁じても得がなく、断られる理由が利用者に伝わりにくい。
 */
async function handleMePost(request, env, device) {
  const body = await readJson(request)
  const name = normalizeName(body?.name)
  if (!name) return fail(400, '名前を入力してください。')
  if ([...String(body?.name ?? '')].length > NAME_MAX) {
    return fail(400, `名前は${NAME_MAX}文字までにしてください。`)
  }

  await env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?')
    .bind(name, device.user_id)
    .run()
  return json({ ok: true, name })
}

/** いまログインしている端末の一覧。 */
async function handleDevices(env, device) {
  const rows = await env.DB.prepare(
    'SELECT id, label, created_at, last_used_at FROM devices WHERE user_id = ? ORDER BY last_used_at DESC',
  )
    .bind(device.user_id)
    .all()
  return json({
    ok: true,
    devices: rows.results.map((r) => ({
      id: r.id,
      label: r.label,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      current: r.id === device.id,
    })),
  })
}

/** 退会。預けたものも端末もすべて消す。 */
async function handleDeleteAccount(env, device) {
  await env.DB.prepare('DELETE FROM backups WHERE user_id = ?').bind(device.user_id).run()
  await env.DB.prepare('DELETE FROM devices WHERE user_id = ?').bind(device.user_id).run()
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(device.user_id).run()
  return json({ ok: true })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const cors = corsHeaders(request)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const withCors = (res) => {
      const headers = new Headers(res.headers)
      for (const [k, v] of Object.entries(cors)) headers.set(k, v)
      return new Response(res.body, { status: res.status, headers })
    }

    try {
      if (url.pathname === '/health') {
        return withCors(json({ ok: true, version: API_VERSION }))
      }

      if (url.pathname === '/otp/send' && request.method === 'POST') {
        return withCors(await handleOtpSend(request, env))
      }
      if (url.pathname === '/otp/verify' && request.method === 'POST') {
        return withCors(await handleOtpVerify(request, env))
      }

      // ここから先は鍵が要る
      const device = await authenticate(request, env)
      if (!device) return withCors(fail(401, 'ログインが必要です。'))

      if (url.pathname === '/backup' && request.method === 'POST') {
        return withCors(await handleBackupPut(request, env, device))
      }
      if (url.pathname === '/backup' && request.method === 'GET') {
        return withCors(await handleBackupGet(url, env, device))
      }
      if (url.pathname === '/backups' && request.method === 'GET') {
        return withCors(await handleBackupList(env, device))
      }
      if (url.pathname === '/me' && request.method === 'GET') {
        return withCors(handleMeGet(device))
      }
      if (url.pathname === '/me' && request.method === 'POST') {
        return withCors(await handleMePost(request, env, device))
      }
      if (url.pathname === '/devices' && request.method === 'GET') {
        return withCors(await handleDevices(env, device))
      }
      if (url.pathname === '/logout' && request.method === 'POST') {
        await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(device.id).run()
        return withCors(json({ ok: true }))
      }
      if (url.pathname === '/account' && request.method === 'DELETE') {
        return withCors(await handleDeleteAccount(env, device))
      }

      return withCors(fail(404, '見つかりません。'))
    } catch (err) {
      console.log('unhandled', String(err))
      return withCors(fail(500, '処理に失敗しました。'))
    }
  },
}
