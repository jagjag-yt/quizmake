import { useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { COLORS, LIMITS, TAP_MIN } from '../constants'
import { parseImport } from '../storage/store'
import { parseWorkbook } from '../utils/parseExcel'
import { dateKey } from '../utils/safe'

/**
 * 問題と学習データの受け渡し。
 *
 * 「書き出す」「読み込む」の2つだけを見せ、Excel かバックアップ（JSON）かは
 * 書き出しのときに選ぶ。読み込みは選ばれたファイルの拡張子で振り分けるので、
 * 利用者が形式を意識する必要はない。
 */

const buttonBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  minHeight: `${TAP_MIN - 8}px`,
  padding: '8px 16px',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
}

const optionButton = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '2px',
  width: '100%',
  minHeight: `${TAP_MIN}px`,
  padding: '10px 12px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  textAlign: 'left',
  fontFamily: 'inherit',
  cursor: 'pointer',
}

/**
 * 読み込み用の隠しファイル入力。
 *
 * 画面のどこからでも「読み込む」を押せるように、ボタンとは切り離して
 * アプリに常設する。拡張子で Excel（問題）と JSON（学習データ）を振り分ける。
 */
export function TransferInput({ inputRef, onLoadQuestions, onImportStudyData, onNotify }) {
  // 統合か置き換えかは window.confirm ではなくアプリ内のダイアログで選ぶ
  const [pending, setPending] = useState(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを選び直せるようにする
    if (!file) return

    const isJson = /\.json$/i.test(file.name)
    try {
      if (isJson) {
        if (file.size > LIMITS.IMPORT_BYTES) {
          throw new Error('ファイルが大きすぎます（8MBまで）。')
        }
        setPending(parseImport(await file.text()))
        return
      }

      if (file.size > LIMITS.EXCEL_BYTES) {
        throw new Error('ファイルが大きすぎます（15MBまで）。')
      }
      const questions = await parseWorkbook(await file.arrayBuffer())
      if (!questions.length) throw new Error('有効な問題が1件も見つかりませんでした。')
      // 1ファイル＝1グループ。拡張子を除いたファイル名をグループ名にする
      onLoadQuestions(questions, file.name.replace(/\.[^.]+$/, ''))
    } catch (err) {
      onNotify({
        tone: 'error',
        title: '読み込めませんでした',
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  const apply = (merge) => {
    onImportStudyData(pending, { merge })
    onNotify({
      tone: 'success',
      title: `学習データを${merge ? '統合' : '置き換え'}しました`,
      description: `記録 ${Object.keys(pending.records).length} 件`,
    })
    setPending(null)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.json"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      {pending && (
        <ConfirmDialog
          title="読み込んだ学習データをどう反映しますか？"
          message={`記録 ${Object.keys(pending.records).length} 件。「統合する」は回答数を合算します。「置き換える」を選ぶと、いまの端末の学習記録（正答率・ブックマーク・メモ）は失われます。`}
          cancelLabel="置き換える"
          confirmLabel="統合する"
          danger={false}
          onCancel={() => apply(false)}
          onConfirm={() => apply(true)}
        />
      )}
    </>
  )
}

/**
 * 「書き出す」「読み込む」のボタン。
 * 書き出しは押してから形式（Excel / バックアップ）を選ぶ。
 */
export default function DataTransfer({ getStudyJson, onExportExcel, onImportClick, onNotify }) {
  const [formatOpen, setFormatOpen] = useState(false)
  const panelRef = useRef(null)

  const exportBackup = () => {
    setFormatOpen(false)
    try {
      const blob = new Blob([getStudyJson()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quizmake-backup-${dateKey()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // オブジェクトURLは使い終わったら解放する
      setTimeout(() => URL.revokeObjectURL(url), 0)
      onNotify({
        tone: 'success',
        title: 'バックアップを書き出しました',
        description: 'ダウンロードフォルダに保存されました',
      })
    } catch {
      onNotify({ tone: 'error', title: '書き出しに失敗しました' })
    }
  }

  return (
    <div ref={panelRef} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => setFormatOpen((v) => !v)}
          aria-expanded={formatOpen}
          style={{
            ...buttonBase,
            flex: 1,
            border: `1px solid ${formatOpen ? COLORS.blue : COLORS.border}`,
            background: formatOpen ? COLORS.blueLight : COLORS.card,
            color: formatOpen ? COLORS.blue : COLORS.body,
          }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>&#11015;</span> 書き出す
        </button>
        <button
          type="button"
          onClick={() => {
            setFormatOpen(false)
            onImportClick()
          }}
          style={{
            ...buttonBase,
            flex: 1,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            color: COLORS.body,
          }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>&#11014;</span> 読み込む
        </button>
      </div>

      {formatOpen && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px',
            borderRadius: '12px',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
          }}
        >
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.sub }}>
            書き出す形式を選んでください
          </span>
          <button
            type="button"
            onClick={() => {
              setFormatOpen(false)
              onExportExcel()
            }}
            style={optionButton}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
              Excel（.xlsx）
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 400, color: COLORS.sub, lineHeight: 1.6 }}>
              問題を表計算ソフトで編集できる形式で。虫食いは含まれません
            </span>
          </button>
          <button type="button" onClick={exportBackup} style={optionButton}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
              バックアップ（.json）
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 400, color: COLORS.sub, lineHeight: 1.6 }}>
              学習記録（正答率・ブックマーク・メモ）を保存
            </span>
          </button>
        </div>
      )}

      <span style={{ fontSize: '11px', color: COLORS.muted, textAlign: 'center', lineHeight: 1.6 }}>
        読み込みは .xlsx / .json のどちらでも選べます
      </span>
    </div>
  )
}
