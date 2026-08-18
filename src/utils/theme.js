import { THEMES, THEME_KEY } from '../constants'

/**
 * 見た目（ライト／ダーク）の切り替え。
 *
 * 色は CSS 変数（index.css の --c-*）で持ち、ここでは <html> の data-theme を
 * 付け替えるだけにしている。各コンポーネントは COLORS（= var(--c-*)）を
 * 参照しているので、この1か所で全画面の色が入れ替わる。
 */

/** 保存してある設定を読む。壊れていたら「端末に合わせる」に戻す。 */
export function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === THEMES.LIGHT || raw === THEMES.DARK ? raw : THEMES.SYSTEM
  } catch {
    return THEMES.SYSTEM
  }
}

/**
 * 見た目を適用する。
 * SYSTEM のときは data-theme を外し、端末の設定（prefers-color-scheme）に任せる。
 *
 * @param {'system'|'light'|'dark'} theme
 */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === THEMES.LIGHT || theme === THEMES.DARK) root.dataset.theme = theme
  else delete root.dataset.theme
  // ブラウザ側のUI（入力欄の既定色やスクロールバー）も合わせる
  root.style.colorScheme = theme === THEMES.SYSTEM ? 'light dark' : theme
}

/** 見た目を保存して適用する。 */
export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 保存できなくても、その場の切り替えは効く
  }
  applyTheme(theme)
}
