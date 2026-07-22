import { LETTERS } from '../data/questions'

/**
 * Excel（.xlsx / .xls）ファイルを問題データ配列（Question[]）へ変換する。
 *
 * 想定するシート構成（1行目がヘッダー、2行目以降が1問1行）:
 *   | 問題番号 | 問題文 | 下線キーワード | 選択肢a | 選択肢b | 選択肢c | 選択肢d | 選択肢e | 正解 | 解説 | 基本事項 |
 *
 * - 問題番号   : 省略可（省略時は上から自動採番）
 * - 下線キーワード : 問題文中で下線強調したい語句を「、」「,」または改行で区切って列挙
 * - 選択肢a〜e : 空欄はスキップ（3〜5択に対応。最低2つ必要）
 * - 正解       : 「a」〜「e」/「1」〜「5」/ 選択肢そのものの文字列、いずれでも可
 * - 基本事項   : 箇条書きを改行（セル内 Alt+Enter）または「｜」「|」で区切って列挙
 *
 * ヘッダー名は日本語・英語の別名も許容する（下記 FIELD_ALIASES 参照）。
 *
 * xlsx ライブラリは重いため、この関数の実行時に動的 import で読み込む
 * （初期表示のバンドルには含めない）。
 *
 * @param {ArrayBuffer} arrayBuffer 読み込んだファイルのバイト列
 * @returns {Promise<import('../data/questions').Question[]>}
 * @throws {Error} 変換できない行があった場合、その行番号を含むメッセージ
 */
export async function parseWorkbook(arrayBuffer) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('シートが見つかりません。')

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    defval: '',
    raw: false, // 数値も文字列として受け取り、正解判定などを安定させる
  })
  if (!rows.length) throw new Error('データ行がありません（ヘッダー行のみ、または空です）。')

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
    if (hit && String(hit[1]).trim() !== '') return String(hit[1]).trim()
  }
  return ''
}

/**
 * 短い語句リスト（下線キーワード）の分割。
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

/** 正規表現用のエスケープ。 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 問題文を下線キーワードの区切りで segments 配列へ分割する。
 * キーワードに一致する部分は u:true（下線強調）。
 */
export function buildSegments(text, keywords) {
  const kws = keywords.filter(Boolean)
  if (!kws.length) return [{ text, u: false }]
  // 長いキーワードを優先（部分一致の取りこぼしを防ぐ）
  const escaped = [...kws].sort((a, b) => b.length - a.length).map(escapeRegExp)
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  return text
    .split(re)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, u: kws.includes(part) }))
}

/** 正解表記（a〜e / 1〜5 / 選択肢テキスト）を choices 内インデックスへ解決する。 */
function resolveCorrectIndex(correctRaw, choices, rowNo) {
  const v = correctRaw.trim()
  // a〜e
  const letterIdx = LETTERS.indexOf(v.toLowerCase())
  if (letterIdx !== -1 && letterIdx < choices.length) return letterIdx
  // 1〜5
  const num = Number(v)
  if (Number.isInteger(num) && num >= 1 && num <= choices.length) return num - 1
  // 選択肢テキストそのもの
  const textIdx = choices.findIndex((c) => c === v)
  if (textIdx !== -1) return textIdx
  throw new Error(
    `${rowNo}行目: 「正解」の値「${correctRaw}」を選択肢に対応付けできません（a〜e / 1〜${choices.length} / 選択肢の文字列で指定してください）。`,
  )
}

/** 1行を1問（Question）へ変換。 */
function rowToQuestion(row, i) {
  const rowNo = i + 2 // ヘッダー行を1行目とした人間可読な行番号

  const question = pick(row, FIELD_ALIASES.question)
  if (!question) throw new Error(`${rowNo}行目: 「問題文」が空です。`)

  const choices = CHOICE_ALIASES.map((aliases) => pick(row, aliases)).filter(Boolean)
  if (choices.length < 2) {
    throw new Error(`${rowNo}行目: 選択肢が2つ以上必要です（選択肢a〜eの列に入力してください）。`)
  }

  const correctRaw = pick(row, FIELD_ALIASES.correct)
  if (!correctRaw) throw new Error(`${rowNo}行目: 「正解」が空です。`)
  const correctIndex = resolveCorrectIndex(correctRaw, choices, rowNo)

  const numRaw = pick(row, FIELD_ALIASES.questionNumber)
  const questionNumber = numRaw && Number.isFinite(Number(numRaw)) ? Number(numRaw) : i + 1

  return {
    questionNumber,
    segments: buildSegments(question, splitTokens(pick(row, FIELD_ALIASES.keywords))),
    choices,
    correctIndex,
    explanation: pick(row, FIELD_ALIASES.explanation),
    keyPoints: splitLines(pick(row, FIELD_ALIASES.keyPoints)),
  }
}
