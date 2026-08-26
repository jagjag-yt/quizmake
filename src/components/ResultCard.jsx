import { useEffect, useState } from 'react'
import { COLORS, LETTERS, LIMITS, SPACING } from '../constants'
import RichText from './RichText'
import { useCompactLayout } from '../hooks/useMediaQuery'

/** 改行。この文字を直接書くと編集の途中で壊れやすいので、文字コードで作る。 */
const NEWLINE = String.fromCharCode(10)

/** 「解説」「基本事項」で共通の見出しスタイル。 */
const sectionHeading = {
  fontSize: '14px',
  fontWeight: 700,
  color: COLORS.text,
  margin: '0 0 10px 0',
  paddingBottom: '8px',
  borderBottom: `1px solid ${COLORS.border}`,
}

/**
 * 自分メモ。入力中は手元の state に保持し、入力欄を離れたときに保存する
 * （キー入力のたびに保存すると、記録が増えたときに重くなるため）。
 */
function NoteEditor({ noteKey, note, onSave }) {
  const [draft, setDraft] = useState(note)
  const [saved, setSaved] = useState(false)

  // 問題が変わったら、その問題のメモに差し替える。
  // 依存を noteKey だけにしているのは、自分の保存で note が更新されたときに
  // 「保存しました」の表示が即座に消えてしまうのを防ぐため。
  useEffect(() => {
    setDraft(note)
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteKey])

  const commit = () => {
    if (draft === note) return
    onSave(draft)
    setSaved(true)
  }

  return (
    <div>
      <h3 style={sectionHeading}>自分メモ</h3>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value.slice(0, LIMITS.NOTE_CHARS))
          setSaved(false)
        }}
        onBlur={commit}
        placeholder="覚え方・間違えた理由・関連事項などを書いておくと、次にこの問題を解くときに表示されます。"
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
      <span style={{ fontSize: '11.5px', color: COLORS.muted }}>
        {saved ? '保存しました' : '入力欄を離れると保存されます'}
      </span>
    </div>
  )
}

/**
 * 右カラム：回答前はプレースホルダー、回答後は正解・解説・基本事項・メモを表示。
 * 本番モードでは、セッション終了まで解説を伏せる。
 *
 * @param {{
 *   question: import('../data/questions').Question,
 *   selected: number[],
 *   answered: boolean,
 *   examMode: boolean,
 *   noteKey: string,
 *   note: string,
 *   onSaveNote: (note: string) => void,
 * }} props
 */
export default function ResultCard({
  question,
  selected,
  answered,
  examMode,
  noteKey,
  note,
  onSaveNote,
}) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const correctLetters = question.correctIndexes.map((i) => LETTERS[i]).join('・')
  const userLetters = [...selected].sort((a, b) => a - b).map((i) => LETTERS[i]).join('・')
  const isCorrect =
    answered &&
    selected.length === question.correctIndexes.length &&
    question.correctIndexes.every((i) => selected.includes(i))

  const shell = {
    background: COLORS.card,
    borderRadius: '20px',
    padding: `${space.card}px`,
    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
    border: `1px solid ${COLORS.cardBorder}`,
    display: 'flex',
    flexDirection: 'column',
  }

  // 未回答：プレースホルダー
  if (!answered) {
    return (
      <section style={shell}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px dashed ${COLORS.dashed}`,
            borderRadius: '16px',
            padding: '40px',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              color: COLORS.muted,
              textAlign: 'center',
              lineHeight: '1.8',
            }}
          >
            選択肢を選ぶと、ここに正解と解説が
            <br />
            表示されます
          </span>
        </div>
      </section>
    )
  }

  // 本番モード：正誤も解説も伏せる
  if (examMode) {
    return (
      <section style={shell}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            border: `2px dashed ${COLORS.dashed}`,
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '28px', lineHeight: 1 }}>&#9203;</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: COLORS.body }}>
            本番モードで解答中
          </span>
          <span style={{ fontSize: '13px', color: COLORS.muted, lineHeight: 1.8 }}>
            あなたの回答：{userLetters || '—'}
            <br />
            正誤と解説は、セッション終了後の結果画面でまとめて確認できます。
          </span>
        </div>
      </section>
    )
  }

  return (
    <section style={shell}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
        {/* 正解表示行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '36px',
              height: '36px',
              padding: '0 10px',
              borderRadius: '999px',
              background: COLORS.green,
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              flexShrink: 0,
            }}
          >
            {correctLetters}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '17px', fontWeight: 700, color: COLORS.greenDark }}>
              正解：{correctLetters}
            </span>
            {!isCorrect && (
              <span style={{ fontSize: '13px', color: COLORS.red, fontWeight: 700 }}>
                あなたの回答：{userLetters || '—'}（不正解）
              </span>
            )}
          </div>
        </div>

        {/* 解説 */}
        {question.explanation && (
          <div>
            <h3 style={sectionHeading}>解説</h3>
            <RichText
              text={question.explanation}
              tables={question.tables}
              style={{
                fontSize: '14.5px',
                lineHeight: '1.9',
                color: COLORS.body,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            />
          </div>
        )}

        {/*
          基本事項は**解説と同じ見た目**にする（利用者の指示・2026-08-26）。
          字下げも1項目ごとの隙間も付けず、入力欄に書いたとおりの1本の文章として出す。
        */}
        {question.keyPoints.some((kp) => kp.trim()) && (
          <div>
            <h3 style={sectionHeading}>基本事項</h3>
            <RichText
              text={question.keyPoints.filter((kp) => kp.trim()).join(NEWLINE)}
              tables={question.tables}
              style={{
                fontSize: '14.5px',
                lineHeight: '1.9',
                color: COLORS.body,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            />
          </div>
        )}

        <NoteEditor noteKey={noteKey} note={note} onSave={onSaveNote} />
      </div>
    </section>
  )
}
