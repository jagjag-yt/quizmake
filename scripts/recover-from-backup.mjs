/**
 * 古い形式のバックアップ（学習記録だけの .json）から、問題文を取り出す。
 *
 * 以前の書き出しには問題そのものが入っておらず、学習記録だけが保存されていた。
 * ただし記録は「問題文そのもの」をキーにしているため、**解答したことがある問題の
 * 問題文だけ**は取り出せる。選択肢・正解・解説は残っていないので戻せない。
 *
 * 取り出した内容は Excel（.xlsx）にして、アプリの「読み込む」で取り込める形にする。
 * 選択肢と正解は空のままなので、Excel で埋めてから読み込む。
 *
 * 使い方:
 *   node scripts/recover-from-backup.mjs <バックアップ.json> [出力先.xlsx]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import * as XLSX from 'xlsx'

/** 書き出しの列（アプリの EXPORT_COLUMNS と同じ並び）。 */
const COLUMNS = [
  '問題番号',
  '問題文',
  '下線キーワード',
  '画像URL',
  '選択肢a',
  '選択肢b',
  '選択肢c',
  '選択肢d',
  '選択肢e',
  '正解',
  '解説',
  '基本事項',
]

/** 虫食いのキーに使われている区切り（data/questions.js と同じ）。 */
const CLOZE_PREFIX = 'cloze:'

const [, , inputPath, outputPath] = process.argv

if (!inputPath) {
  console.error('使い方: node scripts/recover-from-backup.mjs <バックアップ.json> [出力先.xlsx]')
  process.exit(1)
}

const raw = readFileSync(inputPath, 'utf8')
let parsed
try {
  parsed = JSON.parse(raw)
} catch {
  console.error('JSON として読み取れませんでした。')
  process.exit(1)
}

const body = parsed?.data ?? parsed
const records = body?.records
if (!records || typeof records !== 'object') {
  console.error('学習記録が見つかりませんでした。')
  process.exit(1)
}

// 新しい形式なら、そもそも問題がそのまま入っている
if (parsed?.pool?.questions?.length) {
  console.log(
    `このファイルには問題が ${parsed.pool.questions.length} 問そのまま入っています。\n` +
      'アプリの「読み込む」からこのファイルを選べば、そのまま元に戻せます。',
  )
  process.exit(0)
}

const choice = []
const cloze = []
for (const key of Object.keys(records)) {
  if (key.startsWith(CLOZE_PREFIX)) cloze.push(key.slice(CLOZE_PREFIX.length))
  else choice.push(key)
}

console.log(`取り出せた問題文: 選択式 ${choice.length}問 / 虫食い ${cloze.length}問`)
console.log('※ 解答したことがある問題だけが残っています。未解答の問題は記録が無いため取り出せません。')

if (!choice.length && !cloze.length) {
  console.error('取り出せる問題文がありませんでした。')
  process.exit(1)
}

const rows = choice.map((text, i) => {
  const row = {}
  for (const col of COLUMNS) row[col] = ''
  row['問題番号'] = i + 1
  row['問題文'] = text
  return row
})

const out = outputPath ?? `復元_${basename(inputPath).replace(/\.json$/i, '')}.xlsx`
const sheet = XLSX.utils.json_to_sheet(rows, { header: COLUMNS })
const book = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(book, sheet, '問題')
// XLSX.writeFile は Node の ESM だとファイルを書けないため、自分で書き出す
writeFileSync(out, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))

console.log(`\n${out} を書き出しました。`)
console.log('選択肢と正解は空です。Excel で埋めてから、アプリの「読み込む」で取り込んでください。')

if (cloze.length) {
  const txt = out.replace(/\.xlsx$/i, '_虫食い.txt')
  // 虫食いは Excel の形式に入らないため、本文をテキストで出す
  writeFileSync(txt, cloze.map((c) => c.replace(/␟/g, '\n')).join('\n\n---\n\n'), 'utf8')
  console.log(`\n虫食いの本文は ${txt} に書き出しました。`)
  console.log('アプリで虫食い問題を作り、この本文を貼り付け直してください（隠す指定は残っていません）。')
}
