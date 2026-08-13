import { COLORS } from '../constants'
import { withMarkerIndexes } from '../data/cloze'
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
        fontSize: '12px',
        fontWeight: 700,
        lineHeight: 1,
        verticalAlign: 'top',
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
 * 1つのマーカー。クリック／Enter／Space で開閉する。
 *
 * マーカーの高さは字形に合わせるため44pxには届かない。
 * 代わりに行間2.05で上下の余白を確保し、隣接マーカーの間には最低8pxを空けている
 * （SPEC a11y の明示された例外）。
 */
export function Marker({ run, opened, onToggle, tablet = false }) {
  const inline = shouldInline(run.text)
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={opened}
      aria-label={`空所${run.markerIndex} を${opened ? '隠す' : '表示'}`}
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
        background: opened ? COLORS.blueLight : COLORS.blue,
        color: opened ? run.color : 'transparent',
        boxShadow: opened ? `inset 0 -2px 0 ${COLORS.bluePale}` : 'none',
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
  onToggle,
  fontSize = '18px',
  tablet = false,
  interactive = true,
}) {
  const indexed = withMarkerIndexes(paras)
  return (
    <div style={{ fontSize, lineHeight: 2.05, color: COLORS.text }}>
      {indexed.map((para, pi) => (
        <p key={pi} style={{ margin: pi === 0 ? '0' : '1.1em 0 0 0' }}>
          {para.map((run, ri) => {
            if (!run.hide) {
              return (
                <span key={ri} style={{ color: run.color }}>
                  {run.text}
                </span>
              )
            }
            const opened = openedIds.has(run.markerIndex)
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
                    color: opened ? run.color : 'transparent',
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
                tablet={tablet}
                onToggle={() => onToggle?.(run.markerIndex)}
              />
            )
          })}
        </p>
      ))}
    </div>
  )
}
