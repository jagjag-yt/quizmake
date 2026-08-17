import { COLORS } from '../constants'

/**
 * 出題対象が0件のときに、メイン領域全体に表示する空状態。
 *
 * @param {{
 *   icon?: string, title: string, message: React.ReactNode,
 *   actionLabel?: string, onAction?: () => void,
 * }} props
 */
export default function EmptyState({ icon = '☆', title, message, actionLabel, onAction }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        background: COLORS.card,
        borderRadius: '20px',
        padding: '56px 32px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        border: `1px solid ${COLORS.cardBorder}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: '40px', lineHeight: 1 }}>{icon}</span>
      <p style={{ fontSize: '16px', fontWeight: 700, color: COLORS.text, margin: 0 }}>{title}</p>
      <p style={{ fontSize: '14px', color: COLORS.sub, margin: 0, lineHeight: 1.8 }}>{message}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: '4px',
            padding: '10px 22px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.blue}`,
            background: COLORS.blue,
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
