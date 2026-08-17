import { useEffect, useMemo, useState } from 'react'
import { COLORS, LIMITS, TAP_MIN } from '../constants'
import { clozeHeadline, hiddenCount } from '../data/cloze'
import { useCompactLayout } from '../hooks/useMediaQuery'
import ClozeBody from './ClozeMarker'

const card = (pad) => ({
  background: COLORS.card,
  borderRadius: '20px',
  border: `1px solid ${COLORS.cardBorder}`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  padding: `${pad}px`,
})

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

const navButton = (primary) => ({
  minHeight: `${TAP_MIN}px`,
  padding: '0 20px',
  borderRadius: '12px',
  border: `1px solid ${primary ? COLORS.blue : COLORS.border}`,
  background: primary ? COLORS.blue : COLORS.card,
  color: primary ? '#ffffff' : COLORS.body,
  fontSize: '14px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

/**
 * 虫食いの演習画面。
 *
 * 採点しないので「正解と解説」のカードは存在しない。右カードが空になるのを避けるため、
 * 1カラム（最大1000px）で本文を大きく見せる（SPEC C）。
 */
export default function ClozeQuizView({
  question,
  groupName,
  position,
  total,
  record,
  noteKey,
  onToggleBookmark,
  onSaveNote,
  onPrev,
  onNext,
  isFirst,
  isLast,
  onFinish,
  openedIds,
  onToggleMarker,
  onOpenAll,
  onCloseAll,
}) {
  const compact = useCompactLayout()
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(record?.note ?? '')

  const hiddenTotal = hiddenCount(question.paras)
  const opened = openedIds.size
  const allOpen = hiddenTotal > 0 && opened >= hiddenTotal

  useEffect(() => {
    setNoteDraft(record?.note ?? '')
    setNoteOpen(false)
    // 問題が変わったらメモの下書きも差し替える
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteKey])

  const headline = useMemo(() => clozeHeadline(question), [question])

  return (
    <div style={{ gridColumn: '1 / -1', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 開閉の状況と一括操作 */}
        <div
          style={{
            ...card(compact ? 14 : 16),
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            position: 'sticky',
            top: '12px',
            zIndex: 20,
          }}
        >
          {groupName && <span style={pill(COLORS.chipTrack, COLORS.body)}>{groupName}</span>}
          <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: COLORS.sub }}>
            {hiddenTotal}か所中 {opened}か所 表示中
          </span>
          <button
            type="button"
            onClick={() => (allOpen ? onCloseAll() : onOpenAll())}
            disabled={hiddenTotal === 0}
            style={{
              minHeight: `${TAP_MIN}px`,
              padding: '0 16px',
              borderRadius: '10px',
              border: `1px solid ${hiddenTotal ? COLORS.border : COLORS.border}`,
              background: COLORS.card,
              color: hiddenTotal ? COLORS.body : COLORS.dashed,
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: hiddenTotal ? 'pointer' : 'default',
            }}
          >
            {allOpen ? 'すべて隠す' : 'すべて表示'}
          </button>
        </div>

        {/* 本文 */}
        <div style={{ ...card(0), padding: compact ? '22px' : '32px 40px 36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <span style={pill(COLORS.blueLight, COLORS.blue)}>虫食い</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onToggleBookmark}
                aria-label={record?.bookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
                style={{
                  width: `${TAP_MIN}px`,
                  height: `${TAP_MIN}px`,
                  borderRadius: '999px',
                  border: `1px solid ${record?.bookmarked ? COLORS.amber : COLORS.border}`,
                  background: record?.bookmarked ? COLORS.amberLight : COLORS.card,
                  color: record?.bookmarked ? COLORS.amberDark : COLORS.dashed,
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {record?.bookmarked ? '★' : '☆'}
              </button>
              <button
                type="button"
                onClick={() => setNoteOpen((v) => !v)}
                aria-expanded={noteOpen}
                style={{
                  minHeight: `${TAP_MIN}px`,
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: `1px solid ${noteOpen ? COLORS.blue : COLORS.border}`,
                  background: noteOpen ? COLORS.blueLight : COLORS.card,
                  color: noteOpen ? COLORS.blue : COLORS.body,
                  fontSize: '12.5px',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {compact ? '≡' : '自分メモ'}
              </button>
            </span>
          </div>

          <h2 style={{ margin: '0 0 18px 0', fontSize: compact ? '20px' : '24px', fontWeight: 700, color: COLORS.text }}>
            {headline}
          </h2>

          <ClozeBody
            paras={question.paras}
            openedIds={openedIds}
            onToggle={onToggleMarker}
            fontSize={compact ? '17px' : '18px'}
            tablet={compact}
          />

          {noteOpen && (
            <div style={{ marginTop: '22px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub, marginBottom: '6px' }}>
                自分メモ
              </div>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, LIMITS.NOTE_CHARS))}
                onBlur={() => {
                  if (noteDraft !== (record?.note ?? '')) onSaveNote(noteDraft)
                }}
                rows={3}
                placeholder="覚え方や関連事項を書いておくと、次回も表示されます。"
                data-shortcut-ignore="true"
                style={{
                  width: '100%',
                  resize: 'vertical',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.bg,
                  color: COLORS.text,
                  fontSize: '13.5px',
                  lineHeight: 1.7,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* ナビゲーション */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingBottom: '24px',
          }}
        >
          <button
            type="button"
            onClick={onPrev}
            disabled={isFirst}
            style={{ ...navButton(false), opacity: isFirst ? 0.6 : 1, cursor: isFirst ? 'default' : 'pointer' }}
          >
            ← 前の問題
          </button>
          {!compact && (
            <span style={{ fontSize: '12px', color: COLORS.muted }}>
              クリックで開閉／もう一度押すと隠れます
            </span>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={onCloseAll} style={navButton(false)}>
              ↻ 隠し直す
            </button>
            <button
              type="button"
              onClick={isLast ? onFinish : onNext}
              style={navButton(true)}
            >
              {isLast ? '結果を見る →' : '次の問題 →'}
            </button>
          </span>
        </div>

        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          虫食い {position} / {total} 問目
        </span>
      </div>
    </div>
  )
}
