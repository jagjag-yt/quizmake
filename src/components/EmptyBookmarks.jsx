/**
 * 「ブックマークのみ」モードで対象が0件のときに表示する空状態。
 * メインの2カラム領域全体（gridColumn 全幅）に広げて表示する。
 */
export default function EmptyBookmarks({ onBackToAll }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        background: '#ffffff',
        borderRadius: '20px',
        padding: '56px 32px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        border: '1px solid #eef2f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: '40px', lineHeight: 1 }}>&#9734;</span>
      <p style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
        ブックマークした問題がありません
      </p>
      <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.8 }}>
        「全問題」で問題を表示し、右上の
        <span style={{ color: '#b45309', fontWeight: 700 }}> ☆ ブックマーク </span>
        を押すと、ここに集まります。
      </p>
      <button
        type="button"
        onClick={onBackToAll}
        style={{
          marginTop: '4px',
          padding: '10px 22px',
          borderRadius: '12px',
          border: '1px solid #2563eb',
          background: '#2563eb',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        全問題に戻る
      </button>
    </div>
  )
}
