import { CLOZE_LIMITS, DEFAULT_TEXT_COLOR, TEXT_COLORS } from '../constants'
import { toText } from '../utils/safe'

/**
 * 虫食い問題の本文モデル。
 *
 * 本文は「段落の配列」で持ち、段落は run の配列。
 *   paras: [ [ {text, hide, color}, ... ], ... ]
 *
 * run が本文の最小単位で、hide（隠すか）と color（文字色）を持つ。
 * hide と color は独立していて、同じ run が両方を持つこともある（SPEC R3）。
 *
 * 位置で持つ理由：同じ語句が何度も出てくる文章でも、意図した箇所だけを
 * 隠せるようにするため（文字列一致では誤爆する）。
 */

const PALETTE = new Set(TEXT_COLORS.map((c) => c.value))

/** パレット外の色は標準色に寄せる。 */
export const safeColor = (value) =>
  PALETTE.has(String(value)) ? String(value) : DEFAULT_TEXT_COLOR

/** run を1つ作る。 */
export const makeRun = (text, { hide = false, color = DEFAULT_TEXT_COLOR } = {}) => ({
  text: String(text ?? ''),
  hide: hide === true,
  color: safeColor(color),
})

/** 隣り合う同じ属性の run をまとめ、空の run を捨てる。 */
export function mergeRuns(runs) {
  const out = []
  for (const run of runs ?? []) {
    if (!run || !run.text) continue
    const last = out[out.length - 1]
    if (last && last.hide === run.hide && last.color === run.color) {
      last.text += run.text
    } else {
      out.push({ ...run })
    }
  }
  return out
}

/** 保存されている値を安全な paras へ整える。 */
export function normalizeParas(raw) {
  const source = Array.isArray(raw) ? raw : []
  const paras = source
    .slice(0, 500)
    .map((para) =>
      mergeRuns(
        (Array.isArray(para) ? para : []).map((run) =>
          makeRun(toText(run?.text, CLOZE_LIMITS.BODY_CHARS), {
            hide: run?.hide,
            color: run?.color,
          }),
        ),
      ),
    )
    .filter((para) => para.length > 0)
  return paras.length ? paras : [[]]
}

/** 段落をまたいだ素のテキスト（段落は \n で区切る）。 */
export const parasToText = (paras) =>
  (paras ?? []).map((para) => para.map((r) => r.text).join('')).join('\n')

/** 本文の文字数（段落区切りは数えない）。 */
export const bodyLength = (paras) =>
  (paras ?? []).reduce((n, para) => n + para.reduce((m, r) => m + r.text.length, 0), 0)

/** 隠している箇所の数（run 単位。ここが演習でのマーカー数になる）。 */
export const hiddenCount = (paras) =>
  (paras ?? []).reduce((n, para) => n + para.filter((r) => r.hide).length, 0)

/**
 * 文書順に 1 始まりの通し番号を振る。
 * 編集のたびに振り直すので、番号は常に「上から数えて何番目か」を表す。
 */
export function withMarkerIndexes(paras) {
  let index = 0
  return (paras ?? []).map((para) =>
    para.map((run) => {
      if (!run.hide) return { ...run, markerIndex: null }
      index += 1
      return { ...run, markerIndex: index }
    }),
  )
}

/** 一覧に出す見出し（見出し未入力なら本文の冒頭）。 */
export function clozeHeadline(question) {
  const title = (question?.title ?? '').trim()
  if (title) return title
  const body = parasToText(question?.paras).replace(/\s+/g, ' ').trim()
  return body || '（無題の文章）'
}

// ---------------------------------------------------------------------------
// 平文のオフセットに対する編集操作
//
// 段落をまたいだ「通し位置」で範囲を受け取り、run を分割して属性を付ける。
// エディタ側は選択範囲をこの通し位置で渡す。
// ---------------------------------------------------------------------------

/** paras を {para, run, start, end} の一覧へ平坦化する（start/end は通し位置）。 */
function flatten(paras) {
  const items = []
  let pos = 0
  paras.forEach((para, pi) => {
    para.forEach((run) => {
      items.push({ pi, run, start: pos, end: pos + run.text.length })
      pos += run.text.length
    })
    // 段落区切りも1文字ぶん位置を進める（テキスト上の \n に対応）
    if (pi < paras.length - 1) pos += 1
  })
  return items
}

/**
 * 指定範囲の run に属性を適用する。
 * @param {Array} paras
 * @param {number} start 通し位置（含む）
 * @param {number} end   通し位置（含まない）
 * @param {(run) => object} patch 適用する属性
 */
export function applyToRange(paras, start, end, patch) {
  if (!(end > start)) return paras
  const items = flatten(paras)
  const next = paras.map(() => [])

  for (const item of items) {
    const { pi, run } = item
    // 範囲外
    if (item.end <= start || item.start >= end) {
      next[pi].push({ ...run })
      continue
    }
    const localStart = Math.max(0, start - item.start)
    const localEnd = Math.min(run.text.length, end - item.start)

    if (localStart > 0) next[pi].push(makeRun(run.text.slice(0, localStart), run))
    next[pi].push(
      makeRun(run.text.slice(localStart, localEnd), { ...run, ...patch(run) }),
    )
    if (localEnd < run.text.length) next[pi].push(makeRun(run.text.slice(localEnd), run))
  }
  return next.map(mergeRuns)
}

/** 範囲を隠す。 */
export const hideRange = (paras, start, end) =>
  applyToRange(paras, start, end, () => ({ hide: true }))

/** 範囲の「隠す」を外す。 */
export const unhideRange = (paras, start, end) =>
  applyToRange(paras, start, end, () => ({ hide: false }))

/** 範囲の文字色を変える。 */
export const colorRange = (paras, start, end, color) =>
  applyToRange(paras, start, end, () => ({ color: safeColor(color) }))

/** 範囲に隠された run が含まれるか（「解除」ボタンの活性判定に使う）。 */
export function rangeHasHidden(paras, start, end) {
  if (!(end > start)) return false
  return flatten(paras).some(
    (item) => item.run.hide && item.start < end && item.end > start,
  )
}

/**
 * 素のテキストから paras を作り直す（属性は位置で引き継ぐ）。
 * 入力欄で文字が増減したときに、既存の hide/color をできるだけ保つために使う。
 */
export function rebuildFromText(prevParas, text) {
  const items = flatten(prevParas)
  const attrAt = (pos) => {
    const hit = items.find((item) => pos >= item.start && pos < item.end)
    return hit ? { hide: hit.run.hide, color: hit.run.color } : {}
  }

  const paras = []
  let pos = 0
  for (const chunk of String(text ?? '').split('\n')) {
    const runs = []
    for (const ch of chunk) {
      runs.push(makeRun(ch, attrAt(pos)))
      pos += 1
    }
    paras.push(mergeRuns(runs))
    pos += 1 // 段落区切り
  }
  return paras.length ? paras : [[]]
}
