import { useEffect, useRef, useState } from 'react'
import { COLORS, QUESTION_TYPES, TAP_MIN } from '../constants'
import { useCompactLayout } from '../hooks/useMediaQuery'

const TYPE_CARDS = [
  {
    type: QUESTION_TYPES.CHOICE,
    label: '選択式',
    desc: 'a〜eの選択肢から選ぶ。採点され、正答率・定着度に反映される。Excelで読み書きできる。',
  },
  {
    type: QUESTION_TYPES.CLOZE,
    label: '虫食い',
    desc: '文章の一部を隠して確認する。採点はしない。アプリ内のみで作成・保存する。',
  },
]

const FOCUSABLE = 'button, select, input, [tabindex]:not([tabindex="-1"])'

/** まとめて作れる問題数の上限（一度に増やしすぎると一覧が空の問題で埋まる）。 */
const MAX_COUNT = 20
const COUNT_PRESETS = [1, 3, 5, 10]

/**
 * 「新しい問題」ダイアログ。
 *
 * 問題タイプは構造が異なり作成後に変更できないため、エディタを開く前に
 * 必ず1回決めてもらう（SPEC A）。
 */
export default function TypePickerDialog({ groups, defaultGroupId, onCancel, onCreate }) {
  const compact = useCompactLayout()
  const [groupId, setGroupId] = useState(defaultGroupId ?? groups[0]?.id ?? '')
  const [type, setType] = useState(QUESTION_TYPES.CHOICE)
  // 同じ形の問題を続けて作るとき、1問ずつダイアログへ戻らずに済むようにする
  const [count, setCount] = useState(1)
  const ref = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll(FOCUSABLE)
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 55 }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="新しい問題"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 56,
          width: 'min(660px, calc(100vw - 40px))',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: COLORS.card,
          borderRadius: '20px',
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow: '0 16px 40px rgba(15,23,42,0.24)',
          padding: '32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.text }}>
            新しい問題
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="閉じる"
            style={{
              marginLeft: 'auto',
              width: `${TAP_MIN}px`,
              height: `${TAP_MIN}px`,
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: COLORS.sub,
              fontSize: '14px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub, marginBottom: '6px' }}>
            グループ
          </div>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            style={{
              width: '100%',
              minHeight: `${TAP_MIN}px`,
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.text,
              fontSize: '14px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub, marginBottom: '8px' }}>
          問題タイプ
        </div>
        {/* PCは2枚を横並び、タブレット以下は縦積み（デザイン枠02） */}
        <div
          role="radiogroup"
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '1fr' : '1fr 1fr',
            gap: '12px',
            alignItems: 'stretch',
          }}
        >
          {TYPE_CARDS.map((card) => {
            const selected = type === card.type
            return (
              <button
                key={card.type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setType(card.type)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '18px',
                  borderRadius: '14px',
                  border: `1px solid ${selected ? COLORS.blue : COLORS.border}`,
                  background: selected ? COLORS.blueLight : COLORS.card,
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: '18px',
                    height: '18px',
                    marginTop: '2px',
                    borderRadius: '999px',
                    border: `1px solid ${selected ? COLORS.blue : COLORS.dashed}`,
                    background: COLORS.card,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '999px',
                        background: COLORS.blue,
                      }}
                    />
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: COLORS.text,
                      marginBottom: '4px',
                    }}
                  >
                    {card.label}
                  </span>
                  <span style={{ display: 'block', fontSize: '12.5px', color: COLORS.sub, lineHeight: 1.7 }}>
                    {card.desc}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub }}>問題数</span>
            <span style={{ fontSize: '11.5px', color: COLORS.muted }}>
              まとめて作り、1問目から順に書いていきます（あとから増やせます）
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {COUNT_PRESETS.map((n) => {
              const selected = count === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCount(n)}
                  style={{
                    minHeight: '38px',
                    minWidth: '54px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    border: `1px solid ${selected ? COLORS.blue : COLORS.border}`,
                    background: selected ? COLORS.blue : COLORS.card,
                    color: selected ? '#ffffff' : COLORS.sub,
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {n}問
                </button>
              )
            })}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                min="1"
                max={MAX_COUNT}
                value={count}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value))
                  setCount(Number.isFinite(n) ? Math.min(MAX_COUNT, Math.max(1, n)) : 1)
                }}
                aria-label="作成する問題数"
                data-shortcut-ignore="true"
                style={{
                  width: '72px',
                  minHeight: '38px',
                  padding: '0 10px',
                  borderRadius: '10px',
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.card,
                  color: COLORS.text,
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '12.5px', color: COLORS.sub }}>問（最大{MAX_COUNT}）</span>
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginTop: '20px',
          }}
        >
          <span style={{ fontSize: '12px', color: COLORS.muted }}>
            タイプは作成後に変更できません
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                minHeight: `${TAP_MIN}px`,
                padding: '0 18px',
                borderRadius: '12px',
                border: `1px solid ${COLORS.border}`,
                background: COLORS.card,
                color: COLORS.body,
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => onCreate({ groupId, type, count })}
              disabled={!groupId}
              style={{
                minHeight: `${TAP_MIN}px`,
                padding: '0 20px',
                borderRadius: '12px',
                border: `1px solid ${COLORS.blue}`,
                background: groupId ? COLORS.blue : COLORS.blueLight,
                color: groupId ? '#ffffff' : COLORS.bluePale,
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: groupId ? 'pointer' : 'default',
              }}
            >
              {count > 1 ? `${count}問を作成して編集する` : '作成して編集する'}
            </button>
          </span>
        </div>
      </div>
    </>
  )
}
