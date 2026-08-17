import { useState } from 'react'
import { COLORS, MODES, MODE_LABELS, QUESTION_TYPES, SPACING, TAP_MIN, TYPE_LABELS } from '../constants'
import { useCompactLayout } from '../hooks/useMediaQuery'

const selectStyle = {
  minHeight: `${TAP_MIN - 8}px`,
  padding: '8px 10px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.text,
  fontSize: '13px',
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
}

const labelStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: COLORS.sub,
}

/**
 * 出題条件のバー：モード・グループ絞り込み・出題数・本番モード。
 *
 * 既定では1行の要約に畳んである。条件を決め終えて「解く段階に入った」ことが
 * 見て分かるようにするためで、押すと開いて条件を変えられる。
 */
export default function StudyToolbar({
  total = 0,
  qtype,
  onChangeType,
  mode,
  onChangeMode,
  counts,
  groups,
  groupId,
  onChangeGroup,
  limit,
  onChangeLimit,
  examMode,
  onChangeExamMode,
  examMinutes,
  onChangeExamMinutes,
}) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const [open, setOpen] = useState(false)

  // 採点前提のモードは、種別が「虫食い」のときは選べない（SPEC D3）
  const gradedOnly = (key) => key !== MODES.ALL && key !== MODES.BOOKMARKED
  const clozeOnly = qtype === QUESTION_TYPES.CLOZE

  const modeButton = (key) => {
    const active = mode === key
    const count = counts[key] ?? 0
    const disabled = clozeOnly && gradedOnly(key)
    return (
      <button
        key={key}
        type="button"
        title={MODE_LABELS[key].hint}
        disabled={disabled}
        onClick={() => !disabled && onChangeMode(key)}
        style={{
          minHeight: `${TAP_MIN - 8}px`,
          padding: '8px 14px',
          borderRadius: '999px',
          border: 'none',
          background: active ? COLORS.blue : 'transparent',
          color: disabled ? COLORS.dashed : active ? '#ffffff' : COLORS.sub,
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {MODE_LABELS[key].label}
        <span style={{ opacity: 0.85 }}>（{count}）</span>
      </button>
    )
  }

  // 畳んでいるときに出す要約。いま何をどれだけ出題しているかだけを示す
  const summary = [
    qtype === 'all' ? null : TYPE_LABELS[qtype],
    MODE_LABELS[mode]?.label ?? null,
    groupId ? (groups.find((g) => g.id === groupId)?.name ?? null) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: `${compact ? 12 : 16}px ${space.pageX}px 0 ${space.pageX}px`,
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '12px' : '18px',
        flexWrap: 'wrap',
      }}
    >
      {/* 畳んだ状態：いま出題している条件と問題数だけを1行で示す */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minHeight: `${TAP_MIN - 4}px`,
          padding: '8px 14px',
          borderRadius: '12px',
          border: `1px solid ${open ? COLORS.blue : COLORS.border}`,
          background: open ? COLORS.blueLight : COLORS.card,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
          {summary || '全問題'}
        </span>
        <span style={{ fontSize: '12.5px', color: COLORS.sub }}>{total}問で出題中</span>
        <span style={{ marginLeft: 'auto', fontSize: '12.5px', fontWeight: 700, color: COLORS.blue }}>
          {open ? '閉じる' : '条件を変える'}
        </span>
      </button>

      {open && (
      <>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={labelStyle}>種別</span>
        <span
          style={{
            display: 'inline-flex',
            gap: '2px',
            padding: '3px',
            borderRadius: '999px',
            background: COLORS.chipTrack,
          }}
        >
          {[
            { key: 'all', text: 'すべて' },
            { key: QUESTION_TYPES.CHOICE, text: TYPE_LABELS[QUESTION_TYPES.CHOICE] },
            { key: QUESTION_TYPES.CLOZE, text: TYPE_LABELS[QUESTION_TYPES.CLOZE] },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onChangeType(t.key)}
              style={{
                minHeight: `${TAP_MIN - 8}px`,
                padding: '8px 14px',
                borderRadius: '999px',
                border: 'none',
                background: qtype === t.key ? COLORS.blue : 'transparent',
                color: qtype === t.key ? '#ffffff' : COLORS.sub,
                fontSize: '13px',
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

      {clozeOnly && (
        <div
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            background: COLORS.amberLight,
            color: COLORS.amberDark,
            fontSize: '12.5px',
            lineHeight: 1.8,
          }}
        >
          要復習・今日の復習・本番モードは採点前提のため、種別が「虫食い」のときは選べません。「すべて」では選択式のみが対象になります。
        </div>
      )}

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
        <span style={labelStyle}>範囲</span>
        <span
          style={{
            display: 'inline-flex',
            gap: '2px',
            padding: '3px',
            borderRadius: '999px',
            background: COLORS.chipTrack,
          }}
        >
          {Object.values(MODES).map(modeButton)}
        </span>
      </div>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={labelStyle}>グループ</span>
        <select value={groupId} onChange={(e) => onChangeGroup(e.target.value)} style={selectStyle}>
          <option value="">すべて</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={labelStyle}>出題数</span>
        <select
          value={String(limit)}
          onChange={(e) => onChangeLimit(Number(e.target.value))}
          style={selectStyle}
        >
          <option value="0">すべて</option>
          <option value="5">5問</option>
          <option value="10">10問</option>
          <option value="20">20問</option>
          <option value="50">50問</option>
        </select>
      </label>

      <label
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        title="解説を伏せて連続で解き、終了後にまとめて採点します"
      >
        <input
          type="checkbox"
          checked={examMode}
          disabled={clozeOnly}
          onChange={(e) => onChangeExamMode(e.target.checked)}
          style={{ accentColor: COLORS.blue, cursor: clozeOnly ? 'default' : 'pointer' }}
        />
        <span style={{ ...labelStyle, color: clozeOnly ? COLORS.dashed : COLORS.sub }}>
          本番モード
        </span>
      </label>

      {examMode && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={labelStyle}>制限時間</span>
          <select
            value={String(examMinutes)}
            onChange={(e) => onChangeExamMinutes(Number(e.target.value))}
            style={selectStyle}
          >
            <option value="0">なし</option>
            <option value="5">5分</option>
            <option value="10">10分</option>
            <option value="30">30分</option>
            <option value="60">60分</option>
          </select>
        </label>
      )}
      </>
      )}
    </div>
  )
}
