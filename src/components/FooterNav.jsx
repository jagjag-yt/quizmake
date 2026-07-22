const btnBase = {
  flex: 1,
  padding: '12px 24px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 700,
  textAlign: 'center',
  userSelect: 'none',
  transition: 'all 0.15s ease',
}

/**
 * フッターナビ：前の問題／リトライ／次の問題。
 *
 * @param {{
 *   isFirst: boolean,
 *   isLast: boolean,
 *   answered: boolean,
 *   onPrev: () => void,
 *   onRetry: () => void,
 *   onNext: () => void,
 * }} props
 */
export default function FooterNav({ isFirst, isLast, answered, onPrev, onRetry, onNext }) {
  const prevStyle = {
    ...btnBase,
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: isFirst ? '#cbd5e1' : '#475569',
    cursor: isFirst ? 'default' : 'pointer',
    opacity: isFirst ? 0.6 : 1,
  }

  const nextStyle = {
    ...btnBase,
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: isLast ? '#cbd5e1' : '#475569',
    cursor: isLast ? 'default' : 'pointer',
    opacity: isLast ? 0.6 : 1,
  }

  const retryStyle = {
    ...btnBase,
    border: '1px solid #2563eb',
    background: answered ? '#2563eb' : '#eff6ff',
    color: answered ? '#ffffff' : '#93c5fd',
    cursor: answered ? 'pointer' : 'default',
    opacity: answered ? 1 : 0.7,
  }

  return (
    <nav
      style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '12px 32px 32px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div style={prevStyle} onClick={isFirst ? undefined : onPrev}>
        &#8592; 前の問題
      </div>
      <div style={retryStyle} onClick={answered ? onRetry : undefined}>
        リトライ
      </div>
      <div style={nextStyle} onClick={isLast ? undefined : onNext}>
        次の問題 &#8594;
      </div>
    </nav>
  )
}
