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
    ? raw.choices.map((c) => toText(c, LIMITS.TEXT_CHARS)).slice(0, 5)
    : []

  const segments = Array.isArray(raw.segments) && raw.segments.length
    ? raw.segments.map((s) => ({
        text: toText(s?.text, LIMITS.TEXT_CHARS),
        u: s?.u === true,
      }))
    : [{ text: toText(raw.question, LIMITS.TEXT_CHARS), u: false }]

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
    explanation: toText(raw.explanation, LIMITS.TEXT_CHARS),
    // 基本事項も選択肢と同じ理由で空欄を残す
    keyPoints: Array.isArray(raw.keyPoints)
      ? raw.keyPoints.map((k) => toText(k, LIMITS.TEXT_CHARS)).slice(0, 20)
      : [],
    imageUrl: sanitizeImageUrl(raw.imageUrl),
  }
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
// 下線（キーワード強調）の相互変換
//
// エディタ側は「素のテキスト＋下線範囲」で保持し、保存・出題時は segments に
// 変換する。範囲（位置）で持つことで、同じ語句が複数回出てくる問題文でも
// 意図した箇所だけに下線を引ける（キーワード文字列の一致では誤爆する）。
// ---------------------------------------------------------------------------

/** segments を素のテキストへ。 */
export const segmentsToText = (segments) =>
  (segments ?? []).map((s) => s.text).join('')

/** segments から下線範囲（[{start,end}]）を取り出す。 */
export function segmentsToMarks(segments) {
  const marks = []
  let pos = 0
  for (const seg of segments ?? []) {
    const len = seg.text.length
    if (seg.u && len > 0) marks.push({ start: pos, end: pos + len })
    pos += len
  }
  return marks
}

/** 重なり・隣接した範囲をまとめ、開始位置で整列する。 */
export function normalizeMarks(marks, textLength) {
  const cleaned = (marks ?? [])
    .map((m) => ({
      start: Math.max(0, Math.min(textLength, Math.floor(m.start))),
      end: Math.max(0, Math.min(textLength, Math.floor(m.end))),
    }))
    .filter((m) => m.end > m.start)
    .sort((a, b) => a.start - b.start)

  const merged = []
  for (const m of cleaned) {
    const last = merged[merged.length - 1]
    if (last && m.start <= last.end) last.end = Math.max(last.end, m.end)
    else merged.push({ ...m })
  }
  return merged
}

/** 素のテキストと下線範囲から segments を組み立てる（隣接する同種は結合）。 */
export function buildSegmentsFromMarks(text, marks) {
  const src = String(text ?? '')
  if (!src) return [{ text: '', u: false }]

  const ranges = normalizeMarks(marks, src.length)
  const segments = []
  let pos = 0
  for (const m of ranges) {
    if (m.start > pos) segments.push({ text: src.slice(pos, m.start), u: false })
    segments.push({ text: src.slice(m.start, m.end), u: true })
    pos = m.end
  }
  if (pos < src.length) segments.push({ text: src.slice(pos), u: false })

  // 空要素を捨て、隣接する同種を結合する
  const out = []
  for (const seg of segments) {
    if (!seg.text) continue
    const last = out[out.length - 1]
    if (last && last.u === seg.u) last.text += seg.text
    else out.push({ ...seg })
  }
  return out.length ? out : [{ text: src, u: false }]
}

/** 下線が引かれた語句の一覧（Excel の「下線キーワード」列に対応）。 */
export const underlineKeywords = (segments) =>
  (segments ?? []).filter((s) => s.u && s.text).map((s) => s.text)
