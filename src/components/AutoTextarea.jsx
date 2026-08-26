import { useLayoutEffect, useRef } from 'react'

/**
 * 中身の高さに合わせて伸びる入力欄。
 *
 * 手で高さを変える方式はやめてある（SPEC INPUT SIZE）。問題文・解説・基本事項と、
 * 表の1マスで使う。**読み込み直後にも測る**こと。Excel から入れた長い文章が
 * 最初の高さのままになり、「反映されない」と報告されたため。
 * 測るあいだ欄がつぶれるので、ページのスクロール位置は保存して戻す。
 *
 * @param {{
 *   value: string,
 *   minRows?: number,
 *   style?: object,
 *   textareaRef?: {current: HTMLTextAreaElement|null},
 * }} props
 */
export default function AutoTextarea({ value, minRows = 3, style, textareaRef = null, ...rest }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const fit = () => {
      // 測るあいだ欄がつぶれるので、ページのスクロール位置を戻す
      const scroller = document.scrollingElement ?? document.documentElement
      const top = scroller.scrollTop
      el.style.height = 'auto'
      const border = el.offsetHeight - el.clientHeight
      el.style.height = `${el.scrollHeight + border}px`
      if (scroller.scrollTop !== top) scroller.scrollTop = top
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [value])

  return (
    <textarea
      // 呼び出し側もこの欄を触る（カーソル位置を読むなど）ので、両方に渡す
      ref={(el) => {
        ref.current = el
        if (textareaRef) textareaRef.current = el
      }}
      value={value}
      rows={minRows}
      style={{ ...style, resize: 'none', overflow: 'hidden' }}
      {...rest}
    />
  )
}
