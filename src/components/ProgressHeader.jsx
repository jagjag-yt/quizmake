import { useState } from 'react'

/** 出題モード切替（全問題 / ★ブックマーク）のセグメントコントロール。 */
function ModeToggle({ mode, onChangeMode, bookmarkCount }) {
  const seg = (active) => ({
    padding: '6px 14px',
    borderRadius: '999px',
    border: 'none',
    background: active ? '#2563eb' : 'transparent',
    color: active ? '#ffffff' : '#64748b',
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
      <button type="button" style={seg(mode === 'all')} onClick={() => onChangeMode('all')}>
        全問題
      </button>
      <button
        type="button"
        style={seg(mode === 'bookmarked')}
        onClick={() => onChangeMode('bookmarked')}
      >
        ★ ブックマーク{bookmarkCount > 0 ? `（${bookmarkCount}）` : ''}
      </button>
    </div>
  )
}

/** 正答率の記録表示＋リセットボタン。 */
function AccuracyStat({ accuracy, stats, onResetStats }) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '13px', color: '#475569' }}>
        正答率{' '}
        <b style={{ color: '#2563eb', fontSize: '14px' }}>{accuracy}%</b>{' '}
        <span style={{ color: '#94a3b8' }}>
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
          border: '1px solid #e2e8f0',
          background: hover ? '#f1f5f9' : '#ffffff',
          color: '#64748b',
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

/**
 * 上部ヘッダー：左に「戻る」「Excel読み込み」「モード切替」、
 * 右に「正答率」「進捗テキスト＋進捗バー」。
 *
 * @param {{
 *   position: number, total: number, onBack?: () => void, slot?: React.ReactNode,
 *   mode: 'all' | 'bookmarked', onChangeMode: (m: string) => void, bookmarkCount: number,
 *   accuracy: number, stats: { answered: number, correct: number }, onResetStats: () => void,
 * }} props
 */
export default function ProgressHeader({
  position,
  total,
  onBack,
  slot,
  mode,
  onChangeMode,
  bookmarkCount,
  accuracy,
  stats,
  onResetStats,
}) {
  const [backHover, setBackHover] = useState(false)
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
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onBack}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            fontSize: '14px',
            color: backHover ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            transition: 'color 0.15s ease',
          }}
        >
          &#8592; 戻る
        </span>
        {slot}
        <ModeToggle mode={mode} onChangeMode={onChangeMode} bookmarkCount={bookmarkCount} />
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
        <AccuracyStat accuracy={accuracy} stats={stats} onResetStats={onResetStats} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>
          演習 {position}/{total}問目
        </span>
        <div
          style={{
            width: '220px',
            height: '6px',
            borderRadius: '999px',
            background: '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: '999px',
              background: '#2563eb',
              width: `${fillPct}%`,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>
    </header>
  )
}
