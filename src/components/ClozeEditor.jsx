import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CLOZE_LIMITS, COLORS, SPACING, TAP_MIN, TEXT_COLORS } from '../constants'
import {
  bodyLength,
  colorRange,
  hiddenCount,
  hideRange,
  parasToText,
  rangeHasHidden,
  rebuildFromText,
  unhideRange,
  withMarkerIndexes,
} from '../data/cloze'
import { useCompactLayout } from '../hooks/useMediaQuery'
import { shouldInline } from '../utils/clozeRender'

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
function EditorOverlay({ paras }) {
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
        fontSize: '15.5px',
        lineHeight: 1.95,
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
                    color: run.color,
                  }}
                >
                  {run.text}
                </span>
              ) : (
                <span key={ri} style={{ color: run.color }}>
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
                <span key={ri} style={{ color: run.color }}>
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
                  color: allOpen ? run.color : 'transparent',
                  boxShadow: allOpen ? `inset 0 -2px 0 ${COLORS.bluePale}` : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    lineHeight: 1,
                    verticalAlign: 'top',
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
export default function ClozeEditor({ question, onUpdate, tagsSlot, groupSlot, pane = 'editor' }) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [touched, setTouched] = useState(false)
  const areaRef = useRef(null)

  const paras = question.paras
  const text = useMemo(() => parasToText(paras), [paras])
  const hidden = hiddenCount(paras)
  const chars = bodyLength(paras)
  const hasSelection = selection.end > selection.start
  const canUnhide = hasSelection && rangeHasHidden(paras, selection.start, selection.end)

  const syncSelection = useCallback(() => {
    const el = areaRef.current
    if (el) setSelection({ start: el.selectionStart, end: el.selectionEnd })
  }, [])

  const applyHide = useCallback(() => {
    if (!hasSelection) return
    onUpdate(question.id, { paras: hideRange(paras, selection.start, selection.end) })
  }, [hasSelection, onUpdate, question.id, paras, selection])

  const applyUnhide = useCallback(() => {
    if (!hasSelection) return
    onUpdate(question.id, { paras: unhideRange(paras, selection.start, selection.end) })
  }, [hasSelection, onUpdate, question.id, paras, selection])

  const applyColor = useCallback(
    (color) => {
      if (!hasSelection) return
      onUpdate(question.id, {
        paras: colorRange(paras, selection.start, selection.end, color),
      })
    },
    [hasSelection, onUpdate, question.id, paras, selection],
  )

  // 「隠す」のショートカット。Ctrl+F1（要望）と Ctrl/⌘+H（SPEC）の両方を受ける。
  useEffect(() => {
    const onKey = (e) => {
      const hit =
        (e.ctrlKey && e.key === 'F1') ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H'))
      if (!hit) return
      // 入力欄の中にいるときだけ効かせる（他画面のキー操作を邪魔しない）
      if (document.activeElement !== areaRef.current) return
      e.preventDefault()
      syncSelection()
      applyHide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyHide, syncSelection])

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

      {groupSlot}

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

      {tagsSlot}

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
            position: compact ? 'sticky' : 'static',
            top: 0,
            zIndex: 2,
          }}
        >
          <button
            type="button"
            onClick={applyHide}
            disabled={!hasSelection}
            title="選択した範囲を隠す（Ctrl+F1）"
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
            □ 隠すのを解除
          </button>
          <span style={{ width: '1px', height: '24px', background: COLORS.border }} />
          <span style={{ ...label, fontSize: '12px' }}>文字色</span>
          {TEXT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => applyColor(c.value)}
              disabled={!hasSelection}
              aria-label={`文字色を${c.name}にする`}
              title={c.name}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '999px',
                border: 'none',
                background: hasSelection ? c.value : COLORS.chipTrack,
                cursor: hasSelection ? 'pointer' : 'default',
                padding: 0,
              }}
            />
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: COLORS.muted }}>
            Ctrl+F1 で隠す
          </span>
        </div>

        {/* 入力欄（下に見た目の層、上に透明なtextarea） */}
        <div style={{ position: 'relative', marginTop: '10px' }}>
          <EditorOverlay paras={paras} />
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => {
              const next = e.target.value.slice(0, CLOZE_LIMITS.BODY_CHARS)
              onUpdate(question.id, { paras: rebuildFromText(paras, next) })
            }}
            onSelect={syncSelection}
            onKeyUp={syncSelection}
            onMouseUp={syncSelection}
            placeholder="覚えたい文章を貼り付けるか、入力してください。"
            data-shortcut-ignore="true"
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '230px',
              padding: '16px',
              borderRadius: '10px',
              border: `1px solid ${touched && !chars ? COLORS.red : COLORS.blue}`,
              background: 'transparent',
              color: COLORS.text,
              caretColor: COLORS.text,
              fontSize: '15.5px',
              lineHeight: 1.95,
              fontFamily: 'inherit',
              resize: 'vertical',
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
          <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: COLORS.blue }}>
            {question.questionNumber} 問目
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
