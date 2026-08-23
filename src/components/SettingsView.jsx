import { useState } from 'react'
import { COLORS, SPACING, TAP_MIN, THEMES } from '../constants'
import { loadTheme, saveTheme } from '../utils/theme'
import ConfirmDialog from './ConfirmDialog'
import { ShortcutList } from './ShortcutHelp'
import { useCompactLayout } from '../hooks/useMediaQuery'

const card = (pad) => ({
  background: COLORS.card,
  borderRadius: '20px',
  border: `1px solid ${COLORS.cardBorder}`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  padding: `${pad}px`,
})

const heading = {
  fontSize: '14px',
  fontWeight: 700,
  color: COLORS.text,
  margin: '0 0 6px 0',
}

const note = { margin: 0, fontSize: '12.5px', color: COLORS.sub, lineHeight: 1.8 }

/**
 * 設定。
 *
 * 通知と規約は中身がまだ無いため、置き場所だけ先に用意して「準備中」と示す。
 * 何ができるようになる予定かが見えているほうが、問い合わせが減る。
 */
export default function SettingsView({ onResetAll, onOpenAccount, appVersion = '1.0.0' }) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const [confirming, setConfirming] = useState(false)
  const [theme, setTheme] = useState(loadTheme)

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '720px',
        width: '100%',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.text }}>設定</h2>

      {/* 見た目 */}
      <section style={card(space.card)}>
        <h3 style={heading}>見た目</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          暗い場所で使うときはダークが目に楽です。「端末に合わせる」を選ぶと、
          お使いの端末の設定（ダークモードの切り替え）にそのまま従います。
        </p>
        <div
          role="radiogroup"
          aria-label="見た目"
          style={{
            display: 'inline-flex',
            gap: '2px',
            padding: '3px',
            borderRadius: '999px',
            background: COLORS.chipTrack,
          }}
        >
          {[
            { key: THEMES.SYSTEM, text: '端末に合わせる' },
            { key: THEMES.LIGHT, text: 'ライト' },
            { key: THEMES.DARK, text: 'ダーク' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={theme === t.key}
              onClick={() => {
                setTheme(t.key)
                saveTheme(t.key)
              }}
              style={{
                minHeight: '34px',
                padding: '0 14px',
                borderRadius: '999px',
                border: 'none',
                background: theme === t.key ? COLORS.blue : 'transparent',
                color: theme === t.key ? COLORS.onAccent : COLORS.sub,
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
      </section>

      {/* アカウント（本体は別画面。ここには入口だけ置く） */}
      <section style={card(space.card)}>
        <h3 style={heading}>アカウント</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          問題と学習記録を預けて、別の端末や、消してしまったときに取り戻せます。
          アカウントは任意で、作らなくてもすべての機能を使えます。
        </p>
        <button
          type="button"
          onClick={onOpenAccount}
          style={{
            minHeight: `${TAP_MIN}px`,
            padding: '0 20px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            color: COLORS.body,
            fontSize: '13.5px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          アカウントを開く
        </button>
      </section>

      {/* 通知 */}
      <section style={card(space.card)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ ...heading, margin: 0 }}>通知</h3>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              background: COLORS.chipTrack,
              color: COLORS.sub,
              fontSize: '11.5px',
              fontWeight: 700,
            }}
          >
            準備中
          </span>
        </div>
        <p style={{ ...note, marginTop: '8px' }}>
          「今日の復習」がたまったときにお知らせする機能を準備しています。
          お使いの端末に通知を届けるにはアカウントが必要です。
        </p>
      </section>

      {/* 規約 */}
      <section style={card(space.card)}>
        <h3 style={heading}>規約とプライバシー</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          入力した問題も学習記録も、お使いの端末の中に保存されます。
          外部に送るのは、アカウントの「預ける」を押したときだけです。
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: '利用規約', href: 'https://quiz-make.com/terms.html' },
            { label: 'プライバシーポリシー', href: 'https://quiz-make.com/privacy.html' },
            { label: 'お問い合わせ', href: 'mailto:support@quiz-make.com' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                minHeight: `${TAP_MIN - 8}px`,
                padding: '8px 14px',
                borderRadius: '10px',
                border: `1px solid ${COLORS.border}`,
                background: COLORS.card,
                color: COLORS.body,
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {item.label}
              <span aria-hidden="true" style={{ fontSize: '11px', color: COLORS.muted }}>
                ↗
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* キーボードショートカット */}
      <section style={card(space.card)}>
        <h3 style={heading}>キーボードショートカット</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          キーボードのあるパソコンで使えます。タブレットやスマートフォンでは画面のボタンで操作してください。
        </p>
        <ShortcutList />
      </section>

      {/* データ */}
      <section style={card(space.card)}>
        <h3 style={heading}>データ</h3>
        <p style={{ ...note, marginBottom: '12px' }}>
          作成した問題と学習記録をすべて消して、最初の状態に戻します。
          消す前に、問題作成の画面から書き出して控えを取っておくことをおすすめします。
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            minHeight: `${TAP_MIN}px`,
            padding: '0 20px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.red}`,
            background: COLORS.card,
            color: COLORS.red,
            fontSize: '13.5px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          すべてのデータを削除
        </button>
      </section>

      {/* アプリ情報 */}
      <section style={card(space.card)}>
        <h3 style={heading}>アプリについて</h3>
        <p style={note}>
          quizmake バージョン {appVersion}
          <br />
          自分で作った問題を、選択式と虫食いで繰り返し解くための学習アプリです。
        </p>
      </section>

      {confirming && (
        <ConfirmDialog
          title="すべてのデータを削除しますか？"
          message="作成した問題とグループは、ごみ箱へ移してから最初の状態に戻します（あとから戻せます）。学習記録はここで消え、元に戻せません。完全に消したいときは、このあとごみ箱も空にしてください。"
          confirmLabel="削除する"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            onResetAll()
            setConfirming(false)
          }}
        />
      )}
    </div>
  )
}
