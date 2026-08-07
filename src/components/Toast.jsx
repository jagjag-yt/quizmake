import { COLORS, TAP_MIN } from '../constants'

/**
 * トースト（画面右下の通知）。
 *
 * 種別ごとの配色は SPEC の STATES に従う:
 *   success greenLight / border green
 *   info    blueLight  / border bluePale（[元に戻す] を出せる）
 *   error   redLight   / border red（[詳細] を出せる）
 */

const TONE = {
  success: { bg: COLORS.greenLight, border: COLORS.green, icon: '✓', iconColor: COLORS.green },
  info: { bg: COLORS.blueLight, border: COLORS.bluePale, icon: '✓', iconColor: COLORS.blue },
  error: { bg: COLORS.redLight, border: COLORS.red, icon: '✕', iconColor: COLORS.red },
}

export default function ToastHost({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: 'min(420px, calc(100vw - 48px))',
      }}
    >
      {toasts.map((t) => {
        const tone = TONE[t.tone] ?? TONE.success
        return (
          <div
            key={t.id}
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '14px',
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
            }}
          >
            <span
              aria-hidden="true"
              style={{ color: tone.iconColor, fontWeight: 700, fontSize: '15px', lineHeight: 1.5 }}
            >
              {tone.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>
                {t.title}
              </div>
              {t.description && (
                <div style={{ fontSize: '12px', color: COLORS.sub, marginTop: '2px' }}>
                  {t.description}
                </div>
              )}
            </div>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.()
                  onDismiss(t.id)
                }}
                style={{
                  minHeight: `${TAP_MIN - 12}px`,
                  padding: '4px 10px',
                  borderRadius: '10px',
                  border: `1px solid ${tone.border}`,
                  background: COLORS.card,
                  color: COLORS.text,
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="閉じる"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '999px',
                border: 'none',
                background: 'transparent',
                color: COLORS.sub,
                fontSize: '13px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
