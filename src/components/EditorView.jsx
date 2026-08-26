import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  COLORS,
  GROUP_NAME_MAX,
  LETTERS,
  ORIGIN,
  QUESTION_TYPES,
  SPACING,
  TAP_MIN,
  TYPE_LABELS,
} from '../constants'
import {
  emptyTable,
  placedTableNumbers,
  segmentsFromText,
  segmentsToText,
  splitBodyByTables,
  tableToken,
  TABLE_TOKEN,
} from '../data/questions'
import { clozeHeadline, hiddenCount } from '../data/cloze'
import { isCloze } from '../data/questions'
import { useCompactLayout, usePhoneLayout, usePreviewTight } from '../hooks/useMediaQuery'
import ClozeEditor from './ClozeEditor'
import QuestionTable from './QuestionTable'
import MathText from './MathText'
import RichText from './RichText'
import TableEditor from './TableEditor'
import ConfirmDialog, { PromptDialog } from './ConfirmDialog'
import { validateQuestion } from '../hooks/useQuestionPool'
import { isSafeImageUrl } from '../utils/safe'

/** 改行。この文字を直接書くと編集の途中で壊れやすいので、文字コードで作る。 */
const NEWLINE = String.fromCharCode(10)
const CARRIAGE = String.fromCharCode(13)

/** 表を置ける欄。 */
const FIELDS = { BODY: 'body', EXPLANATION: 'explanation', KEY_POINTS: 'keyPoints' }

const card = (pad) => ({
  background: COLORS.card,
  borderRadius: '20px',
  border: `1px solid ${COLORS.cardBorder}`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  padding: `${pad}px`,
})

const label = { fontSize: '12.5px', fontWeight: 700, color: COLORS.sub }

const input = {
  minHeight: `${TAP_MIN}px`,
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.text,
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
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

const errorText = (msg) => (
  <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 700, color: COLORS.red }}>✕ {msg}</div>
)

/**
 * 中身の高さに合わせて伸びる入力欄。
 *
 * 手で高さを変える（resize）のをやめ、**文字の量に合わせて自動で伸ばす**。
 * 読み込んだ直後にも測るので、Excel から入れた長い問題文も最初から全部見える
 * （2026-08-26 に「読み込んだときに反映されない」と報告された）。
 */
function AutoTextarea({ value, minRows = 3, style, textareaRef = null, ...rest }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const fit = () => {
      // 測るあいだ欄がつぶれるので、ページのスクロール位置を戻す
      const scroller = document.scrollingElement ?? document.documentElement
      const top = scroller.scrollTop
      el.style.height = 'auto'
      const border = el.offsetHeight - el.clientHeight
      el.style.height = `${el.scrollHeight + border}px`
      if (scroller.scrollTop !== top) scroller.scrollTop = top
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [value])

  return (
    <textarea
      // 呼び出し側もこの欄を触る（カーソル位置を読むなど）ので、両方に渡す
      ref={(el) => {
        ref.current = el
        if (textareaRef) textareaRef.current = el
      }}
      value={value}
      rows={minRows}
      style={{ ...style, resize: 'none', overflow: 'hidden' }}
      {...rest}
    />
  )
}

/**
 * ドラッグで並べ替えできる行のラッパー。
 *
 * **つまみ（⠿）を押したときだけ**ドラッグを許す。行全体を draggable にすると、
 * 入力欄の中で文字を選ぼうとした瞬間に並べ替えが始まり、選択できなくなる
 * （2026-08-26 に基本事項で報告された）。
 */
function Sortable({ index, onMove, children, style }) {
  const [armed, setArmed] = useState(false)

  // つまみに付ける属性。呼び出し側は <span {...handleProps}>⠿</span> のように使う
  const handleProps = {
    onPointerDown: () => setArmed(true),
    onPointerUp: () => setArmed(false),
    onPointerCancel: () => setArmed(false),
  }

  return (
    <div
      draggable={armed}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
      onDragEnd={() => setArmed(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        setArmed(false)
        const from = Number(e.dataTransfer.getData('text/plain'))
        if (Number.isInteger(from)) onMove(from, index)
      }}
      style={style}
    >
      {typeof children === 'function' ? children(handleProps) : children}
    </div>
  )
}

const handleStyle = {
  cursor: 'grab',
  color: COLORS.dashed,
  fontSize: '14px',
  userSelect: 'none',
  lineHeight: 1,
}

/** 「⊞ 表を入れる」ボタン（問題文・解説・基本事項で同じ形にする）。 */
const tableButton = (enabled) => ({
  marginLeft: 'auto',
  minHeight: '36px',
  padding: '0 12px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: enabled ? COLORS.body : COLORS.dashed,
  fontSize: '12.5px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: enabled ? 'pointer' : 'default',
  whiteSpace: 'nowrap',
})

/** 解説・基本事項の入力欄。問題文と同じく、カーソルの位置に表を差し込める。 */
function LongTextField({ title, hint, value, onChange, onInsertTable, canAddTable }) {
  const ref = useRef(null)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
          flexWrap: 'wrap',
        }}
      >
        <span style={label}>{title}</span>
        {hint && <span style={{ fontSize: '11.5px', color: COLORS.muted }}>{hint}</span>}
        <button
          type="button"
          onClick={() => onInsertTable?.(ref.current?.selectionStart ?? null)}
          disabled={!canAddTable}
          title="カーソルの位置に表を差し込みます"
          style={tableButton(canAddTable)}
        >
          ⊞ 表を入れる
        </button>
      </div>

      <AutoTextarea
        textareaRef={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minRows={3}
        data-shortcut-ignore="true"
        style={{
          ...input,
          minHeight: 'auto',
          padding: '12px 14px',
          fontSize: '14.5px',
          lineHeight: 1.9,
        }}
      />
    </div>
  )
}

/**
 * 問題文の入力欄。
 *
 * 下線を引く操作は 2026-08-26 に廃止した（利用者の指示）。入力に集中できるようにする。
 * ただし **下線そのものは残す**。Excel の「下線キーワード」列から入ってきた問題は
 * これまでどおり下線付きで出題され、書き出しでも失われない。
 */
function QuestionTextField({ text, onChange, invalid, onInsertTable, canAddTable }) {
  const ref = useRef(null)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
          flexWrap: 'wrap',
        }}
      >
        <span style={label}>問題文</span>
        <span style={pill(COLORS.redLight, COLORS.red)}>必須</span>
        <button
          type="button"
          onClick={() => onInsertTable?.(ref.current?.selectionStart ?? null)}
          disabled={!canAddTable}
          title="カーソルの位置に表を差し込みます"
          style={tableButton(canAddTable)}
        >
          ⊞ 表を入れる
        </button>
      </div>

      <AutoTextarea
        textareaRef={ref}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="問題文を入力"
        minRows={3}
        data-shortcut-ignore="true"
        style={{
          ...input,
          minHeight: 'auto',
          padding: '12px 14px',
          fontSize: '15px',
          lineHeight: 1.9,
          borderColor: invalid ? COLORS.red : COLORS.border,
        }}
      />

      {invalid && errorText('問題文を入力してください')}
    </div>
  )
}

