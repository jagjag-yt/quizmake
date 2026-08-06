import { COLORS, TAP_MIN } from '../constants'

const SHORTCUTS = [
  ['a 〜 e / 1 〜 5', '選択肢を選ぶ'],
  ['Enter', '解答する（2つ選べ）／次の問題へ'],
  ['→ / ←', '次の問題 / 前の問題'],
  ['R', 'リトライ'],
  ['S', 'ブックマークの登録・解除'],
  ['?', 'このショートカット一覧'],
]

/** キーボードショートカットの一覧（ヘッダーの「?」で開閉）。 */
export default function ShortcutHelp({ open, onToggle }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        title="キーボードショートカット（?）"
        aria-label="キーボードショートカット"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${TAP_MIN - 8}px`,
          height: `${TAP_MIN - 8}px`,
          borderRadius: '50%',
          border: `1px solid ${open ? COLORS.blue : COLORS.border}`,
          background: open ? COLORS.blueLight : COLORS.card,
          color: open ? COLORS.blue : COLORS.sub,
          fontSize: '14px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="キーボードショートカット"
          style={{
            position: 'absolute',
            top: '40px',
            left: 0,
            zIndex: 20,
            width: '300px',
            padding: '16px 18px',
            borderRadius: '14px',
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
          }}
        >
          <p
            style={{
              margin: '0 0 10px 0',
              fontSize: '13px',
              fontWeight: 700,
              color: COLORS.text,
            }}
          >
            キーボードショートカット
          </p>
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SHORTCUTS.map(([keys, desc]) => (
              <div
                key={keys}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
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
        </div>
      )}
    </div>
  )
}
