import { useEffect } from 'react'
import { COLORS, TABS, TAP_MIN, VIEWS } from '../constants'

/**
 * 左から出すナビゲーション。
 *
 * 画面の切り替えはすべてここに集約する。
 * どの画面幅でも本文の上に重ねる（本文を右へ押し出さない）。暗幕を敷き、
 * その上をパネルが左からすべり込む。項目を選ぶか、暗幕・Esc で閉じる。
 * 押し出す方式は、開閉のたびに本文の折り返しが変わって読みづらいのでやめた。
 */

const DRAWER_W = 248

/**
 * アプリのロゴ。
 *
 * 差し替えるときは、この関数の中身だけを描き替える。
 * 画像を使う場合は public/ に置き、<img src="/logo.svg" alt="quizmake" /> にする。
 * 押すと設問一覧のグループ一覧に戻る（onClick は呼び出し側が渡す）。
 */
export function AppLogo({ onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="quizmake のトップへ"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: `${TAP_MIN - 8}px`,
        padding: '4px 8px',
        borderRadius: '10px',
        border: 'none',
        background: 'transparent',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '26px',
          height: '26px',
          borderRadius: '8px',
          background: COLORS.blue,
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        Q
      </span>
      {!compact && (
        <span style={{ fontSize: '16px', fontWeight: 700, color: COLORS.text, letterSpacing: '0.01em' }}>
          quizmake
        </span>
      )}
    </button>
  )
}

/** ドロワーを開く「≡」ボタン。 */
export function DrawerToggle({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
      aria-expanded={open}
      style={{
        width: `${TAP_MIN - 4}px`,
        height: `${TAP_MIN - 4}px`,
        borderRadius: '10px',
        border: `1px solid ${open ? COLORS.blue : COLORS.border}`,
        background: open ? COLORS.blueLight : COLORS.card,
        color: open ? COLORS.blue : COLORS.body,
        fontSize: '17px',
        lineHeight: 1,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      ≡
    </button>
  )
}

const itemStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  minHeight: `${TAP_MIN}px`,
  padding: '0 14px',
  borderRadius: '12px',
  border: 'none',
  background: active ? COLORS.blueLight : 'transparent',
  color: active ? COLORS.blue : COLORS.body,
  fontSize: '14px',
  fontWeight: 700,
  fontFamily: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
})

/**
 * @param {{
 *   open: boolean, overlay: boolean,
 *   view: string, onChangeView: (v: string) => void, onClose: () => void,
 * }} props
 */
export default function AppDrawer({ open, view, onChangeView, onClose, trashCount = 0 }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const pick = (next) => {
    onChangeView(next)
    onClose()
  }

  const panel = (
    <nav
      aria-label="メニュー"
      data-drawer-panel=""
      style={{
        width: `${DRAWER_W}px`,
        maxWidth: '86vw',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '16px 12px',
        background: COLORS.card,
        borderRight: `1px solid ${COLORS.border}`,
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 46,
        overflowY: 'auto',
        boxShadow: '8px 0 24px rgba(15,23,42,0.12)',
        animation: 'drawer-slide-in 0.18s ease-out',
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.view}
          type="button"
          aria-current={view === t.view ? 'page' : undefined}
          onClick={() => pick(t.view)}
          style={itemStyle(view === t.view || (t.view === VIEWS.QUIZ && view === VIEWS.SUMMARY))}
        >
          {t.label}
        </button>
      ))}

      <span style={{ height: '1px', background: COLORS.border, margin: '10px 6px' }} />

      {/* アカウント。預ける・取り戻すはこの中にある */}
      <button
        type="button"
        aria-current={view === VIEWS.ACCOUNT ? 'page' : undefined}
        onClick={() => pick(VIEWS.ACCOUNT)}
        style={itemStyle(view === VIEWS.ACCOUNT)}
      >
        アカウント
      </button>
      <button
        type="button"
        aria-current={view === VIEWS.TRASH ? 'page' : undefined}
        onClick={() => pick(VIEWS.TRASH)}
        style={itemStyle(view === VIEWS.TRASH)}
      >
        ごみ箱
        {trashCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: COLORS.sub }}>
            {trashCount}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-current={view === VIEWS.SETTINGS ? 'page' : undefined}
        onClick={() => pick(VIEWS.SETTINGS)}
        style={itemStyle(view === VIEWS.SETTINGS)}
      >
        設定
      </button>
    </nav>
  )

  return (
    <>
      <div
        onClick={onClose}
        data-drawer-scrim=""
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: COLORS.scrim,
          zIndex: 45,
          animation: 'drawer-scrim-in 0.18s ease-out',
        }}
      />
      {panel}
    </>
  )
}
