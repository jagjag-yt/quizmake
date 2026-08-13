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

/** 出題条件のバー：モード・グループ/タグ絞り込み・出題数・本番モード。 */
export default function StudyToolbar({
  qtype,
  onChangeType,
  mode,
  onChangeMode,
  counts,
  groups,
  groupId,
  onChangeGroup,
  tags,
  tag,
  onChangeTag,
  limit,
  onChangeLimit,
  examMode,
  onChangeExamMode,
  examMinutes,
  onChangeExamMinutes,
  onRestart,
}) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide

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

      {tags.length > 0 && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={labelStyle}>タグ</span>
          <select value={tag} onChange={(e) => onChangeTag(e.target.value)} style={selectStyle}>
            <option value="">すべて</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}

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

      <button
        type="button"
        onClick={onRestart}
        title="現在の条件で最初から出題し直します"
        style={{
          marginLeft: 'auto',
          minHeight: `${TAP_MIN - 8}px`,
          padding: '8px 16px',
          borderRadius: '10px',
          border: `1px solid ${COLORS.blue}`,
          background: COLORS.blueLight,
          color: COLORS.blue,
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        この条件で開始
      </button>
    </div>
  )
}
