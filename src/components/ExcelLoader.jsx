import { useRef, useState } from 'react'
import { parseWorkbook } from '../utils/parseExcel'

/**
 * Excel（.xlsx / .xls）読み込みボタン。
 * 選択されたファイルをパースし、成功時は onLoad(questions, fileName) を呼ぶ。
 * 失敗時はボタン下にエラーメッセージを表示する。
 *
 * @param {{ onLoad: (questions: import('../data/questions').Question[], fileName: string) => void }} props
 */
export default function ExcelLoader({ onLoad }) {
  const inputRef = useRef(null)
  const [hover, setHover] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const buffer = await file.arrayBuffer()
      const questions = await parseWorkbook(buffer)
      if (!questions.length) throw new Error('有効な問題が1件も見つかりませんでした。')
      onLoad(questions, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました。')
    } finally {
      // 同じファイルを連続選択しても onChange が発火するようリセット
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '10px',
          border: '1px solid #2563eb',
          background: hover ? '#2563eb' : '#eff6ff',
          color: hover ? '#ffffff' : '#2563eb',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ fontSize: '15px', lineHeight: 1 }}>&#128196;</span>
        Excelを読み込む
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      {error && (
        <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, maxWidth: '360px' }}>
          {error}
        </span>
      )}
    </div>
  )
}
