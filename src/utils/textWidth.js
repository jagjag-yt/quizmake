/**
 * 文字の実寸を測る。
 *
 * 番号付きの行を折り返したとき、2行目以降を本文の開始位置に揃えたい。
 * 「半角は0.5em、全角は1em」という概算では、書体によって必ずずれる
 * （2026-08-26 に実機で報告された）。canvas に同じ書体・同じ大きさで
 * 書かせて幅を測り、その値を使う。
 *
 * 演習画面は箱を並べて揃えるので測らなくてよい。ここを使うのは、
 * 行ごとの字下げを持てない**編集画面の入力欄**だけ。
 */

let context = null

/** 測るための canvas（1つを使い回す。作り直すと遅い）。 */
function ctx() {
  if (context) return context
  if (typeof document === 'undefined') return null
  context = document.createElement('canvas').getContext('2d')
  return context
}

/**
 * 指定した書体での文字幅（px）。
 *
 * @param {string} text 測る文字
 * @param {string} font canvas の font 指定（例: '18px "Noto Sans JP", sans-serif'）
 * @returns {number} 幅（px）。測れないときは 0
 */
export function measureTextPx(text, font) {
  const c = ctx()
  if (!c || !text) return 0
  c.font = font
  return c.measureText(text).width
}

/**
 * 要素に効いている書体を canvas の font 指定に組み立てる。
 * font-family はそのまま渡す（引用符付きの指定も canvas はそのまま解釈する）。
 */
export function fontOf(element) {
  if (!element || typeof getComputedStyle !== 'function') return ''
  const style = getComputedStyle(element)
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
}
