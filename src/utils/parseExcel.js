import { LETTERS, LIMITS } from '../constants'
import { buildSegmentsFromMarks, normalizeQuestion } from '../data/questions'
import { isPlainObject, sanitizeMap, toText } from './safe'

/**
 * Excel（.xlsx / .xls）ファイルを問題データ配列（Question[]）へ変換する。
 *
 * 想定するシート構成（1行目がヘッダー、2行目以降が1問1行）:
 *   | 問題番号 | 問題文 | 下線キーワード | 画像URL |
 *   | 選択肢a〜e | 正解 | 解説 | 基本事項 |
 *
 * - 問題番号   : 読み飛ばす。番号はグループ内の並び順から1,2,3…で振り直す
 * - グループ   : 列では持たない。1ファイル＝1グループとして取り込む
 * - 下線キーワード : 問題文中で下線強調したい語句を「、」「,」または改行で区切って列挙
 * - 画像URL    : 省略可。http(s) と画像のdata URLのみ受け付ける（安全でない値は無視）
 * - 選択肢a〜e : 空欄はスキップ（2〜5択に対応）
 * - 正解       : 「a」〜「e」/「1」〜「5」/ 選択肢そのものの文字列。
 *                「a、b」のように複数指定すると「2つ選べ」形式になる
 * - 基本事項   : 箇条書きを改行（セル内 Alt+Enter）または「｜」「|」で区切って列挙
 *
 * ヘッダー名は日本語・英語の別名も許容する（下記 FIELD_ALIASES 参照）。
 *
 * セキュリティ上の扱い:
 * - ファイルサイズ・行数に上限を設け、巨大ファイルでの固まりを防ぐ
 * - ヘッダー名由来のキーはプロトタイプ汚染対策のうえで参照する
 * - 画像URLはスキームを検証し、危険なものは捨てる（normalizeQuestion 側）
 * - xlsx ライブラリは重いため、この関数の実行時に動的 import で読み込む
 *
 * @param {ArrayBuffer} arrayBuffer 読み込んだファイルのバイト列
 * @returns {Promise<import('../data/questions').Question[]>}
 * @throws {Error} 変換できない行があった場合、その行番号を含むメッセージ
 */
export async function parseWorkbook(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error('ファイルを読み取れませんでした。')
  }
  if (arrayBuffer.byteLength > LIMITS.EXCEL_BYTES) {
    throw new Error('ファイルが大きすぎます（15MBまで）。')
  }

  const XLSX = await import('xlsx')
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('シートが見つかりません。')

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    defval: '',
    raw: false, // 数値も文字列として受け取り、正解判定などを安定させる
  })
  if (!rows.length) throw new Error('データ行がありません（ヘッダー行のみ、または空です）。')
  if (rows.length > LIMITS.QUESTIONS) {
    throw new Error(`問題数が多すぎます（${LIMITS.QUESTIONS}問まで）。`)
  }

  return rows.map((row, i) => rowToQuestion(row, i))
}

/** ヘッダー名の別名マップ。左が正規キー、右が受け付ける別名（小文字化して比較）。 */
const FIELD_ALIASES = {
  questionNumber: ['問題番号', '番号', 'no', 'no.', 'number', 'q'],
  question: ['問題文', '問題', 'question', '本文'],
  keywords: ['下線キーワード', '下線', 'キーワード', 'underline', 'keywords', 'keyword'],
  correct: ['正解', '答え', '解答', 'answer', 'correct'],
  explanation: ['解説', 'explanation', '説明'],
  keyPoints: ['基本事項', 'ポイント', 'keypoints', 'points'],
  imageUrl: ['画像url', '画像', '図', 'image', 'imageurl', 'image_url'],
}

/** 選択肢列の別名（インデックス0=a に対応）。 */
const CHOICE_ALIASES = LETTERS.map((letter, idx) => [
  `選択肢${letter}`, // 選択肢a
  `選択肢${idx + 1}`, // 選択肢1
  `choice${letter}`,
  `choice${idx + 1}`,
  letter, // 単独の a / b / ...
])

/** row（ヘッダー→値のオブジェクト）から、正規キーの値を別名込みで取り出す。 */
function pick(row, aliases) {
  const norm = (s) => String(s).trim().toLowerCase()
  const entries = Object.entries(row)
  for (const alias of aliases) {
    const hit = entries.find(([key]) => norm(key) === norm(alias))
    if (hit && String(hit[1]).trim() !== '') return toText(hit[1], LIMITS.TEXT_CHARS)
  }
  return ''
}

/**
 * 短い語句リスト（下線キーワード・複数正解）の分割。
 * 「、」「,」「;」「｜」「|」または改行で区切る。
 */
