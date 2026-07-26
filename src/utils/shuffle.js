/**
 * 並び順のランダム化ユーティリティ。
 *
 * 選択肢は「順序を表す配列（order）」を作り、それを使って choices と
 * correctIndexes を並び替える2段構え。order を state に持てば、
 * クリックや再レンダーのたびに並びが変わってしまうのを防げる。
 */

/** 配列をランダムに並べ替えた新しい配列を返す（Fisher–Yates シャッフル）。 */
export function shuffled(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 0..n-1 をランダムに並べた配列を返す。
 * @param {number} n
 * @returns {number[]}
 */
export function makeOrder(n) {
  return shuffled(Array.from({ length: n }, (_, i) => i))
}

/**
 * order に従って問題の選択肢を並び替え、正解位置を新しい位置へ写した
 * 「表示用の問題オブジェクト」を返す。問題文・解説・基本事項は変更しない。
 *
 * @param {import('../data/questions').Question} question
 * @param {number[]} order 表示順（各要素は元の choices インデックス）
 * @returns {import('../data/questions').Question}
 */
export function reorderQuestion(question, order) {
  // order が choices と噛み合わない場合（データ差し替え直後など）は元のまま返す
  if (!question) return question
  if (!order || order.length !== question.choices.length) return question

  const correctIndexes = (question.correctIndexes ?? [])
    .map((ci) => order.indexOf(ci))
    .filter((i) => i !== -1)
    .sort((a, b) => a - b)

  return {
    ...question,
    choices: order.map((i) => question.choices[i]),
    correctIndexes,
    correctIndex: correctIndexes[0] ?? 0,
  }
}
