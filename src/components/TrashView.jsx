import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { COLORS, SPACING, TAP_MIN, TYPE_LABELS } from '../constants'
import { clozeHeadline, hiddenCount } from '../data/cloze'
import { isCloze, segmentsToText } from '../data/questions'
import { useCompactLayout } from '../hooks/useMediaQuery'
import { TRASH_MAX } from '../storage/trash'

const card = (pad) => ({
  background: COLORS.card,
  borderRadius: '20px',
  border: `1px solid ${COLORS.cardBorder}`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  padding: `${pad}px`,
})

const button = (tone) => ({
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '10px',
  border: `1px solid ${tone === 'primary' ? COLORS.blue : COLORS.border}`,
  background: tone === 'primary' ? COLORS.blue : COLORS.card,
  color: tone === 'primary' ? COLORS.onAccent : tone === 'danger' ? COLORS.red : COLORS.body,
  fontSize: '12.5px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

/** 「2026-08-20 22:31」の形にする。 */
function formatWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 1件の中身を1行で言い表す。 */
function describe(item) {
  if (item.kind === 'group') {
    return {
      title: `グループ「${item.group?.name ?? '（名前なし）'}」`,
      detail: `中の問題 ${item.questions.length}問もいっしょに戻ります`,
    }
  }
  const q = item.questions[0]
  const head = q
    ? isCloze(q)
      ? clozeHeadline(q)
      : segmentsToText(q.segments) || '（無題の問題）'
    : '（問題なし）'
  const meta = q
    ? isCloze(q)
      ? `虫食い · 隠す ${hiddenCount(q.paras)}か所`
      : `選択式 · ${q.choices?.length ?? 0}択`
    : ''
  return {
    title: head,
    detail: `${meta}${item.group ? ` · 元のグループ「${item.group.name}」` : ''}`,
  }
}

/**
 * ごみ箱。
 *
 * 消した問題とグループを一時的に置いておく場所。
 * 削除は取り返しがつかず、しかも一度に何十問も消せるため、戻せる場所を1つ挟む。
 *
 * @param {{
 *   trash: { items: Array },
 *   onRestore: (itemId: string) => void,
 *   onPurge: (itemId: string) => void,
 *   onEmpty: () => void,
 *   onBack: () => void,
 * }} props
 */
export default function TrashView({ trash, onRestore, onPurge, onEmpty, onBack }) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const [purging, setPurging] = useState(null)
  const [emptying, setEmptying] = useState(false)

  const items = trash?.items ?? []

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '900px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} style={button()}>
          ← 設問一覧
        </button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.text }}>ごみ箱</h2>
        <span style={{ fontSize: '12.5px', color: COLORS.sub }}>{items.length}件</span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setEmptying(true)}
            style={{ ...button('danger'), marginLeft: 'auto' }}
          >
            すべて完全に削除
          </button>
        )}
      </div>

      {!items.length ? (
        <div
          style={{
            ...card(space.card),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '56px 32px',
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden="true"
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
            🗑
          </span>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: COLORS.text }}>
            ごみ箱は空です
          </p>
          <p style={{ margin: 0, fontSize: '13.5px', color: COLORS.sub, lineHeight: 1.9 }}>
            問題やグループを削除すると、ここに移ります。
            <br />
            あとから元に戻せます。
          </p>
        </div>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: '12.5px', color: COLORS.sub, lineHeight: 1.8 }}>
            削除した問題とグループが入っています。「元に戻す」で復活します。
            新しいものから {TRASH_MAX} 件まで残り、それより古いものは自動で消えます。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((item) => {
              const { title, detail } = describe(item)
              return (
                <div
                  key={item.id}
                  style={{
                    ...card(compact ? 14 : 16),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: item.kind === 'group' ? COLORS.amberLight : COLORS.chipTrack,
                      color: item.kind === 'group' ? COLORS.amberDark : COLORS.body,
                      fontSize: '11.5px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.kind === 'group' ? 'グループ' : TYPE_LABELS[item.questions[0]?.type] ?? '問題'}
                  </span>

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: COLORS.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {title}
                    </span>
                    <span style={{ display: 'block', fontSize: '11.5px', color: COLORS.muted }}>
                      {detail} · {formatWhen(item.deletedAt)} に削除
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onRestore(item.id)}
                    style={{ ...button('primary'), minHeight: `${TAP_MIN - 8}px` }}
                  >
                    元に戻す
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurging(item)}
                    style={{ ...button('danger'), minHeight: `${TAP_MIN - 8}px` }}
                  >
                    完全に削除
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {purging && (
        <ConfirmDialog
          title="完全に削除しますか？"
          message="ごみ箱から消します。元に戻せません。"
          confirmLabel="完全に削除"
          onCancel={() => setPurging(null)}
          onConfirm={() => {
            onPurge(purging.id)
            setPurging(null)
          }}
        />
      )}

      {emptying && (
        <ConfirmDialog
          title="ごみ箱を空にしますか？"
          message={`${items.length}件をすべて消します。元に戻せません。`}
          confirmLabel="すべて完全に削除"
          onCancel={() => setEmptying(false)}
          onConfirm={() => {
            onEmpty()
            setEmptying(false)
          }}
        />
      )}
    </div>
  )
}
