/**
 * 通し試験：ログイン → 預ける → 取り戻す。
 *
 * 今回の事故は「書き出したファイルに問題が入っていなかった」ことが致命傷だった。
 * 預けたものが本当に戻せるかを、毎回ここで確かめる。
 *
 * 起動:
 *   npx wrangler dev --local --port 8787 \
 *     --var SECRET_PEPPER:testpepper --var RESEND_API_KEY:dummy \
 *     --var DEV_ECHO_OTP:1 --var OTP_BURST_SECONDS:0
 *   node test/flow.mjs
 *
 * DEV_ECHO_OTP は localhost から呼ばれたときだけ6桁を応答に含める設定。
 * 本番のドメインでは効かないので、取り違えても漏れない。
 * データベースには外から触らない（dev サーバーが握っている最中に書くと落ちる）。
 */

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:8787'
const EMAIL = `flow-${Date.now()}@example.com`

let passed = 0
let failed = 0

function check(label, cond, detail = '') {
  if (cond) {
    passed += 1
    console.log(`  OK   ${label}`)
  } else {
    failed += 1
    console.log(`  NG   ${label} ${detail}`)
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // 本文が無いこともある
  }
  return { status: res.status, data }
}

/** ログインして鍵をもらう。 */
async function login(email) {
  const send = await api('/otp/send', { method: 'POST', body: { email } })
  const code = send.data?.devCode
  if (!code) return { error: `番号を受け取れない status=${send.status}` }
  const verify = await api('/otp/verify', { method: 'POST', body: { email, code } })
  return { token: verify.data?.token, code }
}

const sample = {
  app: 'quizmake',
  kind: 'backup',
  version: 2,
  pool: {
    groups: [{ id: 'g1', name: '生物', createdAt: '2026-08-01T00:00:00.000Z' }],
    questions: [
      {
        id: 'q1',
        type: 'cloze',
        questionNumber: 1,
        groupId: 'g1',
        title: '第1回',
        paras: [[{ text: '光合成は', hide: false }, { text: '葉緑体', hide: true }]],
      },
      {
        id: 'q2',
        type: 'choice',
        questionNumber: 2,
        groupId: 'g1',
        segments: [{ text: '日本の首都は', u: false }],
        choices: ['東京', '大阪'],
        correctIndexes: [0],
      },
    ],
  },
  data: { records: { 日本の首都は: { attempts: 3, correct: 2 } }, daily: {}, totals: {} },
}

console.log(`API: ${BASE}\nメール: ${EMAIL}\n`)

console.log('1. ログイン')
const first = await login(EMAIL)
check('番号を受け取れる', !!first.code, first.error ?? '')
check('鍵をもらえる', !!first.token)
const token = first.token

const reuse = await api('/otp/verify', { method: 'POST', body: { email: EMAIL, code: first.code } })
check('同じ番号は二度使えない', reuse.status !== 200 || !reuse.data?.ok, `status=${reuse.status}`)

const nextSend = await api('/otp/send', { method: 'POST', body: { email: EMAIL } })
const wrongCode = nextSend.data?.devCode === '000000' ? '111111' : '000000'
const wrong = await api('/otp/verify', { method: 'POST', body: { email: EMAIL, code: wrongCode } })
check('違う番号は通らない', wrong.status === 400, `status=${wrong.status}`)

const badEmail = await api('/otp/send', { method: 'POST', body: { email: 'こわれた' } })
check('形式が違うアドレスは拒否される', badEmail.status === 400)

console.log('\n2. 鍵が無いと触れない')
check('鍵なしは拒否される', (await api('/backups')).status === 401)
check('でたらめな鍵も拒否される', (await api('/backups', { token: 'not-a-real-token' })).status === 401)

console.log('\n3. 預ける')
const put = await api('/backup', {
  method: 'POST',
  token,
  body: { payload: sample, day: '2026-08-21' },
})
check('預けられる', put.status === 200 && put.data?.ok, JSON.stringify(put.data))
check('問題数が数えられている', put.data?.questionCount === 2, String(put.data?.questionCount))

