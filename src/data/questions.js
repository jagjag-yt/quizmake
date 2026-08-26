import { CLOZE_LIMITS, LIMITS, ORIGIN, QUESTION_TYPES } from '../constants'
import { hiddenCount, normalizeParas } from './cloze'
import { sanitizeImageUrl, toText } from '../utils/safe'

/**
 * 問題データ。
 *
 * Excel 等の外部データ読み込みへ拡張する際は、この構造をそのまま
 * 1レコード（1行）のスキーマとして利用できる。
 *
 * @typedef {Object} Question
 * @property {number}   questionNumber  問題番号
 * @property {Array<{text: string, u: boolean}>} segments
 *   問題文を「下線キーワードの区切り」で分割した配列。u: true の箇所に下線（キーワード強調）。
 * @property {string[]} choices          選択肢（最大5件、a〜eに対応。順序＝配列順）
 * @property {number[]} correctIndexes   正解のインデックス（「2つ選べ」に対応するため配列）
 * @property {number}   correctIndex     先頭の正解インデックス（単一選択時の互換用）
 * @property {string}   explanation      解説文
 * @property {string[]} keyPoints        「基本事項」の箇条書き
 * @property {string}   groupId          所属グループのID（旧「科目」の置き換え）
 * @property {string|null} imageUrl      問題画像（検証済みURLのみ保持）
 * @property {'authored'|'imported'} origin  アプリ内で作成したか、外部から読み込んだか
 * @property {'choice'|'cloze'} type  問題タイプ（作成後は変更しない）
 *
 * 虫食い（type:'cloze'）は上記のうち choices / correctIndexes / explanation /
 * keyPoints / imageUrl を使わず、代わりに title と paras を持つ。
 * 採点しないため、正答率・要復習・今日の復習・定着度の計算からは常に外す。
 */

/**
 * 同梱のサンプル問題。
 *
 * 初めて開いた人が「どう使うものか」を掴むための見本なので、特定の分野に
 * 寄らない一般教養から採り、事実だけを扱う（出典の権利に触れないため）。
 * 虫食いも1問入れておき、選択式以外の作り方にも気づけるようにする。
 */
/** @type {Question[]} */
const RAW_QUESTIONS = [
  {
    questionNumber: 1,
    group: '地理',
    segments: [
      { text: '日本で最も', u: false },
      { text: '面積が大きい都道府県', u: true },
      { text: 'はどれか。', u: false },
    ],
    choices: ['北海道', '岩手県', '福島県', '長野県', '新潟県'],
    correctIndexes: [0],
    explanation:
      '北海道は約83,000平方キロメートルで、日本の総面積のおよそ5分の1を占める。2位の岩手県（約15,000平方キロメートル）とは5倍以上の差がある。',
    keyPoints: [
      '面積の順位は 北海道 → 岩手 → 福島 → 長野 → 新潟',
      '岩手県は本州で最大',
      '最も小さいのは香川県',
    ],
  },
  {
    questionNumber: 2,
    group: '歴史',
    segments: [
      { text: '江戸幕府を開いた人物', u: true },
      { text: 'はどれか。', u: false },
    ],
    choices: ['徳川家康', '豊臣秀吉', '織田信長', '徳川家光', '源頼朝'],
    correctIndexes: [0],
    explanation:
      '徳川家康は1600年の関ヶ原の戦いに勝利し、1603年に征夷大将軍となって江戸に幕府を開いた。以後およそ260年続く江戸時代が始まる。',
    keyPoints: [
      '1603年、家康が征夷大将軍に就任して江戸幕府が成立',
      '家光は3代将軍で、参勤交代を制度化した',
      '源頼朝が開いたのは鎌倉幕府',
    ],
  },
  {
    questionNumber: 3,
    group: '理科',
    segments: [
      { text: '1気圧のもとで', u: false },
      { text: '水が沸騰する温度', u: true },
      { text: 'はどれか。', u: false },
    ],
    choices: ['0℃', '50℃', '75℃', '100℃', '150℃'],
    correctIndexes: [3],
    explanation:
      '1気圧（約1013ヘクトパスカル）では水は100℃で沸騰する。気圧が下がると沸点も下がるため、高い山の上では100℃より低い温度で沸騰する。',
    keyPoints: [
      '1気圧での沸点は100℃、凝固点は0℃',
      '気圧が下がると沸点も下がる',
      '富士山頂ではおよそ88℃で沸騰する',
    ],
  },
  {
    questionNumber: 4,
    group: '英語',
    segments: [
      { text: '"inevitable"', u: true },
      { text: 'の意味として最も適切なものはどれか。', u: false },
    ],
    choices: ['避けられない', '信じられない', '価値がない', '目に見えない', '数えきれない'],
    correctIndexes: [0],
    explanation:
      '"inevitable" は「避けられない、必然の」という意味の形容詞。in-（否定）＋ evitable（避けうる）という成り立ちで覚えると忘れにくい。',
    keyPoints: [
      'in- は否定を表す接頭辞',
      '名詞形は inevitability（必然性）',
      '副詞形 inevitably は「必然的に、当然ながら」',
    ],
  },
  {
    questionNumber: 5,
    group: '理科',
    type: 'cloze',
    title: '光合成のしくみ',
    paras: [
      [
        { text: '植物は葉の', hide: false },
        { text: '葉緑体', hide: true },
        { text: 'で、光のエネルギーを使って', hide: false },
        { text: '二酸化炭素', hide: true },
        { text: 'と', hide: false },
        { text: '水', hide: true },
        { text: 'から養分をつくる。', hide: false },
      ],
      [
        { text: 'このはたらきを', hide: false },
        { text: '光合成', hide: true },
        { text: 'といい、このとき', hide: false },
        { text: '酸素', hide: true },
        { text: 'が放出される。', hide: false },
      ],
    ],
  },
]

