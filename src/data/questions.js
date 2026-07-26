import { LIMITS } from '../constants'
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
 * @property {string}   subject          科目（絞り込み・成績集計に使用）
 * @property {string[]} tags             タグ（絞り込みに使用）
 * @property {string|null} imageUrl      問題画像（検証済みURLのみ保持）
 */

/** @type {Question[]} */
const RAW_QUESTIONS = [
  {
    questionNumber: 1,
    subject: '循環器',
    tags: ['心電図', '虚血性心疾患'],
    segments: [
      { text: '急性心筋梗塞の発症直後（', u: false },
      { text: '超急性期', u: true },
      { text: '）にみられる', u: false },
      { text: '心電図変化', u: true },
      { text: 'として、最も特徴的なのはどれか。', u: false },
    ],
    choices: ['ST上昇', '異常Q波の出現', 'T波の陰転化', 'PQ間隔の延長', 'U波の出現'],
    correctIndexes: [0],
    explanation:
      '急性心筋梗塞の超急性期には、障害を受けた心筋領域に一致した誘導でST上昇が最初に出現する。異常Q波やT波の陰転化は、より後の時期（急性期〜亜急性期）にみられる所見である。',
    keyPoints: [
      'ST上昇 → 異常Q波 → 陰転化したT波、という経時的変化を覚える',
      'ST上昇は障害心筋に一致した誘導に出現する',
      '異常Q波は不可逆的な心筋壊死を反映する',
    ],
  },
  {
    questionNumber: 2,
    subject: '消化器',
    tags: ['肝臓', '生理学'],
    segments: [
      { text: '肝臓の機能', u: true },
      { text: 'に関する記述のうち、誤っているのはどれか。', u: false },
    ],
    choices: [
      'アルブミンを合成する',
      '胆汁を生成する',
      '胆汁を貯留する',
      'アンモニアを尿素に変換する',
      '薬物を代謝する',
    ],
    correctIndexes: [2],
    explanation:
      '胆汁は肝細胞で生成されるが、貯留し濃縮するのは胆嚢の役割である。肝臓はアルブミン合成、尿素回路によるアンモニア処理、薬物代謝など多彩な機能を担う。',
    keyPoints: [
      '胆汁の生成は肝臓、貯留・濃縮は胆嚢と区別する',
      '肝臓は合成・解毒・代謝の中心臓器',
      'アンモニアは尿素回路で尿素に変換され腎から排泄される',
    ],
  },
  {
    questionNumber: 3,
    subject: '代謝・内分泌',
    tags: ['糖尿病', '検査値'],
    segments: [
      { text: '空腹時血糖値', u: true },
      { text: 'が糖尿病型と判定される基準値はどれか。', u: false },
    ],
    choices: [
      '100 mg/dL以上',
      '110 mg/dL以上',
      '126 mg/dL以上',
      '140 mg/dL以上',
      '200 mg/dL以上',
    ],
    correctIndexes: [2],
    explanation:
      '空腹時血糖値126 mg/dL以上、または75gOGTT2時間値200 mg/dL以上、随時血糖値200 mg/dL以上のいずれかを満たす場合を糖尿病型と判定する。',
    keyPoints: [
      '空腹時血糖126以上／OGTT2時間値200以上／随時血糖200以上のいずれかで糖尿病型',
      '正常型は空腹時110未満かつOGTT2時間値140未満',
      '境界型はそのいずれにも属さない中間域',
    ],
  },
  {
    questionNumber: 4,
    subject: '薬理',
    tags: ['抗菌薬', '副作用'],
    segments: [
      { text: 'アミノグリコシド系抗菌薬', u: true },
      { text: 'で頻度の高い重大な副作用はどれか。', u: false },
    ],
    choices: [
      '腎障害・第8脳神経障害',
      '肝障害',
      '骨髄抑制',
      '光線過敏症',
      '消化管出血',
    ],
    correctIndexes: [0],
    explanation:
      'アミノグリコシド系抗菌薬は腎尿細管への蓄積による腎障害と、内耳への蓄積による第8脳神経障害（聴力障害・平衡障害）が代表的な副作用である。',
    keyPoints: [
      '腎機能と聴力のモニタリングが投与中に重要',
      '血中濃度モニタリング（TDM）の対象薬',
      '高齢者・腎機能低下患者では特に注意',
    ],
  },
]

/**
 * 問題オブジェクトを表示・採点に使える形へ整える。
 * 同梱データと Excel 由来データの差異（欠けた項目・古い形式）をここで吸収する。
 *
 * @param {Partial<Question> & { correctIndex?: number }} raw
 * @param {number} index 0始まりの並び順（問題番号が無いときの採番に使う）
 * @returns {Question}
 */
export function normalizeQuestion(raw, index = 0) {
  const choices = Array.isArray(raw.choices)
    ? raw.choices.map((c) => toText(c, LIMITS.TEXT_CHARS)).filter(Boolean).slice(0, 5)
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

  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map((t) => toText(t, 40)).filter(Boolean))].slice(0, 10)
    : []

  return {
    questionNumber: Number.isFinite(Number(raw.questionNumber))
      ? Number(raw.questionNumber)
      : index + 1,
    segments,
    choices,
    correctIndexes,
    correctIndex: correctIndexes[0] ?? 0,
    explanation: toText(raw.explanation, LIMITS.TEXT_CHARS),
    keyPoints: Array.isArray(raw.keyPoints)
      ? raw.keyPoints.map((k) => toText(k, LIMITS.TEXT_CHARS)).filter(Boolean).slice(0, 20)
      : [],
    subject: toText(raw.subject, 60),
    tags,
    imageUrl: sanitizeImageUrl(raw.imageUrl),
  }
}

/** 同梱の問題（正規化済み）。 */
export const QUESTIONS = RAW_QUESTIONS.map(normalizeQuestion)

/**
 * 問題を一意に識別する安定キー（問題文の全文）。
 * 学習記録・ブックマーク・メモの保存キーとして使う。
 * 問題番号ではなく内容ベースにすることで、Excel の差し替えや
 * 並び替えがあっても同じ問題の記録を引き継げる。
 *
 * @param {Question} q
 * @returns {string}
 */
export const questionKey = (q) => (q?.segments ?? []).map((s) => s.text).join('')

/** 正解が複数ある（「2つ選べ」形式）か。 */
export const isMultiAnswer = (q) => (q?.correctIndexes?.length ?? 0) > 1
