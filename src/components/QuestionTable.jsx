import { COLORS } from '../constants'

/**
 * 問題文の中に置く表。
 *
 * 演習・設問一覧・プレビューで**同じ見た目**にする（同じ問題が場所によって
 * 違って見えると、作った人が確認できない）。
 * 狭い画面では表だけを横にスクロールさせる。ページ全体が横に伸びると、
 * 本文まで読みづらくなるため。
 */
export default function QuestionTable({ table, compact = false }) {
  const rows = table?.rows ?? []
  if (!rows.length) return null

  const header = table.header === true
  const cell = {
    border: `1px solid ${COLORS.rowBorder}`,
    padding: compact ? '6px 8px' : '8px 12px',
    fontSize: compact ? '13px' : '14px',
    lineHeight: 1.7,
    color: COLORS.body,
    textAlign: 'left',
    verticalAlign: 'top',
    overflowWrap: 'anywhere',
  }

  return (
    <div
      style={{
        margin: '14px 0',
        // 表だけを横にスクロールさせる（本文の折り返しは変えない）
        overflowX: 'auto',
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: '12px',
        background: COLORS.card,
      }}
    >
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: rows[0].length > 3 ? '520px' : 'auto',
        }}
      >
        <tbody>
          {rows.map((row, ri) => {
            const isHead = header && ri === 0
            return (
              <tr key={ri}>
                {row.map((text, ci) =>
                  isHead ? (
                    <th
                      key={ci}
                      scope="col"
                      style={{
                        ...cell,
                        fontWeight: 700,
                        color: COLORS.text,
                        background: COLORS.bg,
                      }}
                    >
                      {text}
                    </th>
                  ) : (
                    <td key={ci} style={cell}>
                      {text}
                    </td>
                  ),
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
