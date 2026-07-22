import { useState } from 'react'

/**
 * 上部ヘッダー：「← 戻る」リンクと、右側に進捗テキスト＋進捗バー。
 *
 * @param {{ position: number, total: number, onBack?: () => void, slot?: React.ReactNode }} props
 *   position: 現在の問題位置（1始まり）, total: 問題総数, slot: 戻るの隣に置く任意要素
 */
export default function ProgressHeader({ position, total, onBack, slot }) {
  const [backHover, setBackHover] = useState(false)
  const fillPct = (position / total) * 100

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 32px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
