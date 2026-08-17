import { COLORS, SPACING, TAP_MIN } from '../constants'
import { useCompactLayout, usePhoneLayout } from '../hooks/useMediaQuery'

/**
 * スマホでは3つのボタンで幅を分け合うため、1つあたり 100px ほどしか取れない。
 * 左右の余白 24px を残すと文字に 52px しか回らず、「リトライ」でも2行に折れる。
 * 余白と文字を詰めて1行に収める（実測: 360px 幅で 68px → 44px の高さになる）。
 */
const btnBase = (phone) => ({
  flex: 1,
  minWidth: 0,
  minHeight: `${TAP_MIN}px`,
  padding: phone ? '10px 6px' : '12px 24px',
  borderRadius: '12px',
  fontSize: phone ? '13px' : '14px',
  fontWeight: 700,
  fontFamily: 'inherit',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  transition: 'all 0.15s ease',
  WebkitTapHighlightColor: 'transparent',
})

/**
 * フッターナビ：前の問題／リトライ／次の問題（最終問題では「結果を見る」）。
 *
 * @param {{
 *   isFirst: boolean,
 *   isLast: boolean,
 *   answered: boolean,
 *   examMode: boolean,
 *   onPrev: () => void,
 *   onRetry: () => void,
 *   onNext: () => void,
 *   onFinish: () => void,
 * }} props
 */
export default function FooterNav({
  isFirst,
  isLast,
  answered,
  examMode,
  onPrev,
  onRetry,
  onNext,
  onFinish,
}) {
  const compact = useCompactLayout()
  const phone = usePhoneLayout()
  const base = btnBase(phone)
  const space = compact ? SPACING.compact : SPACING.wide
  // 本番モードでは解き直しをさせない（試験の再現）
  const canRetry = answered && !examMode

  const outlined = (disabled) => ({
    ...base,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.card,
    color: disabled ? '#cbd5e1' : COLORS.body,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  })

  return (
    <nav
      style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: `12px ${space.pageX}px ${compact ? 20 : 32}px ${space.pageX}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: compact ? '10px' : '16px',
      }}
    >
      <button
        type="button"
        style={outlined(isFirst)}
        onClick={isFirst ? undefined : onPrev}
        disabled={isFirst}
        title="前の問題（←）"
      >
        &#8592; 前の問題
      </button>

      <button
        type="button"
        style={{
          ...base,
          border: `1px solid ${COLORS.blue}`,
          background: canRetry ? COLORS.blue : COLORS.blueLight,
          color: canRetry ? '#ffffff' : COLORS.bluePale,
          cursor: canRetry ? 'pointer' : 'default',
          opacity: canRetry ? 1 : 0.7,
        }}
        onClick={canRetry ? onRetry : undefined}
        disabled={!canRetry}
        title="リトライ（R）"
      >
        リトライ
      </button>

      {isLast ? (
        <button
          type="button"
          style={{
            ...base,
            border: `1px solid ${COLORS.green}`,
            background: COLORS.green,
            color: '#ffffff',
            cursor: 'pointer',
          }}
          onClick={onFinish}
          title="結果を見る（→）"
        >
          結果を見る &#8594;
        </button>
      ) : (
        <button
          type="button"
          style={outlined(false)}
          onClick={onNext}
          title="次の問題（→）"
        >
          次の問題 &#8594;
        </button>
      )}
    </nav>
  )
}
