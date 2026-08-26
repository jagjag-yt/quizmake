import { useRef } from 'react'
import { COLORS, inkColor } from '../constants'
import { splitNumberPrefix, withMarkerIndexes } from '../data/cloze'
import { shouldInline } from '../utils/clozeRender'

/**
 * 虫食いのマーカー描画。
 *
 * 閉じている状態は「塗り＋文字色 transparent」で描く。文字自体はDOMに残るので、
 * 幅と高さが本文の字形にぴったり合い、開閉しても行送りがずれない（SPEC MARKER RENDER）。
 * 角は落とさず直角のまま。番号バッジは開閉で位置を変えず、色だけ反転させる。
 */

/** 通し番号のバッジ（閉／開で位置は不変、色だけ反転）。 */
function NumberBadge({ index, opened }) {
  return (
    <span
      aria-hidden="true"
      style={{
        // inline のままだとフォントの上下幅で行box全体に広がり、番号がマーカーの
        // 塗りから上にはみ出す。inline-block にして高さを line-height に固定する
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
        color: opened ? COLORS.text : '#ffffff',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {index}
    </span>
  )
}

/**
 * 判定の印（○ / ✕）。
 *
 * 背景の色だけだと、淡い塗り（#f0fdf4 / #fef2f2）では見分けが付きにくい。
 * 記号を添えて、色に頼らなくても分かるようにする。
 */
function VerdictBadge({ verdict }) {
  if (!verdict) return null
  const correct = verdict === 'correct'
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        position: 'relative',
        top: '-4px',
        marginRight: '4px',
        fontSize: '12px',
        fontWeight: 700,
        lineHeight: '12px',
        verticalAlign: 'baseline',
        color: correct ? COLORS.greenDark : COLORS.redDark,
      }}
    >
      {correct ? '○' : '✕'}
    </span>
  )
}

/** 長押しを右クリックの代わりとみなす時間（ミリ秒）。 */
const LONG_PRESS_MS = 550

/** 判定ごとの見た目。開いていて未判定なら青、正答は緑、誤答は赤。 */
function judgedStyle(verdict) {
  if (verdict === 'correct') {
    return { background: COLORS.greenLight, line: COLORS.green }
  }
  if (verdict === 'wrong') {
    return { background: COLORS.redLight, line: COLORS.red }
  }
  return { background: COLORS.blueLight, line: COLORS.bluePale }
}

/** 読み上げ用の状態名。 */
function stateLabel(opened, verdict) {
  if (!opened) return '表示する'
  if (verdict === 'correct') return '正答。押すと隠す'
  if (verdict === 'wrong') return '誤答。押すと正答にする'
  return '正答にする'
}

/**
 * 1つのマーカー。クリック／Enter／Space で開閉する。
 *
 * 開いたあとは **左クリックで正答（緑）／右クリックで誤答（赤）**。
 * 左クリックは 閉じる→開く→正答→閉じる の順に回る。右クリックは誤答の付け外し。
 * タッチ端末には右クリックが無いので、長押しを同じ扱いにする。
 *
 * マーカーの高さは字形に合わせるため44pxには届かない。
 * 代わりに行間2.05で上下の余白を確保し、隣接マーカーの間には最低8pxを空けている
 * （SPEC a11y の明示された例外）。
 */
