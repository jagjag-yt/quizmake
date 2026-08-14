import { EXPORT_COLUMNS, LETTERS } from '../constants'
import { segmentsToMarks, segmentsToText } from '../data/questions'

/**
 * 問題データを Excel（.xlsx）へ書き出す。
 *
 * 列は SPEC の EXPORT_COLUMNS の順序・見出し文字列のとおりに出す。
 * 読み込み側（parseExcel.js）がそのまま解釈できる形にそろえてあり、
 * 「書き出し → 読み込み」で内容が往復する。
 *
 * xlsx ライブラリは重いため、実行時に動的 import する。
 */

/**
 * 「下線キーワード」列の値を作る。
 *
 * 同じ語句が問題文に複数あり、その一部だけに下線が引かれている場合は
 * 位置指定（`語句@2` = 2番目の出現）で書き出す。すべてに下線がある場合と
 * 1か所しかない場合は、手入力しやすい素の語句のまま書き出す。
 */
export function buildUnderlineColumn(segments) {
  const text = segmentsToText(segments)
  const marks = segmentsToMarks(segments)

  const occurrencesOf = (needle) => {
    const list = []
    let from = 0
    for (;;) {
      const i = text.indexOf(needle, from)
      if (i === -1) break
      list.push(i)
      from = i + needle.length
    }
    return list
  }

  const out = []
  const emittedWholeWord = new Set()

  for (const mark of marks) {
    const word = text.slice(mark.start, mark.end)
    if (!word) continue
    const positions = occurrencesOf(word)
    const underlinedCount = marks.filter(
      (m) => text.slice(m.start, m.end) === word,
    ).length

    // すべての出現箇所に下線が引かれているなら、素の語句1つで表せる
    if (positions.length === underlinedCount) {
      if (!emittedWholeWord.has(word)) {
        out.push(word)
        emittedWholeWord.add(word)
      }
      continue
    }
    const nth = positions.indexOf(mark.start) + 1
    out.push(nth > 0 ? `${word}@${nth}` : word)
  }
  return out
}

/** 1問を書き出し用の1行（列名→値）へ変換する。 */
export function questionToRow(q) {
  const choices = q.choices ?? []
  const row = {
    問題番号: q.questionNumber ?? '',
    // タグ機能は廃止したが、既存ファイルとの互換のため列自体は13列のまま空欄で残す
    タグ: '',
    問題文: segmentsToText(q.segments),
    // 複数箇所ある場合は改行区切り（読み込み側は改行でも「、」でも分割できる）
    下線キーワード: buildUnderlineColumn(q.segments).join('\n'),
    画像URL: q.imageUrl ?? '',
    正解: (q.correctIndexes ?? []).map((i) => LETTERS[i]).filter(Boolean).join(','),
    解説: q.explanation ?? '',
    基本事項: (q.keyPoints ?? []).join('\n'),
  }
  // 選択肢a〜e。存在しない選択肢は空欄にする
  LETTERS.forEach((letter, i) => {
    row[`選択肢${letter}`] = choices[i] ?? ''
  })
  return row
}

/** ファイル名。例: quizmake_120問.xlsx / quizmake_循環器_20問.xlsx */
export function exportFileName(count, groupName) {
  // ファイル名に使えない文字は落とす
  const safe = String(groupName ?? '').replace(/[/:*?"<>|\\]/g, '').trim()
  return safe ? `quizmake_${safe}_${count}問.xlsx` : `quizmake_${count}問.xlsx`
}

/**
 * 書き出しを実行し、ブラウザにダウンロードさせる。
 * @param {import('../data/questions').Question[]} questions
 * @returns {Promise<{ fileName: string, count: number }>}
 */
export async function exportQuestionsToXlsx(questions, { groupName } = {}) {
  const XLSX = await import('xlsx')

  const rows = questions.map(questionToRow)
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS })
  worksheet['!cols'] = [
    { wch: 10 }, { wch: 20 }, { wch: 46 }, { wch: 20 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 8 }, { wch: 50 }, { wch: 44 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '問題')

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const fileName = exportFileName(questions.length, groupName)

  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)

  return { fileName, count: questions.length }
}
