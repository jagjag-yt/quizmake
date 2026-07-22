import { useEffect, useState } from 'react'
import { LETTERS } from '../data/questions'

/**
 * 「問題〇」バッジ。番号部分が入力欄になっており、番号を打って Enter で
 * その問題番号へジャンプする。無効な番号のときは元の番号に戻す。
 */
function QuestionNumberBadge({ number, onJump }) {
  const [draft, setDraft] = useState(String(number))

  // 問題が変わったら表示中の番号に同期
  useEffect(() => {
    setDraft(String(number))
  }, [number])

  const submit = (e) => {
    e.preventDefault()
    const num = Number(draft)
    if (Number.isInteger(num) && onJump(num)) return // ジャンプ成功
    setDraft(String(number)) // 失敗時は元に戻す
  }

  return (
    <form
      onSubmit={submit}
      title="番号を入力して Enter でジャンプ"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 14px',
        borderRadius: '999px',
        background: '#eff6ff',
        color: '#2563eb',
        fontWeight: 700,
        fontSize: '13px',
      }}
    >
      <span>問題</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(e)
        }}
        onFocus={(e) => e.target.select()}
        onBlur={submit}
        aria-label="問題番号（入力してジャンプ）"
        style={{
          width: `${Math.max(1, draft.length)}ch`,
          minWidth: '1ch',
          border: 'none',
          borderBottom: '1px solid #93c5fd',
          background: 'transparent',
          color: '#2563eb',
          fontWeight: 700,
          fontSize: '13px',
          fontFamily: 'inherit',
          textAlign: 'center',
          padding: 0,
          outline: 'none',
        }}
      />
    </form>
  )
}

/** ブックマークのトグルボタン（★＝登録中 / ☆＝未登録）。 */
function BookmarkStar({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? 'ブックマークを解除' : 'ブックマークに追加'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '999px',
        border: `1px solid ${active ? '#f59e0b' : '#e2e8f0'}`,
        background: active ? '#fffbeb' : '#ffffff',
        color: active ? '#b45309' : '#64748b',
        fontSize: '13px',
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ fontSize: '15px', lineHeight: 1 }}>{active ? '★' : '☆'}</span>
      {active ? 'ブックマーク中' : 'ブックマーク'}
    </button>
  )
}

/**
 * 単一の選択肢。回答状態に応じて正誤色に切り替わる。
 */
function Choice({ letter, text, state, onSelect }) {
  const [hover, setHover] = useState(false)
  const { answered, isCorrect, isSelected } = state

  // 既定（未回答）
  let bg = '#ffffff'
  let border = '#e2e8f0'
  let color = '#1e293b'
  let badgeBg = '#f1f5f9'
  let badgeColor = '#475569'

  if (answered) {
    if (isCorrect) {
      bg = '#f0fdf4'
      border = '#16a34a'
      color = '#166534'
      badgeBg = '#16a34a'
      badgeColor = '#ffffff'
    } else if (isSelected) {
      bg = '#fef2f2'
      border = '#dc2626'
      color = '#991b1b'
      badgeBg = '#dc2626'
      badgeColor = '#ffffff'
    } else {
      // その他の未選択肢：減光
      color = '#94a3b8'
      badgeColor = '#cbd5e1'
    }
  } else if (hover) {
    // 未回答時の hover
    border = '#93c5fd'
    bg = '#f8fafc'
  }

  return (
    <div
      role="button"
      tabIndex={answered ? -1 : 0}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '16px 20px',
        borderRadius: '14px',
        border: `2px solid ${border}`,
        background: bg,
        color,
        cursor: answered ? 'default' : 'pointer',
        transition: 'all 0.15s ease',
        fontSize: '15px',
        lineHeight: '1.6',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: badgeBg,
          color: badgeColor,
          fontWeight: 700,
          fontSize: '13px',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
      >
        {letter}
      </span>
      <span>{text}</span>
    </div>
  )
}

/**
 * 左カラム：問題文と選択肢リスト。
 *
 * @param {{
 *   question: import('../data/questions').Question,
 *   selectedIndex: number | null,
 *   answered: boolean,
 *   onSelect: (idx: number) => void,
 *   bookmarked: boolean,
 *   onToggleBookmark: () => void,
 *   onJump: (num: number) => boolean,
 * }} props
 */
export default function QuestionCard({
  question,
  selectedIndex,
  answered,
  onSelect,
  bookmarked,
  onToggleBookmark,
  onJump,
}) {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        border: '1px solid #eef2f7',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <QuestionNumberBadge number={question.questionNumber} onJump={onJump} />
        <BookmarkStar active={bookmarked} onToggle={onToggleBookmark} />
      </div>

      <p
        style={{
          fontSize: '18px',
          lineHeight: '1.9',
          color: '#1e293b',
          margin: '0 0 30px 0',
        }}
      >
        {question.segments.map((seg, i) => (
          <span
            key={i}
            style={
              seg.u
                ? {
                    borderBottom: '2px solid #2563eb',
                    paddingBottom: '1px',
                    fontWeight: 700,
                  }
                : undefined
            }
          >
            {seg.text}
          </span>
        ))}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {question.choices.map((text, idx) => (
          <Choice
            key={idx}
            letter={LETTERS[idx]}
            text={text}
            state={{
              answered,
              isCorrect: idx === question.correctIndex,
              isSelected: idx === selectedIndex,
            }}
            onSelect={() => onSelect(idx)}
          />
        ))}
      </div>
    </section>
  )
}
