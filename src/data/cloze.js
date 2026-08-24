import { CLOZE_LIMITS, DEFAULT_TEXT_COLOR, TEXT_COLORS } from '../constants'

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

/**
 * run の文字を整える。
 *
 * **前後の空白を落とさない**こと。落とすと「12. aaa」の aaa を隠したときに
 * 直前の run が「12. 」から「12.」になり、空白が消えてカーソルもずれる
 * （2026-08-24 に報告された症状）。長さだけを制限する。
 */
const runText = (value, maxChars) => {
  const s = value == null ? '' : String(value)
  return maxChars && s.length > maxChars ? s.slice(0, maxChars) : s
}

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
          makeRun(runText(run?.text, CLOZE_LIMITS.BODY_CHARS), {
            hide: run?.hide,
            color: run?.color,
          }),
        ),
      ),
    )
  // 空の段落は捨てない。捨てると、Enter を2回押しても空行が作れず、
  // 段落を空けて書けなくなる（番号を外して次の行から書き始めるときにも困る）
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

/**
 * 2つの本文が同じ中身か。
 *
 * 保存の途中で run の入れ物は作り直されるため、同じ内容でも `===` は成り立たない。
 * 履歴（元に戻す）で「自分が書いた状態」と「保存後に戻ってきた状態」を
 * 見分けるのに使う。
 */
export function sameParas(a, b) {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const pa = a[i]
    const pb = b[i]
    if (pa.length !== pb.length) return false
    for (let j = 0; j < pa.length; j += 1) {
      if (pa[j].text !== pb[j].text) return false
      if (pa[j].hide !== pb[j].hide) return false
      if (pa[j].color !== pb[j].color) return false
    }
  }
  return true
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

/**
 * 選択範囲の文字色を返す（ツールバーで「いまの色」に印を付けるために使う）。
 * 範囲内に複数の色が混ざっているときは null（どれも選ばれていない扱い）。
 */
export function colorOfRange(paras, start, end) {
  const items = flatten(paras).filter((item) =>
    end > start ? item.start < end && item.end > start : item.start <= start && item.end > start,
  )
  if (!items.length) return DEFAULT_TEXT_COLOR
  const first = items[0].run.color
  return items.every((item) => item.run.color === first) ? first : null
}

/** 範囲に隠された run が含まれるか（「解除」ボタンの活性判定に使う）。 */
export function rangeHasHidden(paras, start, end) {
  if (!(end > start)) return false
  return flatten(paras).some(
    (item) => item.run.hide && item.start < end && item.end > start,
  )
}

/**
 * [[ ]] で囲まれた箇所を「隠す指定」として取り出す。
 *
 * 画面をタッチで操作するときは、文字を選択してボタンを押す操作が難しい。
 * 入力しながら [[葉緑体]] と書けるようにして、選択操作を要らなくする。
 * 閉じ括弧まで入力された時点で括弧そのものは消し、中身を隠す範囲にする。
 *
 * @param {string} text 括弧を含んだテキスト
 * @param {number} caret 変換前のカーソル位置
 * @returns {{ text: string, ranges: Array<{start:number,end:number}>, caret: number }}
 *   括弧を取り除いたテキストと、隠す範囲（取り除いたあとの位置）
 */