export function Marker({ run, opened, verdict = null, onToggle, onMarkWrong, tablet = false }) {
  const inline = shouldInline(run.text)
  const look = judgedStyle(verdict)
  // 長押しの計測。押している最中に指が動いたら取り消す（スクロールと区別する）
  const pressRef = useRef({ timer: null, fired: false })

  const startPress = () => {
    clearTimeout(pressRef.current.timer)
    pressRef.current.fired = false
    pressRef.current.timer = setTimeout(() => {
      pressRef.current.fired = true
      onMarkWrong?.()
    }, LONG_PRESS_MS)
  }
  const cancelPress = () => clearTimeout(pressRef.current.timer)

  return (
    <button
      type="button"
      data-marker="true"
      onKeyDown={(e) => {
        // Tab で選んだマーカーを、その場でめくれるようにする。
        // Enter はボタンの既定動作でも click になるが、ここで明示的に受ける。
        // 既定動作に任せると、環境によっては何も起きないことがあるため。
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (e.shiftKey) onMarkWrong?.()
        else onToggle?.()
      }}
      onClick={(e) => {
        // 長押しで誤答にした直後のクリックは無視する（続けて正答にしない）
        if (pressRef.current.fired) {
          pressRef.current.fired = false
          e.preventDefault()
          return
        }
        onToggle?.()
      }}
      onContextMenu={(e) => {
        // ブラウザのメニューは出さない。右クリックは誤答の付け外しに使う
        e.preventDefault()
        onMarkWrong?.()
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') startPress()
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onPointerMove={cancelPress}
      aria-pressed={opened}
      aria-label={`空所${run.markerIndex} を${stateLabel(opened, verdict)}`}
      style={{
        display: inline ? 'inline' : 'inline-block',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
        padding: tablet ? '0 7px' : '0 6px',
        margin: '0 4px',
        border: 'none',
        borderRadius: 0,
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        // 字形の高さに合わせるため、本文の行間(2.05)ではなく1.35を使う
        lineHeight: 1.35,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: opened ? look.background : COLORS.blue,
        color: opened ? inkColor(run.color) : 'transparent',
        boxShadow: opened ? `inset 0 -2px 0 ${look.line}` : 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${COLORS.bluePale}`
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
      }}
    >
      <NumberBadge index={run.markerIndex} opened={opened} />
      <VerdictBadge verdict={opened ? verdict : null} />
      {run.text}
    </button>
  )
}

/**
 * 本文の描画（演習・詳細・プレビュー共通）。
 * @param {{
 *   paras: Array, openedIds: Set<number>, onToggle?: (n:number)=>void,
 *   fontSize?: string, tablet?: boolean, interactive?: boolean,
 * }} props
 */
export default function ClozeBody({
  paras,
  openedIds,
  verdicts = new Map(),
  onToggle,
  onMarkWrong,
  fontSize = '18px',
  tablet = false,
  interactive = true,
}) {
  const indexed = withMarkerIndexes(paras)
  return (
    <div style={{ fontSize, lineHeight: 2.05, color: COLORS.text }}>
      {indexed.map((para, pi) => {
        // 番号付きの段落は、番号と本文を別の箱に入れて横に並べる。
        // 折り返した2行目以降は本文の箱の中で折り返すので、字幅を計算しなくても
        // 必ず本文の開始位置に揃う（書体が変わってもずれない）
        const numbered = splitNumberPrefix(para)
        const body = numbered ? numbered.rest : para
        return (
        <p
          key={pi}
          style={{
            margin: pi === 0 ? '0' : '1.1em 0 0 0',
            ...(numbered ? { display: 'flex', alignItems: 'flex-start' } : null),
          }}
        >
          {numbered && (
            <span style={{ flex: '0 0 auto', whiteSpace: 'pre' }}>{numbered.prefix}</span>
          )}
          {numbered ? (
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>{renderRuns(body)}</span>
          ) : (
            renderRuns(para)
          )}
        </p>
        )
      })}
    </div>
  )

  /** 段落の中身（マーカーと素の文字）を描く。 */
  function renderRuns(runs) {
    return (
      <>
        {runs.map((run, ri) => {
          if (!run.hide) {
              return (
                <span key={ri} style={{ color: inkColor(run.color) }}>
                  {run.text}
                </span>
              )
            }
            // 開閉と○✕は markerKey（必ず一意）で管理する。表示の番号は
            // 「同じ番号」のまとまりで重なるため、状態の鍵には使えない
            const opened = openedIds.has(run.markerKey)
            if (!interactive) {
              // プレビューでは個別に押せない（一括切替のみ）
              return (
                <span
                  key={ri}
                  style={{
                    display: shouldInline(run.text) ? 'inline' : 'inline-block',
                    boxDecorationBreak: 'clone',
                    WebkitBoxDecorationBreak: 'clone',
                    padding: tablet ? '0 7px' : '0 6px',
                    margin: '0 4px',
                    borderRadius: 0,
                    lineHeight: 1.35,
                    background: opened ? COLORS.blueLight : COLORS.blue,
                    color: opened ? inkColor(run.color) : 'transparent',
                    boxShadow: opened ? `inset 0 -2px 0 ${COLORS.bluePale}` : 'none',
                  }}
                >
                  <NumberBadge index={run.markerIndex} opened={opened} />
                  {run.text}
                </span>
              )
            }
            return (
              <Marker
                key={ri}
                run={run}
                opened={opened}
                verdict={verdicts.get(run.markerKey) ?? null}
                tablet={tablet}
                onToggle={() => onToggle?.(run.markerKey)}
                onMarkWrong={() => onMarkWrong?.(run.markerKey)}
              />
            )
        })}
      </>
    )
  }
}
