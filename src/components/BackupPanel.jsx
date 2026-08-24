import { useCallback, useEffect, useState } from 'react'
import { COLORS, TAP_MIN } from '../constants'
import ConfirmDialog from './ConfirmDialog'
import { dateKey } from '../utils/safe'
import { SyncError, getBackup, listBackups, putBackup } from '../api/sync'

/**
 * 「預ける・取り戻す」（段階6a）。アカウントの機能のひとつ。
 *
 * ログイン済みであることを前提にする。ログインの手続きは AccountView が持つ。
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
 *   onSignedOut: () => void,
 * }} props
 */
export default function BackupPanel({
  cardStyle,
  onBuildPayload,
  onRestore,
  onNotify,
  onSignedOut,
}) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [backups, setBackups] = useState(null)
  const [restoring, setRestoring] = useState(null)

  /** 失敗の理由をその場に出す。鍵が無効になっていたら画面ごと戻してもらう。 */
  const handleError = useCallback(
    (err) => {
      setError(err instanceof Error && err.message ? err.message : 'うまくいきませんでした。')
      if (err instanceof SyncError && err.signedOut) onSignedOut()
    },
    [onSignedOut],
  )

  const refresh = useCallback(async () => {
    setBackups(await listBackups())
  }, [])

  useEffect(() => {
    refresh().catch(handleError)
  }, [refresh, handleError])

  const run = (name, fn) => {
    setBusy(name)
    setError('')
    return fn()
      .catch(handleError)
      .finally(() => setBusy(''))
  }

  return (
    <section style={cardStyle}>
      <h3 style={heading}>預ける・取り戻す</h3>
      <p style={{ ...note, marginBottom: '12px' }}>
        いまの問題と学習記録を、押したときだけサーバーに預けます。過去7日分を保ち、
        日付を選んで取り戻せます。自動では送りません。
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

      <h4 style={{ ...heading, fontSize: '13px' }}>預けたもの（7日分）</h4>
      {backups === null ? (
        <p style={note}>読み込んでいます…</p>
      ) : backups.length === 0 ? (
        <p style={note}>まだ何も預けていません。上の「いまの内容を預ける」を押してください。</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0', padding: 0 }}>
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
    </section>
  )
}
