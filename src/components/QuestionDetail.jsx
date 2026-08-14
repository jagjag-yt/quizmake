import { useEffect, useState } from 'react'
import { COLORS, LETTERS, LIMITS, ORIGIN_LABELS, TAP_MIN } from '../constants'
import { clozeHeadline, hiddenCount, withMarkerIndexes } from '../data/cloze'
import { isCloze } from '../data/questions'
import { shouldInline } from '../utils/clozeRender'

/** 見出し（h14b + 下線）。 */
const heading = {
  fontSize: '14px',
  fontWeight: 700,
  color: COLORS.text,
  margin: '0 0 10px 0',
  paddingBottom: '8px',
  borderBottom: `1px solid ${COLORS.border}`,
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

/** 定着度（●○の5段表示）。 */
export function BoxMeter({ box }) {
  const filled = Math.max(0, Math.min(5, box ?? 0))
  return (
    <span
      aria-label={`定着度 ${filled} / 5`}
      style={{ color: COLORS.blue, letterSpacing: '1px', fontSize: '12px' }}
    >
      {'●'.repeat(filled)}
      {'○'.repeat(5 - filled)}
    </span>
  )
}

/** 学習状況のバッジ（色だけに依存させないためテキストを必ず添える）。 */
export function StatusBadge({ record }) {
  const map = {
    correct: { text: '○ 正解', bg: COLORS.greenLight, color: COLORS.greenDark },
    incorrect: { text: '× 不正解', bg: COLORS.redLight, color: COLORS.redDark },
    none: { text: '未学習', bg: COLORS.bg, color: COLORS.muted },
  }
  const key = record?.attempts ? (record.lastResult ?? 'none') : 'none'
  const s = map[key] ?? map.none
  return <span style={pill(s.bg, s.color)}>{s.text}</span>
}

/** 自分メモ（入力欄を離れると保存）。 */
function NoteField({ noteKey, note, onSave }) {
  const [draft, setDraft] = useState(note)
  // 問題が変わったときだけ差し替える（自分の保存で note が変わっても入力を巻き戻さない）
  useEffect(() => {
    setDraft(note)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteKey])

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value.slice(0, LIMITS.NOTE_CHARS))}
      onBlur={() => {
        if (draft !== note) onSave(draft)
      }}
      placeholder="メモはまだありません。クリックして入力できます。"
      rows={3}
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
  )
}

/** 詳細パネルでの虫食い本文（一括で開閉する）。 */
function ClozeDetailBody({ paras, opened }) {
  const indexed = withMarkerIndexes(paras)
  return (
    <div style={{ fontSize: '16px', lineHeight: 2.0, color: COLORS.text }}>
      {indexed.map((para, pi) => (
        <p key={pi} style={{ margin: pi === 0 ? 0 : '1.1em 0 0 0' }}>
          {para.map((run, ri) =>
            run.hide ? (
              <span
                key={ri}
                style={{
                  display: shouldInline(run.text) ? 'inline' : 'inline-block',
                  boxDecorationBreak: 'clone',
                  WebkitBoxDecorationBreak: 'clone',
                  padding: '0 6px',
                  margin: '0 4px',
                  borderRadius: 0,
                  lineHeight: 1.35,
                  background: opened ? COLORS.blueLight : COLORS.blue,
                  color: opened ? run.color : 'transparent',
                  boxShadow: opened ? `inset 0 -2px 0 ${COLORS.bluePale}` : 'none',
                }}
              >
                <span
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
                  {run.markerIndex}
                </span>
                {run.text}
              </span>
            ) : (
              <span key={ri} style={{ color: run.color }}>
                {run.text}
              </span>
            ),
          )}
        </p>
      ))}
    </div>
  )
}

/**
 * 設問の詳細プレビュー。
 * デスクトップでは右カラムに常時表示、タブレットでは右からのパネルに入れる。
 */
