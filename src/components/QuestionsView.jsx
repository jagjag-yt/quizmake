import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COLORS,
  LIST_STATE_KEY,
  QUESTION_TYPES,
  SORTS,
  SORT_LABELS,
  TYPE_LABELS,
  SPACING,
  STATUS_FILTERS,
  STATUS_FILTER_LABELS,
  TAP_MIN,
} from '../constants'
import { clozeHiddenCount, isCloze, questionKey, segmentsToText } from '../data/questions'
import { clozeHeadline } from '../data/cloze'
import { useCompactLayout, usePhoneLayout } from '../hooks/useMediaQuery'
import { isPlainObject, safeJsonParse } from '../utils/safe'
import QuestionDetail, { BoxMeter, StatusBadge } from './QuestionDetail'
import ConfirmDialog, { PromptDialog } from './ConfirmDialog'

const ROW_H = 56
/** スマホの行。7列は入らないので2段に組み替え、その分だけ高くする。 */
const ROW_H_PHONE = 78
const GRID = '40px 68px 76px 1fr 118px 78px 36px'
/** 固定列(494px)＋余白を確保できる最小幅。これ未満は横スクロールにする。 */
const MIN_TABLE_W = 760

const DEFAULT_STATE = {
  search: '',
  type: 'all',
  sort: SORTS.NUMBER,
  statuses: [STATUS_FILTERS.ALL],
}

/** 絞り込み状態はセッション中だけ保持し、詳細を見て戻っても失わないようにする。 */
function loadListState() {
  try {
    const raw = sessionStorage.getItem(LIST_STATE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = safeJsonParse(raw)
    if (!isPlainObject(parsed)) return DEFAULT_STATE
    return {
      ...DEFAULT_STATE,
      ...parsed,
      statuses: Array.isArray(parsed.statuses) && parsed.statuses.length
        ? parsed.statuses
        : DEFAULT_STATE.statuses,
    }
  } catch {
    return DEFAULT_STATE
  }
}

const controlBase = {
  minHeight: `${TAP_MIN}px`,
  padding: '0 12px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.text,
  fontSize: '13px',
  fontFamily: 'inherit',
  outline: 'none',
}

/** 詳細パネル上部の操作ボタン。 */
const panelAction = () => ({
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.body,
  fontSize: '12.5px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
})

/** 一括操作バー（濃い背景）の上に置くボタン。 */
const ghostButton = {
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.card,
  color: COLORS.body,
  fontSize: '12.5px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const cardStyle = (pad) => ({
  background: COLORS.card,
  borderRadius: '20px',
  border: `1px solid ${COLORS.cardBorder}`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  padding: `${pad}px`,
})

/** 状況フィルタのトグルチップ。 */
function StatusChips({ statuses, onChange }) {
  const toggle = (value) => {
    if (value === STATUS_FILTERS.ALL) {
      onChange([STATUS_FILTERS.ALL])
      return
    }
    const without = statuses.filter((s) => s !== STATUS_FILTERS.ALL)
    const next = without.includes(value)
      ? without.filter((s) => s !== value)
      : [...without, value]
    onChange(next.length ? next : [STATUS_FILTERS.ALL])
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {Object.values(STATUS_FILTERS).map((value) => {
        const active = statuses.includes(value)
        return (
          <span
            key={value}
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: `${TAP_MIN}px` }}
          >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => toggle(value)}
              style={{
                minHeight: '34px',
                padding: '0 14px',
                borderRadius: '999px',
                border: `1px solid ${active ? COLORS.blue : COLORS.border}`,
                background: active ? COLORS.blue : COLORS.card,
                color: active ? '#ffffff' : COLORS.sub,
                fontSize: '12.5px',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {STATUS_FILTER_LABELS[value]}
            </button>
          </span>
        )
      })}
    </div>
  )
}