/** プール内で問題を識別するIDを発行する。 */
export function newQuestionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 問題オブジェクトを表示・採点に使える形へ整える。
 * 同梱データと Excel 由来データの差異（欠けた項目・古い形式）をここで吸収する。
 *
 * @param {Partial<Question> & { correctIndex?: number }} raw
 * @param {number} index 0始まりの並び順（問題番号が無いときの採番に使う）
 * @returns {Question}
 */
/**
 * 利用者が打ち込む文字を整える。**前後の空白を落とさない**。
 *
 * toText は trim するため、文の先頭でスペースや改行を打つとその場で消え、
 * 「入力できない」ように見えていた（2026-08-26 報告）。長さだけ制限する。
 * 空白だけかどうかの判定（未入力の検出）は、使う側で trim して行う。
 */
function editableText(value, maxChars) {
  const s = value == null ? '' : String(value)
  return maxChars && s.length > maxChars ? s.slice(0, maxChars) : s
}

export function normalizeQuestion(raw, index = 0) {
  // 問題番号は通常は数値だが、取り込み時の衝突回避で「12-2」形式の文字列にもなる
  const rawNum = raw.questionNumber
  const number =
    typeof rawNum === 'string' && /^\d+-\d+$/.test(rawNum.trim())
      ? rawNum.trim()
      : Number.isFinite(Number(rawNum))
        ? Number(rawNum)
        : index + 1

  const common = {
    id: toText(raw.id, 40) || newQuestionId(),
    questionNumber: number,
    groupId: toText(raw.groupId, 40),
    origin: raw.origin === ORIGIN.AUTHORED ? ORIGIN.AUTHORED : ORIGIN.IMPORTED,
  }

  // 虫食いは選択肢を持たない別構造
  if (raw.type === QUESTION_TYPES.CLOZE) {
    return {
      ...common,
      type: QUESTION_TYPES.CLOZE,
      title: toText(raw.title, CLOZE_LIMITS.TITLE_CHARS),
      paras: normalizeParas(raw.paras),
    }
  }

  // 未入力の選択肢はここでは捨てない。捨ててしまうと編集中に「＋ 選択肢を追加」で
  // 足した空欄がその場で消えてしまうため。出題・書き出しの直前に compactQuestion で落とす。
  const choices = Array.isArray(raw.choices)
    ? raw.choices.map((c) => editableText(c, LIMITS.TEXT_CHARS)).slice(0, 5)
    : []

  // 下線は 2026-08-26 に全廃した（利用者の指示）。古いデータに u が付いていても落とす。
  // segments 自体は残す（本文と、表の目印を運ぶ入れ物）
  const segments =
    Array.isArray(raw.segments) && raw.segments.length
      ? raw.segments.map((s) => ({ text: editableText(s?.text, LIMITS.TEXT_CHARS) }))
      : [{ text: editableText(raw.question, LIMITS.TEXT_CHARS) }]

  // correctIndexes（配列）を正とし、旧形式の correctIndex も受け付ける
  const rawIndexes = Array.isArray(raw.correctIndexes)
    ? raw.correctIndexes
    : [raw.correctIndex]
  const correctIndexes = [
    ...new Set(
      rawIndexes
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < choices.length),
    ),
  ].sort((a, b) => a - b)

  return {
    ...common,
    type: QUESTION_TYPES.CHOICE,
    segments,
    choices,
    correctIndexes,
    correctIndex: correctIndexes[0] ?? 0,
    tables: normalizeTables(raw.tables),
    explanation: editableText(raw.explanation, LIMITS.TEXT_CHARS),
    // 基本事項も選択肢と同じ理由で空欄を残す
    keyPoints: Array.isArray(raw.keyPoints)
      ? raw.keyPoints.map((k) => editableText(k, LIMITS.TEXT_CHARS)).slice(0, 20)
      : [],
    imageUrl: sanitizeImageUrl(raw.imageUrl),
  }
}

