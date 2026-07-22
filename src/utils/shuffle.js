/**
 * 選択肢の表示順ランダム化ユーティリティ。
 *
 * 「順序を表す配列（order）」を作り、それを使って問題の choices と
 * correctIndex を並び替える、という2段構えにしている。order を state に
 * 持てば、クリックや再レンダーのたびに並びが変わってしまうのを防げる。
 */

/**
 * 0..n-1 をランダムに並べた配列を返す（Fisher–Yates シャッフル）。
 * @param {number} n
 * @returns {number[]}
 */
export function makeOrder(n) {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * order に従って問題の選択肢を並び替え、correctIndex を新しい位置へ写した
 * 「表示用の問題オブジェクト」を返す。問題文・解説・基本事項は変更しない。
 *
 * @param {import('../data/questions').Question} question
 * @param {number[]} order 表示順（各要素は元の choices インデックス）
 * @returns {import('../data/questions').Question}
 */
export function reorderQuestion(question, order) {
  // order が choices と噛み合わない場合（データ差し替え直後など）は元のまま返す
  if (!order || order.length !== question.choices.length) return question
  return {
    ...question,
    choices: order.map((i) => question.choices[i]),
    correctIndex: order.indexOf(question.correctIndex),
  }
}
