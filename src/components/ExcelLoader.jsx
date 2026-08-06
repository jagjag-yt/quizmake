import { useRef, useState } from 'react'
import { COLORS, LIMITS, TAP_MIN } from '../constants'
import { useCanHover } from '../hooks/useMediaQuery'
import { parseWorkbook } from '../utils/parseExcel'

/**
 * Excel（.xlsx / .xls）読み込みボタン。
 * 選択されたファイルをパースし、成功時は onLoad(questions) を呼ぶ。
 * 失敗時はボタン下にエラーメッセージ（原因と行番号）を表示する。
 */
export default function ExcelLoader({ onLoad }) {
  const inputRef = useRef(null)
  const [hover, setHover] = useState(false)
  const canHover = useCanHover()
  const [message, setMessage] = useState(null) // { type: 'ok'|'error', text }
  const [busy, setBusy] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを選び直せるようにする
    if (!file) return

    setMessage(null)
    setBusy(true)
    try {
      if (file.size > LIMITS.EXCEL_BYTES) {
        throw new Error('ファイルが大きすぎます（15MBまで）。')
      }
      const buffer = await file.arrayBuffer()
      const questions = await parseWorkbook(buffer)
      if (!questions.length) throw new Error('有効な問題が1件も見つかりませんでした。')
      onLoad(questions)
      setMessage({ type: 'ok', text: `${questions.length}問を読み込みました。` })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '読み込みに失敗しました。',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={busy}
        title="自作の問題集（Excel）を読み込みます"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: `${TAP_MIN - 8}px`,
          padding: '8px 16px',
          borderRadius: '10px',
          border: `1px solid ${COLORS.blue}`,
          background: hover && canHover && !busy ? COLORS.blue : COLORS.blueLight,
          color: hover && canHover && !busy ? '#ffffff' : COLORS.blue,
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: busy ? 'progress' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ fontSize: '15px', lineHeight: 1 }}>&#128196;</span>
        {busy ? '読み込み中…' : 'Excelを読み込む'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      {message && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            maxWidth: '360px',
            color: message.type === 'error' ? COLORS.red : COLORS.green,
          }}
        >
          {message.text}
        </span>
      )}
    </div>
  )
}
