import { useCallback, useEffect, useState } from 'react'
import { COLORS, SPACING, TAP_MIN } from '../constants'
import { useCompactLayout } from '../hooks/useMediaQuery'
import ConfirmDialog from './ConfirmDialog'
import BackupPanel from './BackupPanel'
import {
  NAME_MAX,
  SyncError,
  deleteAccount,
  fetchAccount,
  listDevices,
  loadSession,
  logout,
  saveName,
  sendCode,
  verifyCode,
} from '../api/sync'

/**
 * アカウント。
 *
 * アカウントは**任意**で、作らなくてもアプリは全部使える。ここを独立した画面に
 * 置いているのは、「預ける」が何の上に乗っている機能なのかを分かるようにするため。
 * 設定の中に混ぜていたときは、探しにくいうえに、預ける相手（＝自分のアカウント）が
 * 見えないままボタンだけがある状態だった。
 *
 * ログインはメールに届く6桁の数字だけで、パスワードは作らない。
 * 覚えるものを増やさないため。
 */

const card = (pad) => ({
  background: COLORS.card,
  borderRadius: '20px',
  border: `1px solid ${COLORS.cardBorder}`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  padding: `${pad}px`,
})

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

const formRow = { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }

/** 入力欄とボタンの高さを揃えるための、ラベル1行ぶんの余白。 */
const alignWithLabel = { marginTop: '26px' }