function splitTokens(value) {
  return String(value)
    .split(/[,、;｜|]|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 文章リスト（基本事項）の分割。
 * 各項目は「、」や「,」を本文に含みうるため、改行または「｜」「|」のみで区切る。
 */
function splitLines(value) {
  return String(value)
    .split(/\r?\n|[｜|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 文字列 needle が現れる位置をすべて返す。 */
function occurrences(text, needle) {
  const found = []
  if (!needle) return found
  let from = 0
  for (;;) {
    const i = text.indexOf(needle, from)
    if (i === -1) break
    found.push(i)
    from = i + needle.length
  }
  return found
}

/**
 * 問題文を下線キーワードの区切りで segments 配列へ分割する。
 *
 * キーワードの書き方は2通り:
 * - `ST上昇`    … 一致する箇所すべてに下線（手入力しやすい既定の書き方）
 * - `ST上昇@2`  … 2番目に現れる箇所だけに下線（位置指定）
 *
 * 位置指定は、アプリが書き出すときに「同じ語句が複数あり、その一部だけに
 * 下線が引かれている」場合にだけ自動で付く。読み込み → 書き出し → 読み込みで
 * 下線の位置が変わらないようにするための記法。
 */
export function buildSegments(text, keywords) {
  const kws = keywords.filter(Boolean)
  if (!kws.length) return [{ text, u: false }]

  const marks = []
  for (const raw of kws) {
    const m = /^(.*?)@(\d+)$/.exec(raw)
    const word = m ? m[1] : raw
    const nth = m ? Number(m[2]) : null
    if (!word) continue

    const positions = occurrences(text, word)
    if (nth) {
      const pos = positions[nth - 1]
      if (pos != null) marks.push({ start: pos, end: pos + word.length })
    } else {
      for (const pos of positions) marks.push({ start: pos, end: pos + word.length })
    }
  }

  return buildSegmentsFromMarks(text, marks)
}

/** 正解表記1つ（a〜e / 1〜5 / 選択肢テキスト）を choices 内インデックスへ解決する。 */
function resolveOne(token, choices, rowNo) {
  const v = token.trim()
  const letterIdx = LETTERS.indexOf(v.toLowerCase())
  if (letterIdx !== -1 && letterIdx < choices.length) return letterIdx

  const num = Number(v)
  if (Number.isInteger(num) && num >= 1 && num <= choices.length) return num - 1

  const textIdx = choices.findIndex((c) => c === v)
  if (textIdx !== -1) return textIdx

  throw new Error(
    `${rowNo}行目: 「正解」の値「${token}」を選択肢に対応付けできません（a〜e / 1〜${choices.length} / 選択肢の文字列で指定してください）。`,
  )
}

/**
 * 「正解」セルを正解インデックスの配列へ解決する。
 * 「a、b」「1,3」のように複数指定すると「2つ選べ」形式になる。
 */
function resolveCorrectIndexes(correctRaw, choices, rowNo) {
  const tokens = splitTokens(correctRaw)
  // 「ST上昇, 異常Q波」のように選択肢自身がカンマを含む場合は、分割前の全体一致を優先
  const whole = choices.indexOf(correctRaw.trim())
  if (tokens.length > 1 && whole !== -1) return [whole]

  const list = (tokens.length ? tokens : [correctRaw]).map((t) => resolveOne(t, choices, rowNo))
  const unique = [...new Set(list)].sort((a, b) => a - b)
  if (unique.length >= choices.length) {
    throw new Error(`${rowNo}行目: すべての選択肢が正解になっています。`)
  }
  return unique
}

/** 1行を1問（Question）へ変換。 */
function rowToQuestion(rawRow, i) {
  const rowNo = i + 2 // ヘッダー行を1行目とした人間可読な行番号
  // ヘッダー名がそのままキーになるため、危険なキーを落としてから扱う
  const row = isPlainObject(rawRow) ? sanitizeMap(rawRow) : Object.create(null)

  const question = pick(row, FIELD_ALIASES.question)
  if (!question) throw new Error(`${rowNo}行目: 「問題文」が空です。`)

  const choices = CHOICE_ALIASES.map((aliases) => pick(row, aliases)).filter(Boolean)
  if (choices.length < 2) {
    throw new Error(`${rowNo}行目: 選択肢が2つ以上必要です（選択肢a〜eの列に入力してください）。`)
  }

  const correctRaw = pick(row, FIELD_ALIASES.correct)
  if (!correctRaw) throw new Error(`${rowNo}行目: 「正解」が空です。`)
  const correctIndexes = resolveCorrectIndexes(correctRaw, choices, rowNo)

  const numRaw = pick(row, FIELD_ALIASES.questionNumber)

  return normalizeQuestion(
    {
      questionNumber: numRaw && Number.isFinite(Number(numRaw)) ? Number(numRaw) : i + 1,
      segments: buildSegments(question, splitTokens(pick(row, FIELD_ALIASES.keywords))),
      choices,
      correctIndexes,
      explanation: pick(row, FIELD_ALIASES.explanation),
      keyPoints: splitLines(pick(row, FIELD_ALIASES.keyPoints)),
      imageUrl: pick(row, FIELD_ALIASES.imageUrl),
    },
    i,
  )
}
