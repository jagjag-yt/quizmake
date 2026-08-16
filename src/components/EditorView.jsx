import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  buildSegmentsFromMarks,
  segmentsToMarks,
  segmentsToText,
} from '../data/questions'
import { clozeHeadline, hiddenCount } from '../data/cloze'
import { isCloze } from '../data/questions'
import { useCompactLayout } from '../hooks/useMediaQuery'
import ClozeEditor from './ClozeEditor'
import ConfirmDialog, { PromptDialog } from './ConfirmDialog'
import { validateQuestion } from '../hooks/useQuestionPool'
import { isSafeImageUrl } from '../utils/safe'

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
 * 文字列の編集にあわせて下線範囲をずらす。
 * 共通の前後を突き合わせ、変更された範囲の外にある下線は位置を保つ。
 */
function adjustMarks(oldText, newText, marks) {
  if (oldText === newText) return marks
  let prefix = 0
  const max = Math.min(oldText.length, newText.length)
  while (prefix < max && oldText[prefix] === newText[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < max - prefix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix += 1
  }
  const removedStart = prefix
  const removedEnd = oldText.length - suffix
  const inserted = newText.length - suffix - prefix
  const delta = inserted - (removedEnd - removedStart)

  const shift = (pos) => {
    if (pos <= removedStart) return pos
    if (pos >= removedEnd) return pos + delta
    return removedStart
  }
  return marks
    .map((m) => ({ start: shift(m.start), end: shift(m.end) }))
    .filter((m) => m.end > m.start)
}

/** ドラッグで並べ替えできる行のラッパー。 */
function Sortable({ index, onMove, children, style }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const from = Number(e.dataTransfer.getData('text/plain'))
        if (Number.isInteger(from)) onMove(from, index)
      }}
      style={style}
    >
      {children}
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

