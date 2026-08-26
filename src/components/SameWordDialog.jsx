import { useEffect, useRef, useState } from 'react'
import { COLORS, SAME_WORD_KEY, TAP_MIN } from '../constants'

/**
 * 「同じ語をすべて隠す」の設定。
 *
 * 同じ語をまとめて隠すとき、決めることが2つある。
 *   ・番号を1つにまとめるか、1か所ずつ連番にするか
 *   ・1つ開いたら全部開くか、1つずつ開くか
 * 押すたびに選べるようにし、前回の選び方を覚えておく（毎回選び直すのは手間なので）。
 */

/** 前回の選び方を読む。壊れていたら既定（連番・1つずつ）。 */
function loadSameWordPrefs() {
  try {
    const raw = localStorage.getItem(SAME_WORD_KEY)
    if (!raw) return { sharedNumber: false, openTogether: false }
    const parsed = JSON.parse(raw)
    return {
      sharedNumber: parsed?.sharedNumber === true,
      openTogether: parsed?.openTogether === true,
    }
  } catch {
    return { sharedNumber: false, openTogether: false }
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(SAME_WORD_KEY, JSON.stringify(prefs))
  } catch {
    // 覚えられなくても、その回の操作は続けられる
  }
}

const heading = { fontSize: '12.5px', fontWeight: 700, color: COLORS.sub, margin: '0 0 6px 0' }
const note = { margin: '6px 0 0', fontSize: '11.5px', color: COLORS.muted, lineHeight: 1.7 }

const button = (primary) => ({
  minHeight: `${TAP_MIN}px`,
  padding: '0 18px',
  borderRadius: '12px',
  border: `1px solid ${primary ? COLORS.blue : COLORS.border}`,
  background: primary ? COLORS.blue : COLORS.card,
  color: primary ? COLORS.onAccent : COLORS.body,
  fontSize: '13.5px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
})

/** 2択のスイッチ（見た目は設定画面のテーマ切り替えと同じ）。 */
function Switch({ label, hint, value, onChange, options }) {
  return (
    <div>
      <div style={heading}>{label}</div>
      <div
        role="radiogroup"
        aria-label={label}
        style={{
          display: 'inline-flex',
          gap: '2px',
          padding: '3px',
          borderRadius: '999px',
          background: COLORS.chipTrack,
          maxWidth: '100%',
          flexWrap: 'wrap',
        }}
      >
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            style={{
              minHeight: '36px',
              padding: '0 14px',
              borderRadius: '999px',
              border: 'none',
              background: value === option.value ? COLORS.blue : 'transparent',
              color: value === option.value ? COLORS.onAccent : COLORS.sub,
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {option.text}
          </button>
        ))}
      </div>
      <p style={note}>{hint}</p>
    </div>
  )
}

/**
 * @param {{
 *   word: string,
 *   count: number,
 *   onCancel: () => void,
 *   onApply: (prefs: {sharedNumber: boolean, openTogether: boolean}) => void,
 * }} props
 */
export default function SameWordDialog({ word, count, onCancel, onApply }) {
  const [prefs, setPrefs] = useState(loadSameWordPrefs)
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const set = (patch) => setPrefs((prev) => ({ ...prev, ...patch }))

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="同じ語をまとめて隠す"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 61,
          width: 'min(460px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          padding: '22px',
          borderRadius: '18px',
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow: '0 18px 48px rgba(15,23,42,0.24)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
            同じ語をまとめて隠す
          </h2>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '13px',
              color: COLORS.body,
              lineHeight: 1.8,
              overflowWrap: 'anywhere',
            }}
          >
            「<b style={{ color: COLORS.blue }}>{word}</b>」を文章全体から探して隠します（
            {count}か所）。
          </p>
        </div>

        <Switch
          label="番号の付け方"
          value={prefs.sharedNumber}
          onChange={(v) => set({ sharedNumber: v })}
          options={[
            { value: false, text: '連番' },
            { value: true, text: '同じ番号' },
          ]}
          hint={
            prefs.sharedNumber
              ? 'どこも同じ番号になります。「同じ語が入る」と分かる形です。'
              : '1か所ずつ別の番号が付きます（これまでと同じ）。'
          }
        />

        <Switch
          label="開き方"
          value={prefs.openTogether}
          onChange={(v) => set({ openTogether: v })}
          options={[
            { value: false, text: 'ふつう' },
            { value: true, text: 'まとめて開く' },
          ]}
          hint={
            prefs.openTogether
              ? '1か所を開くと、同じ語の箇所がすべて開きます。答え合わせが1回で済みます。'
              : '1か所ずつ開きます（これまでと同じ）。'
          }
        />

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" ref={cancelRef} onClick={onCancel} style={button(false)}>
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => {
              savePrefs(prefs)
              onApply(prefs)
            }}
            style={button(true)}
          >
            {count}か所を隠す
          </button>
        </div>
      </div>
    </>
  )
}