await api('/backup', { method: 'POST', token, body: { payload: sample, day: '2026-08-21' } })
const list1 = await api('/backups', { token })
check(
  '同じ日に2回預けても1件のまま',
  list1.data?.backups?.length === 1,
  String(list1.data?.backups?.length),
)

console.log('\n4. 日付を選べる')
for (const day of ['2026-08-20', '2026-08-19']) {
  await api('/backup', { method: 'POST', token, body: { payload: sample, day } })
}
const list2 = await api('/backups', { token })
check('3日分になる', list2.data?.backups?.length === 3, String(list2.data?.backups?.length))
check('新しい順に並ぶ', list2.data?.backups?.[0]?.day === '2026-08-21')

console.log('\n5. 取り戻す')
const latest = await api('/backup', { token })
check('最新を取り戻せる', latest.status === 200 && latest.data?.day === '2026-08-21')
check(
  '問題が2問とも戻る',
  latest.data?.payload?.pool?.questions?.length === 2,
  String(latest.data?.payload?.pool?.questions?.length),
)
check(
  '虫食いの隠す指定が残っている',
  latest.data?.payload?.pool?.questions?.[0]?.paras?.[0]?.some((r) => r.hide) === true,
)
check('学習記録も戻る', !!latest.data?.payload?.data?.records?.['日本の首都は'])
check(
  '日付を選んで戻せる',
  (await api('/backup?day=2026-08-19', { token })).data?.day === '2026-08-19',
)
check('無い日付は404', (await api('/backup?day=2020-01-01', { token })).status === 404)

console.log('\n6. 7日分だけ残る')
for (let i = 1; i <= 8; i += 1) {
  const day = `2026-09-${String(i).padStart(2, '0')}`
  await api('/backup', { method: 'POST', token, body: { payload: sample, day } })
}
const list3 = await api('/backups', { token })
check(
  '8日目を足しても7件で止まる',
  list3.data?.backups?.length === 7,
  String(list3.data?.backups?.length),
)
check('残るのは新しい7日分', list3.data?.backups?.[0]?.day === '2026-09-08')

console.log('\n7. 別の人のものは見えない')
const other = await login(`other-${Date.now()}@example.com`)
const otherList = await api('/backups', { token: other.token })
check(
  '別の人には何も見えない',
  otherList.data?.backups?.length === 0,
  String(otherList.data?.backups?.length),
)

console.log('\n8. 端末は3台まで')
const tokens = [token]
for (let i = 0; i < 3; i += 1) {
  const again = await login(EMAIL)
  if (again.token) tokens.push(again.token)
}
const devices = await api('/devices', { token: tokens[tokens.length - 1] })
check('3台を超えない', devices.data?.devices?.length === 3, String(devices.data?.devices?.length))
check('外された端末は使えない', (await api('/backups', { token: tokens[0] })).status === 401)
check(
  '残った端末では預けたものが見える',
  (await api('/backups', { token: tokens[tokens.length - 1] })).data?.backups?.length === 7,
)

console.log('\n9. 中身の検査')
const live = tokens[tokens.length - 1]
check(
  '問題0問は預けられない',
  (
    await api('/backup', {
      method: 'POST',
      token: live,
      body: { payload: { pool: { groups: [], questions: [] } } },
    })
  ).status === 400,
)
check(
  '中身が無いものは預けられない',
  (await api('/backup', { method: 'POST', token: live, body: {} })).status === 400,
)

console.log('\n10. 退会するとすべて消える')
check('退会できる', (await api('/account', { method: 'DELETE', token: live })).status === 200)
check('退会後は鍵が効かない', (await api('/backups', { token: live })).status === 401)

console.log(`\n合計: ${passed} 件成功 / ${failed} 件失敗`)
process.exit(failed ? 1 : 0)
