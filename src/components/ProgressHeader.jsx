import { useState } from 'react'
import { COLORS, VIEWS } from '../constants'
import { formatDuration } from '../utils/safe'

/** 画面切替タブ（演習 / ダッシュボード）。 */
function ViewTabs({ view, onChangeView }) {
  const tab = (active) => ({
    padding: '6px 14px',
    borderRadius: '999px',
    border: 'none',
    background: active ? COLORS.blue : 'transparent',
    color: active ? '#ffffff' : COLORS.sub,
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  })
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: '2px',
        padding: '3px',
        borderRadius: '999px',
        background: '#f1f5f9',
      }}
    >
      <button type="button" style={tab(view === VIEWS.QUIZ)} onClick={() => onChangeView(VIEWS.QUIZ)}>
        演習
      </button>
      <button
        type="button"
        style={tab(view === VIEWS.DASHBOARD)}
        onClick={() => onChangeView(VIEWS.DASHBOARD)}
      >
        学習記録
      </button>
    </div>
  )
}

/** 正答率の記録表示＋リセットボタン。 */
function AccuracyStat({ accuracy, stats, onResetStats }) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '13px', color: COLORS.body }}>
        正答率 <b style={{ color: COLORS.blue, fontSize: '14px' }}>{accuracy}%</b>{' '}
        <span style={{ color: COLORS.muted }}>
          （{stats.correct}/{stats.answered}）
        </span>
      </span>
      <button
        type="button"
        onClick={onResetStats}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="正答率の記録をリセット"
        aria-label="正答率の記録をリセット"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: `1px solid ${COLORS.border}`,
          background: hover ? '#f1f5f9' : COLORS.card,
          color: COLORS.sub,
          fontSize: '13px',
          lineHeight: 1,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        &#8635;
      </button>
    </div>
  )
}

/** 本番モードの残り時間表示。残り1分を切ると赤くなる。 */
function ExamTimer({ remainingSec }) {
  const danger = remainingSec <= 60
  return (
    <span
      title="本番モードの残り時間"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '999px',
        background: danger ? COLORS.redLight : '#f1f5f9',
        color: danger ? COLORS.red : COLORS.body,
        fontSize: '13px',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      &#9203; {formatDuration(remainingSec)}
    </span>
  )
}

/**
 * 上部ヘッダー：左に画面切替と各種ボタン、右に正答率・進捗。
 *
 * @param {{
 *   view: string, onChangeView: (v: string) => void,
 *   position: number, total: number,
 *   accuracy: number, stats: { answered: number, correct: number }, onResetStats: () => void,
 *   examMode: boolean, remainingSec: number|null,
 *   children?: React.ReactNode,
 * }} props
 */
export default function ProgressHeader({
  view,
  onChangeView,
  position,
  total,
  accuracy,
  stats,
  onResetStats,
  examMode,
  remainingSec,
  children,
}) {
  const fillPct = total > 0 ? (position / total) * 100 : 0

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        padding: '18px 32px',
        background: COLORS.card,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <ViewTabs view={view} onChangeView={onChangeView} />
        {children}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          minWidth: '220px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {examMode && remainingSec != null && <ExamTimer remainingSec={remainingSec} />}
          <AccuracyStat accuracy={accuracy} stats={stats} onResetStats={onResetStats} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.blue }}>
          演習 {position}/{total}問目
        </span>
        <div
          style={{
            width: '220px',
            height: '6px',
            borderRadius: '999px',
            background: COLORS.border,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: '999px',
              background: COLORS.blue,
              width: `${fillPct}%`,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>
    </header>
  )
}
