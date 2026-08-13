import { useEffect, useRef, useState } from 'react'
import { COLORS, QUESTION_TYPES, TAP_MIN } from '../constants'

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

const FOCUSABLE = 'button, select, [tabindex]:not([tabindex="-1"])'

/**
 * 「新しい問題」ダイアログ。
 *
 * 問題タイプは構造が異なり作成後に変更できないため、エディタを開く前に
 * 必ず1回決めてもらう（SPEC A）。
 */
export default function TypePickerDialog({ groups, defaultGroupId, onCancel, onCreate }) {
  const [groupId, setGroupId] = useState(defaultGroupId ?? groups[0]?.id ?? '')
  const [type, setType] = useState(QUESTION_TYPES.CHOICE)
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
          width: 'min(600px, calc(100vw - 40px))',
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
              width: '32px',
              height: '32px',
              borderRadius: '999px',
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
        <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              onClick={() => onCreate({ groupId, type })}
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
              作成して編集する
            </button>
          </span>
        </div>
      </div>
    </>
  )
}
