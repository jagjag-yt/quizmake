import { useEffect, useState } from 'react'
import { COMPACT_QUERY, HOVER_QUERY, PHONE_QUERY, PREVIEW_TIGHT_QUERY } from '../constants'

/**
 * CSS メディアクエリの一致状態を購読する。
 *
 * このアプリの見た目はインラインスタイルで組んでいるため、CSS の
 * `@media` では上書きできない（インラインスタイルの方が強い）。
 * そこで画面幅や入力方式の判定を JS 側で行い、スタイル値を差し替える。
 *
 * @param {string} query 例: '(max-width: 1023px)'
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mql = window.matchMedia(query)
    const sync = () => setMatches(mql.matches)

    sync() // マウント時点の実際の値に合わせる

    mql.addEventListener('change', sync)
    // 一部の環境（アプリ内ブラウザや埋め込みビューなど）では matchMedia の
    // change が発火しないことがあるため、確実に発火する resize / 画面回転でも
    // 判定し直す。同じ値なら React 側で再描画されないので負荷はほぼない。
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      mql.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [query])

  return matches
}

/**
 * 余白を詰める表示にするか（iPad 縦などの中間幅）。
 * PC・iPad 横（1024px以上）は従来どおりのゆったりした余白。
 */
export function useCompactLayout() {
  return useMediaQuery(COMPACT_QUERY)
}

/**
 * スマートフォンの幅か。
 * 問題作成をタブレット・パソコンに限るための判定に使う。
 */
export function usePhoneLayout() {
  return useMediaQuery(PHONE_QUERY)
}

/**
 * 3ペインでプレビューの幅が足りなくなる画面幅か。
 * 問題作成で、プレビューを既定で畳むかどうかの判定に使う。
 */
export function usePreviewTight() {
  return useMediaQuery(PREVIEW_TIGHT_QUERY)
}

/**
 * マウスのようなホバーできる入力機器かどうか。
 * タッチ端末では false になり、タップ後にホバー状態が残るのを防ぐ。
 */
export function useCanHover() {
  return useMediaQuery(HOVER_QUERY)
}
