/**
 * 文章の中の数式（LaTeX）を見つけて切り分ける。
 *
 * `$...$` は文中の数式、`$$...$$` は行を分けて中央に置く数式。
 * 描画そのものは components/MathText.jsx が KaTeX で行う。
 */

/** 数式の区切り。`$$…$$` を先に見るため、この順で並べる。 */
const MATH_PATTERN = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g

/** その文字列が数式を含むか。 */
export function hasMath(text) {
  MATH_PATTERN.lastIndex = 0
  return MATH_PATTERN.test(String(text ?? ''))
}

/**
 * 文字列を「素の文字」と「数式」に分ける。
 * @returns {Array<{type:'text'|'math', value:string, block?: boolean}>}
 */
export function splitMath(text) {
  const source = String(text ?? '')
  const parts = []
  let last = 0
  MATH_PATTERN.lastIndex = 0
  for (const hit of source.matchAll(MATH_PATTERN)) {
    if (hit.index > last) parts.push({ type: 'text', value: source.slice(last, hit.index) })
    const block = hit[1] != null
    parts.push({ type: 'math', value: block ? hit[1] : hit[2], block })
    last = hit.index + hit[0].length
  }
  if (last < source.length) parts.push({ type: 'text', value: source.slice(last) })
  return parts
}