// ---------------------------------------------------------------------------
// 問題文の中の表
//
// 問題文は入力欄の文字から毎回組み立て直している（segmentsFromText）。
// そのため表を segments に混ぜると、文字を1字打っただけで消える。
// 表は別の入れ物（tables）に持ち、**本文には目印だけを置く**。
//   本文: 「次の表を見て答えよ。[[表1]] このとき…」
// 目印が動けば表も動き、目印を消せば本文から外れる。位置合わせの計算が要らない。
// ---------------------------------------------------------------------------

/** 表1つの上限。大きすぎる表は画面にもExcelにも収まらない。 */
export const TABLE_LIMITS = { ROWS: 30, COLS: 10, CELL_CHARS: 200 }

/** 本文に置く目印。1始まりの番号で表を指す。 */
export const TABLE_TOKEN = /\[\[表(\d{1,2})\]\]/g

/** 番号から目印の文字列を作る。 */
export const tableToken = (n) => `[[表${n}]]`

/** 表の1つを整える。 */
function normalizeTable(raw) {
  const rows = Array.isArray(raw?.rows) ? raw.rows : []
  const cleaned = rows
    .slice(0, TABLE_LIMITS.ROWS)
    .map((row) =>
      (Array.isArray(row) ? row : [])
        .slice(0, TABLE_LIMITS.COLS)
        .map((cell) => toText(cell, TABLE_LIMITS.CELL_CHARS)),
    )
  // 行ごとに列数がばらつくと表が崩れるので、いちばん長い行に合わせて空欄で埋める
  const width = cleaned.reduce((n, row) => Math.max(n, row.length), 0)
  return {
    header: raw?.header !== false, // 既定は1行目を見出しにする
    rows: cleaned.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]),
  }
}

/** 表の一覧を整える。 */
export function normalizeTables(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 9).map(normalizeTable).filter((t) => t.rows.length > 0)
}

/** 空の表（3列×3行。1行目は見出し）。 */
export function emptyTable() {
  return { header: true, rows: [['', '', ''], ['', '', ''], ['', '', '']] }
}

/**
 * Excel などから貼り付けた文字列を表にする。
 * 行は改行、列はタブで区切られている（表計算ソフトの標準）。
 */
export function tableFromPaste(text) {
  // 改行・タブは文字コードで指定する（この文字を直接書くと編集の途中で壊れやすい）
  const CR = String.fromCharCode(13)
  const NEWLINE = String.fromCharCode(10)
  const TAB = String.fromCharCode(9)

  const lines = String(text ?? '')
    .split(CR)
    .join('')
    .split(NEWLINE)
    .filter((line) => line.length > 0)
  if (!lines.length) return null
  return normalizeTable({ header: true, rows: lines.map((line) => line.split(TAB)) })
}

/**
 * 本文を「文章」と「表」の並びに分ける（表示のため）。
 *
 * @param {Array} segments 下線付きの問題文
 * @param {Array} tables   表の一覧
 * @returns {Array<{type:'text', segments:Array}|{type:'table', table:object, index:number}>}
 */
export function splitBodyByTables(segments, tables) {
  const list = Array.isArray(tables) ? tables : []
  if (!list.length) return [{ type: 'text', segments: segments ?? [] }]

  const blocks = []
  let buffer = []
  const flush = () => {
    if (buffer.length) blocks.push({ type: 'text', segments: buffer })
    buffer = []
  }

  for (const seg of segments ?? []) {
    const text = seg.text ?? ''
    let last = 0
    // 目印は同じ段落の途中にも入りうるので、1つの segment を切り分けながら進む
    for (const hit of text.matchAll(TABLE_TOKEN)) {
      const before = text.slice(last, hit.index)
      if (before) buffer.push({ ...seg, text: before })
      const index = Number(hit[1]) - 1
      const table = list[index]
      if (table) {
        flush()
        blocks.push({ type: 'table', table, index })
      }
      last = hit.index + hit[0].length
    }
    const rest = text.slice(last)
    if (rest) buffer.push({ ...seg, text: rest })
  }
  flush()
  return blocks.length ? blocks : [{ type: 'text', segments: [] }]
}

