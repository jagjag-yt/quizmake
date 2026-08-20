/**
 * ブラウザの保存領域から、消してしまった問題を探し出す。
 *
 * localStorage は上書きや削除をしても、古い値がしばらくファイルに残っている。
 * そこを直接なめて、問題データ（quizmake.pool.v2 の中身）の断片を拾う。
 * 見つかったものは、アプリの「読み込む」でそのまま取り込める形にして書き出す。
 *
 * 使い方:
 *   1) ブラウザを完全に終了する
 *   2) 保存フォルダを**コピー**する（元は触らない）
 *        Firefox: %AppData%\Mozilla\Firefox\Profiles\  ← プロファイルごとコピーが確実
 *        Chrome : %LocalAppData%\Google\Chrome\User Data\Default\Local Storage\leveldb
 *        Edge   : %LocalAppData%\Microsoft\Edge\User Data\Default\Local Storage\leveldb
 *   3) node scripts/recover-from-browser.mjs <コピーしたフォルダ> [出力先.json]
 *
 * Firefox は SQLite に保存し、値を Snappy で圧縮していることがあるため、
 * 圧縮されたままの断片も展開して探す。
 *
 * 注意: 見つかるとは限らない。ブラウザを使い続けるほど、古い値は消えていく。
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { snappyDecompress } from './lib/snappy.mjs'

/** 探す目印。savePool が書く文字列の先頭。 */
const NEEDLE = '{"version":2,"groups":['

/** 中身を見ても意味が無いファイル。 */
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.woff', '.woff2', '.ttf', '.ico'])

/**
 * 文字列から JSON オブジェクトを1つ切り出す。
 * 文字列の中の波括弧を数えないよう、引用符とエスケープを見ながら進む。
 *
 * @param {string} text 対象
 * @param {number} start 開き波括弧の位置
 * @returns {string|null}
 */
function sliceJsonString(text, start) {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/** 切り出した文字列を問題データとして受け取れるか試す。 */
function tryParse(text, into, source) {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed?.questions) && parsed.questions.length) {
      into.push({ ...source, pool: parsed })
      return true
    }
  } catch {
    // 途中で切れている断片は捨てる
  }
  return false
}

/** 圧縮されずに入っている値を探す。 */
function scanPlain(buf, found, path) {
  const views = [
    ['utf8', buf.toString('utf8')],
    ['utf16le', buf.toString('utf16le')],
    // 2バイト単位の境目がずれている場合に備えて、1バイトずらしたものも見る
    ['utf16le+1', buf.length > 1 ? buf.subarray(1).toString('utf16le') : ''],
  ]
  for (const [label, text] of views) {
    let at = text.indexOf(NEEDLE)
    while (at !== -1) {
      const json = sliceJsonString(text, at)
      if (json) tryParse(json, found, { path, how: `そのまま(${label})` })
      at = text.indexOf(NEEDLE, at + NEEDLE.length)
    }
  }
}

/**
 * Snappy で圧縮されたまま入っている値を探す。
 *
 * 圧縮されていても、先頭のあたりは「そのままの文字列」として入っていることが多い。
 * 目印が見つかった位置から数バイト戻って、そこが圧縮の開始かどうかを試す。
 */
function scanCompressed(buf, found, path) {
  for (const encoding of ['utf16le', 'utf8']) {
    const marker = Buffer.from(NEEDLE, encoding)
    let at = buf.indexOf(marker)
    while (at !== -1) {
      for (let back = 1; back <= 10; back += 1) {
        const start = at - back
        if (start < 0) break
        const out = snappyDecompress(buf, start)
        if (!out) continue
        const text = out.toString(encoding)
        const pos = text.indexOf(NEEDLE)
        if (pos === -1) continue
        const json = sliceJsonString(text, pos)
        if (json && tryParse(json, found, { path, how: `圧縮を展開(${encoding})` })) break
      }
      at = buf.indexOf(marker, at + marker.length)
    }
  }
}

/** フォルダの中を再帰的に集める。 */
function listFiles(dir, acc = [], depth = 0) {
  if (depth > 8) return acc
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    const path = join(dir, name)
    let info
    try {
      info = statSync(path)
    } catch {
      continue
    }
    if (info.isDirectory()) listFiles(path, acc, depth + 1)
    else if (info.isFile() && !SKIP_EXT.has(extname(name).toLowerCase())) acc.push(path)
  }
  return acc
}

const [, , dir, outputPath] = process.argv

if (!dir) {
  console.error('使い方: node scripts/recover-from-browser.mjs <コピーしたフォルダ> [出力先.json]')
  process.exit(1)
}

const files = listFiles(dir)
if (!files.length) {
  console.error(`ファイルが見つかりませんでした: ${dir}`)
  process.exit(1)
}

console.log(`${files.length} 個のファイルを調べます…\n`)

const found = []
for (const path of files) {
  let buf
  try {
    buf = readFileSync(path)
  } catch {
    continue
  }
  if (!buf.length) continue
  const before = found.length
  scanPlain(buf, found, path)
  scanCompressed(buf, found, path)
  for (const hit of found.slice(before)) {
    const cloze = hit.pool.questions.filter((q) => q?.type === 'cloze').length
    console.log(
      `  見つかりました: ${path}\n` +
        `    ${hit.how} / 問題 ${hit.pool.questions.length}問（うち虫食い ${cloze}問）` +
        ` / グループ ${hit.pool.groups?.length ?? 0}個`,
    )
  }
}

if (!found.length) {
  console.error('\n問題データは見つかりませんでした。')
  console.error('次の手も試せます:')
  console.error('  ・フォルダのプロパティ →「以前のバージョン」から、削除前の状態を取り出す')
  console.error('  ・プロファイルフォルダごと指定し直す（storage の下だけでなく全体を渡す）')
  process.exit(1)
}

// 一番たくさん問題が入っているものを採用する
found.sort((a, b) => b.pool.questions.length - a.pool.questions.length)
const best = found[0]

const payload = {
  app: 'quizmake',
  kind: 'backup',
  version: 2,
  exportedAt: new Date().toISOString(),
  recoveredFrom: best.path,
  pool: { groups: best.pool.groups ?? [], questions: best.pool.questions },
}

const out = outputPath ?? '復元した問題.json'
writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8')

const cloze = best.pool.questions.filter((q) => q?.type === 'cloze').length
console.log(`\n候補 ${found.length} 件のうち、一番多いものを採用しました。`)
console.log(`  問題 ${best.pool.questions.length}問（うち虫食い ${cloze}問）`)
console.log(`  グループ: ${(best.pool.groups ?? []).map((g) => g.name).join(' / ')}`)
console.log(`\n${out} を書き出しました。`)
console.log('アプリの「読み込む」からこのファイルを選び、「追加する」を押すと元に戻ります。')