/** 「2026-08-24T…」を「2026年8月24日」にする。 */
function dateLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return ''
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`
}

/**
 * @param {{
 *   onBuildPayload: () => object,
 *   onRestoreBackup: (payload: object) => {questions: number, records: number},
 *   onNotify: (toast: object) => void,
 * }} props
 */
export default function AccountView({ onBuildPayload, onRestoreBackup, onNotify }) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide

  const [session, setSession] = useState(loadSession)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('email') // email → code
  const [nameInput, setNameInput] = useState('')
  const [account, setAccount] = useState(null)
  const [devices, setDevices] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)

  /** ログイン前の状態に戻す。 */
  const signedOut = useCallback(() => {
    setSession(null)
    setStage('email')
    setCode('')
    setNameInput('')
    setAccount(null)
    setDevices(null)
  }, [])

  const handleError = useCallback(
    (err) => {
      setError(err instanceof Error && err.message ? err.message : 'うまくいきませんでした。')
      if (err instanceof SyncError && err.signedOut) signedOut()
    },
    [signedOut],
  )

  useEffect(() => {
    if (!session) return
    Promise.all([fetchAccount(), listDevices()])
      .then(([me, devs]) => {
        setAccount(me)
        setDevices(devs)
        setNameInput(me.name)
      })
      .catch(handleError)
  }, [session, handleError])

  const run = (name, fn) => {
    setBusy(name)
    setError('')
    return fn()
      .catch(handleError)
      .finally(() => setBusy(''))
  }

  const errorLine = error ? (
    <p role="alert" style={{ ...note, color: COLORS.red, marginTop: '10px' }}>
      {error}
    </p>
  ) : null

  const page = (children) => (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '720px',
        width: '100%',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.text }}>
        アカウント
      </h2>
      {children}
    </div>
  )

  /* ---- ログイン前 ---- */

  if (!session) {
    return page(
      <>
        <section style={card(space.card)}>
          <h3 style={heading}>アカウントを作る（任意）</h3>
          <p style={{ ...note, marginBottom: '12px' }}>
            アカウントは<strong>作らなくても、アプリのすべての機能を使えます</strong>。
            作ると、いまの問題と学習記録をサーバーに<strong>預けて、取り戻せる</strong>ようになります。
            端末が壊れたときや、ブラウザのデータを消してしまったときのためのものです。
          </p>
          <p style={{ ...note, marginBottom: '12px' }}>
            <strong>パスワードは作りません。</strong>
            メールアドレスに届く6桁の数字だけでログインします。覚えるものを増やさないためです。
            預けるまで、サーバーには何も送りません。
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
                <span style={{ ...note, display: 'block', marginBottom: '4px' }}>
                  メールアドレス
                </span>
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
                style={{ ...primaryButton, ...alignWithLabel }}
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
                    title: res.name ? `おかえりなさい、${res.name}さん` : 'アカウントを作りました',
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
                style={{ ...primaryButton, ...alignWithLabel }}
              >
                {busy === 'verify' ? '確認中…' : '次へ'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage('email')
                  setCode('')
                  setError('')
                }}
                style={{ ...plainButton, ...alignWithLabel }}
              >
                アドレスを直す
              </button>
            </form>
          )}

          {errorLine}
        </section>

        <section style={card(space.card)}>
          <h3 style={heading}>アカウントで何ができるか</h3>
          <ul style={{ ...note, margin: 0, paddingLeft: '1.2em' }}>
            <li>いまの問題と学習記録を、押したときだけ預けられる</li>
            <li>過去7日分から日付を選んで取り戻せる</li>
            <li>3台までの端末で、同じアカウントを使える</li>
            <li>いつでも退会でき、預けたものはすべて消える</li>
          </ul>
        </section>
      </>,
    )
  }

  /* ---- 名前がまだ無い（作った直後） ---- */

  const currentName = account?.name ?? session.name ?? ''

  if (account && !currentName) {
    return page(
      <section style={card(space.card)}>
        <h3 style={heading}>お名前を決めてください</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          画面に表示するだけの名前です。本名でなくてかまいませんし、あとから変えられます。
          {NAME_MAX}文字までです。
        </p>
        <form
          style={formRow}
          onSubmit={(e) => {
            e.preventDefault()
            const wanted = nameInput.trim()
            if (!wanted) {
              setError('名前を入力してください。')
              return
            }
            run('name', async () => {
              const saved = await saveName(wanted)
              setAccount((prev) => ({ ...prev, name: saved }))
              setSession(loadSession())
              onNotify({ tone: 'success', title: `${saved}さん、ようこそ` })
            })
          }}
        >
          <label style={{ flex: '1 1 240px', minWidth: 0 }}>
            <span style={{ ...note, display: 'block', marginBottom: '4px' }}>お名前</span>
            <input
              type="text"
              autoComplete="nickname"
              maxLength={NAME_MAX}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="例：ゆうき"
              style={input}
            />
          </label>
          <button
            type="submit"
            disabled={busy === 'name'}
            style={{ ...primaryButton, ...alignWithLabel }}
          >
            {busy === 'name' ? '保存中…' : '決定'}
          </button>
        </form>
        {errorLine}
      </section>,
    )
  }

  /* ---- ログイン後 ---- */

  return page(
    <>
      <section style={card(space.card)}>
        <h3 style={heading}>{currentName ? `${currentName} さん` : 'アカウント'}</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          {account?.email ?? session.email}
          {account?.createdAt ? `（${dateLabel(account.createdAt)}から）` : ''}
        </p>

        <form
          style={formRow}
          onSubmit={(e) => {
            e.preventDefault()
            const wanted = nameInput.trim()
            if (!wanted) {
              setError('名前を入力してください。')
              return
            }
            if (wanted === currentName) return
            run('name', async () => {
              const saved = await saveName(wanted)
              setAccount((prev) => ({ ...prev, name: saved }))
              setSession(loadSession())
              onNotify({ tone: 'success', title: '名前を変えました', description: `${saved} さん` })
            })
          }}
        >
          <label style={{ flex: '1 1 240px', minWidth: 0 }}>
            <span style={{ ...note, display: 'block', marginBottom: '4px' }}>
              お名前（{NAME_MAX}文字まで）
            </span>
            <input
              type="text"
              autoComplete="nickname"
              maxLength={NAME_MAX}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={input}
            />
          </label>
          <button
            type="submit"
            disabled={busy === 'name' || !nameInput.trim() || nameInput.trim() === currentName}
            style={{ ...plainButton, ...alignWithLabel }}
          >
            {busy === 'name' ? '保存中…' : '名前を変える'}
          </button>
        </form>
        {errorLine}
      </section>

      <BackupPanel
        cardStyle={card(space.card)}
        onBuildPayload={onBuildPayload}
        onRestore={onRestoreBackup}
        onNotify={onNotify}
        onSignedOut={signedOut}
      />

      <section style={card(space.card)}>
        <h3 style={heading}>ログイン中の端末（3台まで）</h3>
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
        <p style={note}>
          4台目でログインすると、いちばん古い端末が外れます。外れても、預けたものは消えません。
        </p>
      </section>

      <section style={card(space.card)}>
        <h3 style={heading}>ログアウトと退会</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          ログアウトしても、預けたものと、この端末の中の問題は消えません。
          退会は、サーバーに預けたものをすべて消す操作です。
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
      </section>

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
    </>,
  )
}