/** 問題文＋下線指定。選択範囲に対して下線を付け外しする。 */
function QuestionTextField({ text, marks, onChange, invalid }) {
  const ref = useRef(null)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const hasSelection = selection.end > selection.start

  const syncSelection = () => {
    const el = ref.current
    if (el) setSelection({ start: el.selectionStart, end: el.selectionEnd })
  }

  const applyUnderline = () => {
    if (!hasSelection) return
    onChange(text, [...marks, { start: selection.start, end: selection.end }])
  }

  const clearUnderline = () => {
    if (!hasSelection) return
    const next = []
    for (const m of marks) {
      if (m.end <= selection.start || m.start >= selection.end) {
        next.push(m)
        continue
      }
      if (m.start < selection.start) next.push({ start: m.start, end: selection.start })
      if (m.end > selection.end) next.push({ start: selection.end, end: m.end })
    }
    onChange(text, next)
  }

  const segments = buildSegmentsFromMarks(text, marks)
  const underlineCount = segments.filter((s) => s.u).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={label}>問題文</span>
        <span style={pill(COLORS.redLight, COLORS.red)}>必須</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={applyUnderline}
            disabled={!hasSelection}
            title="選択したテキストに下線をつけます"
            style={{
              minHeight: '36px',
              padding: '0 14px',
              borderRadius: '10px',
              border: `1px solid ${hasSelection ? COLORS.blue : COLORS.border}`,
              background: hasSelection ? COLORS.blue : COLORS.blueLight,
              color: hasSelection ? '#ffffff' : COLORS.bluePale,
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: hasSelection ? 'pointer' : 'default',
            }}
          >
            U 下線をつける
          </button>
          <button
            type="button"
            onClick={clearUnderline}
            disabled={!hasSelection}
            style={{
              minHeight: '36px',
              padding: '0 12px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.sub,
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: hasSelection ? 'pointer' : 'default',
              opacity: hasSelection ? 1 : 0.6,
            }}
          >
            解除
          </button>
        </span>
      </div>

      <textarea
        ref={ref}
        value={text}
        onChange={(e) => onChange(e.target.value, adjustMarks(text, e.target.value, marks))}
        onSelect={syncSelection}
        onKeyUp={syncSelection}
        onMouseUp={syncSelection}
        placeholder="問題文を入力"
        rows={5}
        data-shortcut-ignore="true"
        style={{
          ...input,
          resize: 'vertical',
          lineHeight: 1.9,
          border: `1px solid ${invalid ? COLORS.red : COLORS.border}`,
          background: invalid ? COLORS.redLight : COLORS.card,
        }}
      />
      {invalid && errorText('問題文を入力してください')}

      {/* 下線の反映結果 */}
      {text && (
        <div
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: COLORS.bg,
            border: `1px solid ${COLORS.cardBorder}`,
            fontSize: '14px',
            lineHeight: 1.9,
            color: COLORS.text,
          }}
        >
          {segments.map((seg, i) => (
            <span
              key={i}
              style={
                seg.u
                  ? {
                      background: COLORS.blueLight,
                      borderBottom: `2px solid ${COLORS.blue}`,
                      fontWeight: 700,
                    }
                  : undefined
              }
            >
              {seg.text}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
        <span style={pill(COLORS.chipTrack, COLORS.body)}>下線 {underlineCount} か所</span>
        <span style={{ fontSize: '11.5px', color: COLORS.muted, lineHeight: 1.6 }}>
          テキストを選択すると「下線をつける」が有効になります。書き出し時は下線部が「下線キーワード」列になります。
        </span>
      </div>
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

        <p style={{ margin: '0 0 20px 0', fontSize: '18px', lineHeight: 1.9, color: COLORS.text }}>
          {question.segments.map((seg, i) => (
            <span
              key={i}
              style={seg.u ? { borderBottom: `2px solid ${COLORS.blue}`, paddingBottom: '1px', fontWeight: 700 } : undefined}
            >
              {seg.text}
            </span>
          ))}
          {!segmentsToText(question.segments) && (
            <span style={{ color: COLORS.muted }}>ここに問題文が表示されます</span>
          )}
        </p>

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
              <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.9, color: COLORS.body, whiteSpace: 'pre-wrap' }}>
                {question.explanation}
              </p>
            </div>
          )}
          {question.keyPoints.length > 0 && (
            <div>
              <h3 style={heading}>基本事項</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {question.keyPoints.map((kp, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '14px', background: COLORS.blueLight }}>
                    <span style={{ color: COLORS.blue, fontSize: '12px', lineHeight: 1.7 }}>●</span>
                    <span style={{ fontSize: '14px', lineHeight: 1.7, color: COLORS.body }}>{kp}</span>
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

/**
 * 問題作成の入口。
 *
 * 問題は必ずどれかのグループの中に入るため、いきなり1問目を作らせるのではなく
 * 「新しいグループを作る」か「既存のグループに追加する」かを先に選んでもらう。
 * どちらを選んでも、続けて「新しい問題」ダイアログ（問題タイプの選択）へ進む。
 */
function StartPane({
  groups,
  activeGroupId,
  onCreateGroup,
  onChangeActiveGroup,
  onAdd,
  onImportClick,
  transferSlot,
  showTransfer,
  compact,
  pad,
}) {
  const [name, setName] = useState('')
  const [pick, setPick] = useState(activeGroupId ?? groups[0]?.id ?? '')

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
              ? 'すでにあるグループを選んで、問題を追加します。'
              : 'まだグループがありません。左の「新しいグループを作成」から始めてください。'}
          </span>
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={!hasGroups}
            aria-label="追加先のグループ"
            style={{ ...input, marginTop: 'auto', cursor: hasGroups ? 'pointer' : 'default' }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!hasGroups}
            onClick={() => {
              onChangeActiveGroup(pick)
              onAdd()
            }}
            style={actionButton(hasGroups)}
          >
            このグループに問題を追加
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
  onImportClick,
  onSaved,
  transferSlot,
  groups,
  activeGroupId,
  onChangeActiveGroup,
  onCreateGroup,
}) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const [poolFilter, setPoolFilter] = useState('all')
  const [previewMode, setPreviewMode] = useState('before')
  const [tabletPane, setTabletPane] = useState('edit')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [touched, setTouched] = useState({})
  const [imageState, setImageState] = useState('idle')
  // 確認・名前入力はアプリ内のダイアログで行う（window.confirm/prompt は環境により出ない）
  const [deleting, setDeleting] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  // 何か直したら「保存」を出す（保存自体は自動だが、区切りを自分で決められるようにする）
  const [dirty, setDirty] = useState(false)

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

  // 別の問題に移ったら「変更あり」を持ち越さない
  useEffect(() => {
    setDirty(false)
  }, [selectedId])

  const text = question && !isCloze(question) ? segmentsToText(question.segments) : ''
  const marks = useMemo(
    () => (question && !isCloze(question) ? segmentsToMarks(question.segments) : []),
    [question],
  )
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

  const setText = useCallback(
    (nextText, nextMarks) => {
      if (!question) return
      onUpdate(question.id, { segments: buildSegmentsFromMarks(nextText, nextMarks) })
    },
    [question, onUpdate],
  )

  const setChoice = (index, value) => {
    const choices = [...question.choices]
    choices[index] = value
    onUpdate(question.id, { choices })
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

  const setKeyPoint = (index, value) => {
    const keyPoints = [...question.keyPoints]
    keyPoints[index] = value
    onUpdate(question.id, { keyPoints })
  }

  const moveKeyPoint = (from, to) => {
    if (from === to) return
    const keyPoints = [...question.keyPoints]
    const [item] = keyPoints.splice(from, 1)
    keyPoints.splice(to, 0, item)
    onUpdate(question.id, { keyPoints })
  }

  const groupScoped = activeGroupId
    ? questions.filter((q) => q.groupId === activeGroupId)
    : questions
  const choiceCount = groupScoped.filter((q) => !isCloze(q)).length
  const clozeCount = groupScoped.filter(isCloze).length
  const sidebarItems =
    poolFilter === 'all' ? groupScoped : groupScoped.filter((q) => q.type === poolFilter)

  // ---------- グループが1つも無いとき（作成はグループが先） ----------
  if (!groups.length) {
    return (
      <div
        style={{
          gridColumn: '1 / -1',
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
      activeGroupId={activeGroupId}
      onCreateGroup={onCreateGroup}
      onChangeActiveGroup={onChangeActiveGroup}
      onAdd={onAdd}
      onImportClick={onImportClick}
      transferSlot={transferSlot}
      showTransfer={!authored.length && !question}
      compact={compact}
      pad={space.card}
    />
  )

  const dialogs = (
    <>
      {dirty && question && (
        <button
          type="button"
          onClick={() => {
            setDirty(false)
            onSaved?.(question.groupId)
          }}
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            zIndex: 50,
            minHeight: `${TAP_MIN}px`,
            padding: '0 24px',
            borderRadius: '999px',
            border: `1px solid ${COLORS.blue}`,
            background: COLORS.blue,
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(37,99,235,0.32)',
          }}
        >
          保存
        </button>
      )}
      {deleting && question && (
        <ConfirmDialog
          title="この問題を削除しますか？"
          message="元に戻せません。"
          confirmLabel="削除する"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            onRemove(question.id)
            onSelect(null)
            setDeleting(false)
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

  if (!authored.length && !question) {
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>作成した問題</span>
        <span style={{ fontSize: '12px', color: COLORS.sub }}>{authored.length}問</span>
        <button
          type="button"
          onClick={() => {
            const id = onAdd(activeGroupId)
            if (!id) return
            onSelect(id)
            setPoolFilter(ORIGIN.AUTHORED)
            setDrawerOpen(false)
          }}
          aria-label="問題を追加"
          style={{ marginLeft: 'auto', width: '36px', height: '36px', borderRadius: '12px', border: 'none', background: COLORS.blue, color: '#ffffff', fontSize: '16px', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          ＋
        </button>
      </div>

      <div style={{ display: 'inline-flex', gap: '2px', padding: '3px', borderRadius: '999px', background: COLORS.chipTrack }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px', overflowY: 'auto' }}>
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
              <span style={handleStyle} aria-hidden="true">⠿</span>
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
            </Sortable>
          )
        })}
      </div>

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

  // 虫食いは専用エディタ（本文・隠す・文字色）に差し替える
  const clozePanes =
    question && isCloze(question)
      ? {
          editor: (
            <ClozeEditor
              question={question}
              onUpdate={onUpdate}
              groupName={groups.find((g) => g.id === question.groupId)?.name ?? ''}
              total={questions.length}
              pane="editor"
            />
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
        <QuestionTextField text={text} marks={marks} onChange={setText} invalid={textInvalid} />
      </div>

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
          <span style={{ fontSize: '11.5px', color: COLORS.muted }}>2〜5個 / 「正解」を1つ以上</span>
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
                <span style={handleStyle} aria-hidden="true">⠿</span>
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

        {choiceInvalid && errorText('選択肢は2つ以上、正解は1つ以上必要です')}
      </div>

      <div>
        <div style={label}>解説</div>
        <textarea
          value={question.explanation}
          onChange={(e) => onUpdate(question.id, { explanation: e.target.value })}
          rows={4}
          data-shortcut-ignore="true"
          style={{ ...input, marginTop: '6px', resize: 'vertical', fontSize: '14.5px', lineHeight: 1.9 }}
        />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={label}>基本事項</span>
          <span style={{ fontSize: '11.5px', color: COLORS.muted }}>箇条書き・並べ替え可</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {question.keyPoints.map((kp, i) => (
            <Sortable
              key={i}
              index={i}
              onMove={moveKeyPoint}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '4px 10px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}
            >
              <span style={handleStyle} aria-hidden="true">⠿</span>
              <input
                value={kp}
                onChange={(e) => setKeyPoint(i, e.target.value)}
                data-shortcut-ignore="true"
                style={{ ...input, minHeight: '36px', flex: 1, border: 'none', background: 'transparent', fontSize: '14px' }}
              />
              <button
                type="button"
                onClick={() => onUpdate(question.id, { keyPoints: question.keyPoints.filter((_, j) => j !== i) })}
                aria-label="この項目を削除"
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', color: COLORS.sub, fontFamily: 'inherit', cursor: 'pointer' }}
              >
                ✕
              </button>
            </Sortable>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onUpdate(question.id, { keyPoints: [...question.keyPoints, ''] })}
          style={{ marginTop: '8px', width: '100%', minHeight: '44px', borderRadius: '14px', border: `1px dashed ${COLORS.dashed}`, background: 'transparent', color: COLORS.sub, fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          ＋ 項目を追加
        </button>
      </div>

      {errors.length > 0 && (
        <div style={{ fontSize: '12px', color: COLORS.muted }}>
          未入力の項目：{errors.join(' / ')}
        </div>
      )}
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

  // ---------- タブレット ----------
  if (compact) {
    return (
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'grid',
        gridTemplateColumns: '268px 528px minmax(0, 1fr)',
        gap: '20px',
        alignItems: 'start',
      }}
    >
      <div style={{ position: 'sticky', top: '24px' }}>{sidebar}</div>
      {editorPane}
      <div style={{ position: 'sticky', top: '24px' }}>{previewNode}</div>
      {dialogs}
    </div>
  )
}
