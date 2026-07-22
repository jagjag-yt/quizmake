/**
 * 問題データ。
 *
 * Excel 等の外部データ読み込みへ拡張する際は、この構造をそのまま
 * 1レコード（1行）のスキーマとして利用できる。
 *
 * @typedef {Object} Question
 * @property {number}   questionNumber  問題番号
 * @property {Array<{text: string, u: boolean}>} segments
 *   問題文を「下線キーワードの区切り」で分割した配列。u: true の箇所に下線（強調）。
 * @property {string[]} choices         選択肢（最大5件、a〜eに対応。順序＝配列順）
 * @property {number}   correctIndex    choices 内の正解インデックス
 * @property {string}   explanation     解説文
 * @property {string[]} keyPoints       「基本事項」の箇条書き
 */

/** @type {Question[]} */
export const QUESTIONS = [
  {
    questionNumber: 1,
    segments: [
      { text: '急性心筋梗塞の発症直後（', u: false },
      { text: '超急性期', u: true },
      { text: '）にみられる', u: false },
      { text: '心電図変化', u: true },
      { text: 'として、最も特徴的なのはどれか。', u: false },
    ],
    choices: ['ST上昇', '異常Q波の出現', 'T波の陰転化', 'PQ間隔の延長', 'U波の出現'],
    correctIndex: 0,
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
    correctIndex: 2,
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
    correctIndex: 2,
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
    correctIndex: 0,
    explanation:
      'アミノグリコシド系抗菌薬は腎尿細管への蓄積による腎障害と、内耳への蓄積による第8脳神経障害（聴力障害・平衡障害）が代表的な副作用である。',
    keyPoints: [
      '腎機能と聴力のモニタリングが投与中に重要',
      '血中濃度モニタリング（TDM）の対象薬',
      '高齢者・腎機能低下患者では特に注意',
    ],
  },
]

export const LETTERS = ['a', 'b', 'c', 'd', 'e']
