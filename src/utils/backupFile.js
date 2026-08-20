import { dateKey } from './safe'

/**
 * 書き出したファイルのダウンロード。
 *
 * ファイル名は「日付＋名前」。日付を先頭に置くと、ダウンロードフォルダで
 * 名前順に並べたときにそのまま時系列になる。
 */

/** ファイル名に使えない文字を落とす。 */
function safeName(name) {
  return String(name ?? '')
    .replace(/[/:*?"<>|\\]/g, '')
    .trim()
}

/**
 * バックアップのファイル名。
 * 名前があれば `2026-08-20_日本史.json`、無ければ `2026-08-20_quizmake-backup.json`。
 *
 * @param {string} [name] グループ名など
 */
export function backupFileName(name) {
  const safe = safeName(name)
  return `${dateKey()}_${safe || 'quizmake-backup'}.json`
}

/**
 * 文字列を JSON ファイルとしてダウンロードさせる。
 *
 * @param {string} text 中身
 * @param {string} fileName ファイル名
 */
export function downloadJson(text, fileName) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // オブジェクトURLは使い終わったら解放する
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
