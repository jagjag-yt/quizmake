import { useEffect, useState } from 'react'
import { COLORS } from '../constants'

/**
 * 通信が切れていることの表示。
 *
 * このアプリはオフラインでも演習できるが、何も出ないと
 * 「壊れたのか、意図した動きなのか」が利用者に分からない。
 * 動き続けていることを添えて、右下に小さく出す。
 *
 * 保存ボタン（右下 24px）と重ならないよう、その1つ上に置く。
 */
export default function OfflineNotice() {
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  )
  // 一度読んだら消せるようにする。次に切れたときはまた出す（気づけないと困るため）
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const goOffline = () => {
      setOffline(true)
      setDismissed(false)
    }
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    // 表示に戻ったときに実際の状態と合わせ直す
    const sync = () => {
      const isOffline = navigator.onLine === false
      setOffline(isOffline)
      if (!isOffline) setDismissed(false)
    }
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  if (!offline || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '84px',
        zIndex: 55,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderRadius: '999px',
        background: COLORS.text,
        color: '#ffffff',
        fontSize: '12.5px',
        fontWeight: 700,
        boxShadow: '0 8px 24px rgba(15,23,42,0.24)',
        maxWidth: 'calc(100vw - 48px)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '13px', lineHeight: 1 }}>
        ⚡
      </span>
      オフラインです
      <span style={{ fontWeight: 400, color: COLORS.dashed }}>演習は続けられます</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="オフラインの表示を閉じる"
        title="閉じる"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          marginLeft: '2px',
          marginRight: '-6px',
          borderRadius: '999px',
          border: 'none',
          background: 'transparent',
          color: '#ffffff',
          fontSize: '13px',
          lineHeight: 1,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  )
}
