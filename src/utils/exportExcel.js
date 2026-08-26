import { EXPORT_COLUMNS, LETTERS } from '../constants'
import { dateKey } from './safe'
import { compactQuestion, segmentsToText } from '../data/questions'

/**
 * 問題データを Excel（.xlsx）へ書き出す。
 *
 * 列は SPEC の EXPORT_COLUMNS の順序・見出し文字列のとおりに出す。
 * 読み込み側（parseExcel.js）がそのまま解釈できる形にそろえてあり、
 * 「書き出し → 読み込み」で内容が往復する。
 *
 * xlsx ライブラリは重いため、実行時に動的 import する。
 */

/** 1問を書き出し用の1行（列名→値）へ変換する。 */
export function questionToRow(question) {
  // 未入力の選択肢・基本事項は書き出さない
  const q = compactQuestion(question)
  const choices = q.choices ?? []
  const row = {
    問題番号: q.questionNumber ?? '',
    問題文: segmentsToText(q.segments),
    // 複数箇所ある場合は改行区切り（読み込み側は改行でも「、」でも分割できる）
    // 下線は全廃したので常に空。列そのものは残す（既存のファイルと形をそろえるため）
    下線キーワード: '',
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

/**
 * ファイル名。例: 2026-08-20_循環器_20問.xlsx / 2026-08-20_quizmake_120問.xlsx
 *
 * 日付を先頭に置くと、ダウンロードフォルダで名前順に並べたときに時系列になる。
 * グループ名を入れるのは、複数のグループを書き出したときに区別が付かないため。
 */
export function exportFileName(count, groupName) {
  // ファイル名に使えない文字は落とす
  const safe = String(groupName ?? '').replace(/[/:*?"<>|\\]/g, '').trim()
  return `${dateKey()}_${safe || 'quizmake'}_${count}問.xlsx`
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
