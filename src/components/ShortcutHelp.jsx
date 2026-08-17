import { COLORS } from '../constants'

const SHORTCUTS = [
  ['a 〜 e / 1 〜 5', '選択肢を選ぶ'],
  ['Enter', '解答する（2つ選べ）／次の問題へ'],
  ['→ / ←', '次の問題 / 前の問題'],
  ['R', 'リトライ'],
  ['S', 'ブックマークの登録・解除'],
  ['?', 'このショートカット一覧'],
]

/**
 * ショートカットの一覧そのもの。
 * 設定の中に直接置くので、開閉のボタンは持たない。
 */
export function ShortcutList() {
  return (
    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {SHORTCUTS.map(([keys, desc]) => (
        <div
          key={keys}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <dt
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: COLORS.blue,
              background: COLORS.blueLight,
              padding: '3px 8px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            {keys}
          </dt>
          <dd style={{ margin: 0, fontSize: '12.5px', color: COLORS.body, textAlign: 'right' }}>
            {desc}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * 「?」キーで開く小窓。
 *
 * ヘッダーの「?」ボタンと「⋯」メニューは廃止した（中身が1つだけで、
 * しかもタブレットには物理キーボードが無く意味が薄かった）。
 * 一覧は設定の中に常設し、ここはキーボードを使う人のための近道として残す。
 */
export default function ShortcutHelp({ open, onClose }) {
  if (!open) return null
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-label="キーボードショートカット"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 61,
          width: 'min(340px, 92vw)',
          padding: '18px 20px',
          borderRadius: '14px',
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
        }}
      >
        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
          キーボードショートカット
        </p>
        <ShortcutList />
        <p style={{ margin: '12px 0 0 0', fontSize: '11.5px', color: COLORS.muted }}>
          「?」をもう一度押すか、外側を押すと閉じます。設定の中にも同じ一覧があります。
        </p>
      </div>
    </>
  )
}
