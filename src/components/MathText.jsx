import { useEffect, useState } from 'react'
import { COLORS } from '../constants'
import { hasMath, splitMath } from '../utils/mathText'

/**
 * 文章の中の数式（LaTeX）を描く。
 *
 * `$...$` で囲んだところを数式として組む。`$$...$$` は行を分けて中央に置く。
 * 書き方は LaTeX のごく一部（分数・平方根・上下付き・ギリシャ文字など）で足りる想定。
 *
 * KaTeX は約270KBあるため、**数式を含む問題を開いたときにだけ読み込む**。
 * 数式を使わない人の表示を遅くしない。読み込みが終わるまでは元の文字を出す
 * （何も見えない時間を作らない）。
 */

/** 読み込んだ KaTeX を覚えておく（問題ごとに読み直さない）。 */
let katexPromise = null
function loadKatex() {
  if (!katexPromise) {
    katexPromise = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
      ([mod]) => mod.default ?? mod,
    )
  }
  return katexPromise
}

/**
 * 数式を含む文字列を描く。数式が無ければ、そのまま文字を返す。
 *
 * @param {{text: string}} props
 */
export default function MathText({ text }) {
  const source = String(text ?? '')
  const needsMath = hasMath(source)
  const [katex, setKatex] = useState(null)

  useEffect(() => {
    if (!needsMath) return undefined
    let alive = true
    loadKatex().then((mod) => {
      if (alive) setKatex(() => mod)
    })
    return () => {
      alive = false
    }
  }, [needsMath])

  // 数式が無い、または読み込み中は、元の文字をそのまま出す
  if (!needsMath || !katex) return source

  return splitMath(source).map((part, i) => {
    if (part.type === 'text') return <span key={i}>{part.value}</span>
    let html = ''
    try {
      html = katex.renderToString(part.value, {
        displayMode: part.block === true,
        throwOnError: false,
        output: 'html',
      })
    } catch {
      // 書き方が誤っていても画面は壊さない。元の文字を出して直せるようにする
      return (
        <span key={i} style={{ color: COLORS.red }}>
          ${part.value}$
        </span>
      )
    }
    return (
      <span
        key={i}
        // KaTeX が組んだHTMLをそのまま入れる。中身は利用者が書いた数式のみで、
        // throwOnError:false・output:'html' のため <script> は生成されない
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  })
}
