import { useMemo, useState } from 'react'
import ConfirmDialog, { PromptDialog } from './ConfirmDialog'
import { COLORS, SPACING } from '../constants'
import { questionKey } from '../data/questions'
import { useCompactLayout } from '../hooks/useMediaQuery'
import { accuracyOf } from '../utils/stats'

const cardStyle = (pad) => ({
  background: COLORS.card,
  borderRadius: '20px',
  border: `1px solid ${COLORS.cardBorder}`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  padding: `${pad}px`,
})

const smallBtn = (primary) => ({
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '10px',
  border: `1px solid ${primary ? COLORS.blue : COLORS.border}`,
  background: primary ? COLORS.blue : COLORS.card,
  color: primary ? '#ffffff' : COLORS.body,
  fontSize: '12.5px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
})

/**
 * グループ一覧（設問一覧の1階層目）。
 * グループを選ぶと、そのグループの設問一覧へ入る。
 */
export default function GroupsView({
  groups,
  questions,
  getRecord,
  onOpenGroup,
  onCreateGroup,
  onRenameGroup,
  onRemoveGroup,
  onMergeGroups,
  onStartQuiz,
  onImportClick,
}) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const [checked, setChecked] = useState([])
  // window.confirm / prompt は環境によって表示されないため、アプリ内のUIで扱う
  const [renaming, setRenaming] = useState(null) // { id, value }
  const [deleting, setDeleting] = useState(null) // { id, name, total }
  const [creating, setCreating] = useState(false)
  const [merging, setMerging] = useState(false)

  /** グループごとの集計（問題数・学習済み・正答率・要復習）。 */
  const stats = useMemo(() => {
    const map = new Map(
      groups.map((g) => [
        g.id,
        { group: g, total: 0, studied: 0, answered: 0, correct: 0, wrong: 0, bookmarked: 0 },
      ]),
    )
    for (const q of questions) {
      const s = map.get(q.groupId)
      if (!s) continue
      s.total += 1
      const rec = getRecord(questionKey(q))
      if (rec.bookmarked) s.bookmarked += 1
      if (rec.attempts) {
        s.studied += 1
        s.answered += rec.attempts
        s.correct += rec.correct
        if (rec.lastResult === 'incorrect') s.wrong += 1
      }
    }
    return [...map.values()].map((s) => ({ ...s, accuracy: accuracyOf(s.correct, s.answered) }))
  }, [groups, questions, getRecord])

  const toggle = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  if (!groups.length) {
    return (
      <div
        style={{
          gridColumn: '1 / -1',
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
          🗂
        </span>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
          グループがまだありません
        </p>
        <p style={{ margin: 0, fontSize: '14px', color: COLORS.sub, lineHeight: 1.8 }}>
          問題を読み込むか、グループを作って問題を追加すると
          <br />
          ここに一覧が表示されます。
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" style={smallBtn(false)} onClick={onImportClick}>
            ⬆ 読み込む
          </button>
          <button
            type="button"
            style={smallBtn(true)}
            onClick={() => setCreating(true)}
          >
            ＋ グループを作成
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          ...cardStyle(compact ? 16 : 20),
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text }}>問題グループ</span>
        <span style={{ fontSize: '12.5px', color: COLORS.sub }}>
          {groups.length}グループ / 全{questions.length}問
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" style={smallBtn(false)} onClick={onImportClick}>
            ⬆ 読み込む
          </button>
          <button
            type="button"
            style={smallBtn(true)}
            onClick={() => setCreating(true)}
          >
            ＋ グループを作成
          </button>
        </span>
      </div>

      {/* グループのカード一覧 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fill, minmax(260px, 1fr))'
            : 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {stats.map((s) => {
          const isChecked = checked.includes(s.group.id)
          return (
            <div
              key={s.group.id}
              style={{
                ...cardStyle(compact ? 18 : 22),
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: `1px solid ${isChecked ? COLORS.blue : COLORS.cardBorder}`,
                background: isChecked ? COLORS.blueLight : COLORS.card,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(s.group.id)}
                  aria-label={`${s.group.name} を選択`}
                  style={{ width: '18px', height: '18px', accentColor: COLORS.blue, cursor: 'pointer', marginTop: '3px' }}
                />
                <button
                  type="button"
                  onClick={() => onOpenGroup(s.group.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 700, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.group.name}
                  </div>
                  <div style={{ fontSize: '12px', color: COLORS.sub, marginTop: '2px' }}>
                    {s.total}問 · 学習済み {s.studied}問
                  </div>
                </button>
              </div>

              {/* 学習の進み具合 */}
              <div>
                <div
                  style={{
                    height: '8px',
                    borderRadius: '999px',
                    background: COLORS.chipTrack,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${s.total ? Math.round((s.studied / s.total) * 100) : 0}%`,
                      height: '100%',
                      background: COLORS.blue,
                      borderRadius: '999px',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
                  <span style={{ color: COLORS.sub }}>
                    正答率 <b style={{ color: s.answered ? COLORS.blue : COLORS.muted }}>{s.answered ? `${s.accuracy}%` : '—'}</b>
                  </span>
                  {s.wrong > 0 && <span style={{ color: COLORS.red }}>要復習 {s.wrong}</span>}
                  {s.bookmarked > 0 && <span style={{ color: COLORS.amberDark }}>★ {s.bookmarked}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" style={smallBtn(false)} onClick={() => onOpenGroup(s.group.id)}>
                  設問を見る
                </button>
                <button
                  type="button"
                  style={smallBtn(true)}
                  disabled={!s.total}
                  onClick={() => onStartQuiz(questions.filter((q) => q.groupId === s.group.id), {})}
                >
                  ▶ 演習
                </button>
                <button
                  type="button"
                  aria-label={`${s.group.name} の名前を変更`}
                  style={{ ...smallBtn(false), padding: '0 10px', marginLeft: 'auto' }}
                  onClick={() => setRenaming({ id: s.group.id, value: s.group.name })}
                >
                  名前
                </button>
                <button
                  type="button"
                  aria-label={`${s.group.name} を削除`}
                  style={{ ...smallBtn(false), padding: '0 10px', color: COLORS.red }}
                  onClick={() =>
                    setDeleting({ id: s.group.id, name: s.group.name, total: s.total })
                  }
                >
                  削除
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 統合バー（2つ以上選んだときだけ出す） */}
      {checked.length >= 2 && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '24px',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 18px',
            borderRadius: '14px',
            background: COLORS.text,
            boxShadow: '0 8px 24px rgba(15,23,42,0.24)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
            {checked.length}グループを選択中
          </span>
          <button
            type="button"
            style={{ ...smallBtn(true), border: `1px solid ${COLORS.blue}` }}
            onClick={() => setMerging(true)}
          >
            ⇉ 統合する
          </button>
          <button
            type="button"
            onClick={() => setChecked([])}
            aria-label="選択を解除"
            style={{ width: '32px', height: '32px', borderRadius: '999px', border: 'none', background: 'transparent', color: COLORS.muted, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 名前の変更・削除・作成・統合（window.prompt / confirm の置き換え） */}
      {renaming && (
        <PromptDialog
          title="グループ名を変更"
          label="新しい名前"
          defaultValue={renaming.value}
          confirmLabel="変更する"
          onCancel={() => setRenaming(null)}
          onConfirm={(name) => {
            onRenameGroup(renaming.id, name)
            setRenaming(null)
          }}
        />
      )}

      {creating && (
        <PromptDialog
          title="グループを作成"
          label="グループ名"
          placeholder="例：循環器"
          confirmLabel="作成する"
          onCancel={() => setCreating(false)}
          onConfirm={(name) => {
            onCreateGroup(name)
            setCreating(false)
          }}
        />
      )}

      {merging && (
        <PromptDialog
          title={`${checked.length}個のグループを統合`}
          label="統合後のグループ名"
          defaultValue={groups.find((g) => g.id === checked[0])?.name ?? ''}
          confirmLabel="統合する"
          onCancel={() => setMerging(false)}
          onConfirm={(name) => {
            onMergeGroups(checked, name)
            setChecked([])
            setMerging(false)
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`「${deleting.name}」を削除しますか？`}
          message={`中の${deleting.total}問も一緒に削除されます。元に戻せません。`}
          confirmLabel="削除する"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onRemoveGroup(deleting.id)
            setChecked((prev) => prev.filter((x) => x !== deleting.id))
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
