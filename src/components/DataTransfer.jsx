import { useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { COLORS, LIMITS, TAP_MIN } from '../constants'
import { parseImport } from '../storage/store'
import { parseWorkbook } from '../utils/parseExcel'

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
export function TransferInput({
  inputRef,
  onLoadQuestions,
  onImportStudyData,
  onImportPool,
  onNotify,
}) {
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

  const apply = () => {
    // 置き換えは用意しない。今ある問題を消してしまう操作で、取り返しがつかないため
    const merge = true
    if (pending.study) onImportStudyData(pending.study, { merge })
    if (pending.pool) onImportPool(pending.pool, { merge })
    const parts = []
    if (pending.pool) parts.push(`問題 ${pending.pool.questions.length} 問`)
    if (pending.study) parts.push(`記録 ${Object.keys(pending.study.records).length} 件`)
    onNotify({
      tone: 'success',
      title: '追加しました',
      description: parts.join(' ／ '),
    })
    setPending(null)
  }

  /** 確認ダイアログに出す中身の内訳。 */
  const summary = pending
    ? [
        pending.pool ? `問題 ${pending.pool.questions.length} 問` : null,
        pending.study ? `学習記録 ${Object.keys(pending.study.records).length} 件` : null,
      ]
        .filter(Boolean)
        .join(' ／ ')
    : ''

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
          title="読み込んだ内容を追加しますか？"
          message={`${summary}。今ある問題は消えません。同じ名前のグループがあるときは、別の名前で新しく作られます。`}
          confirmLabel="追加する"
          danger={false}
          onCancel={() => setPending(null)}
          onConfirm={() => apply()}
        />
      )}
    </>
  )
}

/**
 * 「書き出す」「読み込む」のボタン。
 * 書き出しは押してから形式（Excel / バックアップ）を選ぶ。
 *
 * バックアップは**グループごとに1ファイル**にする。全部を1つにまとめると、
 * 「日本史だけ渡したい」ができず、受け取った側も要らない科目まで抱え込む。
 * まとめて書き出したいときは、グループの数だけファイルを作る。
 *
 * @param {{
 *   groups: Array<{id: string, name: string}>,
 *   countsByGroup: Map<string, number>,
 *   onExportExcel: () => void,
 *   onExportGroup: (groupId: string) => Promise<void>|void,
 *   onImportClick: () => void,
 *   onNotify: (toast: object) => void,
 * }} props
 */
export default function DataTransfer({
  groups = [],
  countsByGroup = new Map(),
  onExportExcel,
  onExportGroup,
  onImportClick,
  onNotify,
}) {
  const [formatOpen, setFormatOpen] = useState(false)
  // 'format'（形式を選ぶ）→ 'group'（グループを選ぶ）
  const [stage, setStage] = useState('format')
  const [busy, setBusy] = useState(false)
  const panelRef = useRef(null)

  const close = () => {
    setFormatOpen(false)
    setStage('format')
  }

  /** グループを1つ書き出す。 */
  const exportOne = async (groupId) => {
    close()
    await onExportGroup(groupId)
  }

  /**
   * 全グループを書き出す。ファイルはグループごとに分かれる。
   * 連続してダウンロードするとブラウザが確認を出すことがあるので、少し間を空ける。
   */
  const exportAll = async () => {
    const target = groups.filter((g) => (countsByGroup.get(g.id) ?? 0) > 0)
    if (!target.length) {
      onNotify({ tone: 'error', title: '書き出せる問題がありません' })
      return
    }
    setBusy(true)
    try {
      for (const group of target) {
        await onExportGroup(group.id)
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      onNotify({
        tone: 'success',
        title: `${target.length}グループを書き出しました`,
        description: 'グループごとに1つのファイルになっています',
      })
    } finally {
      setBusy(false)
      close()
    }
  }

  return (
    <div ref={panelRef} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => {
            setStage('format')
            setFormatOpen((v) => !v)
          }}
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
            close()
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
          {stage === 'format' ? (
            <>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.sub }}>
                書き出す形式を選んでください
              </span>
              <button
                type="button"
                onClick={() => {
                  close()
                  onExportExcel()
                }}
                style={optionButton}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
                  Excel（.xlsx）
                </span>
                <span
                  style={{ fontSize: '11.5px', fontWeight: 400, color: COLORS.sub, lineHeight: 1.6 }}
                >
                  問題を表計算ソフトで編集できる形式で。虫食いは含まれません
                </span>
              </button>
              <button type="button" onClick={() => setStage('group')} style={optionButton}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
                  バックアップ（.json）
                </span>
                <span
                  style={{ fontSize: '11.5px', fontWeight: 400, color: COLORS.sub, lineHeight: 1.6 }}
                >
                  問題と学習記録を保存。読み込むと元に戻せます。グループごとに1ファイル
                </span>
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.sub }}>
                どのグループを書き出しますか？
              </span>
              {groups.length === 0 && (
                <span style={{ fontSize: '11.5px', color: COLORS.muted, lineHeight: 1.6 }}>
                  まだグループがありません。
                </span>
              )}
              {groups.map((group) => {
                const count = countsByGroup.get(group.id) ?? 0
                return (
                  <button
                    key={group.id}
                    type="button"
                    disabled={busy || count === 0}
                    onClick={() => exportOne(group.id)}
                    style={{
                      ...optionButton,
                      opacity: count === 0 ? 0.5 : 1,
                      cursor: count === 0 ? 'default' : 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
                      {group.name}
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: 400, color: COLORS.sub }}>
                      {count}問
                    </span>
                  </button>
                )
              })}
              {groups.length > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={exportAll}
                  style={optionButton}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
                    {busy ? '書き出しています…' : 'すべてのグループ'}
                  </span>
                  <span
                    style={{ fontSize: '11.5px', fontWeight: 400, color: COLORS.sub, lineHeight: 1.6 }}
                  >
                    ファイルはグループごとに分かれます（{groups.length}個）
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setStage('format')}
                style={{
                  ...buttonBase,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.card,
                  color: COLORS.body,
                }}
              >
                ← 形式を選び直す
              </button>
            </>
          )}
        </div>
      )}

      <span style={{ fontSize: '11px', color: COLORS.muted, textAlign: 'center', lineHeight: 1.6 }}>
        読み込みは .xlsx / .json のどちらでも選べます
      </span>
    </div>
  )
}