/** 本文から目印を取り除く（Excel へ書き出すときなど、表を落とす場面で使う）。 */
export const stripTableTokens = (text) => String(text ?? '').replace(TABLE_TOKEN, '')

/** その問題が表を持っているか（本文に目印が置かれているものだけ数える）。 */
export function usedTableCount(q) {
  if (!q || q.type === QUESTION_TYPES.CLOZE) return 0
  const text = segmentsToText(q.segments)
  let count = 0
  for (const hit of text.matchAll(TABLE_TOKEN)) {
    if ((q.tables ?? [])[Number(hit[1]) - 1]) count += 1
  }
  return count
}

/**
 * 未入力の選択肢・基本事項を落とす。
 *
 * 編集中は「＋ 選択肢を追加」で作った空欄をそのまま保持する必要があるため、
 * 空欄の除去は保存時ではなく「使う直前」に行う（出題・書き出し・詳細表示）。
 * 選択肢を詰めると位置がずれるので、正解のインデックスも合わせて振り直す。
 *
 * @param {Question} q
 * @returns {Question} 空欄が無ければ元のオブジェクトをそのまま返す
 */
export function compactQuestion(q) {
  if (!q || q.type === QUESTION_TYPES.CLOZE) return q

  const keep = []
  ;(q.choices ?? []).forEach((c, i) => {
    if (String(c).trim()) keep.push(i)
  })
  const keyPoints = (q.keyPoints ?? []).filter((k) => String(k).trim())

  const sameChoices = keep.length === (q.choices ?? []).length
  const sameKeyPoints = keyPoints.length === (q.keyPoints ?? []).length
  if (sameChoices && sameKeyPoints) return q

  const choices = keep.map((i) => q.choices[i])
  const correctIndexes = (q.correctIndexes ?? [])
    .map((i) => keep.indexOf(i))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)

  return {
    ...q,
    choices,
    correctIndexes,
    correctIndex: correctIndexes[0] ?? 0,
    keyPoints,
  }
}

/** 同梱の問題（初期プールの種。group はグループ名の文字列）。 */
export const SEED_QUESTIONS = RAW_QUESTIONS

/**
 * 問題を一意に識別する安定キー（問題文の全文）。
 * 学習記録・ブックマーク・メモの保存キーとして使う。
 * 問題番号ではなく内容ベースにすることで、Excel の差し替えや
 * 並び替えがあっても同じ問題の記録を引き継げる。
 *
 * @param {Question} q
 * @returns {string}
 */
/** 段落の区切り（改行）とキー内の区切り。エスケープを使わず定義する。 */
const PARA_SEP = String.fromCharCode(10)
const KEY_SEP = String.fromCharCode(31)

export const questionKey = (q) => {
  // 虫食いは segments を持たないため、見出しと本文からキーを作る。
  // 接頭辞を付けて選択式のキーと衝突しないようにする。
  if (q?.type === QUESTION_TYPES.CLOZE) {
    const body = (q.paras ?? [])
      .map((para) => (para ?? []).map((r) => r.text).join(''))
      .join(PARA_SEP)
    return `cloze:${q.title ?? ''}${KEY_SEP}${body}`
  }
  return (q?.segments ?? []).map((s) => s.text).join('')
}

/** 虫食い問題か。 */
export const isCloze = (q) => q?.type === QUESTION_TYPES.CLOZE

/** 採点の対象になる問題か（虫食いは常に対象外）。 */
export const isGraded = (q) => !isCloze(q)

/** 一覧・演習で使う「隠す箇所」の数。 */
export const clozeHiddenCount = (q) => (isCloze(q) ? hiddenCount(q.paras) : 0)

/** 正解が複数ある（「2つ選べ」形式）か。 */
export const isMultiAnswer = (q) => (q?.correctIndexes?.length ?? 0) > 1

// ---------------------------------------------------------------------------
// 本文の取り出し
//
// 下線（キーワード強調）は 2026-08-26 に全廃した。位置で下線を持つ仕組み
// （segmentsToMarks / buildSegmentsFromMarks / underlineKeywords）も一緒に外している。
// ---------------------------------------------------------------------------

/** segments を素のテキストへ。 */
export const segmentsToText = (segments) =>
  (segments ?? []).map((s) => s.text).join('')

/** 素のテキストから segments を作る。 */
export const segmentsFromText = (text) => [{ text: String(text ?? '') }]
