import { useCallback, useRef, useState } from 'react'

/**
 * トーストの表示・管理。
 * tone は 'success' | 'info' | 'error'（配色は ToastHost 側の定義に対応）。
 */
export function useToast() {
  const [toasts, setToasts] = useState([])
  const seq = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    ({ tone = 'success', title, description, actionLabel, onAction, duration = 6000 }) => {
      seq.current += 1
      const id = seq.current
      setToasts((prev) => [...prev, { id, tone, title, description, actionLabel, onAction }])
      if (duration > 0) {
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
      }
      return id
    },
    [],
  )

  return { toasts, show, dismiss }
}
