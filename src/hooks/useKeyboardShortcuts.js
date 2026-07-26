import { useEffect, useRef } from 'react'

/** 入力中（テキスト入力・メモ欄・セレクト）はショートカットを無効にする。 */
function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('[data-shortcut-ignore="true"]')) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * 演習画面のキーボード操作。
 *
 * - a〜e / 1〜5 : 選択肢を選ぶ
 * - Enter       : 解答する（複数選択時）／次の問題へ
 * - ← →        : 前の問題 / 次の問題
 * - r           : リトライ
 * - s           : ブックマーク（b は選択肢bと重なるため s を使う）
 * - ?           : ショートカット一覧
 *
 * @param {{
 *   onChoice?: (idx: number) => void,
 *   onEnter?: () => void,
 *   onPrev?: () => void,
 *   onNext?: () => void,
 *   onRetry?: () => void,
 *   onBookmark?: () => void,
 *   onHelp?: () => void,
 * }} handlers
 * @param {boolean} enabled
 */
export function useKeyboardShortcuts(handlers, enabled = true) {
  // ハンドラの変化でリスナーを貼り直さずに済むよう ref 経由で呼ぶ
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!enabled) return undefined

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      const h = ref.current
      const key = e.key
      const lower = key.toLowerCase()

      // 選択肢: a〜e または 1〜5
      const letterIdx = ['a', 'b', 'c', 'd', 'e'].indexOf(lower)
      if (letterIdx !== -1) {
        e.preventDefault()
        h.onChoice?.(letterIdx)
        return
      }
      if (/^[1-5]$/.test(key)) {
        e.preventDefault()
        h.onChoice?.(Number(key) - 1)
        return
      }

      switch (key) {
        case 'Enter':
          e.preventDefault()
          h.onEnter?.()
          break
        case 'ArrowRight':
          e.preventDefault()
          h.onNext?.()
          break
        case 'ArrowLeft':
          e.preventDefault()
          h.onPrev?.()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          h.onRetry?.()
          break
        case 's':
        case 'S':
          e.preventDefault()
          h.onBookmark?.()
          break
        case '?':
        case '/':
          e.preventDefault()
          h.onHelp?.()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
