import { useEffect, useState } from 'react'
import { COLORS, LETTERS, SPACING, TAP_MIN } from '../constants'
import { useCanHover, useCompactLayout } from '../hooks/useMediaQuery'
import { splitBodyByTables } from '../data/questions'
import QuestionTable from './QuestionTable'
import MathText from './MathText'

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
        background: COLORS.blueLight,
        color: COLORS.blue,
        fontWeight: 700,
        fontSize: '13px',
      }}
    >
      <span>問題</span>
      <input
        type="text"
        inputMode="numeric"
        enterKeyHint="go"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(e)
        }}
        onFocus={(e) => e.target.select()}
        onBlur={submit}
        aria-label="問題番号（入力してジャンプ）"
        data-shortcut-ignore="true"
        style={{
          width: `${Math.max(1, draft.length)}ch`,
          minWidth: '1ch',
          border: 'none',
          borderBottom: `1px solid ${COLORS.bluePale}`,
          background: 'transparent',
          color: COLORS.blue,
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
      title={active ? 'ブックマークを解除（S）' : 'ブックマークに追加（S）'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        minHeight: `${TAP_MIN}px`,
        padding: '6px 14px',
        borderRadius: '999px',
        border: `1px solid ${active ? COLORS.amber : COLORS.border}`,
        background: active ? COLORS.amberLight : COLORS.card,
        color: active ? COLORS.amberDark : COLORS.sub,
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
 * 問題画像。URLは取り込み時に検証済み（http(s) と画像data URLのみ）。
 * 読み込みに失敗した場合は領域ごと隠す。
 */
function QuestionImage({ url }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  if (!url || failed) return null
  return (
    <img
      src={url}
      alt="問題の図"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: '320px',
        objectFit: 'contain',
        margin: '0 0 24px 0',
        borderRadius: '12px',
        border: `1px solid ${COLORS.border}`,
        background: COLORS.bg,
      }}
    />
  )
}

/** 単一の選択肢。回答状態に応じて正誤色に切り替わる。 */
function Choice({ letter, text, state, onSelect }) {
  const [hover, setHover] = useState(false)
  // タッチ端末ではタップ後にホバー状態が残るため、ホバー演出自体を無効にする
  const canHover = useCanHover()
  const compact = useCompactLayout()
  const { answered, reveal, isCorrect, isSelected, disabled } = state

  // 既定（未回答）
  let bg = COLORS.card
  let border = COLORS.border
  let color = COLORS.text
  let badgeBg = COLORS.chipTrack
  let badgeColor = COLORS.body

  if (reveal) {
    // 正誤を開示する（通常モードの回答後）
    if (isCorrect) {
      bg = COLORS.greenLight
      border = COLORS.green
      color = COLORS.greenDark
      badgeBg = COLORS.green
      badgeColor = '#ffffff'
    } else if (isSelected) {
      bg = COLORS.redLight
      border = COLORS.red
      color = COLORS.redDark
      badgeBg = COLORS.red
      badgeColor = '#ffffff'
    } else {
      // その他の未選択肢：減光
      color = COLORS.muted
      badgeColor = COLORS.dashed
    }
  } else if (isSelected) {
    // 選択済み（未採点、または本番モードで正誤を伏せている状態）
    bg = COLORS.blueLight
    border = COLORS.blue
    color = COLORS.blue
    badgeBg = COLORS.blue
    badgeColor = '#ffffff'
  } else if (hover && canHover && !answered && !disabled) {
    border = COLORS.bluePale
    bg = COLORS.bg
  }

  const clickable = !answered && !disabled

  return (
    <div
      role="button"
      aria-pressed={isSelected}
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? onSelect : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault()
          onSelect()
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '12px' : '14px',
        minHeight: `${TAP_MIN}px`,
        padding: compact ? '14px 16px' : '16px 20px',
        borderRadius: '14px',
        border: `2px solid ${border}`,
        background: bg,
        color,
        cursor: clickable ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled && !isSelected ? 0.6 : 1,
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
      <span>
        <MathText text={text} />
      </span>
    </div>
  )
}

/**
 * 左カラム：問題文と選択肢リスト。
 *
 * @param {{
 *   question: import('../data/questions').Question,
 *   selected: number[],
 *   answered: boolean,
 *   examMode: boolean,
 *   onToggleChoice: (idx: number) => void,
 *   onSubmit: () => void,
 *   bookmarked: boolean,
 *   onToggleBookmark: () => void,
 *   onJump: (num: number) => boolean,
 * }} props
 */
export default function QuestionCard({
  question,
  groupName,
  selected,
  answered,
  examMode,
  onToggleChoice,
  onSubmit,
  bookmarked,
  onToggleBookmark,
  onJump,
}) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const requiredCount = question.correctIndexes.length
  const isMulti = requiredCount > 1
  const reveal = answered && !examMode
  // 「2つ選べ」で上限まで選んだら、未選択の選択肢は選べない
  const capped = isMulti && selected.length >= requiredCount

  return (
    <section
      style={{
        background: COLORS.card,
        borderRadius: '20px',
        padding: `${space.card}px`,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        border: `1px solid ${COLORS.cardBorder}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '18px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <QuestionNumberBadge number={question.questionNumber} onJump={onJump} />
          {groupName && (
            <span
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                background: COLORS.chipTrack,
                color: COLORS.body,
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {groupName}
            </span>
          )}
        </div>
        <BookmarkStar active={bookmarked} onToggle={onToggleBookmark} />
      </div>

      <div style={{ margin: '0 0 24px 0' }}>
        {splitBodyByTables(question.segments, question.tables).map((block, bi) =>
          block.type === 'table' ? (
            <QuestionTable key={bi} table={block.table} compact={compact} />
          ) : (
            <p
              key={bi}
              style={{
                fontSize: compact ? '17px' : '18px',
                lineHeight: '1.9',
                color: COLORS.text,
                margin: 0,
                // 作成画面で入れた改行をそのまま出す（解説・基本事項と同じ扱い）
                whiteSpace: 'pre-wrap',
              }}
            >
              {block.segments.map((seg, i) => (
                <MathText key={i} text={seg.text} />
              ))}
            </p>
          ),
        )}
      </div>

      <QuestionImage url={question.imageUrl} />

      {isMulti && !answered && (
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '13px',
            fontWeight: 700,
            color: COLORS.blue,
          }}
        >
          {requiredCount}つ選んでから「解答する」を押してください（選択中 {selected.length}/
          {requiredCount}）
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {question.choices.map((text, idx) => (
          <Choice
            key={idx}
            letter={LETTERS[idx]}
            text={text}
            state={{
              answered,
              reveal,
              isCorrect: question.correctIndexes.includes(idx),
              isSelected: selected.includes(idx),
              disabled: capped && !selected.includes(idx),
            }}
            onSelect={() => onToggleChoice(idx)}
          />
        ))}
      </div>

      {isMulti && !answered && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={selected.length !== requiredCount}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px 24px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.blue}`,
            background: selected.length === requiredCount ? COLORS.blue : COLORS.blueLight,
            color: selected.length === requiredCount ? '#ffffff' : COLORS.bluePale,
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: selected.length === requiredCount ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
        >
          解答する
        </button>
      )}
    </section>
  )
}
