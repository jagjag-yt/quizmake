import { COLORS, MODES, MODE_LABELS, SPACING, TAP_MIN } from '../constants'
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

/** 出題条件のバー：モード・科目/タグ絞り込み・出題数・本番モード。 */
export default function StudyToolbar({
  mode,
  onChangeMode,
  counts,
  subjects,
  subject,
  onChangeSubject,
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

  const modeButton = (key) => {
    const active = mode === key
    const count = counts[key] ?? 0
    return (
      <button
        key={key}
        type="button"
        title={MODE_LABELS[key].hint}
        onClick={() => onChangeMode(key)}
        style={{
          minHeight: `${TAP_MIN - 8}px`,
          padding: '8px 14px',
          borderRadius: '999px',
          border: 'none',
          background: active ? COLORS.blue : 'transparent',
          color: active ? '#ffffff' : COLORS.sub,
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
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
      <div
        style={{
          display: 'inline-flex',
          gap: '2px',
          padding: '3px',
          borderRadius: '999px',
          background: '#f1f5f9',
        }}
      >
        {Object.values(MODES).map(modeButton)}
      </div>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={labelStyle}>科目</span>
        <select value={subject} onChange={(e) => onChangeSubject(e.target.value)} style={selectStyle}>
          <option value="">すべて</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
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
          onChange={(e) => onChangeExamMode(e.target.checked)}
          style={{ accentColor: COLORS.blue, cursor: 'pointer' }}
        />
        <span style={labelStyle}>本番モード</span>
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
