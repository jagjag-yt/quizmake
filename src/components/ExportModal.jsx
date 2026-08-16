import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, EXPORT_COLUMNS, ORIGIN, TAP_MIN } from '../constants'
import { isGraded } from '../data/questions'
import { validateQuestion } from '../hooks/useQuestionPool'

/** 指標タイル。 */
function Stat({ label, value }) {
  return (
    <div
      style={{
        flex: '1 1 160px',
        padding: '16px 18px',
        borderRadius: '14px',
        background: COLORS.bg,
        border: `1px solid ${COLORS.cardBorder}`,
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.sub }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.text, lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  )
}

/**
 * Excel 書き出し前の確認ダイアログ。
 * 対象範囲の選択と、不備のある問題の警告を出してから書き出す。
 */
export default function ExportModal({ questions, groups = [], onClose, onExport }) {
  const [scope, setScope] = useState('all')
  const dialogRef = useRef(null)

  // 虫食いは Excel に書き出さない（SPEC R4）
  const exportable = useMemo(() => questions.filter(isGraded), [questions])
  const excludedCount = questions.length - exportable.length
  const authored = useMemo(
    () => exportable.filter((q) => q.origin === ORIGIN.AUTHORED),
    [exportable],
  )
  const target =
    scope === 'authored'
      ? authored
      : scope.startsWith('group:')
        ? exportable.filter((q) => q.groupId === scope.slice(6))
        : exportable
  const scopeGroupName =
    scope.startsWith('group:') ? groups.find((g) => g.id === scope.slice(6))?.name : ''

  const invalid = useMemo(
    () =>
      target
        .map((q) => ({ q, errors: validateQuestion(q) }))
        .filter((x) => x.errors.length > 0),
    [target],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 55 }} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Excelに書き出す"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 56,
          width: 'min(620px, calc(100vw - 40px))',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: COLORS.card,
          borderRadius: '20px',
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow: '0 16px 40px rgba(15,23,42,0.24)',
          padding: '28px',
        }}
      >
        <h2 style={{ margin: '0 0 18px 0', fontSize: '18px', fontWeight: 700, color: COLORS.text }}>
          Excelに書き出す
        </h2>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Stat label="書き出す問題" value={`${target.length} 問`} />
          <Stat label={excludedCount ? '対象外' : 'うち作成分'} value={`${excludedCount || authored.length} 問`} />
        </div>

        {excludedCount > 0 && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              borderRadius: '14px',
              background: COLORS.chipTrack,
              color: COLORS.body,
              fontSize: '12.5px',
              lineHeight: 1.8,
            }}
          >
            虫食い問題 {excludedCount}問は書き出されません。Excelの12列は選択式のための形式のため、虫食いはアプリ内にのみ保存されます（削除はされません）。
          </div>
        )}

        <div
          style={{
            display: 'inline-flex',
            gap: '2px',
            padding: '3px',
            borderRadius: '999px',
            background: COLORS.chipTrack,
            margin: '18px 0',
          }}
        >
          {[
            { key: 'all', text: `全問（${exportable.length}）` },
            { key: 'authored', text: `作成分のみ（${authored.length}）` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setScope(t.key)}
              style={{
                minHeight: '36px',
                padding: '0 16px',
                borderRadius: '999px',
                border: 'none',
                background: scope === t.key ? COLORS.blue : 'transparent',
                color: scope === t.key ? '#ffffff' : COLORS.sub,
                fontSize: '12.5px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {t.text}
            </button>
          ))}
        </div>

        {groups.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub }}>
              グループで絞る
            </span>
            <select
              value={scope.startsWith('group:') ? scope : ''}
              onChange={(e) => setScope(e.target.value || 'all')}
              style={{
                minHeight: '36px',
                padding: '0 10px',
                borderRadius: '10px',
                border: `1px solid ${COLORS.border}`,
                background: COLORS.card,
                color: COLORS.text,
                fontSize: '13px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="">絞らない</option>
              {groups.map((g) => (
                <option key={g.id} value={`group:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {invalid.length > 0 && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              background: COLORS.amberLight,
              border: `1px solid ${COLORS.amber}`,
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: COLORS.amberDark }}>
              ⚠ 不備のある問題が{invalid.length}件あります
            </div>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {invalid.slice(0, 6).map(({ q, errors }) => (
                <li key={q.id} style={{ fontSize: '12.5px', color: COLORS.body }}>
                  問題 {q.questionNumber}：{errors[0]}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: '12px', color: COLORS.body, marginTop: '8px' }}>
              このまま書き出すと該当行は空欄になります。
            </div>
          </div>
        )}

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: COLORS.bg,
            border: `1px solid ${COLORS.cardBorder}`,
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: '11.5px',
            color: COLORS.sub,
            lineHeight: 1.7,
            wordBreak: 'break-all',
          }}
        >
          列：{EXPORT_COLUMNS.join(' / ')}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: `${TAP_MIN}px`,
              padding: '0 18px',
              borderRadius: '12px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.body,
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {invalid.length > 0 ? '不備を修正する' : 'キャンセル'}
          </button>
          <button
            type="button"
            onClick={() => onExport(target, scopeGroupName)}
            disabled={!target.length}
            style={{
              minHeight: `${TAP_MIN}px`,
              padding: '0 20px',
              borderRadius: '12px',
              border: `1px solid ${COLORS.blue}`,
              background: target.length ? COLORS.blue : COLORS.blueLight,
              color: target.length ? '#ffffff' : COLORS.bluePale,
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: target.length ? 'pointer' : 'default',
            }}
          >
            ⬇ {target.length}問を書き出す
          </button>
        </div>
      </div>
    </>
  )
}
