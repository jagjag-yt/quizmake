import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CLOZE_LIMITS, COLORS, SPACING, TAP_MIN, inkColor } from '../constants'
import {
  NUMBER_STYLES,
  bodyLength,
  extractBracketRanges,
  hiddenCount,
  hideRange,
  hideSameWord,
  locate,
  matchNumberPrefix,
  numberParas,
  numberPrefix,
  paraStart,
  parasToText,
  rangeHasHidden,
  rebuildFromText,
  renumberFollowing,
  sameParas,
  splitParaWithNumber,
  unhideRange,
  unnumberParas,
  withMarkerIndexes,
} from '../data/cloze'
import { useCompactLayout } from '../hooks/useMediaQuery'
import SameWordDialog from './SameWordDialog'
import { shouldInline } from '../utils/clozeRender'

/**
 * 本文の文字。入力欄とプレビューで同じ値を使う。
 * 別々の値にすると、同じ文章でも折り返しと行数が変わり、左右で高さが揃わない。
 * 値はプレビュー（＝演習画面の見た目）に合わせている。
 */
const BODY_LINE_HEIGHT = 2.05

/** 元に戻せる回数。長い文章でも数MBに収まる範囲にする。 */
const HISTORY_MAX = 100

/**
 * 続けて打った文字をひとまとめにする時間（ミリ秒）。
 * 1文字ずつ戻すと、元に戻すのに何十回も押すことになる。
 */
const TYPING_MERGE_MS = 700

/** 番号の種類の選択肢。表示はそのまま見本になっている。 */
const NUMBER_CHOICES = [
  { key: NUMBER_STYLES.DOT, label: '1.' },
  { key: NUMBER_STYLES.PAREN, label: '(1)' },
  { key: NUMBER_STYLES.CIRCLED, label: '①' },
]
const bodyFontSizeFor = (compact) => (compact ? '17px' : '18px')

const card = (pad) => ({
  background: COLORS.card,
  borderRadius: '20px',
  border: `1px solid ${COLORS.cardBorder}`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  padding: `${pad}px`,
})

const label = { fontSize: '12.5px', fontWeight: 700, color: COLORS.sub }

const input = {
  minHeight: `${TAP_MIN}px`,
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.text,
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
}

const pill = (bg, color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 12px',
  borderRadius: '999px',
  background: bg,
  color,
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
})

/**
 * 編集中の本文表示。
 *
 * 演習と同じ塗り潰しにすると自分の書いた文章が読めなくなるため、
 * 編集中は薄い下地＋細枠で「隠す対象」だけを示す（SPEC B: edit-mode mark render）。
 * 入力自体は下に重ねた textarea が受け持ち、この層は見た目だけを担当する。
 */
function EditorOverlay({ paras, fontSize, lineHeight }) {
  const indexed = withMarkerIndexes(paras)
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        boxSizing: 'border-box',
        border: '1px solid transparent',
        padding: '16px',
        fontSize,
        lineHeight,
        fontFamily: 'inherit',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'hidden',
        pointerEvents: 'none',
        color: 'transparent',
      }}
    >
      {indexed.map((para, pi) => (
        <div key={pi}>
          {para.length === 0 ? (
            <br />
          ) : (
            para.map((run, ri) =>
              run.hide ? (
                <span
                  key={ri}
                  style={{
                    background: COLORS.blueLight,
                    boxShadow: `inset 0 0 0 1px ${COLORS.bluePale}`,
                    borderRadius: 0,
                    color: inkColor(run.color),
                  }}
                >
                  {run.text}
                </span>
              ) : (
                <span key={ri} style={{ color: inkColor(run.color) }}>
                  {run.text}
                </span>
              ),
            )
          )}
        </div>
      ))}
    </div>
  )
}

