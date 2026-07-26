import { useRef, useState } from 'react'
import { COLORS, LIMITS } from '../constants'
import { parseImport } from '../storage/store'
import { dateKey } from '../utils/safe'

const smallButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.body,
  fontSize: '13px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
}

/**
 * 学習データの書き出し・読み込み。
 *
 * 保存先はブラウザの localStorage のみなので、
 * 端末の移行やバックアップのために JSON で入出力できるようにする。
 */
export default function DataManager({ onExport, onImport }) {
  const inputRef = useRef(null)
  const [message, setMessage] = useState(null) // { type: 'ok'|'error', text: string }

  const handleExport = () => {
    try {
      const json = onExport()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quizmake-study-data-${dateKey()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // オブジェクトURLは使い終わったら解放する
      setTimeout(() => URL.revokeObjectURL(url), 0)
      setMessage({ type: 'ok', text: '学習データを書き出しました。' })
    } catch {
      setMessage({ type: 'error', text: '書き出しに失敗しました。' })
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを選び直せるようにする
    if (!file) return
    setMessage(null)

    try {
      if (file.size > LIMITS.IMPORT_BYTES) {
        throw new Error('ファイルが大きすぎます（8MBまで）。')
      }
      const text = await file.text()
      const incoming = parseImport(text)

      const merge = window.confirm(
        '読み込んだ学習データをどう反映しますか？\n\n' +
          '［OK］ 今のデータに統合する（回答数を合算）\n' +
          '［キャンセル］ 今のデータを置き換える',
      )
      if (!merge) {
        const sure = window.confirm(
          '置き換えると、今の端末に保存されている学習記録（正答率・ブックマーク・メモ）は失われます。\n続行しますか？',
        )
        if (!sure) {
          setMessage({ type: 'ok', text: '読み込みを中止しました。' })
          return
        }
      }

      onImport(incoming, { merge })
      const count = Object.keys(incoming.records).length
      setMessage({
        type: 'ok',
        text: `学習データを${merge ? '統合' : '置き換え'}しました（記録 ${count} 件）。`,
      })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '読み込みに失敗しました。',
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" style={smallButton} onClick={handleExport} title="学習データをJSONで保存">
          <span style={{ fontSize: '14px', lineHeight: 1 }}>&#11015;</span> 書き出し
        </button>
        <button
          type="button"
          style={smallButton}
          onClick={() => inputRef.current?.click()}
          title="書き出したJSONを読み込む"
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>&#11014;</span> 読み込み
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>
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
