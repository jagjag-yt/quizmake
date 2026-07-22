import { useState } from 'react'
import { LETTERS } from '../data/questions'

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
 * }} props
 */
export default function QuestionCard({ question, selectedIndex, answered, onSelect }) {
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
      <span
        style={{
          display: 'inline-flex',
          padding: '5px 14px',
          borderRadius: '999px',
          background: '#eff6ff',
          color: '#2563eb',
          fontWeight: 700,
          fontSize: '13px',
          marginBottom: '18px',
        }}
      >
        問題 {question.questionNumber}
      </span>

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
