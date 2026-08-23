import { useCallback, useEffect, useState } from 'react'
import { COLORS, TAP_MIN } from '../constants'
import ConfirmDialog from './ConfirmDialog'
import { dateKey } from '../utils/safe'
import {
  SyncError,
  deleteAccount,
  getBackup,
  listBackups,
  listDevices,
  loadSession,
  logout,
  putBackup,
  sendCode,
  verifyCode,
} from '../api/sync'

/**
 * 「預ける・取り戻す」（段階6a）。
 *
 * 自動では何も送らない。押したときだけ預け、押したときだけ取り戻す。
 * 取り戻しは**足すだけ**にしてある。いまある問題を消す操作を用意すると、
 * 押し間違いで取り返しがつかなくなるため。
 */

const heading = { fontSize: '14px', fontWeight: 700, color: COLORS.text, margin: '0 0 6px 0' }
const note = { margin: 0, fontSize: '12.5px', color: COLORS.sub, lineHeight: 1.8 }

const primaryButton = {
  minHeight: `${TAP_MIN}px`,
  padding: '0 20px',
  borderRadius: '12px',
  border: `1px solid ${COLORS.blue}`,
  background: COLORS.blue,
  color: COLORS.onAccent,
  fontSize: '13.5px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const plainButton = {
  ...primaryButton,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.body,
}

const smallButton = {
  ...plainButton,
  minHeight: `${TAP_MIN - 8}px`,
  padding: '0 14px',
  fontSize: '12.5px',
}

const input = {
  minHeight: `${TAP_MIN}px`,
  padding: '0 12px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.text,
  fontSize: '14px',
  fontFamily: 'inherit',
  width: '100%',
  maxWidth: '320px',
  boxSizing: 'border-box',
}

const formRow = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
}

/** 「2026-08-24」を「8月24日」にする。日付を選ぶときに読みやすくするため。 */
function dayLabel(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ''))
  if (!m) return String(day ?? '')
  return `${Number(m[2])}月${Number(m[3])}日`
}

