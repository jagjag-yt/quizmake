import { COLORS, SPACING, TAP_MIN } from '../constants'
import { useCompactLayout } from '../hooks/useMediaQuery'
import { clozeHeadline } from '../data/cloze'
import { isCloze } from '../data/questions'
import { accuracyOf } from '../utils/stats'
import { formatDuration } from '../utils/safe'

/** 指標タイル。 */
function Stat({ label, value, sub, color = COLORS.text }) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        // flex の子も既定は min-width:auto。0 にしないと文字の最小幅で下限が決まり、
        // スマホでカードごと画面からはみ出す
        minWidth: 0,
        padding: '16px 18px',
        borderRadius: '14px',
        background: COLORS.bg,
        border: `1px solid ${COLORS.cardBorder}`,
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.sub }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color, lineHeight: 1.4 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: COLORS.muted }}>{sub}</div>}
    </div>
  )
}

const actionButton = (primary) => ({
  minHeight: `${TAP_MIN}px`,
  padding: '12px 22px',
  borderRadius: '12px',
  border: `1px solid ${primary ? COLORS.blue : COLORS.border}`,
  background: primary ? COLORS.blue : COLORS.card,
  color: primary ? '#ffffff' : COLORS.body,
  fontSize: '14px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
})

/**
 * セッションの採点サマリー。
 * 何問中何問正解したか、どこで間違えたかをまとめて振り返る画面。
 *
 * @param {{
 *   questions: import('../data/questions').Question[],
 *   answers: Array<null | { correct: boolean, selectedLetters: string, correctLetters: string }>,
 *   elapsedSec: number,
 *   onReviewWrong: () => void,
 *   onRestart: () => void,
 *   onOpenDashboard: () => void,
 *   onJumpTo: (index: number) => void,
 * }} props
 */
export default function SessionSummary({
  questions,
  answers,
  elapsedSec,
  onReviewWrong,
  onRestart,
  onOpenDashboard,
  onJumpTo,
}) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const answered = answers.filter(Boolean).length
  const correct = answers.filter((a) => a?.correct).length
  const wrong = answered - correct
  const unanswered = questions.length - answered
  const accuracy = accuracyOf(correct, answered)

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <section
        style={{
          background: COLORS.card,
          borderRadius: '20px',
          padding: `${space.card}px`,
          boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
          border: `1px solid ${COLORS.cardBorder}`,
        }}
      >
        <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: COLORS.text }}>
          演習おつかれさまでした
        </h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: COLORS.sub }}>
          今回の結果です。間違えた問題はそのまま復習に進めます。
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Stat
            label="正答率"
            value={`${accuracy}%`}
            sub={`${correct} / ${answered} 問正解`}
            color={COLORS.blue}
          />
          <Stat label="正解" value={correct} color={COLORS.green} />
          <Stat label="不正解" value={wrong} color={wrong > 0 ? COLORS.red : COLORS.text} />
          <Stat label="未回答" value={unanswered} color={COLORS.muted} />
          <Stat label="所要時間" value={formatDuration(elapsedSec)} sub={`${questions.length}問`} />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '24px' }}>
          {wrong > 0 && (
            <button type="button" style={actionButton(true)} onClick={onReviewWrong}>
              間違えた問題を復習する（{wrong}問）
            </button>
          )}
          <button type="button" style={actionButton(false)} onClick={onRestart}>
            同じ条件でもう一度
          </button>
          <button type="button" style={actionButton(false)} onClick={onOpenDashboard}>
            学習記録を見る
          </button>
        </div>
      </section>

      <section
        style={{
          background: COLORS.card,
          borderRadius: '20px',
          padding: `${space.card}px`,
          boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
          border: `1px solid ${COLORS.cardBorder}`,
        }}
      >
        <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: COLORS.text }}>
          問題ごとの結果
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {questions.map((q, i) => {
            const a = answers[i]
            const status = !a ? 'skip' : a.correct ? 'correct' : 'wrong'
            const color =
              status === 'correct' ? COLORS.green : status === 'wrong' ? COLORS.red : COLORS.muted
            const bg =
              status === 'correct'
                ? COLORS.greenLight
                : status === 'wrong'
                  ? COLORS.redLight
                  : COLORS.bg
            const text = isCloze(q) ? clozeHeadline(q) : q.segments.map((s) => s.text).join('')
            return (
              <button
                key={`${q.questionNumber}-${i}`}
                type="button"
                onClick={() => onJumpTo(i)}
                title="この問題をもう一度見る"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${status === 'skip' ? COLORS.border : color}`,
                  background: bg,
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: status === 'skip' ? '#e2e8f0' : color,
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  {status === 'correct' ? '○' : status === 'wrong' ? '×' : '−'}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: COLORS.sub,
                  }}
                >
                  問題 {q.questionNumber}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: '13.5px',
                    color: COLORS.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {text}
                </span>
                {a && (
                  <span style={{ flexShrink: 0, fontSize: '12px', color: COLORS.sub }}>
                    回答 {a.selectedLetters || '—'} / 正解 {a.correctLetters}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
