import { useEffect, useRef, useState } from 'react'
import { COLORS, TAP_MIN } from '../constants'

/**
 * 確認ダイアログ。
 *
 * window.confirm はブラウザや PWA の設定によっては表示されず、押しても
 * 何も起きないように見えてしまう。取り消せない操作の確認は、この
 * アプリ内のダイアログで行う。
 *
 * @param {{
 *   title: string, message?: React.ReactNode,
 *   confirmLabel?: string, cancelLabel?: string,
 *   danger?: boolean,
 *   onConfirm: () => void, onCancel: () => void,
 * }} props
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = '削除する',
  cancelLabel = 'キャンセル',
  danger = true,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    // 取り消せない操作なので、初期フォーカスは「キャンセル」に置く
    cancelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const button = (primary) => ({
    minHeight: `${TAP_MIN}px`,
    padding: '0 18px',
    borderRadius: '12px',
    border: `1px solid ${primary ? (danger ? COLORS.red : COLORS.blue) : COLORS.border}`,
    background: primary ? (danger ? COLORS.red : COLORS.blue) : COLORS.card,
    color: primary ? '#ffffff' : COLORS.body,
    fontSize: '13.5px',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  })

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 61,
          width: 'min(440px, calc(100vw - 40px))',
          background: COLORS.card,
          borderRadius: '20px',
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow: '0 16px 40px rgba(15,23,42,0.24)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
          {title}
        </h2>
        {message && (
          <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.8, color: COLORS.sub }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button ref={cancelRef} type="button" onClick={onCancel} style={button(false)}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} style={button(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * 名前を入力させるダイアログ（window.prompt の置き換え）。
 *
 * @param {{
 *   title: string, label?: string, defaultValue?: string, placeholder?: string,
 *   confirmLabel?: string, maxLength?: number,
 *   onConfirm: (value: string) => void, onCancel: () => void,
 * }} props
 */
export function PromptDialog({
  title,
  label,
  defaultValue = '',
  placeholder = '',
  confirmLabel = '決定',
  maxLength = 60,
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const ready = value.trim().length > 0
  const submit = () => {
    if (ready) onConfirm(value.trim())
  }

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 61,
          width: 'min(440px, calc(100vw - 40px))',
          background: COLORS.card,
          borderRadius: '20px',
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow: '0 16px 40px rgba(15,23,42,0.24)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
          {title}
        </h2>
        {label && (
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub }}>{label}</span>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder={placeholder}
          data-shortcut-ignore="true"
          style={{
            minHeight: `${TAP_MIN}px`,
            width: '100%',
            padding: '10px 12px',
            borderRadius: '10px',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            color: COLORS.text,
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              minHeight: `${TAP_MIN}px`,
              padding: '0 18px',
              borderRadius: '12px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.body,
              fontSize: '13.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            style={{
              minHeight: `${TAP_MIN}px`,
              padding: '0 18px',
              borderRadius: '12px',
              border: `1px solid ${ready ? COLORS.blue : COLORS.border}`,
              background: ready ? COLORS.blue : COLORS.chipTrack,
              color: ready ? '#ffffff' : COLORS.dashed,
              fontSize: '13.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: ready ? 'pointer' : 'default',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
