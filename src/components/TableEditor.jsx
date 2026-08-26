import { useRef, useState } from 'react'
import { COLORS, TAP_MIN } from '../constants'
import { TABLE_LIMITS, tableFromPaste } from '../data/questions'
import AutoTextarea from './AutoTextarea'

/**
 * 問題文・解説・基本事項に入れる表の編集。
 *
 * カードは**目印を置いた欄のすぐ下**に出る（EditorView が振り分ける）。
 *
 * 入れ方は2通り。
 *   ・Excel などから範囲をコピーして貼り付ける（行はそのまま、列はタブで分かれる）
 *   ・1マスずつ手で入力し、行と列を足し引きする
 * 過去問はすでに Excel にあることが多いので、貼り付けを先に置く。
 *
 * 表そのものは `{ header, rows }`。行ごとの列数は必ず揃える（崩れた表は直せない）。
 */

const smallButton = {
  minHeight: '32px',
  padding: '0 10px',
  borderRadius: '8px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.body,
  fontSize: '12px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/**
 * 1マスの入力欄。
 *
 * **改行を打てるように textarea にしてある**（利用者の要望・2026-08-26）。
 * input のままだと Enter が効かず、1マスを2行に分けられなかった。
 * 高さは中身に合わせて伸ばす（AutoTextarea）。
 */
const cellInput = {
  display: 'block',
  width: '100%',
  minWidth: '90px',
  minHeight: '34px',
  padding: '6px 8px',
  border: 'none',
  background: 'transparent',
  color: COLORS.text,
  fontSize: '13px',
  lineHeight: 1.6,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

/** 行や列の増減。上限を超えたら何もしない。 */
function withSize(table, { rows = 0, cols = 0 }) {
  const width = table.rows[0]?.length ?? 0
  const height = table.rows.length
  const nextHeight = Math.min(TABLE_LIMITS.ROWS, Math.max(1, height + rows))
  const nextWidth = Math.min(TABLE_LIMITS.COLS, Math.max(1, width + cols))

  const next = []
  for (let r = 0; r < nextHeight; r += 1) {
    const row = []
    for (let c = 0; c < nextWidth; c += 1) row.push(table.rows[r]?.[c] ?? '')
    next.push(row)
  }
  return { ...table, rows: next }
}

/**
 * @param {{
 *   table: {header: boolean, rows: string[][]},
 *   label: string,
 *   placed: boolean,
 *   onChange: (table: object) => void,
 *   onRemove: () => void,
 *   onInsertToken: () => void,
 * }} props
 */
export default function TableEditor({ table, label, placed, onChange, onRemove, onInsertToken }) {
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const pasteRef = useRef(null)

  const width = table.rows[0]?.length ?? 0

  const setCell = (r, c, value) => {
    const rows = table.rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row,
    )
    onChange({ ...table, rows })
  }

  const applyPaste = (text) => {
    const parsed = tableFromPaste(text)
    if (!parsed) return
    onChange({ ...parsed, header: table.header })
    setPasteText('')
    setPasteOpen(false)
  }

  return (
    <div
      style={{
        border: `1px solid ${placed ? COLORS.cardBorder : COLORS.amber}`,
        borderRadius: '12px',
        background: COLORS.bg,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{label}</span>
        <span style={{ fontSize: '11.5px', color: COLORS.muted }}>
          {table.rows.length}行 × {width}列
        </span>
        {!placed && (
          <button type="button" onClick={onInsertToken} style={{ ...smallButton, borderColor: COLORS.amber, color: COLORS.amberDark }}>
            問題文に入れる
          </button>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPasteOpen((v) => !v)} style={smallButton}>
            Excelから貼り付け
          </button>
          <button type="button" onClick={onRemove} style={{ ...smallButton, color: COLORS.red }}>
            表を削除
          </button>
        </span>
      </div>

      {!placed && (
        <p style={{ margin: 0, fontSize: '11.5px', color: COLORS.amberDark, lineHeight: 1.7 }}>
          この表はどこにも置かれていません（{label}の目印が問題文・解説・基本事項のどれにもありません）。
          「問題文に入れる」を押すと、問題文の末尾に目印を足します。
        </p>
      )}

      {pasteOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <textarea
            ref={pasteRef}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData?.getData('text/plain')
              if (!text) return
              e.preventDefault()
              applyPaste(text)
            }}
            rows={3}
            data-shortcut-ignore="true"
            placeholder="ここに Excel の範囲をそのまま貼り付けてください（行と列がそのまま入ります）"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.text,
              fontSize: '12.5px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => applyPaste(pasteText)} style={smallButton}>
              この内容にする
            </button>
            <span style={{ fontSize: '11px', color: COLORS.muted, lineHeight: 1.7 }}>
              いまの表は置き換わります。{TABLE_LIMITS.ROWS}行 × {TABLE_LIMITS.COLS}列まで。
            </span>
          </div>
        </div>
      )}

      {/* 表そのもの（1マスずつ直せる） */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', background: COLORS.card }}>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    style={{
                      border: `1px solid ${COLORS.rowBorder}`,
                      padding: 0,
                      background: table.header && r === 0 ? COLORS.bg : COLORS.card,
                    }}
                  >
                    <AutoTextarea
                      value={cell}
                      minRows={1}
                      onChange={(e) => setCell(r, c, e.target.value.slice(0, TABLE_LIMITS.CELL_CHARS))}
                      data-shortcut-ignore="true"
                      aria-label={`${r + 1}行${c + 1}列`}
                      style={{
                        ...cellInput,
                        fontWeight: table.header && r === 0 ? 700 : 400,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onChange(withSize(table, { rows: 1 }))} style={smallButton}>
          ＋ 行
        </button>
        <button type="button" onClick={() => onChange(withSize(table, { rows: -1 }))} style={smallButton}>
          − 行
        </button>
        <button type="button" onClick={() => onChange(withSize(table, { cols: 1 }))} style={smallButton}>
          ＋ 列
        </button>
        <button type="button" onClick={() => onChange(withSize(table, { cols: -1 }))} style={smallButton}>
          − 列
        </button>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: `${TAP_MIN - 12}px`,
            marginLeft: 'auto',
            fontSize: '12px',
            color: COLORS.sub,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={table.header === true}
            onChange={(e) => onChange({ ...table, header: e.target.checked })}
          />
          1行目を見出しにする
        </label>
      </div>
    </div>
  )
}