export default function QuestionDetail({
  question,
  groupName,
  record,
  noteKey,
  onToggleBookmark,
  onSaveNote,
  onStartFromHere,
  cardPadding = 32,
}) {
  const [clozeOpen, setClozeOpen] = useState(true)
  // 選択式の詳細は「内容の確認」で開くことが多く、正解が目に入ると演習にならない。
  // 既定では伏せておき、押したときだけ見せる（虫食いの [答えを表示|隠す] と同じ操作）。
  const [answerOpen, setAnswerOpen] = useState(false)
  useEffect(() => {
    setAnswerOpen(false)
  }, [noteKey])

  const meta = record?.attempts
    ? `${record.attempts}回中${record.correct}回正解${
        record.lastAnsweredAt ? ` · 最終 ${record.lastAnsweredAt.replace(/-/g, '/')}` : ''
      }`
    : '未学習'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', padding: `${cardPadding}px` }}>
      {/* 見出し行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text }}>
          問題 {question.questionNumber}
        </span>
        {groupName && <span style={pill(COLORS.chipTrack, COLORS.body)}>{groupName}</span>}
        <span
          style={pill(
            isCloze(question) ? COLORS.blueLight : COLORS.chipTrack,
            isCloze(question) ? COLORS.blue : COLORS.body,
          )}
        >
          {isCloze(question) ? '虫食い' : '選択式'}
        </span>
        <span style={pill(COLORS.blueLight, COLORS.blue)}>
          {ORIGIN_LABELS[question.origin] ?? '読込'}
        </span>
        <button
          type="button"
          onClick={onToggleBookmark}
          aria-label={record?.bookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
          title={record?.bookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
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
            lineHeight: 1,
          }}
        >
          {record?.bookmarked ? '★' : '☆'}
        </button>
        <button
          type="button"
          onClick={onStartFromHere}
          style={{
            marginLeft: 'auto',
            minHeight: `${TAP_MIN - 8}px`,
            padding: '8px 16px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.blue}`,
            background: COLORS.blue,
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          この問題から演習
        </button>
      </div>

      {isCloze(question) ? (
        <>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.text }}>
            {clozeHeadline(question)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={pill(COLORS.chipTrack, COLORS.body)}>
              隠す箇所 {hiddenCount(question.paras)} か所
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
                { key: true, text: '答えを表示' },
                { key: false, text: '隠す' },
              ].map((t) => (
                <button
                  key={String(t.key)}
                  type="button"
                  onClick={() => setClozeOpen(t.key)}
                  style={{
                    minHeight: '34px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    border: 'none',
                    background: clozeOpen === t.key ? COLORS.blue : 'transparent',
                    color: clozeOpen === t.key ? '#ffffff' : COLORS.sub,
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
          <ClozeDetailBody paras={question.paras} opened={clozeOpen} />
        </>
      ) : (
      <>
      {/* 問題文 */}
      <p style={{ margin: 0, fontSize: '18px', lineHeight: 1.9, color: COLORS.text }}>
        {question.segments.map((seg, i) => (
          <span
            key={i}
            style={
              seg.u
                ? { borderBottom: `2px solid ${COLORS.blue}`, paddingBottom: '1px', fontWeight: 700 }
                : undefined
            }
          >
            {seg.text}
          </span>
        ))}
      </p>

      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt="問題の図"
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            display: 'block',
            maxWidth: '100%',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
          }}
        />
      )}

      {/* 正解の表示切り替え */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={pill(COLORS.chipTrack, COLORS.body)}>選択肢 {question.choices.length}つ</span>
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
            { key: false, text: '答えを隠す' },
            { key: true, text: '答えを表示' },
          ].map((t) => (
            <button
              key={String(t.key)}
              type="button"
              onClick={() => setAnswerOpen(t.key)}
              style={{
                minHeight: '34px',
                padding: '0 14px',
                borderRadius: '999px',
                border: 'none',
                background: answerOpen === t.key ? COLORS.blue : 'transparent',
                color: answerOpen === t.key ? '#ffffff' : COLORS.sub,
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

      {/* 選択肢（「答えを表示」のときだけ正解を明示する） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {question.choices.map((text, idx) => {
          const isCorrect = answerOpen && question.correctIndexes.includes(idx)
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minHeight: '48px',
                padding: '10px 14px',
                borderRadius: '14px',
                border: `1px solid ${isCorrect ? COLORS.green : COLORS.border}`,
                background: isCorrect ? COLORS.greenLight : COLORS.card,
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: isCorrect ? COLORS.green : COLORS.chipTrack,
                  color: isCorrect ? '#ffffff' : COLORS.body,
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {LETTERS[idx]}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: isCorrect ? COLORS.greenDark : COLORS.text,
                  fontWeight: isCorrect ? 700 : 400,
                }}
              >
                {text}
              </span>
              {isCorrect && (
                <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.green }}>正解</span>
              )}
            </div>
          )
        })}
      </div>

      {answerOpen && question.explanation && (
        <div>
          <h3 style={heading}>解説</h3>
          <p
            style={{
              margin: 0,
              fontSize: '14.5px',
              lineHeight: 1.9,
              color: COLORS.body,
              whiteSpace: 'pre-wrap',
            }}
          >
            {question.explanation}
          </p>
        </div>
      )}

      {answerOpen && question.keyPoints.length > 0 && (
        <div>
          <h3 style={heading}>基本事項</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {question.keyPoints.map((kp, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: COLORS.blueLight,
                }}
              >
                <span style={{ color: COLORS.blue, fontSize: '12px', lineHeight: 1.7 }}>●</span>
                <span style={{ fontSize: '14px', lineHeight: 1.7, color: COLORS.body }}>{kp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      </>
      )}

      <div>
        <h3 style={heading}>自分メモ</h3>
        <NoteField noteKey={noteKey} note={record?.note ?? ''} onSave={onSaveNote} />
      </div>

      {!isCloze(question) && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: COLORS.muted }}>
        <span>定着度</span>
        <BoxMeter box={record?.box} />
        <span>·</span>
        <span>{meta}</span>
      </div>
      )}
    </div>
  )
}