/** 演習と同じ見た目のプレビュー本文（一括開閉のみ）。 */
function PreviewBody({ paras, allOpen, compact }) {
  const indexed = withMarkerIndexes(paras)
  return (
    <div style={{ fontSize: compact ? '17px' : '18px', lineHeight: 2.05, color: COLORS.text }}>
      {indexed.map((para, pi) => (
        <p key={pi} style={{ margin: pi === 0 ? 0 : '1.1em 0 0 0' }}>
          {para.map((run, ri) => {
            if (!run.hide) {
              return (
                <span key={ri} style={{ color: inkColor(run.color) }}>
                  {run.text}
                </span>
              )
            }
            return (
              <span
                key={ri}
                style={{
                  display: shouldInline(run.text) ? 'inline' : 'inline-block',
                  boxDecorationBreak: 'clone',
                  WebkitBoxDecorationBreak: 'clone',
                  padding: compact ? '0 7px' : '0 6px',
                  margin: '0 4px',
                  borderRadius: 0,
                  lineHeight: 1.35,
                  background: allOpen ? COLORS.blueLight : COLORS.blue,
                  color: allOpen ? inkColor(run.color) : 'transparent',
                  boxShadow: allOpen ? `inset 0 -2px 0 ${COLORS.bluePale}` : 'none',
                }}
              >
                <span
                  style={{
                    // 行ボックス基準（vertical-align:top）だと、inline 表示のマーカーでは
                    // 塗りの上端より上に出てしまう。文字のベースライン基準で置き、
                    // relative で少しだけ持ち上げて「左上」に見せる
                    display: 'inline-block',
                    position: 'relative',
                    top: '-4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    lineHeight: '12px',
                    verticalAlign: 'baseline',
                    marginRight: '4px',
                    color: allOpen ? COLORS.text : '#ffffff',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {run.markerIndex}
                </span>
                {run.text}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}

/**
 * 虫食い問題の編集。
 *
 * 本文は「素のテキスト＋範囲の属性」で持ち、textarea で入力を受ける。
 * contenteditable ではなく textarea にしているのは、選択位置（selectionStart/End）が
 * そのまま範囲指定に使え、日本語入力や端末のキーボードでも壊れないため。
 */
export default function ClozeEditor({
  question,
  onUpdate,
  groupName = '',
  total = 0,
  pane = 'editor',
}) {
  const compact = useCompactLayout()
  const bodyFontSize = bodyFontSizeFor(compact)
  const space = compact ? SPACING.compact : SPACING.wide
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [touched, setTouched] = useState(false)
  const areaRef = useRef(null)
  // 括弧記法の変換でカーソルが飛ばないように、戻す位置を覚えておく
  const caretRef = useRef(null)

  const paras = question.paras
  const text = useMemo(() => parasToText(paras), [paras])
  const hidden = hiddenCount(paras)
  const chars = bodyLength(paras)
  const hasSelection = selection.end > selection.start
  const canUnhide = hasSelection && rangeHasHidden(paras, selection.start, selection.end)

  useEffect(() => {
    if (caretRef.current == null) return
    const el = areaRef.current
    if (el) {
      // カーソルを置き直すと、ブラウザはその位置を見せようとしてページを動かす。
      // ここは利用者が動かしたのではなく、隠す・戻すの後始末で置き直しているだけ
      // なので、見えている位置は変えない（2026-08-24 に報告された「勝手に上へ飛ぶ」）
      const scroller = document.scrollingElement ?? document.documentElement
      const top = scroller.scrollTop
      el.setSelectionRange(caretRef.current, caretRef.current)
      if (scroller.scrollTop !== top) scroller.scrollTop = top
    }
    caretRef.current = null
  })

  /**
   * 入力欄を中身の高さに合わせて伸ばす。
   *
   * 見た目（マーカー）は下に敷いた層が描き、入力は透明な textarea が受ける二層構造のため、
   * textarea の中だけがスクロールすると下の層とずれて、文字が二重に見える。
   * 高さを中身に合わせて伸ばし、textarea の中でスクロールさせないことで position を揃える。
   * 折り返しは幅で変わるので、画面幅が変わったときも測り直す。
   */
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return undefined

    const fit = () => {
      // 高さを測るあいだ、この欄は一瞬つぶれる。ページ全体が短くなるため
      // ブラウザがスクロール位置を切り詰め、文章を消したり隠したりするたびに
      // 画面が上へ飛んでいた（2026-08-24 に報告）。測り終えたら元の位置に戻す。
      const scroller = document.scrollingElement ?? document.documentElement
      const top = scroller.scrollTop
      el.style.height = 'auto'
      // box-sizing: border-box なので、scrollHeight に入らない枠線の分を足す
      const border = el.offsetHeight - el.clientHeight
      el.style.height = `${el.scrollHeight + border}px`
      if (scroller.scrollTop !== top) scroller.scrollTop = top
    }

    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
    }
  }, [text, compact])

  const syncSelection = useCallback(() => {
    const el = areaRef.current
    if (el) setSelection({ start: el.selectionStart, end: el.selectionEnd })
  }, [])

  /**
   * 元に戻す・やり直すための履歴。
   *
   * textarea が持つブラウザ標準の履歴は、値を React 側で差し替えている以上あてにならず、
   * 「隠す」のような文字を変えない操作は最初から入らない。本文（paras）そのものを
   * 積んでおき、隠す・番号・入力を同じ土俵で戻せるようにする。
   */
  const historyRef = useRef({ id: null, stack: [], index: 0, at: 0, kind: null })
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const syncHistoryState = useCallback(() => {
    const h = historyRef.current
    setHistoryState({ canUndo: h.index > 0, canRedo: h.index < h.stack.length - 1 })
  }, [])

  // 問題を切り替えたときは履歴を作り直す。外から本文が変わったとき（読み込み・
  // 取り戻し）は、その状態を新しい一歩として積む
  useEffect(() => {
    const h = historyRef.current
    if (h.id !== question.id) {
      historyRef.current = {
        id: question.id,
        stack: [{ paras, caret: null }],
        index: 0,
        at: 0,
        kind: null,
      }
      syncHistoryState()
      return
    }
    // 中身で比べる。保存を通ると run の入れ物が作り直されるため、
    // `!==` で見ると自分の変更まで「外から変わった」と誤解して履歴が二重になる
    if (!sameParas(h.stack[h.index]?.paras, paras)) {
      h.stack = [...h.stack.slice(0, h.index + 1), { paras, caret: null }].slice(-HISTORY_MAX)
      h.index = h.stack.length - 1
      h.kind = null
      syncHistoryState()
    }
  }, [question.id, paras, syncHistoryState])

  /**
   * 本文を書き換え、履歴に積む。
   *
   * @param {Array} nextParas 新しい本文
   * @param {{caret?: number|null, kind?: string}} [options]
   *   caret を渡すと、その位置にカーソルを置き直す。
   *   kind が 'type'（続けての入力）のときは、直前の一歩とまとめる。
   */
  const commit = useCallback(
    (nextParas, { caret = null, kind = 'edit' } = {}) => {
      const h = historyRef.current
      const now = performance.now()
      const merge = kind === 'type' && h.kind === 'type' && now - h.at < TYPING_MERGE_MS

      if (merge) {
        h.stack = [...h.stack.slice(0, h.index), { paras: nextParas, caret }]
        h.index = h.stack.length - 1
      } else {
        h.stack = [...h.stack.slice(0, h.index + 1), { paras: nextParas, caret }].slice(-HISTORY_MAX)
        h.index = h.stack.length - 1
      }
      h.at = now
      h.kind = kind
      syncHistoryState()

      onUpdate(question.id, { paras: nextParas })
      if (caret != null) {
        caretRef.current = caret
        setSelection({ start: caret, end: caret })
      }
    },
    [onUpdate, question.id, syncHistoryState],
  )

  /** 履歴を1つ動かす（-1 で元に戻す、+1 でやり直す）。 */
  const step = useCallback(
    (delta) => {
      const h = historyRef.current
      const nextIndex = h.index + delta
      if (nextIndex < 0 || nextIndex >= h.stack.length) return
      h.index = nextIndex
      h.kind = null
      syncHistoryState()

      const snapshot = h.stack[nextIndex]
      onUpdate(question.id, { paras: snapshot.paras })
      const caret = snapshot.caret ?? bodyLength(snapshot.paras)
      caretRef.current = caret
      setSelection({ start: caret, end: caret })
    },
    [onUpdate, question.id, syncHistoryState],
  )

  const undo = useCallback(() => step(-1), [step])
  const redo = useCallback(() => step(1), [step])

  /**
   * 指定した範囲に反映したあと、選択を解いて末尾にカーソルを置く。
   * 選択が残っていると、続けて押したときに同じ場所へ何度も効いてしまう。
   */
  const applyAndDeselect = useCallback(
    (nextParas) => {
      commit(nextParas, { caret: selection.end, kind: 'mark' })
    },
    [commit, selection.end],
  )

  const applyHide = useCallback(() => {
    if (!hasSelection) return
    applyAndDeselect(hideRange(paras, selection.start, selection.end))
  }, [hasSelection, applyAndDeselect, paras, selection])

  const applyUnhide = useCallback(() => {
    if (!hasSelection) return
    applyAndDeselect(unhideRange(paras, selection.start, selection.end))
  }, [hasSelection, applyAndDeselect, paras, selection])

  /**
   * 選んだ語と同じ語を、文章全体でまとめて隠す。
   *
   * ブラウザは離れた複数箇所の同時選択を持てない（Chrome では範囲が1つに潰れる）。
   * 「飛び地を選んで一気に隠す」の代わりに、同じ語の一括指定を用意する。
   *
   * 押すとまず設定を聞く（番号の付け方・開き方）。同じ語が何度も出てくる文章では、
   * 「どこも同じ番号にしたい」「1つ開いたら全部開きたい」という要望が両方あるため。
   */
  const [sameWord, setSameWord] = useState(null) // { word, count }

  const openSameWord = useCallback(() => {
    const el = areaRef.current
    // 選択は入力欄から直に読む。state は onSelect が走るまで古いままのため
    const start = el ? el.selectionStart : selection.start
    const end = el ? el.selectionEnd : selection.end
    if (end <= start) return
    const word = text.slice(start, end)
    if (!word.trim()) return

    let count = 0
    let at = text.indexOf(word)
    while (at !== -1) {
      count += 1
      at = text.indexOf(word, at + word.length)
    }
    setSameWord({ word, count, caret: end })
  }, [text, selection])

  /** 段落の文字数。 */
  const paraLength = (para) => para.reduce((n, r) => n + r.text.length, 0)

  /**
   * 番号を振る対象の段落。
   * 選んでいればその範囲、選んでいなければカーソルのある段落だけ（Word と同じ）。
   *
   * 選択は state ではなく入力欄から直に読む。state は onSelect が走るまで
   * 古いままで、選んだ直後にボタンを押すと1行目だけに振られてしまう。
   */
  const targetParas = useCallback(() => {
    const el = areaRef.current
    const start = el ? el.selectionStart : selection.start
    const end = el ? el.selectionEnd : selection.end
    const from = locate(paras, Math.min(start, end)).index
    const to = locate(paras, Math.max(start, end)).index
    return { from, to }
  }, [paras, selection])

  /** 選んだ段落に番号を振る。 */
  const applyNumbering = useCallback(
    (style) => {
      const { from, to } = targetParas()
      const next = numberParas(paras, from, to, style)
      // 振ったいちばん下の行末にカーソルを置く。続けて書き足せる位置
      const caret = paraStart(next, to) + paraLength(next[to] ?? [])
      commit(next, { caret, kind: 'number' })
    },
    [paras, targetParas, commit],
  )

  /** 選んだ段落の番号を外す。 */
  const clearNumbering = useCallback(() => {
    const { from, to } = targetParas()
    const next = unnumberParas(paras, from, to)
    const caret = paraStart(next, to) + paraLength(next[to] ?? [])
    commit(next, { caret, kind: 'number' })
  }, [paras, targetParas, commit])

  /** いま選んでいる範囲に番号が付いているか（「番号を外す」の活性判定）。 */
  const hasNumbering = useMemo(() => {
    const from = locate(paras, selection.start).index
    const to = locate(paras, Math.max(selection.start, selection.end)).index
    for (let i = from; i <= to && i < paras.length; i += 1) {
      if (matchNumberPrefix(paras[i].map((r) => r.text).join(''))) return true
    }
    return false
  }, [paras, selection])

  /**
   * Enter で次の番号を続ける（Word と同じ振る舞い）。
   *
   * 番号だけの行で Enter を押したときは、番号を外して箇条書きを終える。
   * 続きの行がある場合は、下の番号も振り直す。
   */
  const continueNumbering = useCallback(
    (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
      const el = areaRef.current
      if (!el || el.selectionStart !== el.selectionEnd) return

      const { index, offset } = locate(paras, el.selectionStart)
      const paraText = (paras[index] ?? []).map((r) => r.text).join('')
      const hit = matchNumberPrefix(paraText)
      if (!hit) return

      e.preventDefault()

      // 番号しかない行＝もう書くことがない、とみなして番号を外す
      if (paraText.length <= hit.length) {
        const next = unnumberParas(paras, index, index)
        commit(next, { caret: paraStart(next, index), kind: 'number' })
        return
      }

      const split = splitParaWithNumber(paras, index, offset, numberPrefix(hit.style, hit.value + 1))
      const next = renumberFollowing(split.paras, index + 1, hit.style)
      const added = matchNumberPrefix((next[index + 1] ?? []).map((r) => r.text).join(''))
      commit(next, { caret: paraStart(next, index + 1) + (added?.length ?? 0), kind: 'number' })
    },
    [paras, commit],
  )

  // 入力欄の中だけで効くキー操作。
  //   F1 / Ctrl+H … 隠す・戻す（F1は要望、Ctrl+H は SPEC）
  //   Ctrl+Z / Ctrl+Y（Ctrl+Shift+Z）… 元に戻す・やり直す
  // 元に戻すはブラウザ標準の履歴を使わない。値を React 側で差し替えているうえ、
  // 「隠す」は文字が変わらないため標準の履歴には残らない。
  useEffect(() => {
    const onKey = (e) => {
      const el = areaRef.current
      // 入力欄の中にいるときだけ効かせる（他画面のキー操作を邪魔しない）
      if (document.activeElement !== el) return
      const mod = e.ctrlKey || e.metaKey

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redo()
        return
      }

      const hit =
        (e.key === 'F1' && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        (mod && (e.key === 'h' || e.key === 'H'))
      if (!hit) return
      e.preventDefault()
      // state ではなく入力欄の今の選択を読む。state は同じ処理の中では古いままのため
      const start = el.selectionStart
      const end = el.selectionEnd
      if (end <= start) return
      const next = rangeHasHidden(paras, start, end)
        ? unhideRange(paras, start, end)
        : hideRange(paras, start, end)
      // 隠したらその場の選択は解く。残っていると続けて押したとき同じ場所に効く
      commit(next, { caret: end, kind: 'mark' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paras, commit, undo, redo])

  const toolbarButton = (enabled, primary) => ({
    minHeight: '36px',
    padding: '0 14px',
    borderRadius: '10px',
    border: `1px solid ${enabled ? (primary ? COLORS.blue : COLORS.border) : COLORS.border}`,
    background: enabled ? (primary ? COLORS.blue : COLORS.card) : COLORS.chipTrack,
    color: enabled ? (primary ? '#ffffff' : COLORS.body) : COLORS.dashed,
    fontSize: '12.5px',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: enabled ? 'pointer' : 'default',
    whiteSpace: 'nowrap',
  })

  const editor = (
    <div style={{ ...card(space.card), display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text }}>
          虫食い問題を編集
        </span>
        <span style={pill(COLORS.blueLight, COLORS.blue)}>虫食い</span>
        <span style={pill(COLORS.chipTrack, COLORS.body)}>
          問題番号 {question.questionNumber}（自動）
        </span>
      </div>

      <div>
        <div style={label}>見出し</div>
        <input
          value={question.title}
          onChange={(e) =>
            onUpdate(question.id, { title: e.target.value.slice(0, CLOZE_LIMITS.TITLE_CHARS) })
          }
          placeholder="例：心不全の左右差"
          data-shortcut-ignore="true"
          style={{ ...input, marginTop: '6px' }}
        />
        <div style={{ fontSize: '11.5px', color: COLORS.muted, marginTop: '4px' }}>
          未入力なら文章の冒頭を一覧に表示
        </div>
      </div>

      <div onBlur={() => setTouched(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={label}>文章</span>
          <span style={pill(COLORS.redLight, COLORS.red)}>必須</span>
          <span style={{ fontSize: '11.5px', color: COLORS.muted }}>選択してからボタンを押す</span>
        </div>

        {/* ツールバー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            padding: '8px',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '12px',
            background: COLORS.bg,
            // 文章が長くなっても操作を探しに戻らなくて済むよう、幅によらず上部へ貼り付ける
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          <button
            type="button"
            onClick={applyHide}
            disabled={!hasSelection}
            title="選択した範囲を隠す（F1）"
            style={toolbarButton(hasSelection, true)}
          >
            ■ 隠す
          </button>
          <button
            type="button"
            onClick={applyUnhide}
            disabled={!canUnhide}
            style={toolbarButton(canUnhide, false)}
          >
            {compact ? '□ 解除' : '□ 隠すのを解除'}
          </button>
          <button
            type="button"
            onClick={openSameWord}
            disabled={!hasSelection}
            title="選んだ語と同じ語を、文章の中からまとめて隠す"
            style={toolbarButton(hasSelection, false)}
          >
            {compact ? '同じ語' : '同じ語をすべて隠す'}
          </button>
          {/* 番号（Word の「番号を振る」と同じ感覚で使う） */}
          <span
            aria-hidden="true"
            style={{ width: '1px', alignSelf: 'stretch', background: COLORS.border }}
          />
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.sub }}>番号</span>
          {NUMBER_CHOICES.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => applyNumbering(choice.key)}
              title={`選んだ行の先頭に ${choice.label} の番号を振る（Enterで続きます）`}
              style={{ ...toolbarButton(true, false), minWidth: '44px' }}
            >
              {choice.label}
            </button>
          ))}
          <button
            type="button"
            onClick={clearNumbering}
            disabled={!hasNumbering}
            title="選んだ行の番号を外す"
            style={toolbarButton(hasNumbering, false)}
          >
            なし
          </button>

          {/* 元に戻す・やり直す */}
          <span
            aria-hidden="true"
            style={{ width: '1px', alignSelf: 'stretch', background: COLORS.border }}
          />
          <button
            type="button"
            onClick={undo}
            disabled={!historyState.canUndo}
            title="元に戻す（Ctrl+Z）"
            aria-label="元に戻す"
            style={toolbarButton(historyState.canUndo, false)}
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!historyState.canRedo}
            title="やり直す（Ctrl+Y）"
            aria-label="やり直す"
            style={toolbarButton(historyState.canRedo, false)}
          >
            ↷
          </button>

          <span style={{ marginLeft: 'auto', fontSize: '11px', color: COLORS.muted }}>
            {compact ? '［［ ］］でも隠せます' : 'F1 で隠す'}
          </span>
        </div>

        {/* 入力欄（下に見た目の層、上に透明なtextarea） */}
        <div style={{ position: 'relative', marginTop: '10px' }}>
          <EditorOverlay paras={paras} fontSize={bodyFontSize} lineHeight={BODY_LINE_HEIGHT} />
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => {
              const raw = e.target.value.slice(0, CLOZE_LIMITS.BODY_CHARS)
              // [[ ]] で囲まれた箇所は、閉じた時点で括弧を外して「隠す」に変える
              const { text: stripped, ranges, caret } = extractBracketRanges(
                raw,
                e.target.selectionStart ?? raw.length,
              )
              let nextParas = rebuildFromText(paras, stripped)
              for (const range of ranges) {
                nextParas = hideRange(nextParas, range.start, range.end)
              }
              // 括弧を消した分だけカーソルがずれるので、変換後の位置へ戻す。
              // 括弧が無いときは触らない（打っている場所を動かさない）
              commit(nextParas, {
                caret: ranges.length ? caret : null,
                kind: ranges.length ? 'mark' : 'type',
              })
            }}
            onSelect={syncSelection}
            onKeyDown={continueNumbering}
            onKeyUp={syncSelection}
            onMouseUp={syncSelection}
            placeholder="覚えたい文章を貼り付けるか、入力してください。"
            data-shortcut-ignore="true"
            style={{
              position: 'relative',
              // inline-block のままだとベースライン分の余白が下に付き、
              // 下に敷いた層（inset:0）が数px高くなる
              display: 'block',
              width: '100%',
              minHeight: '230px',
              // 中身に合わせて伸ばすので、この欄の中ではスクロールさせない
              overflow: 'hidden',
              padding: '16px',
              borderRadius: '10px',
              border: `1px solid ${touched && !chars ? COLORS.red : COLORS.blue}`,
              background: 'transparent',
              color: COLORS.text,
              caretColor: COLORS.text,
              fontSize: bodyFontSize,
              lineHeight: BODY_LINE_HEIGHT,
              fontFamily: 'inherit',
              // 高さは中身に追従させる。手で変えられると下の層とずれる
              resize: 'none',
              outline: 'none',
              // 下の層と重ねるため、文字自体は透明にして装飾側を見せる
              WebkitTextFillColor: 'transparent',
            }}
          />
        </div>

        {touched && !chars && (
          <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 700, color: COLORS.red }}>
            ✕ 文章を入力してください
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '8px',
          }}
        >
          <span style={pill(COLORS.chipTrack, COLORS.body)}>隠す箇所 {hidden} か所</span>
          <span style={{ fontSize: '11.5px', color: COLORS.muted }}>
            薄い青枠が演習でマーカーになる範囲です
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: COLORS.muted }}>
            {chars}文字 / {paras.length}段落
          </span>
        </div>

        <div
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: COLORS.bg,
            border: `1px solid ${COLORS.cardBorder}`,
            fontSize: '11.5px',
            color: COLORS.sub,
            lineHeight: 1.8,
          }}
        >
          隠したい語を <b style={{ color: COLORS.blue }}>[[ ]]</b> で囲んで入力しても隠せます。
          例：植物は葉の[[葉緑体]]で —— 閉じた時点で括弧は消え、その語が隠す箇所になります。
          文字を選びにくい端末では、こちらが早いです。
        </div>

        {chars > 0 && hidden === 0 && (
          <div
            style={{
              marginTop: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: COLORS.blueLight,
              color: COLORS.blue,
              fontSize: '12.5px',
              lineHeight: 1.8,
            }}
          >
            隠す箇所が0か所です。覚えたい語句を選んで「■ 隠す」を押してください。このままでも保存できますが、演習では文章がそのまま表示されます。
          </div>
        )}
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: '14px',
          background: COLORS.bg,
          border: `1px solid ${COLORS.cardBorder}`,
          fontSize: '12.5px',
          color: COLORS.sub,
          lineHeight: 1.8,
        }}
      >
        虫食い問題は採点しないため、正答率・定着度・今日の復習には含まれません。Excelにも書き出されません。
      </div>

      {sameWord && (
        <SameWordDialog
          word={sameWord.word}
          count={sameWord.count}
          onCancel={() => setSameWord(null)}
          onApply={(prefs) => {
            const { paras: next, count } = hideSameWord(paras, sameWord.word, prefs)
            const caret = sameWord.caret
            setSameWord(null)
            if (!count) return
            commit(next, { caret, kind: 'mark' })
          }}
        />
      )}
    </div>
  )

  const preview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
          演習画面プレビュー
        </span>
        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            gap: '2px',
            padding: '3px',
            borderRadius: '999px',
            background: COLORS.chipTrack,
          }}
        >
          {[
            { key: false, text: '閉じた状態' },
            { key: true, text: '開いた状態' },
          ].map((t) => (
            <button
              key={String(t.key)}
              type="button"
              onClick={() => setPreviewOpen(t.key)}
              style={{
                minHeight: '34px',
                padding: '0 14px',
                borderRadius: '999px',
                border: 'none',
                background: previewOpen === t.key ? COLORS.blue : 'transparent',
                color: previewOpen === t.key ? '#ffffff' : COLORS.sub,
                fontSize: '12.5px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {t.text}
            </button>
          ))}
        </span>
      </div>

      <div style={card(space.card)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <span style={pill(COLORS.blueLight, COLORS.blue)}>虫食い</span>
          {groupName && <span style={pill(COLORS.chipTrack, COLORS.body)}>{groupName}</span>}
          <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: COLORS.blue }}>
            {question.questionNumber} / {total}問目
          </span>
        </div>
        {question.title && (
          <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 700, color: COLORS.text }}>
            {question.title}
          </h3>
        )}
        {chars ? (
          <PreviewBody paras={paras} allOpen={previewOpen} compact={compact} />
        ) : (
          <p style={{ margin: 0, fontSize: '14px', color: COLORS.muted }}>
            文章を入力すると、ここに演習画面と同じ見た目で表示されます。
          </p>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '20px',
            paddingTop: '14px',
            borderTop: `1px solid ${COLORS.border}`,
            fontSize: '12.5px',
            color: COLORS.sub,
          }}
        >
          <span>
            {hidden}か所中 {previewOpen ? hidden : 0}か所 表示中
          </span>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            style={{
              marginLeft: 'auto',
              minHeight: '36px',
              padding: '0 14px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.body,
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            すべて表示
          </button>
        </div>
      </div>
    </div>
  )

  return pane === 'preview' ? preview : editor
}