export default function QuestionsView({
  group,
  onBackToGroups,
  onSplit,
  questions,
  getRecord,
  onToggleBookmark,
  onSaveNote,
  onStartQuiz,
  onImportClick,
  onCreateClick,
  onBulkBookmark,
  onEdit,
  onDuplicate,
  onMoveToGroup,
  onDelete,
  groups = [],
  loading,
  loadingCount,
}) {
  const compact = useCompactLayout()
  // スマホでは表を7列のまま出せない（実測で 390px の画面に 782px はみ出した）。
  // 列を潰して読めなくするのではなく、1行を2段に組み替えて縦に積む。
  const phone = usePhoneLayout()
  const rowH = phone ? ROW_H_PHONE : ROW_H
  const gridCols = phone ? '28px 1fr 36px' : GRID
  const tableMinW = phone ? 0 : MIN_TABLE_W
  const space = compact ? SPACING.compact : SPACING.wide

  const [state, setState] = useState(loadListState)
  const [selectedId, setSelectedId] = useState(null)
  // 詳細は常時表示せず、行を選んだときだけパネルで開く
  const [panelOpen, setPanelOpen] = useState(false)
  const [checkedIds, setCheckedIds] = useState([])
  // 確認は window.confirm ではなくアプリ内のダイアログで行う
  const [deleting, setDeleting] = useState(null) // { ids, label }
  const [splitting, setSplitting] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef(null)
  const panelRef = useRef(null)

  const patch = useCallback((p) => setState((prev) => ({ ...prev, ...p })), [])

  // 絞り込み・並び順の保持
  useEffect(() => {
    try {
      sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify(state))
    } catch {
      // セッション保存が使えなくても動作に支障はない
    }
  }, [state])


  const rows = useMemo(() => {
    const keyword = state.search.trim().toLowerCase()
    const list = questions.filter((q) => {
      if (state.type !== 'all' && q.type !== state.type) return false

      if (keyword) {
        const haystack = [
          isCloze(q) ? clozeHeadline(q) : segmentsToText(q.segments),
          isCloze(q) ? '' : q.explanation,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(keyword)) return false
      }

      if (!state.statuses.includes(STATUS_FILTERS.ALL)) {
        const rec = getRecord(questionKey(q))
        const hit = state.statuses.some((s) => {
          if (s === STATUS_FILTERS.UNSTUDIED) return !rec.attempts
          if (s === STATUS_FILTERS.WRONG) return rec.lastResult === 'incorrect'
          if (s === STATUS_FILTERS.BOOKMARKED) return rec.bookmarked
          return false
        })
        if (!hit) return false
      }
      return true
    })

    const withRecord = list.map((q) => ({ q, rec: getRecord(questionKey(q)) }))
    const numeric = (v) => parseInt(String(v).split('-')[0], 10) || 0

    withRecord.sort((a, b) => {
      if (state.sort === SORTS.ACCURACY) {
        const ra = a.rec.attempts ? a.rec.correct / a.rec.attempts : -1
        const rb = b.rec.attempts ? b.rec.correct / b.rec.attempts : -1
        if (ra !== rb) return ra - rb // 低い順（苦手から）
      } else if (state.sort === SORTS.LAST_STUDIED) {
        const da = a.rec.lastAnsweredAt ?? ''
        const db = b.rec.lastAnsweredAt ?? ''
        if (da !== db) return db.localeCompare(da) // 新しい順
      }
      return numeric(a.q.questionNumber) - numeric(b.q.questionNumber)
    })
    return withRecord
  }, [questions, state, getRecord])

  const selected = useMemo(
    () => rows.find((r) => r.q.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  )
  const selectedIndex = selected ? rows.findIndex((r) => r.q.id === selected.q.id) : -1

  // 絞り込みが変わって選択が消えた場合だけ、先頭に寄せる
  useEffect(() => {
    if (selectedId && !rows.some((r) => r.q.id === selectedId)) setSelectedId(null)
  }, [rows, selectedId])

  const viewportH = compact ? 460 : 560
  const start = Math.max(0, Math.floor(scrollTop / rowH) - 6)
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewportH) / rowH) + 6)
  const visible = rows.slice(start, end)

  const toggleChecked = useCallback((id) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const openDetail = useCallback((id, index) => {
    setSelectedId(id)
    setPanelOpen(true)
    if (typeof index === 'number') setFocusIndex(index)
  }, [])

  const closeDetail = useCallback(() => setPanelOpen(false), [])

  const goRelative = useCallback(
    (delta) => {
      if (selectedIndex < 0) return
      const next = rows[selectedIndex + delta]
      if (next) setSelectedId(next.q.id)
    },
    [rows, selectedIndex],
  )

  // 詳細パネルは Esc で閉じ、開いている間はフォーカスを閉じ込める
  useEffect(() => {
    if (!panelOpen || !selectedId) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setPanelOpen(false)
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
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
  }, [panelOpen, selectedId])

  const onGridKeyDown = (e) => {
    if (!rows.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.max(0, Math.min(rows.length - 1, focusIndex + (e.key === 'ArrowDown' ? 1 : -1)))
      setFocusIndex(next)
      setSelectedId(rows[next].q.id)
      const top = next * rowH
      if (scrollRef.current) {
        const el = scrollRef.current
        if (top < el.scrollTop) el.scrollTop = top
        else if (top + rowH > el.scrollTop + viewportH) el.scrollTop = top + rowH - viewportH
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[focusIndex]
      if (row) openDetail(row.q.id, focusIndex)
    } else if (e.key === ' ') {
      e.preventDefault()
      const row = rows[focusIndex]
      if (row) toggleChecked(row.q.id)
    }
  }

  const filteredQuestions = rows.map((r) => r.q)

  // ---------- 状態表示 ----------
  if (loading) {
    return (
      <div style={{ gridColumn: '1 / -1', minWidth: 0, ...cardStyle(space.card) }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>
          ⏳ Excelを解析しています…（{loadingCount ?? 0}問）
        </div>
        <div
          style={{
            height: '6px',
            borderRadius: '999px',
            background: COLORS.border,
            overflow: 'hidden',
            margin: '14px 0 18px',
          }}
        >
          <div style={{ width: '45%', height: '100%', background: COLORS.blue, borderRadius: '999px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '10px', height: `${rowH}px`, alignItems: 'center' }}>
              {[36, 48, 72, 320, 96, 64, 40, 24].map((w, j) => (
                <div key={j} style={{ height: '14px', width: `${w}px`, maxWidth: '100%', borderRadius: '999px', background: COLORS.chipTrack }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!questions.length) {
    return (
      <div
        style={{
          gridColumn: '1 / -1',
          minWidth: 0,
          ...cardStyle(space.card),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          padding: '56px 32px',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '999px',
            background: COLORS.chipTrack,
            fontSize: '26px',
          }}
        >
          📄
        </span>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
          問題がまだありません
        </p>
        <p style={{ margin: 0, fontSize: '14px', color: COLORS.sub, lineHeight: 1.8 }}>
          問題を読み込むか、アプリ内で作成すると
          <br />
          ここに一覧が表示されます。
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={onImportClick} style={{ ...controlBase, border: `1px solid ${COLORS.border}`, fontWeight: 700, cursor: 'pointer', color: COLORS.body }}>
            ⬆ 読み込む
          </button>
          <button
            type="button"
            onClick={onCreateClick}
            style={{ ...controlBase, border: `1px solid ${COLORS.blue}`, background: COLORS.blue, color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
          >
            ＋ 問題を作成
          </button>
        </div>
      </div>
    )
  }

  // ---------- 一覧 ----------
  const detailNode = selected ? (
    <QuestionDetail
      question={selected.q}
      groupName={group?.name ?? ''}
      record={selected.rec}
      noteKey={questionKey(selected.q)}
      onToggleBookmark={() => onToggleBookmark(questionKey(selected.q))}
      onSaveNote={(note) => onSaveNote(questionKey(selected.q), note)}
      onStartFromHere={() => onStartQuiz(filteredQuestions, { startAtId: selected.q.id })}
      cardPadding={space.card}
    />
  ) : null

  return (
    <div style={{ gridColumn: '1 / -1', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* グループ見出し（1階層目へ戻る） */}
      <div
        style={{
          ...cardStyle(compact ? 14 : 16),
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onBackToGroups}
          style={{
            minHeight: `${TAP_MIN - 8}px`,
            padding: '0 14px',
            borderRadius: '10px',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            color: COLORS.body,
            fontSize: '12.5px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          ← グループ一覧
        </button>
        <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text }}>
          {group?.name ?? 'グループ'}
        </span>
        <span style={{ fontSize: '12.5px', color: COLORS.sub }}>{questions.length}問</span>
      </div>

      {/* フィルタバー */}
      <div style={cardStyle(compact ? 16 : 20)}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: COLORS.muted, fontSize: '14px' }}>⌕</span>
            <input
              type="search"
              value={state.search}
              onChange={(e) => patch({ search: e.target.value })}
              placeholder={compact ? 'キーワード検索' : '問題文・解説を検索'}
              aria-label="問題文・解説を検索"
              data-shortcut-ignore="true"
              style={{ ...controlBase, width: '100%', paddingLeft: '32px' }}
            />
          </div>
          <select
            value={state.type}
            onChange={(e) => patch({ type: e.target.value })}
            aria-label="種別で絞り込み"
            style={{ ...controlBase, cursor: 'pointer' }}
          >
            <option value="all">種別：すべて</option>
            <option value={QUESTION_TYPES.CHOICE}>種別：選択式</option>
            <option value={QUESTION_TYPES.CLOZE}>種別：虫食い</option>
          </select>
          <select value={state.sort} onChange={(e) => patch({ sort: e.target.value })} aria-label="並び順" style={{ ...controlBase, cursor: 'pointer' }}>
            {Object.values(SORTS).map((s) => (
              <option key={s} value={s}>並び順：{SORT_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.sub }}>状況</span>
          <StatusChips statuses={state.statuses} onChange={(statuses) => patch({ statuses })} />
          <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: COLORS.sub }}>
            {questions.length}問中 {rows.length}問を表示
          </span>
        </div>
      </div>

      {/* 一覧は全幅。詳細は行を選んだときだけパネルで開く */}
      <div>
        {/* 一覧テーブル */}
        <div style={{ ...cardStyle(0), overflow: 'hidden', minWidth: 0 }}>
          <div
            ref={scrollRef}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            onKeyDown={onGridKeyDown}
            role="grid"
            aria-rowcount={rows.length}
            tabIndex={0}
            style={{
              height: `${viewportH}px`,
              overflowY: 'auto',
              // 設計幅(812px)より狭いときは、列を潰さず横スクロールさせる
              overflowX: 'auto',
              outline: 'none',
            }}
          >
            {/* 見出し。スマホでは列が無いので出さない（並び替えはフィルタバーの「並び順」で行う） */}
            {!phone && (
            <div
              role="row"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                display: 'grid',
                gridTemplateColumns: GRID,
                gap: '10px',
                alignItems: 'center',
                padding: '0 18px',
                minWidth: `${MIN_TABLE_W}px`,
                height: '44px',
                background: COLORS.card,
                borderBottom: `1px solid ${COLORS.border}`,
                fontSize: '12px',
                fontWeight: 700,
                color: COLORS.sub,
              }}
            >
              <span />
              <button
                type="button"
                onClick={() => patch({ sort: SORTS.NUMBER })}
                style={{ border: 'none', background: 'transparent', color: COLORS.blue, fontWeight: 700, fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                番号 ⇅
              </button>
              <span>種別</span>
              <span>問題文</span>
              <span>学習状況</span>
              <span>定着度</span>
              <span>★</span>
            </div>
            )}

            <div style={{ height: `${start * rowH}px` }} />

            {visible.map(({ q, rec }, i) => {
              const index = start + i
              const isSelected = selected?.q.id === q.id
              const isChecked = checkedIds.includes(q.id)
              return (
                <div
                  key={q.id}
                  role="row"
                  aria-selected={isSelected}
                  aria-rowindex={index + 1}
                  onClick={() => openDetail(q.id, index)}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = COLORS.rowHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected ? COLORS.blueLight : COLORS.card
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridCols,
                    gap: phone ? '8px' : '10px',
                    alignItems: 'center',
                    padding: phone ? '0 12px' : '0 18px',
                    minWidth: tableMinW ? `${tableMinW}px` : 0,
                    height: `${rowH}px`,
                    borderBottom: `1px solid ${COLORS.rowBorder}`,
                    background: isSelected ? COLORS.blueLight : COLORS.card,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleChecked(q.id)}
                    aria-label={`問題 ${q.questionNumber} を選択`}
                    style={{
                      width: phone ? '22px' : '18px',
                      height: phone ? '22px' : '18px',
                      accentColor: COLORS.blue,
                      cursor: 'pointer',
                    }}
                  />
                  {phone ? (
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <b style={{ fontSize: '13px', color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
                          {q.questionNumber}
                        </b>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isCloze(q) ? COLORS.blueLight : COLORS.chipTrack,
                            color: isCloze(q) ? COLORS.blue : COLORS.body,
                            fontSize: '11px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {TYPE_LABELS[q.type]}
                        </span>
                        {isCloze(q) ? (
                          <span style={{ fontSize: '11px', color: COLORS.muted }}>— 採点なし</span>
                        ) : (
                          <StatusBadge record={rec} />
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          color: COLORS.body,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isCloze(q)
                          ? clozeHeadline(q)
                          : segmentsToText(q.segments) || '（無題の問題）'}
                      </span>
                    </span>
                  ) : (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
                    {q.questionNumber}
                  </span>
                  )}
                  {!phone && (
                    <>
                      <span
                        style={{
                          justifySelf: 'start',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: isCloze(q) ? COLORS.blueLight : COLORS.chipTrack,
                          color: isCloze(q) ? COLORS.blue : COLORS.body,
                          fontSize: '11.5px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {TYPE_LABELS[q.type]}
                      </span>
                      <span style={{ fontSize: '13.5px', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isCloze(q)
                          ? clozeHeadline(q)
                          : segmentsToText(q.segments) || '（無題の問題）'}
                      </span>
                      {isCloze(q) ? (
                        <span style={{ fontSize: '11.5px', color: COLORS.muted }}>— 採点なし</span>
                      ) : (
                        <StatusBadge record={rec} />
                      )}
                      {isCloze(q) ? (
                        <span style={{ fontSize: '11.5px', color: COLORS.sub }}>
                          隠す {clozeHiddenCount(q)} か所
                        </span>
                      ) : (
                        <BoxMeter box={rec.box} />
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleBookmark(questionKey(q))
                    }}
                    aria-label={rec.bookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
                    style={{
                      width: '36px',
                      height: '36px',
                      border: 'none',
                      background: 'transparent',
                      color: rec.bookmarked ? COLORS.amber : COLORS.dashed,
                      fontSize: '16px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    {rec.bookmarked ? '★' : '☆'}
                  </button>
                </div>
              )
            })}

            <div style={{ height: `${Math.max(0, (rows.length - end) * rowH)}px` }} />

            {/* 虫食いで絞り込んで0件のとき（SPEC E1）。Excelから読めないことをここで伝える */}
            {!rows.length && state.type === QUESTION_TYPES.CLOZE && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '48px 24px',
                  textAlign: 'center',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '56px',
                    height: '56px',
                    borderRadius: '999px',
                    background: COLORS.blueLight,
                  }}
                >
                  <span style={{ display: 'block', width: '22px', height: '12px', background: COLORS.blue }} />
                </span>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
                  虫食い問題はまだありません
                </p>
                <p style={{ margin: 0, fontSize: '13.5px', color: COLORS.sub, lineHeight: 1.8 }}>
                  文章の一部を隠して覚えたい内容に向いています。
                  <br />
                  Excelからは読み込めないため、アプリ内で作成します。
                </p>
                <button
                  type="button"
                  onClick={onCreateClick}
                  style={{
                    minHeight: `${TAP_MIN}px`,
                    padding: '0 20px',
                    borderRadius: '12px',
                    border: `1px solid ${COLORS.blue}`,
                    background: COLORS.blue,
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  ＋ 虫食い問題を作成
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '12px 18px',
              borderTop: `1px solid ${COLORS.border}`,
              fontSize: '12.5px',
              color: COLORS.sub,
            }}
          >
            <span>
              {rows.length ? `${Math.min(rows.length, start + 1)}–${end} / ${rows.length}問を表示` : '該当する問題がありません'}
            </span>
            <span style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => goRelative(-1)} aria-label="前の問題を選択" style={{ width: '36px', height: '36px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.body, cursor: 'pointer', fontFamily: 'inherit' }}>←</button>
              <button type="button" onClick={() => goRelative(1)} aria-label="次の問題を選択" style={{ width: '36px', height: '36px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.body, cursor: 'pointer', fontFamily: 'inherit' }}>→</button>
            </span>
          </div>
        </div>

      </div>

      {/* 絞り込み結果から演習を始める（常に画面下部に表示） */}
      <div
        style={{
          ...cardStyle(compact ? 16 : 20),
          position: 'sticky',
          bottom: `calc(12px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          boxShadow: '0 -4px 16px rgba(15,23,42,0.08)',
        }}
      >
        <span style={{ fontSize: '13.5px', color: COLORS.body }}>
          絞り込み中の <b style={{ color: COLORS.text }}>{rows.length}問</b> を対象に
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!rows.length}
            onClick={() => onStartQuiz(filteredQuestions, { shuffle: true })}
            style={{ ...controlBase, fontWeight: 700, cursor: rows.length ? 'pointer' : 'default', opacity: rows.length ? 1 : 0.6, color: COLORS.body }}
          >
            ⇄ シャッフル演習
          </button>
          <button
            type="button"
            disabled={!rows.length}
            onClick={() => onStartQuiz(filteredQuestions, {})}
            style={{ ...controlBase, border: `1px solid ${COLORS.blue}`, background: COLORS.blue, color: '#ffffff', fontWeight: 700, cursor: rows.length ? 'pointer' : 'default', opacity: rows.length ? 1 : 0.6 }}
          >
            ▶ この条件で演習を開始
          </button>
        </span>
      </div>

      {/* 一括操作バー */}
      {checkedIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            // 下部に常時表示している演習開始バーの上に重ねる
            bottom: `calc(104px + env(safe-area-inset-bottom, 0px))`,
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 18px',
            borderRadius: '14px',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            boxShadow: '0 8px 24px rgba(15,23,42,0.16)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
            {checkedIds.length}問を選択中
          </span>
          <button
            type="button"
            onClick={() => {
              onBulkBookmark(checkedIds)
              setCheckedIds([])
            }}
            style={{ minHeight: '36px', padding: '0 14px', borderRadius: '10px', border: `1px solid ${COLORS.amber}`, background: COLORS.card, color: COLORS.amberDark, fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            ★ ブックマーク
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicate(checkedIds)
              setCheckedIds([])
            }}
            style={ghostButton}
          >
            ⧉ 複製
          </button>
          <select
            aria-label="移動先のグループ"
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              onMoveToGroup(checkedIds, e.target.value)
              setCheckedIds([])
            }}
            style={{ ...ghostButton, cursor: 'pointer', paddingRight: '8px' }}
          >
            <option value="">→ 移動…</option>
            {groups
              .filter((g) => g.id !== group?.id)
              .map((g) => (
                <option key={g.id} value={g.id} style={{ color: COLORS.text }}>
                  {g.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => setSplitting(true)}
            style={{ minHeight: '36px', padding: '0 14px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.body, fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            ⇱ 別グループへ分割
          </button>
          <button
            type="button"
            onClick={() =>
              setDeleting({ ids: [...checkedIds], label: `選択した${checkedIds.length}問` })
            }
            style={{ ...ghostButton, borderColor: COLORS.red, color: COLORS.red }}
          >
            🗑 削除
          </button>
          <button
            type="button"
            onClick={() => {
              const picked = rows.filter((r) => checkedIds.includes(r.q.id)).map((r) => r.q)
              if (picked.length) onStartQuiz(picked, {})
            }}
            style={{ minHeight: '36px', padding: '0 16px', borderRadius: '10px', border: `1px solid ${COLORS.blue}`, background: COLORS.blue, color: '#ffffff', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            ▶ 演習
          </button>
          <button
            type="button"
            onClick={() => setCheckedIds([])}
            aria-label="選択を解除"
            style={{ width: '32px', height: '32px', borderRadius: '999px', border: 'none', background: 'transparent', color: COLORS.muted, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 詳細は右からのパネル（行を選んだときだけ開く） */}
      {panelOpen && selected && (
        <>
          <div
            onClick={closeDetail}
            style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 45 }}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`問題 ${selected.q.questionNumber} の詳細`}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(560px, 100vw)',
              zIndex: 46,
              background: COLORS.card,
              borderLeft: `1px solid ${COLORS.border}`,
              overflowY: 'auto',
              boxShadow: '-8px 0 24px rgba(15,23,42,0.12)',
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                background: COLORS.card,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <button type="button" onClick={closeDetail} aria-label="閉じる" style={{ width: `${TAP_MIN}px`, height: `${TAP_MIN}px`, borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.body, fontFamily: 'inherit', cursor: 'pointer' }}>✕</button>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>
                問題 {selected.q.questionNumber}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => onToggleBookmark(questionKey(selected.q))} aria-label="ブックマーク" style={{ width: `${TAP_MIN}px`, height: `${TAP_MIN}px`, borderRadius: '10px', border: `1px solid ${selected.rec.bookmarked ? COLORS.amber : COLORS.border}`, background: selected.rec.bookmarked ? COLORS.amberLight : COLORS.card, color: selected.rec.bookmarked ? COLORS.amberDark : COLORS.dashed, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {selected.rec.bookmarked ? '★' : '☆'}
                </button>
                <button type="button" onClick={() => goRelative(-1)} aria-label="前の問題" style={{ width: `${TAP_MIN}px`, height: `${TAP_MIN}px`, borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.body, fontFamily: 'inherit', cursor: 'pointer' }}>←</button>
                <button type="button" onClick={() => goRelative(1)} aria-label="次の問題" style={{ width: `${TAP_MIN}px`, height: `${TAP_MIN}px`, borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.body, fontFamily: 'inherit', cursor: 'pointer' }}>→</button>
              </span>
            </div>

            {/* 1問だけへの操作（複製・移動・削除） */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                padding: '10px 16px',
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.bg,
              }}
            >
              <button
                type="button"
                onClick={() => onEdit(selected.q.id)}
                style={{ ...panelAction(), borderColor: COLORS.blue, color: COLORS.blue }}
              >
                ✎ 編集
              </button>
              <button
                type="button"
                onClick={() => onDuplicate([selected.q.id])}
                style={panelAction()}
              >
                ⧉ 複製
              </button>
              <select
                aria-label="この問題の移動先グループ"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  onMoveToGroup([selected.q.id], e.target.value)
                }}
                style={{ ...panelAction(), cursor: 'pointer' }}
              >
                <option value="">→ 移動…</option>
                {groups
                  .filter((g) => g.id !== group?.id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setDeleting({
                    ids: [selected.q.id],
                    label: `問題 ${selected.q.questionNumber}`,
                    closeAfter: true,
                  })
                }
                style={{ ...panelAction(), marginLeft: 'auto', borderColor: COLORS.red, color: COLORS.red }}
              >
                🗑 削除
              </button>
            </div>

            {detailNode}
          </div>
        </>
      )}

      {splitting && (
        <PromptDialog
          title={`選択した${checkedIds.length}問を新しいグループへ`}
          label="新しいグループ名"
          defaultValue={group?.name ? `${group.name} 分割` : ''}
          confirmLabel="分割する"
          onCancel={() => setSplitting(false)}
          onConfirm={(name) => {
            onSplit(checkedIds, name)
            setCheckedIds([])
            setSplitting(false)
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`${deleting.label}を削除しますか？`}
          message="元に戻せません。"
          confirmLabel="削除する"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onDelete(deleting.ids)
            setCheckedIds([])
            if (deleting.closeAfter) closeDetail()
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