export function extractBracketRanges(text, caret = 0) {
  const source = String(text ?? '')
  const ranges = []
  let out = ''
  let i = 0
  let nextCaret = caret

  while (i < source.length) {
    // 入れ子は想定しない。開き括弧から、最初の閉じ括弧までを1つの範囲とする
    if (source.startsWith('[[', i)) {
      const close = source.indexOf(']]', i + 2)
      const inner = close === -1 ? '' : source.slice(i + 2, close)
      if (close !== -1 && inner.length > 0 && !inner.includes('[[')) {
        const start = out.length
        out += inner
        ranges.push({ start, end: out.length })
        // 取り除いた括弧の分だけカーソルを前へ詰める
        if (caret > close + 1) nextCaret -= 4
        else if (caret > i) nextCaret = out.length
        i = close + 2
        continue
      }
    }
    out += source[i]
    i += 1
  }

  return { text: out, ranges, caret: Math.max(0, Math.min(nextCaret, out.length)) }
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

  const prevText = parasToText(prevParas)
  const next = String(text ?? '')

  // 変わっていない先頭と末尾を求め、その間だけを「今おこなった編集」とみなす。
  // 位置をそのまま引き写すと、前に文字を足したときに隠す箇所だけ取り残されて
  // 文字とずれる（実際に報告された症状）。前後を突き合わせて位置をずらす。
  const limit = Math.min(prevText.length, next.length)
  let prefix = 0
  while (prefix < limit && prevText[prefix] === next[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < limit - prefix &&
    prevText[prevText.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const editedEnd = next.length - suffix // 新しい文章での編集範囲の終わり
  const shift = prevText.length - next.length // 末尾側の位置のずれ

  // 打った文字が隠す範囲の「内側」なら、その範囲の設定を引き継いで一緒に伸びる。
  // 範囲の境目（直前・直後）で打った文字は巻き込まない。
  const before = prefix > 0 ? attrAt(prefix - 1) : {}
  const after = attrAt(prevText.length - suffix)
  const insideAttr =
    before.hide && after.hide && before.color === after.color ? before : {}

  const attrFor = (pos) => {
    if (pos < prefix) return attrAt(pos)
    if (pos >= editedEnd) return attrAt(pos + shift)
    return insideAttr
  }

  const paras = []
  let pos = 0
  for (const chunk of next.split('\n')) {
    const runs = []
    for (const ch of chunk) {
      runs.push(makeRun(ch, attrFor(pos)))
      pos += 1
    }
    paras.push(mergeRuns(runs))
    pos += 1 // 段落区切り
  }
  return paras.length ? paras : [[]]
}

// ---------------------------------------------------------------------------
// 段落の先頭に振る番号
//
// Word の「番号を振る」と同じ感覚で使えるようにする。段落ごとに先頭へ
// 「1. 」「(1) 」「① 」を置き、Enter で次の番号が続く。
// 文字列を作り直すのではなく、段落の先頭 run だけを足し引きする。
// そうしないと、隠す指定や文字色がずれる。
// ---------------------------------------------------------------------------

/** 番号の種類。 */
export const NUMBER_STYLES = {
  DOT: 'dot', // 1. 2. 3.
  PAREN: 'paren', // (1) (2) (3)
  CIRCLED: 'circled', // ① ② ③
}

/** 丸数字は ① から ⑳ まで。21以降は用意されていないので「(21) 」に落とす。 */
const CIRCLED_MAX = 20

/**
 * 番号の文字列を作る（末尾の空白まで含む）。
 * @param {string} style NUMBER_STYLES のいずれか
 * @param {number} n 1始まりの番号
 */
export function numberPrefix(style, n) {
  const num = Math.max(1, Math.floor(n))
  if (style === NUMBER_STYLES.PAREN) return `(${num}) `
  if (style === NUMBER_STYLES.CIRCLED) {
    if (num > CIRCLED_MAX) return `(${num}) `
    return `${String.fromCharCode(0x2460 + num - 1)} `
  }
  return `${num}. `
}

/** 「1. 」「(1) 」「① 」で始まっていれば、その内訳を返す。 */
export function matchNumberPrefix(text) {
  const line = String(text ?? '')

  const dot = /^(\d{1,3})\.[ 　]/.exec(line)
  if (dot) return { style: NUMBER_STYLES.DOT, value: Number(dot[1]), length: dot[0].length }

  const paren = /^\((\d{1,3})\)[ 　]/.exec(line)
  if (paren) return { style: NUMBER_STYLES.PAREN, value: Number(paren[1]), length: paren[0].length }

  const circled = /^([①-⑳])[ 　]?/.exec(line)
  if (circled) {
    return {
      style: NUMBER_STYLES.CIRCLED,
      value: circled[1].charCodeAt(0) - 0x2460 + 1,
      length: circled[0].length,
    }
  }
  return null
}

/** 段落の先頭から n 文字を落とす（run の属性は残す）。 */
function dropLeading(para, n) {
  if (n <= 0) return para
  let left = n
  const out = []
  for (const run of para) {
    if (left <= 0) {
      out.push({ ...run })
      continue
    }
    if (run.text.length <= left) {
      left -= run.text.length
      continue
    }
    out.push(makeRun(run.text.slice(left), run))
    left = 0
  }
  return mergeRuns(out)
}

/** 段落の先頭に文字を足す（足した分は隠さない・標準色）。 */
function prependText(para, text) {
  if (!text) return para
  return mergeRuns([makeRun(text), ...para.map((run) => ({ ...run }))])
}

/** 段落に番号が付いていれば外す。 */
export function stripNumber(para) {
  const hit = matchNumberPrefix(para.map((r) => r.text).join(''))
  return hit ? dropLeading(para, hit.length) : para
}

/**
 * 指定した段落の範囲に番号を振り直す。
 *
 * すでに付いている番号は種類を問わず外してから振り直す。二重に付かないようにするため。
 * 直前の段落が同じ種類の番号で終わっていれば、その続きから数える（Word と同じ）。
 *
 * @param {Array} paras
 * @param {number} from 先頭の段落番号（含む）
 * @param {number} to   末尾の段落番号（含む）
 * @param {string} style NUMBER_STYLES のいずれか
 */
export function numberParas(paras, from, to, style) {
  const list = paras ?? []
  const first = Math.max(0, from)
  const last = Math.min(list.length - 1, to)
  if (last < first) return list

  // 直前の段落から続けられるなら続ける
  const above = first > 0 ? matchNumberPrefix(list[first - 1].map((r) => r.text).join('')) : null
  let n = above && above.style === style ? above.value + 1 : 1

  const next = list.map((para, i) => {
    if (i < first || i > last) return para
    const bare = stripNumber(para)
    // 空の段落には番号を振らない（間の空行まで数に入ると数え方が狂う）
    if (!bare.length) return bare
    const withNumber = prependText(bare, numberPrefix(style, n))
    n += 1
    return withNumber
  })
  return next
}

/** 指定した段落の範囲から番号を外す。 */
export function unnumberParas(paras, from, to) {
  const list = paras ?? []
  return list.map((para, i) => (i >= from && i <= to ? stripNumber(para) : para))
}

/**
 * 続く段落の番号を振り直す。
 *
 * 途中に段落を足したあと、下の番号がずれたままにならないようにする。
 * 同じ種類の番号が続いているあいだだけ直す。番号の無い段落で止める。
 */
export function renumberFollowing(paras, fromIndex, style) {
  const list = paras ?? []
  const above = fromIndex > 0 ? matchNumberPrefix(list[fromIndex - 1].map((r) => r.text).join('')) : null
  let n = above && above.style === style ? above.value + 1 : 1

  const next = [...list]
  for (let i = fromIndex; i < next.length; i += 1) {
    const hit = matchNumberPrefix(next[i].map((r) => r.text).join(''))
    if (!hit || hit.style !== style) break
    next[i] = prependText(dropLeading(next[i], hit.length), numberPrefix(style, n))
    n += 1
  }
  return next
}

/**
 * 通し位置から、段落の番号と段落内の位置を求める。
 * @returns {{index: number, offset: number}}
 */
export function locate(paras, pos) {
  const list = paras ?? []
  let left = Math.max(0, pos)
  for (let i = 0; i < list.length; i += 1) {
    const len = list[i].reduce((n, r) => n + r.text.length, 0)
    if (left <= len) return { index: i, offset: left }
    left -= len + 1 // 段落区切り
  }
  const lastIndex = Math.max(0, list.length - 1)
  return { index: lastIndex, offset: (list[lastIndex] ?? []).reduce((n, r) => n + r.text.length, 0) }
}

/** 段落の先頭からの通し位置。 */
export function paraStart(paras, index) {
  const list = paras ?? []
  let pos = 0
  for (let i = 0; i < index && i < list.length; i += 1) {
    pos += list[i].reduce((n, r) => n + r.text.length, 0) + 1
  }
  return pos
}

/**
 * 段落を caret の位置で2つに割り、下の段落の先頭に番号を置く。
 * Enter で次の番号を続けるために使う。
 *
 * @returns {{paras: Array, caret: number}} 割ったあとの本文と、置くべきカーソル位置
 */
export function splitParaWithNumber(paras, index, offset, prefix) {
  const list = paras ?? []
  const para = list[index] ?? []
  const head = dropTrailing(para, offset)
  const tail = dropLeading(para, offset)
  const next = [...list.slice(0, index), head, prependText(tail, prefix), ...list.slice(index + 1)]
  return { paras: next, caret: paraStart(next, index + 1) + prefix.length }
}

/** 段落の先頭から n 文字だけ残す。 */
function dropTrailing(para, n) {
  if (n <= 0) return []
  let left = n
  const out = []
  for (const run of para) {
    if (left <= 0) break
    if (run.text.length <= left) {
      out.push({ ...run })
      left -= run.text.length
      continue
    }
    out.push(makeRun(run.text.slice(0, left), run))
    left = 0
  }
  return mergeRuns(out)
}