/** バイト数を読める形にする。 */
function sizeLabel(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`
  return `${(n / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * @param {{
 *   cardStyle: object,
 *   onBuildPayload: () => object,
 *   onRestore: (payload: object) => {questions: number, records: number},
 *   onNotify: (toast: object) => void,
 * }} props
 */
export default function SyncPanel({ cardStyle, onBuildPayload, onRestore, onNotify }) {
  const [session, setSession] = useState(loadSession)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('email') // email → code
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [backups, setBackups] = useState(null)
  const [devices, setDevices] = useState(null)
  const [restoring, setRestoring] = useState(null) // 取り戻す対象
  const [leaving, setLeaving] = useState(false)

  /** ログイン前の状態に戻す。 */
  const signedOut = useCallback(() => {
    setSession(null)
    setStage('email')
    setCode('')
    setBackups(null)
    setDevices(null)
  }, [])

  /** 失敗の理由をその場に出す。鍵が無効になっていたら画面も戻す。 */
  const handleError = useCallback(
    (err) => {
      // 通信の失敗も、取り込みの失敗（形が違う等）も、理由をそのまま出す
      setError(err instanceof Error && err.message ? err.message : 'うまくいきませんでした。')
      if (err instanceof SyncError && err.signedOut) signedOut()
    },
    [signedOut],
  )

  /** 預けたものと端末の一覧を読み直す。 */
  const refresh = useCallback(async () => {
    const [list, devs] = await Promise.all([listBackups(), listDevices()])
    setBackups(list)
    setDevices(devs)
  }, [])

  useEffect(() => {
    if (!session) return
    refresh().catch(handleError)
  }, [session, refresh, handleError])

  /** 押している間だけ止める。失敗しても busy は必ず戻す。 */
  const run = (name, fn) => {
    setBusy(name)
    setError('')
    return fn()
      .catch(handleError)
      .finally(() => setBusy(''))
  }

  /* ---- ログイン前 ---- */

  if (!session) {
    return (
      <section style={cardStyle}>
        <h3 style={heading}>預ける・取り戻す</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          問題と学習記録を、押したときだけサーバーに預けます。端末が壊れたときや、
          ブラウザのデータを消してしまったときに取り戻せます。過去7日分を保ちます。
          <br />
          パスワードは作りません。メールアドレスに届く6桁の数字でログインします。
          「預ける」を押すまで、サーバーには何も送りません。
        </p>

        {stage === 'email' ? (
          <form
            style={formRow}
            onSubmit={(e) => {
              e.preventDefault()
              const address = email.trim()
              if (!address) return
              run('send', async () => {
                const res = await sendCode(address)
                setStage('code')
                onNotify({
                  tone: 'success',
                  title: '6桁の数字を送りました',
                  description: `${res.expiresInMinutes}分以内に入力してください`,
                })
                // 開発中（localhost）だけ、届いた数字をそのまま入れておく
                if (res.devCode) setCode(res.devCode)
              })
            }}
          >
            <label style={{ flex: '1 1 240px', minWidth: 0 }}>
              <span style={{ ...note, display: 'block', marginBottom: '4px' }}>メールアドレス</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={input}
              />
            </label>
            <button
              type="submit"
              disabled={busy === 'send'}
              style={{ ...primaryButton, marginTop: '26px' }}
            >
              {busy === 'send' ? '送信中…' : '数字を送る'}
            </button>
          </form>
        ) : (
          <form
            style={formRow}
            onSubmit={(e) => {
              e.preventDefault()
              const digits = code.trim()
              if (!/^\d{6}$/.test(digits)) {
                setError('6桁の数字を入力してください。')
                return
              }
              run('verify', async () => {
                const res = await verifyCode(email.trim(), digits)
                setSession(loadSession())
                setCode('')
                onNotify({
                  tone: 'success',
                  title: 'ログインしました',
                  description:
                    res.removedDevices > 0
                      ? `端末は3台までのため、古い端末を${res.removedDevices}台外しました`
                      : res.email,
                })
              })
            }}
          >
            <label style={{ flex: '1 1 200px', minWidth: 0 }}>
              <span style={{ ...note, display: 'block', marginBottom: '4px' }}>
                {email} に届いた6桁の数字
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{ ...input, maxWidth: '160px', letterSpacing: '0.2em' }}
              />
            </label>
            <button
              type="submit"
              disabled={busy === 'verify'}
              style={{ ...primaryButton, marginTop: '26px' }}
            >
              {busy === 'verify' ? '確認中…' : 'ログイン'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage('email')
                setCode('')
                setError('')
              }}
              style={{ ...plainButton, marginTop: '26px' }}
            >
              アドレスを直す
            </button>
          </form>
        )}

        {error && (
          <p role="alert" style={{ ...note, color: COLORS.red, marginTop: '10px' }}>
            {error}
          </p>
        )}
      </section>
    )
  }

  /* ---- ログイン後 ---- */

  return (
    <section style={cardStyle}>
      <h3 style={heading}>預ける・取り戻す</h3>
      <p style={{ ...note, marginBottom: '12px' }}>
        {session.email} でログイン中
        {session.deviceLabel ? `（この端末：${session.deviceLabel}）` : ''}
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          type="button"
          disabled={busy === 'put'}
          onClick={() =>
            run('put', async () => {
              const res = await putBackup(onBuildPayload(), dateKey())
              await refresh()
              onNotify({
                tone: 'success',
                title: '預けました',
                description: `問題 ${res.questionCount} 問 ／ グループ ${res.groupCount} 個`,
              })
            })
          }
          style={primaryButton}
        >
          {busy === 'put' ? '預けています…' : 'いまの内容を預ける'}
        </button>
        <button
          type="button"
          disabled={busy === 'refresh'}
          onClick={() => run('refresh', refresh)}
          style={plainButton}
        >
          一覧を読み直す
        </button>
      </div>

      {/* 預けたもの */}
      <h4 style={{ ...heading, fontSize: '13px' }}>預けたもの（7日分）</h4>
      {backups === null ? (
        <p style={note}>読み込んでいます…</p>
      ) : backups.length === 0 ? (
        <p style={note}>まだ何も預けていません。上の「いまの内容を預ける」を押してください。</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0 }}>
          {backups.map((b) => (
            <li
              key={b.day}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '10px 0',
                borderBottom: `1px solid ${COLORS.rowBorder}`,
              }}
            >
              <span style={{ ...note, color: COLORS.body, minWidth: 0, overflowWrap: 'anywhere' }}>
                {dayLabel(b.day)}　問題 {b.questionCount} 問 ／ グループ {b.groupCount} 個
                <span style={{ color: COLORS.muted }}>（{sizeLabel(b.bytes)}）</span>
              </span>
              <button
                type="button"
                disabled={busy === 'get'}
                onClick={() => setRestoring(b)}
                style={smallButton}
              >
                取り戻す
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 端末 */}
      <h4 style={{ ...heading, fontSize: '13px', marginTop: '16px' }}>
        ログイン中の端末（3台まで）
      </h4>
      {devices === null ? (
        <p style={note}>読み込んでいます…</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0 0 8px 0', padding: 0 }}>
          {devices.map((d) => (
            <li key={d.id} style={{ ...note, padding: '3px 0', overflowWrap: 'anywhere' }}>
              {d.label}
              {d.current ? '（この端末）' : ''}
            </li>
          ))}
        </ul>
      )}
      <p style={{ ...note, marginBottom: '12px' }}>
        4台目でログインすると、いちばん古い端末が外れます。外れても、預けたものは消えません。
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={busy === 'logout'}
          onClick={() =>
            run('logout', async () => {
              await logout()
              signedOut()
              onNotify({
                tone: 'info',
                title: 'ログアウトしました',
                description: '預けたものは残っています',
              })
            })
          }
          style={plainButton}
        >
          この端末をログアウト
        </button>
        <button
          type="button"
          onClick={() => setLeaving(true)}
          style={{ ...plainButton, border: `1px solid ${COLORS.red}`, color: COLORS.red }}
        >
          退会（預けたものを消す）
        </button>
      </div>

      {error && (
        <p role="alert" style={{ ...note, color: COLORS.red, marginTop: '10px' }}>
          {error}
        </p>
      )}

      {restoring && (
        <ConfirmDialog
          title={`${dayLabel(restoring.day)}の内容を取り戻しますか？`}
          message={`預けた ${restoring.questionCount} 問を、いまの問題に足します。いまある問題は消えません。同じ問題を持っている端末では二重になります（不要なほうは、あとから消せます）。`}
          confirmLabel="取り戻す"
          danger={false}
          onCancel={() => setRestoring(null)}
          onConfirm={() => {
            const day = restoring.day
            setRestoring(null)
            run('get', async () => {
              const res = await getBackup(day)
              const added = onRestore(res.payload)
              onNotify({
                tone: 'success',
                title: '取り戻しました',
                description: `問題 ${added.questions} 問 ／ 記録 ${added.records} 件`,
              })
            })
          }}
        />
      )}

      {leaving && (
        <ConfirmDialog
          title="退会しますか？"
          message="サーバーに預けた7日分と、ログイン中の端末をすべて消します。元に戻せません。この端末の中にある問題と学習記録は消えません。"
          confirmLabel="退会する"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false)
            run('leave', async () => {
              await deleteAccount()
              signedOut()
              onNotify({
                tone: 'info',
                title: '退会しました',
                description: '預けたものを消しました',
              })
            })
          }}
        />
      )}
    </section>
  )
}
