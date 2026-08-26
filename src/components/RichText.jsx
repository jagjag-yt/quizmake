import { splitTextByTables } from '../data/questions'
import MathText from './MathText'
import QuestionTable from './QuestionTable'

/**
 * 解説・基本事項の1本を描く。
 *
 * 問題文と同じ目印 `[[表N]]` をそのまま使い、置かれたところに表を出す
 * （表そのものは問題ごとの `tables` にあり、本文・解説・基本事項で共有する）。
 * 数式（$…$）も本文と同じ扱いにするため、文章の側は MathText に通す。
 *
 * @param {{
 *   text: string,
 *   tables: Array,
 *   style: object,   文章の段落に当てるスタイル（呼び出し側の見た目をそのまま使う）
 * }} props
 */
export default function RichText({ text, tables, style }) {
  const blocks = splitTextByTables(text, tables)

  // 表が無いときは段落1つ。囲いを増やすと余白が変わってしまう
  if (blocks.length === 1 && blocks[0].type === 'text') {
    return (
      <p style={style}>
        <MathText text={blocks[0].text} />
      </p>
    )
  }

  return (
    <div>
      {blocks.map((block, i) =>
        block.type === 'table' ? (
          <QuestionTable key={i} table={block.table} />
        ) : (
          <p key={i} style={style}>
            <MathText text={block.text} />
          </p>
        ),
      )}
    </div>
  )
}