/** 右ペインの演習プレビュー（演習画面と同じ見た目）。 */
function Preview({ question, groupName, mode, position, total, pad }) {
  const multi = question.correctIndexes.length > 1
  const heading = {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.text,
    margin: '0 0 10px 0',
    paddingBottom: '8px',
    borderBottom: `1px solid ${COLORS.border}`,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={card(pad)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          {groupName && <span style={pill(COLORS.chipTrack, COLORS.body)}>{groupName}</span>}
          {multi && <span style={pill(COLORS.blueLight, COLORS.blue)}>2つ選べ</span>}
          <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: COLORS.blue }}>
            {position} / {total}問目
          </span>
        </div>

        <div style={{ margin: '0 0 20px 0' }}>
          {splitBodyByTables(question.segments, question.tables).map((block, bi) =>
            block.type === 'table' ? (
              <QuestionTable key={bi} table={block.table} />
            ) : (
              <p
                key={bi}
                style={{
                  margin: 0,
                  fontSize: '18px',
                  lineHeight: 1.9,
                  color: COLORS.text,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {block.segments.map((seg, i) => (
                  <MathText key={i} text={seg.text} />
                ))}
              </p>
            ),
          )}
          {!segmentsToText(question.segments) && (
            <span style={{ color: COLORS.muted }}>ここに問題文が表示されます</span>
          )}
        </div>

        {question.imageUrl && (
          <img
            src={question.imageUrl}
            alt="問題の図"
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ display: 'block', maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', marginBottom: '20px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {question.choices.map((text, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                minHeight: '48px',
                padding: '14px 18px',
                borderRadius: '14px',
                border: `2px solid ${COLORS.border}`,
                background: COLORS.card,
                fontSize: '15px',
                lineHeight: 1.6,
                color: COLORS.text,
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
                  background: COLORS.chipTrack,
                  color: COLORS.body,
                  fontWeight: 700,
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                {LETTERS[i]}
              </span>
              <span>{text || <span style={{ color: COLORS.muted }}>（未入力）</span>}</span>
            </div>
          ))}
        </div>
      </div>

      {mode === 'after' && (
        <div style={card(pad)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ ...pill(COLORS.greenLight, COLORS.greenDark), fontSize: '15px', padding: '8px 16px' }}>
              正解 {question.correctIndexes.map((i) => LETTERS[i]).join('・') || '—'}
            </span>
          </div>
          {question.explanation && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={heading}>解説</h3>
              <RichText
                text={question.explanation}
                tables={question.tables}
                style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.9, color: COLORS.body, whiteSpace: 'pre-wrap' }}
              />
            </div>
          )}
          {question.keyPoints.length > 0 && (
            <div>
              <h3 style={heading}>基本事項</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {question.keyPoints
                  .filter((kp) => kp.trim())
                  .map((kp, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: COLORS.blueLight,
                      }}
                    >
                      <RichText
                        text={kp}
                        tables={question.tables}
                        style={{ margin: 0, fontSize: '14px', lineHeight: 1.7, color: COLORS.body }}
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 選んだ問題をどのグループへ移すかを決めるダイアログ。 */
function MoveGroupDialog({ count, groups, onCancel, onConfirm }) {
  const [pick, setPick] = useState(groups[0]?.id ?? '')

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="移動先のグループ"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 61,
          width: 'min(420px, calc(100vw - 40px))',
          background: COLORS.card,
          borderRadius: '20px',
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow: '0 16px 40px rgba(15,23,42,0.24)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
          {count}問を移動する
        </h2>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub }}>移動先のグループ</span>
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          aria-label="移動先のグループ"
          style={{ ...input, cursor: 'pointer' }}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: '11.5px', color: COLORS.muted, lineHeight: 1.7 }}>
          移動先で番号が重なった場合は、移動してきた問題の番号だけを振り直します。
        </span>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ ...input, width: 'auto', padding: '0 18px', fontWeight: 700, cursor: 'pointer', color: COLORS.body }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(pick)}
            style={{
              ...input,
              width: 'auto',
              padding: '0 18px',
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${COLORS.blue}`,
              background: COLORS.blue,
              color: '#ffffff',
            }}
          >
            移動する
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * スマートフォンで問題作成を開いたときの案内。
 *
 * この幅では選択肢の入力欄が全角4文字ほどになり、実用にならない。
 * 「壊れている」と受け取られないよう、意図してそうしていることと、
 * この端末で何ができるかを伝える。どうしても必要な人のために逃げ道は残す。
 */
function PhoneNotice({ onGoQuiz, onForce, pad }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        ...card(pad),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '999px',
          background: COLORS.blueLight,
          color: COLORS.blue,
          fontSize: '24px',
        }}
      >
        ✎
      </span>
      <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
        問題づくりは、画面の広い端末で
      </p>
      <p style={{ margin: 0, fontSize: '13.5px', color: COLORS.sub, lineHeight: 1.9 }}>
        この画面幅では選択肢の入力欄が数文字分しか取れず、
        <br />
        まともに入力できないため、作成は開いていません。
        <br />
        タブレットかパソコンでお試しください。
      </p>
      <p style={{ margin: 0, fontSize: '13.5px', color: COLORS.body, lineHeight: 1.9 }}>
        この端末では<b>演習と復習</b>が使えます。
        <br />
        作った問題はそのまま解けます。
      </p>
      <button
        type="button"
        onClick={onGoQuiz}
        style={{
          minHeight: `${TAP_MIN}px`,
          padding: '0 24px',
          borderRadius: '12px',
          border: `1px solid ${COLORS.blue}`,
          background: COLORS.blue,
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        演習にすすむ
      </button>
      <button
        type="button"
        onClick={onForce}
        style={{
          border: 'none',
          background: 'transparent',
          color: COLORS.muted,
          fontSize: '12.5px',
          fontFamily: 'inherit',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        それでもこの端末で作成する
      </button>
    </div>
  )
}

/**
 * 問題作成の入口。
 *
 * 問題は必ずどれかのグループの中に入るため、いきなり1問目を作らせるのではなく
 * 「新しいグループを作る」か「既存のグループに追加する」かを先に選んでもらう。
 * どちらを選んでも、続けて「新しい問題」ダイアログ（問題タイプの選択）へ進む。
 */
function StartPane({
  groups,
  onCreateGroup,
  onAdd,
  onImportClick,
  transferSlot,
  showTransfer,
  compact,
  pad,
}) {
  const [name, setName] = useState('')

  const optionCard = {
    border: `1px solid ${COLORS.border}`,
    borderRadius: '14px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  }
  const actionButton = (enabled) => ({
    ...input,
    width: '100%',
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'default',
    border: `1px solid ${enabled ? COLORS.blue : COLORS.border}`,
    background: enabled ? COLORS.blue : COLORS.chipTrack,
    color: enabled ? '#ffffff' : COLORS.dashed,
  })

  const hasGroups = groups.length > 0
  const nameReady = name.trim().length > 0

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        ...card(pad),
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
          問題を作成する
        </p>
        <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: COLORS.sub, lineHeight: 1.8 }}>
          問題はグループ（科目・単元）の中に作ります。どちらから始めるか選んでください。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: '14px' }}>
        <div style={optionCard}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>
            ＋ 新しいグループを作成
          </span>
          <span style={{ fontSize: '12.5px', color: COLORS.sub, lineHeight: 1.7 }}>
            新しい科目や単元を作って、その中に問題を追加します。
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, GROUP_NAME_MAX))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nameReady) {
                onCreateGroup(name.trim())
                setName('')
                onAdd()
              }
            }}
            placeholder="例：循環器"
            aria-label="新しいグループ名"
            data-shortcut-ignore="true"
            style={{ ...input, marginTop: 'auto' }}
          />
          <button
            type="button"
            disabled={!nameReady}
            onClick={() => {
              onCreateGroup(name.trim())
              setName('')
              onAdd()
            }}
            style={actionButton(nameReady)}
          >
            作成して問題を追加
          </button>
        </div>

        <div style={optionCard}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>
            既存のグループに問題を追加
          </span>
          <span style={{ fontSize: '12.5px', color: COLORS.sub, lineHeight: 1.7 }}>
            {hasGroups
              ? 'すでにあるグループに追加します。どのグループにするかは、次の「新しい問題」で選べます。'
              : 'まだグループがありません。左の「新しいグループを作成」から始めてください。'}
          </span>
          <button
            type="button"
            disabled={!hasGroups}
            onClick={onAdd}
            style={{ ...actionButton(hasGroups), marginTop: 'auto' }}
          >
            問題を追加する
          </button>
        </div>
      </div>

      {showTransfer ? (
        // サイドバーが無い（まだ1問も無い）ときは、ここに書き出す／読み込むを出す
        <div style={{ maxWidth: '380px', width: '100%', alignSelf: 'center' }}>{transferSlot}</div>
      ) : (
        <button
          type="button"
          onClick={onImportClick}
          style={{
            alignSelf: 'flex-start',
            border: 'none',
            background: 'transparent',
            color: COLORS.sub,
            fontSize: '13px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          または問題を読み込む
        </button>
      )}
    </div>
  )
}

/**
 * 前後の問題へ移る帯。
 *
 * 左の一覧まで目を戻さずに、いま編集している欄のすぐ下から次へ進めるようにする
 * （利用者の要望・2026-08-26）。並びは左の一覧と同じ（＝絞り込みも効く）。
 */
function QuestionNav({ items, currentId, onSelect, divider = true }) {
  const index = items.findIndex((q) => q.id === currentId)
  if (index < 0) return null
  const prev = items[index - 1] ?? null
  const next = items[index + 1] ?? null

  const navButton = (enabled) => ({
    minHeight: `${TAP_MIN}px`,
    padding: '0 16px',
    borderRadius: '12px',
    border: `1px solid ${enabled ? COLORS.border : COLORS.cardBorder}`,
    background: COLORS.card,
    color: enabled ? COLORS.body : COLORS.dashed,
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: enabled ? 'pointer' : 'default',
    whiteSpace: 'nowrap',
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderTop: divider ? `1px solid ${COLORS.border}` : 'none',
        paddingTop: divider ? '14px' : 0,
      }}
    >
      <button
        type="button"
        onClick={() => prev && onSelect(prev.id)}
        disabled={!prev}
        style={navButton(!!prev)}
      >
        ← 前の問題
      </button>
      <span
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '12.5px',
          color: COLORS.sub,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {index + 1} / {items.length}問目
      </span>
      <button
        type="button"
        onClick={() => next && onSelect(next.id)}
        disabled={!next}
        style={navButton(!!next)}
      >
        次の問題 →
      </button>
    </div>
  )
}

export default function EditorView({
  questions,
  authored,
  selectedId,
  onSelect,
  onAdd,
  onUpdate: onUpdateProp,
  onRemove,
  onDuplicate,
  onReorderAuthored,
  onMoveToGroup,
  onGoQuiz,
  onImportClick,
  transferSlot,
  groups,
  activeGroupId,
  onChangeActiveGroup,
  onCreateGroup,
}) {
  const compact = useCompactLayout()
  const phone = usePhoneLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  // スマホでは作成を開かない。どうしても必要な人だけ、案内から進める
  const [forcePhoneEdit, setForcePhoneEdit] = useState(false)
  const [poolFilter, setPoolFilter] = useState('all')
  const [previewMode, setPreviewMode] = useState('before')
  // プレビューは常に開閉式。既定は閉じたままにして、見たいときだけ開く
  const [previewOpen, setPreviewOpen] = useState(false)
  // 3ペインだとプレビューが潰れる幅（iPad 横 1194px など）。
  // この幅では縦画面と同じ [編集|プレビュー] の切り替えにして、向きを変えても操作を変えない
  const previewTight = usePreviewTight()
  const [tabletPane, setTabletPane] = useState('edit')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [touched, setTouched] = useState({})
  const [imageState, setImageState] = useState('idle')
  // 確認・名前入力はアプリ内のダイアログで行う（window.confirm/prompt は環境により出ない）
  const [deleting, setDeleting] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  // 一覧から複数まとめて選び、移動・削除できるようにする
  const [checkedIds, setCheckedIds] = useState([])
  // Shift での範囲選択の起点（一覧の何番目を最後に触ったか）
  const checkAnchorRef = useRef(null)
  // 選択肢に貼り付けた行が5つに収まらなかったときの断り書き
  const [choicePasteNote, setChoicePasteNote] = useState('')
  const [movingTo, setMovingTo] = useState(false)
  const [deletingChecked, setDeletingChecked] = useState(false)
  // 何か直したら「保存」を出す（保存自体は自動だが、区切りを自分で決められるようにする）
  const [dirty, setDirty] = useState(false)
  // 「変更を破棄」で戻す先。編集を始めた時点の内容を控えておく
  const snapshotRef = useRef(null)
  const [discarding, setDiscarding] = useState(false)

  const onUpdate = useCallback(
    (id, patch) => {
      setDirty(true)
      onUpdateProp(id, patch)
    },
    [onUpdateProp],
  )

  const question = useMemo(
    () => questions.find((q) => q.id === selectedId) ?? null,
    [questions, selectedId],
  )

  // スナップショットを撮るためだけに最新の一覧を持つ（依存に questions を入れると毎回撮り直してしまう）
  const questionsRef = useRef(questions)
  questionsRef.current = questions

  // 別の問題に移ったら「変更あり」を持ち越さない。あわせて戻す先を控え直す
  useEffect(() => {
    setDirty(false)
    setTouched({})
    setChoicePasteNote('')
    snapshotRef.current = questionsRef.current.find((q) => q.id === selectedId) ?? null
  }, [selectedId])

  const text = question && !isCloze(question) ? segmentsToText(question.segments) : ''
  const errors = question ? validateQuestion(question) : []
  const textInvalid = touched.text && !text.trim()
  const choiceInvalid =
    touched.choices &&
    !isCloze(question ?? {}) &&
    ((question?.choices?.filter((c) => c.trim()).length ?? 0) < 2 ||
      !(question?.correctIndexes?.length ?? 0))

  // 画像URLの読み込み確認（入力が落ち着いてから）
  const imageUrl = question && !isCloze(question) ? question.imageUrl : null
  useEffect(() => {
    const url = imageUrl
    if (!url) {
      setImageState('idle')
      return undefined
    }
    setImageState('loading')
    const timer = setTimeout(() => {
      const img = new Image()
      img.onload = () => setImageState('ok')
      img.onerror = () => setImageState('error')
      img.src = url
    }, 400)
    return () => clearTimeout(timer)
  }, [imageUrl])

  const tables = useMemo(
    () => (question && !isCloze(question) ? (question.tables ?? []) : []),
    [question],
  )

  /** 本文・解説・基本事項に置かれている表の番号（1始まり）。 */
  const placedTables = useMemo(() => placedTableNumbers(question), [question])

  /** 基本事項は「1項目＝1行」の配列。入力欄では1本の文章として扱う。 */
  const keyPointsText = useMemo(
    () => (question?.keyPoints ?? []).join(NEWLINE),
    [question],
  )

  /**
   * 表を置ける欄（本文・解説・基本事項）の、いまの文字と書き戻し方。
   * 3か所で同じ処理をするため、欄の違いはここだけに閉じ込める。
   */
  const fieldText = (field) => {
    if (field === FIELDS.EXPLANATION) return question?.explanation ?? ''
    if (field === FIELDS.KEY_POINTS) return keyPointsText
    return text
  }
  const fieldPatch = (field, value) => {
    if (field === FIELDS.EXPLANATION) return { explanation: value }
    if (field === FIELDS.KEY_POINTS) return { keyPoints: value.split(NEWLINE) }
    return { segments: segmentsFromText(value) }
  }

  /** 表を1つ足し、その欄のカーソル位置（無ければ末尾）に目印を入れる。 */
  const addTable = (field, caret = null) => {
    if (!question) return
    const nextTables = [...tables, emptyTable()]
    const token = tableToken(nextTables.length)
    const source = fieldText(field)
    const at = caret == null ? source.length : caret
    const nextText = source.slice(0, at) + token + source.slice(at)
    onUpdate(question.id, { tables: nextTables, ...fieldPatch(field, nextText) })
  }

  /** 表の中身を差し替える。 */
  const updateTable = useCallback(
    (index, next) => {
      if (!question) return
      onUpdate(question.id, { tables: tables.map((t, i) => (i === index ? next : t)) })
    },
    [question, tables, onUpdate],
  )

  /**
   * 表を消す。本文の目印も消し、後ろの表の番号を繰り上げる。
   * 番号がずれたまま残ると、別の表が表示されてしまう。
   */
  const removeTable = useCallback(
    (index) => {
      if (!question) return
      const nextTables = tables.filter((_, i) => i !== index)
      // 目印は本文・解説・基本事項のどこにでも置けるので、3か所とも振り直す
      const renumber = (source) =>
        String(source ?? '').replace(TABLE_TOKEN, (whole, num) => {
          const n = Number(num) - 1
          if (n === index) return ''
          return n > index ? tableToken(n) : whole
        })
      onUpdate(question.id, {
        tables: nextTables,
        segments: segmentsFromText(renumber(text)),
        explanation: renumber(question.explanation),
        keyPoints: (question.keyPoints ?? []).map(renumber),
      })
    },
    [question, tables, text, onUpdate],
  )

  /** どこにも置かれていない表の目印を、本文の末尾に入れ直す。 */
  const placeTable = useCallback(
    (index) => {
      if (!question) return
      const nextText = `${text}${tableToken(index + 1)}`
      onUpdate(question.id, { segments: segmentsFromText(nextText) })
    },
    [question, text, onUpdate],
  )

  const setText = useCallback(
    (nextText) => {
      if (!question) return
      onUpdate(question.id, { segments: segmentsFromText(nextText) })
    },
    [question, onUpdate],
  )

  const setChoice = (index, value) => {
    const choices = [...question.choices]
    choices[index] = value
    onUpdate(question.id, { choices })
  }

  /**
   * 選択肢の欄に**複数行**を貼り付けたとき、1行ずつ別々の選択肢にする。
   *
   * 入力欄は1行のため、そのまま貼ると改行が潰れて1つの選択肢になってしまう
   * （利用者の報告・2026-08-26）。貼った欄から順に入れ、足りなければ足す。
   * 上限の5つを超えた行は入れられないので、そのことをその場に出す。
   *
   * @returns {boolean} 行に分けたか（true なら既定の貼り付けは行わない）
   */
  const pasteChoices = (index, raw) => {
    const lines = String(raw ?? '')
      .split(CARRIAGE)
      .join('')
      .split(NEWLINE)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length < 2) return false

    const choices = [...question.choices]
    let dropped = 0
    lines.forEach((line, i) => {
      const at = index + i
      if (at < choices.length) choices[at] = line
      else if (choices.length < 5) choices.push(line)
      else dropped += 1
    })
    onUpdate(question.id, { choices })
    setChoicePasteNote(
      dropped ? `選択肢は5つまでのため、余った${dropped}行は入れていません` : '',
    )
    return true
  }

  const toggleCorrect = (index) => {
    const set = new Set(question.correctIndexes)
    if (set.has(index)) set.delete(index)
    else set.add(index)
    onUpdate(question.id, { correctIndexes: [...set].sort((a, b) => a - b) })
  }

  const addChoice = () => {
    if (question.choices.length >= 5) return
    onUpdate(question.id, { choices: [...question.choices, ''] })
  }

  const removeChoice = (index) => {
    if (question.choices.length <= 2) return
    const choices = question.choices.filter((_, i) => i !== index)
    const correctIndexes = question.correctIndexes
      .filter((i) => i !== index)
      .map((i) => (i > index ? i - 1 : i))
    onUpdate(question.id, { choices, correctIndexes })
  }

  const moveChoice = (from, to) => {
    if (from === to) return
    const choices = [...question.choices]
    const [item] = choices.splice(from, 1)
    choices.splice(to, 0, item)
    const correctIndexes = question.correctIndexes
      .map((i) => {
        if (i === from) return to
        if (from < i && i <= to) return i - 1
        if (to <= i && i < from) return i + 1
        return i
      })
      .sort((a, b) => a - b)
    onUpdate(question.id, { choices, correctIndexes })
  }

  const groupScoped = activeGroupId
    ? questions.filter((q) => q.groupId === activeGroupId)
    : questions
  const choiceCount = groupScoped.filter((q) => !isCloze(q)).length
  const clozeCount = groupScoped.filter(isCloze).length
  const sidebarItems =
    poolFilter === 'all' ? groupScoped : groupScoped.filter((q) => q.type === poolFilter)

  // 絞り込みや表示グループが変わると位置がずれるので、範囲選択の起点は捨てる
  useEffect(() => {
    checkAnchorRef.current = null
  }, [poolFilter, activeGroupId])

  /**
   * 一覧のチェックを切り替える。**Shift を押しながら**なら、前に触った行から
   * ここまでをまとめて同じ状態にする（利用者の要望・2026-08-26）。
   *
   * @param {string} id 問題の id
   * @param {number} index いま表示している一覧での位置
   * @param {boolean} shiftKey Shift を押していたか
   */
  const toggleChecked = (id, index, shiftKey) => {
    // 起点は**この場で**読む。更新関数の中で読むと、その頃には下の行で
    // 書き換えたあと（＝いま押した行）になっていて、範囲が消える
    const anchor = checkAnchorRef.current
    checkAnchorRef.current = index
    setCheckedIds((prev) => {
      const checking = !prev.includes(id)
      if (shiftKey && anchor != null && anchor !== index) {
        const from = Math.min(anchor, index)
        const to = Math.max(anchor, index)
        const set = new Set(prev)
        for (const q of sidebarItems.slice(from, to + 1)) {
          if (checking) set.add(q.id)
          else set.delete(q.id)
        }
        return [...set]
      }
      return checking ? [...prev, id] : prev.filter((x) => x !== id)
    })
  }

  /**
   * 削除したあとに選ぶ問題を決める。
   *
   * null にすると入口の画面に戻ってしまい、作りかけの流れが切れる。
   * 消した位置の次（無ければ前）に移り、作成画面のまま続けられるようにする。
   * 消す対象しか残っていないときだけ null（表示するものが無い）。
   *
   * @param {string[]} removingIds 消す問題の id
   * @returns {string|null} 次に選ぶ問題の id
   */
  const nextSelectionAfterRemoving = (removingIds) => {
    const gone = new Set(removingIds)
    const index = sidebarItems.findIndex((q) => q.id === selectedId)
    const rest = sidebarItems.filter((q) => !gone.has(q.id))
    if (!rest.length) return null
    if (index === -1) return selectedId
    // 消した位置から後ろに残っているもの → 無ければ前に残っているもの
    const after = sidebarItems.slice(index + 1).find((q) => !gone.has(q.id))
    if (after) return after.id
    const before = sidebarItems.slice(0, index).filter((q) => !gone.has(q.id)).pop()
    return before ? before.id : null
  }

  // ---------- グループが1つも無いとき（作成はグループが先） ----------
  if (!groups.length) {
    return (
      <div
        style={{
          gridColumn: '1 / -1',
          minWidth: 0,
          ...card(space.card),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          padding: '56px 32px',
          textAlign: 'center',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '999px', background: COLORS.blueLight, color: COLORS.blue, fontSize: '26px' }}>
          🗂
        </span>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
          まずグループをつくる
        </p>
        <p style={{ margin: 0, fontSize: '14px', color: COLORS.sub, lineHeight: 1.8 }}>
          問題はかならずグループに入ります。教科書の単元や範囲など、
          <br />
          まとまりの名前でグループを作ってください。
        </p>
        <button
          type="button"
          onClick={() => setCreatingGroup(true)}
          style={{ ...input, width: 'auto', padding: '0 22px', border: `1px solid ${COLORS.blue}`, background: COLORS.blue, color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
        >
          ＋ グループを作成
        </button>
        <button
          type="button"
          onClick={onImportClick}
          style={{ border: 'none', background: 'transparent', color: COLORS.sub, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
        >
          または問題を読み込む（1ファイル＝1グループ）
        </button>
      </div>
    )
  }

  // ---------- まだ問題を選んでいない／1問もないとき ----------
  // 「最初の1問」から始めるのではなく、まずグループを決めてもらう
  const startPane = (
    <StartPane
      groups={groups}
      onCreateGroup={onCreateGroup}
      onAdd={onAdd}
      onImportClick={onImportClick}
      transferSlot={transferSlot}
      showTransfer={!question}
      compact={compact}
      pad={space.card}
    />
  )

  // 「変更を破棄」で戻す先が、まだ何も書かれていない問題か
  // （作った直後に破棄したのに空の問題が残ると、一覧に不備つきの行が増えてしまう）
  const snapshotIsBlank = (snap) => {
    if (!snap) return false
    if (isCloze(snap)) {
      return !(snap.paras ?? [])
        .flat()
        .map((r) => r.text ?? '')
        .join('')
        .trim()
    }
    return (
      !segmentsToText(snap.segments ?? []).trim() &&
      !(snap.choices ?? []).some((c) => (c ?? '').trim())
    )
  }

  const discardEdit = () => {
    const snap = snapshotRef.current
    setDiscarding(false)
    setDirty(false)
    setTouched({})
    if (!snap) return
    if (snapshotIsBlank(snap)) {
      // 作った直後に破棄したときは、空の問題ごと取り消す
      onRemove(snap.id)
      onSelect(null)
      return
    }
    onUpdateProp(snap.id, snap)
  }

  const dialogs = (
    <>
      {dirty && question && (
        <div
          style={{
            position: 'fixed',
            right: '24px',
            bottom: `calc(24px + env(safe-area-inset-bottom, 0px))`,
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
          }}
        >
          {/* 保存は自動なので、不備があるときは黙って残さずその場で伝える */}
          {errors.length > 0 && (
            <div
              role="alert"
              style={{
                alignSelf: 'center',
                maxWidth: 'min(320px, 60vw)',
                padding: '10px 14px',
                borderRadius: '12px',
                background: COLORS.redLight,
                border: `1px solid ${COLORS.red}`,
                color: COLORS.redDark,
                fontSize: '12.5px',
                fontWeight: 700,
                lineHeight: 1.7,
                boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
              }}
            >
              未完成：{errors.join(' / ')}
            </div>
          )}

          <button
            type="button"
            onClick={() => setDiscarding(true)}
            style={{
              minHeight: `${TAP_MIN}px`,
              padding: '0 20px',
              borderRadius: '999px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.body,
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
            }}
          >
            変更を破棄
          </button>

        </div>
      )}
      {discarding && (
        <ConfirmDialog
          title="変更を破棄しますか？"
          message={
            snapshotIsBlank(snapshotRef.current)
              ? 'この問題は作ったばかりで中身がまだありません。破棄すると、この問題ごと取り消します。'
              : '編集を始めたときの内容に戻します。元に戻せません。'
          }
          confirmLabel="破棄する"
          onCancel={() => setDiscarding(false)}
          onConfirm={discardEdit}
        />
      )}
      {deleting && question && (
        <ConfirmDialog
          title="この問題を削除しますか？"
          message="元に戻せません。"
          confirmLabel="削除する"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            const next = nextSelectionAfterRemoving([question.id])
            onRemove(question.id)
            onSelect(next)
            setDeleting(false)
          }}
        />
      )}
      {movingTo && (
        <MoveGroupDialog
          count={checkedIds.length}
          groups={groups}
          onCancel={() => setMovingTo(false)}
          onConfirm={(groupId) => {
            onMoveToGroup(checkedIds, groupId)
            setCheckedIds([])
            setMovingTo(false)
          }}
        />
      )}
      {deletingChecked && (
        <ConfirmDialog
          title={`選択した${checkedIds.length}問を削除しますか？`}
          message="元に戻せません。"
          confirmLabel="削除する"
          onCancel={() => setDeletingChecked(false)}
          onConfirm={() => {
            const next = checkedIds.includes(selectedId)
              ? nextSelectionAfterRemoving(checkedIds)
              : selectedId
            checkedIds.forEach((id) => onRemove(id))
            onSelect(next)
            setCheckedIds([])
            setDeletingChecked(false)
          }}
        />
      )}
      {creatingGroup && (
        <PromptDialog
          title="グループを作成"
          label="グループ名"
          placeholder="例：循環器"
          confirmLabel="作成する"
          onCancel={() => setCreatingGroup(false)}
          onConfirm={(name) => {
            onCreateGroup(name)
            setCreatingGroup(false)
          }}
        />
      )}
    </>
  )

  // スマホでは作成の入力欄が実用にならないため、案内だけを出す
  if (phone && !forcePhoneEdit) {
    return (
      <PhoneNotice
        pad={space.card}
        onGoQuiz={onGoQuiz}
        onForce={() => setForcePhoneEdit(true)}
      />
    )
  }

  // 問題を選んでいないあいだは入口の画面だけを出す。
  // 左カラム（作成した問題の一覧）を重ねると、入口の説明が隠れてしまうため。
  if (!question) {
    return (
      <>
        {startPane}
        {dialogs}
      </>
    )
  }

  const sidebar = (
    <div style={{ ...card(16), display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
      {/* 入口の画面ではグループを中央で選ばせるので、ここには出さない */}
      {question && (
        <div>
          <div style={label}>追加先のグループ</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <select
              value={activeGroupId ?? ''}
              onChange={(e) => onChangeActiveGroup(e.target.value)}
              style={{ ...input, flex: 1, minWidth: 0, cursor: 'pointer' }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCreatingGroup(true)}
              style={{
                ...input,
                width: 'auto',
                padding: '0 12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                color: COLORS.blue,
                border: `1px solid ${COLORS.blue}`,
                background: COLORS.blueLight,
              }}
            >
              ＋ 新規
            </button>
          </div>
        </div>
      )}

      {/*
        グループを増やす「＋ 新規」と、問題を増やすボタンが右端に縦に並んでいて押し間違えやすかった。
        役割が違うので線で区切り、問題の追加は幅いっぱいの主ボタンにして見分けられるようにする。
      */}
      <span style={{ height: '1px', background: COLORS.cardBorder }} />

      <button
        type="button"
        onClick={() => {
          onAdd(activeGroupId)
          setDrawerOpen(false)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          minHeight: `${TAP_MIN}px`,
          borderRadius: '12px',
          border: 'none',
          background: COLORS.blue,
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        ＋ 問題を追加
      </button>

      {/*
        件数はこのグループの中だけを数える。下の [選択式 n][虫食い n] と同じ範囲にしないと、
        「48問」なのに一覧には10問しか出ない、という食い違いが起きる（2026-08-26 報告）。
      */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>作成した問題</span>
        <span style={{ fontSize: '12px', color: COLORS.sub }}>{groupScoped.length}問</span>
        {activeGroupId && (
          <span style={{ fontSize: '11.5px', color: COLORS.muted }}>
            （{groups.find((g) => g.id === activeGroupId)?.name ?? ''}）
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '2px',
          padding: '3px',
          borderRadius: '999px',
          background: COLORS.chipTrack,
          // 縮ませない。縮むと下の一覧に重なって文字が切れる
          flex: '0 0 auto',
        }}
      >
        {[
          { key: 'all', text: 'すべて' },
          { key: QUESTION_TYPES.CHOICE, text: `選択式 ${choiceCount}` },
          { key: QUESTION_TYPES.CLOZE, text: `虫食い ${clozeCount}` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPoolFilter(t.key)}
            style={{
              flex: 1,
              minHeight: '34px',
              borderRadius: '999px',
              border: 'none',
              background: poolFilter === t.key ? COLORS.blue : 'transparent',
              color: poolFilter === t.key ? '#ffffff' : COLORS.sub,
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {t.text}
          </button>
        ))}
      </div>

      {/*
        一覧はこの中だけでスクロールさせる。上の帯（チップ）と重ならないよう、
        自分の領域を持たせる（flex の縮みで押し潰されると、文字が帯の下に隠れる）
      */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '420px',
          overflowY: 'auto',
          minHeight: 0,
          flex: '1 1 auto',
          paddingTop: '2px',
        }}
      >
        {sidebarItems.map((q, i) => {
          const invalid = validateQuestion(q).length > 0
          const head = isCloze(q)
            ? clozeHeadline(q)
            : segmentsToText(q.segments) || '（無題の問題）'
          const active = q.id === selectedId
          return (
            <Sortable
              key={q.id}
              index={i}
              onMove={(from, to) => poolFilter === ORIGIN.AUTHORED && onReorderAuthored(from, to)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '52px',
                padding: '8px 10px',
                borderRadius: '12px',
                background: active ? COLORS.blueLight : 'transparent',
                cursor: 'pointer',
              }}
            >
              {(handleProps) => (
                <>
              <input
                type="checkbox"
                checked={checkedIds.includes(q.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => toggleChecked(q.id, i, e.nativeEvent?.shiftKey === true)}
                aria-label={`${head} を選択`}
                style={{ width: '17px', height: '17px', accentColor: COLORS.blue, cursor: 'pointer', flexShrink: 0 }}
              />
                <span style={handleStyle} aria-hidden="true" {...handleProps}>⠿</span>
              <span
                style={{
                  minWidth: '20px',
                  flexShrink: 0,
                  textAlign: 'right',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: active ? COLORS.blue : COLORS.muted,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {q.questionNumber}
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelect(q.id)
                  setDrawerOpen(false)
                }}
                style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              >
                <div style={{ fontSize: '13px', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {head}
                </div>
                <div style={{ fontSize: '11.5px', color: COLORS.muted }}>
                  {groups.find((g) => g.id === q.groupId)?.name ?? '未分類'} ·{' '}
                  {isCloze(q) ? `${hiddenCount(q.paras)}か所` : `${q.choices.length}択`}
                </div>
              </button>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: isCloze(q) ? COLORS.blueLight : COLORS.chipTrack,
                  color: isCloze(q) ? COLORS.blue : COLORS.body,
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {TYPE_LABELS[q.type]}
              </span>
              {invalid && (
                <span title="入力に不備があります" style={{ color: COLORS.red, fontWeight: 700, fontSize: '13px' }}>!</span>
              )}
              </>
            )}
            </Sortable>
          )
        })}
      </div>

      {/*
        まとめて選んだときの操作。
        左カラムの中に置くと、すぐ下にある「複製 / 削除」（いま開いている1問への操作）と
        紛らわしく、押し間違える。画面下に白い帯として出し、別物だと分かるようにする。
      */}
      {checkedIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: `calc(24px + env(safe-area-inset-bottom, 0px))`,
            transform: 'translateX(-50%)',
            zIndex: 52,
            maxWidth: 'calc(100vw - 32px)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            boxShadow: '0 8px 24px rgba(15,23,42,0.16)',
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap' }}>
            {checkedIds.length}問を選択中
          </span>
          <span style={{ width: '1px', height: '20px', background: COLORS.border, flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setMovingTo(true)}
              disabled={groups.length < 2}
              style={{
                minHeight: '36px',
                padding: '0 14px',
                whiteSpace: 'nowrap',
                borderRadius: '10px',
                border: `1px solid ${groups.length < 2 ? COLORS.border : COLORS.blue}`,
                background: COLORS.card,
                color: groups.length < 2 ? COLORS.dashed : COLORS.blue,
                fontSize: '12.5px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: groups.length < 2 ? 'default' : 'pointer',
              }}
            >
              → 移動
            </button>
            <button
              type="button"
              onClick={() => setDeletingChecked(true)}
              style={{
                minHeight: '36px',
                padding: '0 14px',
                whiteSpace: 'nowrap',
                borderRadius: '10px',
                border: `1px solid ${COLORS.border}`,
                background: COLORS.card,
                color: COLORS.red,
                fontSize: '12.5px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              🗑 削除
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCheckedIds([])}
            style={{
              border: 'none',
              background: 'transparent',
              color: COLORS.sub,
              fontSize: '12px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            選択を解除
          </button>
        </div>
      )}

      {question && (
        <div style={{ display: 'flex', gap: '8px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '10px' }}>
          <button
            type="button"
            onClick={() => onSelect(onDuplicate(question.id))}
            style={{ flex: 1, minHeight: '36px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.body, fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            複製
          </button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            style={{ flex: 1, minHeight: '36px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.red, fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            削除
          </button>
        </div>
      )}

      {/* 書き出す／読み込む。上部バーではなく作成画面の左カラム（複製・削除の下）に置く */}
      {transferSlot && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '12px' }}>
          {transferSlot}
        </div>
      )}
    </div>
  )

  // 前後の問題へ移る帯。選択式は基本事項の下、虫食いは専用エディタの下に置く
  const navNode = (
    <QuestionNav items={sidebarItems} currentId={selectedId} onSelect={onSelect} />
  )

  // 虫食いは専用エディタ（本文・隠す・文字色）に差し替える
  const clozePanes =
    question && isCloze(question)
      ? {
          editor: (
            // 3ペインでは grid の1マスなので、帯と一緒に1つの箱に入れる
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
              <ClozeEditor
                question={question}
                onUpdate={onUpdate}
                groupName={groups.find((g) => g.id === question.groupId)?.name ?? ''}
                total={questions.length}
                pane="editor"
              />
              <div style={card(16)}>
                <QuestionNav
                  items={sidebarItems}
                  currentId={selectedId}
                  onSelect={onSelect}
                  divider={false}
                />
              </div>
            </div>
          ),
          preview: (
            <ClozeEditor
              question={question}
              onUpdate={onUpdate}
              groupName={groups.find((g) => g.id === question.groupId)?.name ?? ''}
              total={questions.length}
              pane="preview"
            />
          ),
        }
      : null

  const editor = question && !isCloze(question) ? (
    <div style={{ ...card(space.card), display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text }}>問題を編集</span>
        <span style={pill(COLORS.chipTrack, COLORS.body)}>問題番号 {question.questionNumber}（自動）</span>
      </div>



      <div onBlur={() => setTouched((t) => ({ ...t, text: true }))}>
        <QuestionTextField
          text={text}
          onChange={setText}
          invalid={textInvalid}
          onInsertTable={(caret) => addTable(FIELDS.BODY, caret)}
          canAddTable={tables.length < 9}
        />
      </div>

      {(tables.length > 0 || false) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={label}>表</div>
          {tables.map((table, i) => (
            <TableEditor
              key={i}
              table={table}
              label={`表${i + 1}`}
              placed={placedTables.has(i + 1)}
              onChange={(next) => updateTable(i, next)}
              onRemove={() => removeTable(i)}
              onInsertToken={() => placeTable(i)}
            />
          ))}
        </div>
      )}

      <div>
        <div style={label}>画像URL（任意）</div>
        <input
          value={question.imageUrl ?? ''}
          onChange={(e) => onUpdate(question.id, { imageUrl: e.target.value })}
          placeholder="https://example.com/ecg-v4.png"
          data-shortcut-ignore="true"
          style={{
            ...input,
            marginTop: '6px',
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: '13px',
            border: `1px solid ${imageState === 'error' ? COLORS.red : COLORS.border}`,
          }}
        />
        {imageState === 'error' && errorText('画像を読み込めません。URLを確認してください')}
        {question.imageUrl && imageState === 'ok' && isSafeImageUrl(question.imageUrl) && (
          <img
            src={question.imageUrl}
            alt=""
            style={{ marginTop: '8px', width: '64px', height: '44px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}
          />
        )}
      </div>

      <div onBlur={() => setTouched((t) => ({ ...t, choices: true }))}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={label}>選択肢</span>
          <span style={{ fontSize: '11.5px', color: COLORS.muted }}>
            2〜5個 / 「正解」を1つ以上 ・ 複数行を貼り付けると1行ずつ入ります
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {question.choices.map((choice, i) => {
            const isCorrect = question.correctIndexes.includes(i)
            return (
              <Sortable
                key={i}
                index={i}
                onMove={moveChoice}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minHeight: '48px',
                  padding: '8px 10px',
                  borderRadius: '14px',
                  border: `1px solid ${isCorrect ? COLORS.green : COLORS.border}`,
                  background: isCorrect ? COLORS.greenLight : COLORS.card,
                }}
              >
                {(handleProps) => (
                  <>
                  <span style={handleStyle} aria-hidden="true" {...handleProps}>⠿</span>
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
                  {LETTERS[i]}
                </span>
                <input
                  value={choice}
                  onChange={(e) => setChoice(i, e.target.value)}
                  onPaste={(e) => {
                    const raw = e.clipboardData?.getData('text') ?? ''
                    if (pasteChoices(i, raw)) e.preventDefault()
                  }}
                  placeholder={`選択肢${LETTERS[i]}`}
                  data-shortcut-ignore="true"
                  style={{ ...input, minHeight: '36px', flex: 1, border: 'none', background: 'transparent' }}
                />
                <button
                  type="button"
                  onClick={() => toggleCorrect(i)}
                  style={{
                    minHeight: '34px',
                    padding: '0 12px',
                    borderRadius: '999px',
                    border: `1px solid ${isCorrect ? COLORS.green : COLORS.border}`,
                    background: isCorrect ? COLORS.green : COLORS.card,
                    color: isCorrect ? '#ffffff' : COLORS.sub,
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isCorrect ? '✓ 正解' : '正解にする'}
                </button>
                <button
                  type="button"
                  onClick={() => removeChoice(i)}
                  disabled={question.choices.length <= 2}
                  aria-label={`選択肢${LETTERS[i]}を削除`}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', color: question.choices.length <= 2 ? COLORS.dashed : COLORS.sub, fontFamily: 'inherit', cursor: question.choices.length <= 2 ? 'default' : 'pointer' }}
                >
                  ✕
                </button>
                </>
              )}
              </Sortable>
            )
          })}
        </div>

        {question.choices.length < 5 && (
          <button
            type="button"
            onClick={addChoice}
            style={{ marginTop: '8px', width: '100%', minHeight: '44px', borderRadius: '14px', border: `1px dashed ${COLORS.dashed}`, background: 'transparent', color: COLORS.sub, fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            ＋ 選択肢を追加
          </button>
        )}

        {question.correctIndexes.length >= 2 && (
          <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '10px', background: COLORS.blueLight, color: COLORS.blue, fontSize: '12.5px', fontWeight: 700 }}>
            正解が{question.correctIndexes.length}つ →「2つ選べ」として出題されます
          </div>
        )}

        {choicePasteNote && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: COLORS.amberDark }}>
            {choicePasteNote}
          </div>
        )}

        {choiceInvalid && errorText('選択肢は2つ以上、正解は1つ以上必要です')}
      </div>

      <LongTextField
        title="解説"
        value={question.explanation}
        onChange={(value) => onUpdate(question.id, { explanation: value })}
        onInsertTable={(caret) => addTable(FIELDS.EXPLANATION, caret)}
        canAddTable={tables.length < 9}
      />

      {/*
        箇条書きと並べ替えは 2026-08-26 に廃止した（利用者の指示）。
        保存の形（1項目＝1行の配列）は変えていない。Excel の「基本事項」列は
        これまでどおり改行区切りで往復する。
      */}
      <LongTextField
        title="基本事項"
        hint="解説と同じように、そのまま書けます（改行して並べても構いません）"
        value={keyPointsText}
        onChange={(value) => onUpdate(question.id, { keyPoints: value.split(NEWLINE) })}
        onInsertTable={(caret) => addTable(FIELDS.KEY_POINTS, caret)}
        canAddTable={tables.length < 9}
      />

      {errors.length > 0 && (
        <div style={{ fontSize: '12px', color: COLORS.muted }}>
          未入力の項目：{errors.join(' / ')}
        </div>
      )}

      {navNode}
    </div>
  ) : (
    // 問題を選んでいないときは、入口と同じ「グループを決める」画面を出す
    startPane
  )

  const previewPane = question && !isCloze(question) ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>演習画面プレビュー</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '2px', padding: '3px', borderRadius: '999px', background: COLORS.chipTrack }}>
          {[
            { key: 'before', text: '解答前' },
            { key: 'after', text: '解答後' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setPreviewMode(t.key)}
              style={{
                minHeight: '34px',
                padding: '0 14px',
                borderRadius: '999px',
                border: 'none',
                background: previewMode === t.key ? COLORS.blue : 'transparent',
                color: previewMode === t.key ? '#ffffff' : COLORS.sub,
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
      <Preview
        question={question}
        groupName={groups.find((g) => g.id === question.groupId)?.name ?? ''}
        mode={previewMode}
        position={question.questionNumber}
        total={questions.length}
        pad={space.card}
      />
    </div>
  ) : null

  // ---------- タブレット（縦・横とも同じ切り替え式） ----------
  if (compact || previewTight) {
    return (
      <div style={{ gridColumn: '1 / -1', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {dialogs}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            style={{ ...input, width: 'auto', padding: '0 16px', fontWeight: 700, cursor: 'pointer', color: COLORS.body }}
          >
            ☰ 問題一覧（{authored.length}）
          </button>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '2px', padding: '3px', borderRadius: '999px', background: COLORS.chipTrack }}>
            {[
              { key: 'edit', text: '編集' },
              { key: 'preview', text: 'プレビュー' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTabletPane(t.key)}
                style={{
                  minHeight: '34px',
                  padding: '0 16px',
                  borderRadius: '999px',
                  border: 'none',
                  background: tabletPane === t.key ? COLORS.blue : 'transparent',
                  color: tabletPane === t.key ? '#ffffff' : COLORS.sub,
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

        {tabletPane === 'edit'
          ? (clozePanes ? clozePanes.editor : editor)
          : (clozePanes ? clozePanes.preview : previewPane)}

        {drawerOpen && (
          <>
            <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 45 }} />
            <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 'min(360px, 90vw)', zIndex: 46, background: COLORS.card, borderRight: `1px solid ${COLORS.border}`, overflowY: 'auto', padding: '12px' }}>
              {sidebar}
            </div>
          </>
        )}
      </div>
    )
  }

  // ---------- デスクトップ 3ペイン ----------
  const editorPane = clozePanes ? clozePanes.editor : editor
  const previewNode = clozePanes ? clozePanes.preview : previewPane

  // 1280px 以上でのみ3ペインを出す。それ未満は上の切り替え式に回している。
  // プレビューは開いているときだけ場所を取り、閉じているときは開くための帯だけ残す。
  const canPreview = !!previewNode
  const columns = !canPreview
    ? '268px 528px minmax(0, 1fr)'
    : previewOpen
      ? '268px minmax(0, 528px) minmax(360px, 1fr)'
      : '268px minmax(528px, 1fr) 48px'

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: columns,
        gap: '20px',
        alignItems: 'start',
      }}
    >
      <div style={{ position: 'sticky', top: '24px' }}>{sidebar}</div>
      {editorPane}
      <div style={{ position: 'sticky', top: '24px' }}>
        {canPreview && !previewOpen ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            title="演習画面プレビューを開く"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              minHeight: '220px',
              padding: '16px 0',
              borderRadius: '14px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.blue,
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              writingMode: 'vertical-rl',
            }}
          >
            ‹ プレビュー
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {canPreview && (
              <div style={{ display: 'flex' }}>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  style={{
                    marginLeft: 'auto',
                    minHeight: '34px',
                    padding: '0 12px',
                    borderRadius: '999px',
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.card,
                    color: COLORS.sub,
                    fontSize: '12.5px',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  プレビューを畳む ›
                </button>
              </div>
            )}
            {previewNode}
          </div>
        )}
      </div>
      {dialogs}
    </div>
  )
}
