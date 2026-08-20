/**
 * ブラウザの保存領域（Chrome / Edge の localStorage）から、消してしまった問題を探し出す。
 *
 * localStorage の実体は LevelDB で、上書きや削除をしても古い値がしばらくファイルに
 * 残っている。そこを直接なめて、問題データ（quizmake.pool.v2 の中身）の断片を拾う。
 *
 * 見つかったものは、アプリの「読み込む」でそのまま取り込める形（バックアップ .json）
 * にして書き出す。
 *
 * 使い方:
 *   1) ブラウザを完全に終了する
 *   2) leveldb フォルダを**コピー**する（元は触らない）
 *        Chrome: %LocalAppData%\Google\Chrome\User Data\Default\Local Storage\leveldb
 *        Edge  : %LocalAppData%\Microsoft\Edge\User Data\Default\Local Storage\leveldb
 *   3) node scripts/recover-from-browser.mjs <コピーしたleveldbフォルダ> [出力先.json]
 *
 * 注意: 見つかるとは限らない。ブラウザを使い続けるほど、古い値は消えていく。
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** 探す目印。savePool が書く文字列の先頭。 */
const NEEDLE = '{"version":2,"groups":['

/**
 * バイト列から JSON オブジェクトを1つ切り出す。
 *
 * 文字列の中の波括弧を数えないように、引用符とエスケープを見ながら進む。
 * ASCII の記号は UTF-8 でも UTF-16LE でも同じ位置に現れるので、
 * 1文字あたりのバイト数さえ合わせれば同じ手順で数えられる。
 *
 * @param {Buffer} buf 対象
 * @param {number} start 開き波括弧の位置（バイト）
 * @param {1|2} step 1文字あたりのバイト数
 * @returns {string|null} 切り出した JSON 文字列
 */
function sliceJson(buf, start, step) {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i + step <= buf.length; i += step) {
    const code = step === 2 ? buf.readUInt16LE(i) : buf[i]
    // 制御文字が続くようならデータの切れ目とみなして打ち切る
    if (code === 0 && step === 1) return null

    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (code === 0x5c) escaped = true // \
      else if (code === 0x22) inString = false // "
      continue
    }
    if (code === 0x22) {
      inString = true
      continue
    }
    if (code === 0x7b) depth += 1 // {
    else if (code === 0x7d) {
      depth -= 1 // }
      if (depth === 0) {
        const end = i + step
        return buf.toString(step === 2 ? 'utf16le' : 'utf8', start, end)
      }
    }
    // 単純に長すぎるものは打ち切る（壊れた断片を延々と追わない）
    if (i - start > 40 * 1024 * 1024) return null
  }
  return null
}

/** 1つのファイルから、問題データの候補をすべて拾う。 */
function scanFile(path) {
  const buf = readFileSync(path)
  const found = []

  for (const [encoding, step] of [
    ['utf16le', 2],
    ['utf8', 1],
  ]) {
    const pattern = Buffer.from(NEEDLE, encoding)
    let at = buf.indexOf(pattern)
    while (at !== -1) {
      const text = sliceJson(buf, at, step)
      if (text) {
        try {
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed?.questions)) {
            found.push({ path, encoding, offset: at, pool: parsed })
          }
        } catch {
          // 途中で切れている断片は捨てる
        }
      }
      at = buf.indexOf(pattern, at + pattern.length)
    }
  }
  return found
}

const [, , dir, outputPath] = process.argv

if (!dir) {
  console.error('使い方: node scripts/recover-from-browser.mjs <leveldbフォルダ> [出力先.json]')
  process.exit(1)
}

let entries
try {
  entries = readdirSync(dir).filter((n) => statSync(join(dir, n)).isFile())
} catch {
  console.error(`フォルダを開けませんでした: ${dir}`)
  process.exit(1)
}

console.log(`${entries.length} 個のファイルを調べます…\n`)

const all = []
for (const name of entries) {
  const hits = scanFile(join(dir, name))
  if (hits.length) {
    for (const hit of hits) {
      const cloze = hit.pool.questions.filter((q) => q?.type === 'cloze').length
      console.log(
        `  ${name}  問題 ${hit.pool.questions.length}問` +
          `（うち虫食い ${cloze}問） グループ ${hit.pool.groups?.length ?? 0}個`,
      )
    }
    all.push(...hits)
  }
}

if (!all.length) {
  console.error('\n問題データは見つかりませんでした。')
  console.error('ブラウザを使い続けると古い値は消えます。別の保存先も試してください:')
  console.error('  ・フォルダのプロパティ →「以前のバージョン」から古い状態を復元する')
  console.error('  ・別の端末やブラウザで同じアプリを開いたことがないか')
  process.exit(1)
}

// 一番たくさん問題が入っているものを採用する
all.sort((a, b) => b.pool.questions.length - a.pool.questions.length)
const best = all[0]

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
console.log(`\n見つかった中で一番多いものを採用しました。`)
console.log(`  問題 ${best.pool.questions.length}問（うち虫食い ${cloze}問）`)
console.log(`  グループ: ${(best.pool.groups ?? []).map((g) => g.name).join(' / ')}`)
console.log(`\n${out} を書き出しました。`)
console.log('アプリの「読み込む」からこのファイルを選び、「追加する」を押すと元に戻ります。')
