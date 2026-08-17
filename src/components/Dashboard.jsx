import { COLORS, SPACING } from '../constants'
import { useCompactLayout, usePhoneLayout } from '../hooks/useMediaQuery'
import { BOX_LABELS } from '../utils/srs'

/**
 * 学習ダッシュボード。
 * グラフは外部ライブラリを使わず、SVG と CSS で描画している
 * （依存を増やさない＝ライセンス・脆弱性の管理対象を増やさないため）。
 */

/** カードの外観。余白だけ画面幅に応じて差し替える。 */
const cardStyle = (space) => ({
  background: COLORS.card,
  borderRadius: '20px',
  padding: `${space.card}px`,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  border: `1px solid ${COLORS.cardBorder}`,
})

const cardTitle = {
  margin: '0 0 16px 0',
  fontSize: '15px',
  fontWeight: 700,
  color: COLORS.text,
}

function Stat({ label, value, sub, color = COLORS.text }) {
  return (
    <div
      style={{
        flex: '1 1 150px',
        padding: '16px 18px',
        borderRadius: '14px',
        background: COLORS.bg,
        border: `1px solid ${COLORS.cardBorder}`,
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.sub }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color, lineHeight: 1.4 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: COLORS.muted }}>{sub}</div>}
    </div>
  )
}

/** 日別の学習量（正解/不正解の積み上げ棒グラフ）。 */
function DailyChart({ series }) {
  // スマホではカードの内側が 276px しかなく、最小幅 320px のままだと
  // グラフがカードからはみ出して切れる（実測: 右端 363px / カード右端 340px）。
  // viewBox で縮むので、最小幅を外して画面に収める。
  const phone = usePhoneLayout()
  const W = 640
  const H = 150
  const max = Math.max(1, ...series.map((d) => d.answered))
  const slot = W / series.length
  const barW = Math.max(3, slot - 3)

  return (
    <div style={{ overflowX: 'auto', minWidth: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="直近30日の学習量"
        style={{ display: 'block', minWidth: phone ? 0 : '320px' }}
      >
        <title>直近30日の学習量（緑＝正解、赤＝不正解）</title>
        {/* 基準線 */}
        <line x1="0" y1={H - 20} x2={W} y2={H - 20} stroke={COLORS.border} strokeWidth="1" />
        {series.map((d, i) => {
          const total = (d.answered / max) * (H - 34)
          const correctH = d.answered ? (d.correct / d.answered) * total : 0
          const wrongH = total - correctH
          const x = i * slot + (slot - barW) / 2
          const baseY = H - 20
          return (
            <g key={d.key}>
              <title>{`${d.key}：${d.answered}問（正解 ${d.correct}）`}</title>
              {wrongH > 0 && (
                <rect
                  x={x}
                  y={baseY - total}
                  width={barW}
                  height={wrongH}
                  fill={COLORS.red}
                  opacity="0.75"
                  rx="2"
                />
              )}
              {correctH > 0 && (
                <rect
                  x={x}
                  y={baseY - correctH}
                  width={barW}
                  height={correctH}
                  fill={COLORS.green}
                  rx="2"
                />
              )}
            </g>
          )
        })}
        {/* 端の日付ラベル */}
        <text x="0" y={H - 6} fontSize="10" fill={COLORS.muted}>
          {series[0]?.key.slice(5)}
        </text>
        <text x={W} y={H - 6} fontSize="10" fill={COLORS.muted} textAnchor="end">
          {series[series.length - 1]?.key.slice(5)}
        </text>
      </svg>
    </div>
  )
}

/** 横棒（割合表示）。 */
function BarRow({ label, ratio, valueText, color = COLORS.blue, sub }) {
  // スマホでは 110px + 112px の固定幅を並べるとバーが 30px しか残らない。
  // 名前を上の段に出し、バーと数値で1行を使い切る。
  const phone = usePhoneLayout()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: phone ? 'stretch' : 'center',
        flexDirection: phone ? 'column' : 'row',
        gap: phone ? '4px' : '12px',
      }}
    >
      <span
        style={{
          width: phone ? '100%' : '110px',
          flexShrink: 0,
          fontSize: '13px',
          fontWeight: 700,
          color: COLORS.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={label}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '10px',
          borderRadius: '999px',
          background: '#f1f5f9',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: '100%',
            borderRadius: '999px',
            background: color,
            transition: 'width 0.2s ease',
          }}
        />
      </div>
      <span
        style={{
          width: '112px',
          flexShrink: 0,
          textAlign: 'right',
          fontSize: '12px',
          color: COLORS.sub,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valueText}
        {sub && <span style={{ color: COLORS.muted }}> {sub}</span>}
      </span>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   overview: ReturnType<typeof import('../utils/stats').overview>,
 *   series: ReturnType<typeof import('../utils/stats').dailySeries>,
 *   groups: ReturnType<typeof import('../utils/stats').groupStats>,
 *   boxes: { counts: number[], unstudied: number },
 *   streak: number,
 *   dueCount: number,
 *   onResetStats: () => void, onResetAll: () => void,
 * }} props
 */
export default function Dashboard({
  overview,
  series,
  groups,
  boxes,
  streak,
  dueCount,
  cloze,
  onResetStats,
  onResetAll,
}) {
  const compact = useCompactLayout()
  const card = cardStyle(compact ? SPACING.compact : SPACING.wide)
  const studiedRatio = overview.totalQuestions
    ? overview.studied / overview.totalQuestions
    : 0
  const maxBox = Math.max(1, ...boxes.counts, boxes.unstudied)

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        // grid の子は既定で min-width:auto。0 にしないと中身の最小幅に押し広げられ、
        // スマホ（360px）で画面からはみ出す（実測 386px）
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <section style={card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            margin: '0 0 16px 0',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: COLORS.text }}>
            学習記録
          </h2>
          {/* 正答率はこの画面だけに出すことにしたので、リセットもここに置く */}
          <button
            type="button"
            onClick={onResetStats}
            title="正答率の記録をリセット"
            style={{
              marginLeft: 'auto',
              minHeight: '36px',
              padding: '0 14px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              color: COLORS.sub,
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            &#8635; 正答率をリセット
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Stat
            label="通算正答率"
            value={`${overview.accuracy}%`}
            sub={`${overview.correct} / ${overview.answered} 問`}
            color={COLORS.blue}
          />
          <Stat label="連続学習日数" value={`${streak}日`} color={COLORS.amberDark} />
          <Stat
            label="学習済みの問題"
            value={`${overview.studied} / ${overview.totalQuestions}`}
            sub={`カバー率 ${Math.round(studiedRatio * 100)}%`}
          />
          <Stat label="今日の復習" value={dueCount} sub="間隔反復の対象" color={COLORS.green} />
          <Stat
            label="要復習"
            value={overview.wrong}
            sub="直近で間違えた問題"
            color={overview.wrong > 0 ? COLORS.red : COLORS.text}
          />
        </div>
      </section>

      <section style={card}>
        <h3 style={cardTitle}>直近30日の学習量</h3>
        <DailyChart series={series} />
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          <span style={{ fontSize: '12px', color: COLORS.sub }}>
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: COLORS.green,
                marginRight: '6px',
              }}
            />
            正解
          </span>
          <span style={{ fontSize: '12px', color: COLORS.sub }}>
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: COLORS.red,
                opacity: 0.75,
                marginRight: '6px',
              }}
            />
            不正解
          </span>
        </div>
      </section>

      <section style={card}>
        <h3 style={cardTitle}>グループ別の正答率</h3>
        {groups.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13px', color: COLORS.muted }}>
            まだ学習記録がありません。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groups.map((s) => (
              <BarRow
                key={s.id}
                label={s.name}
                ratio={s.answered ? s.correct / s.answered : 0}
                valueText={s.answered ? `${s.accuracy}%` : '未学習'}
                sub={s.answered ? `(${s.correct}/${s.answered})` : `(0/${s.total}問)`}
                color={s.accuracy >= 80 ? COLORS.green : s.accuracy >= 50 ? COLORS.blue : COLORS.red}
              />
            ))}
          </div>
        )}
      </section>

      <section style={card}>
        <h3 style={cardTitle}>定着度（間隔反復のボックス）</h3>
        <p style={{ margin: '-8px 0 16px 0', fontSize: '12.5px', color: COLORS.sub }}>
          正解するほど右の箱へ進み、次に出題されるまでの間隔が延びます。間違えると最初の箱に戻ります。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <BarRow
            label="未学習"
            ratio={boxes.unstudied / maxBox}
            valueText={`${boxes.unstudied}問`}
            color={COLORS.muted}
          />
          {boxes.counts.map((count, i) => (
            <BarRow
              key={i}
              label={`箱${i}・${BOX_LABELS[i]}`}
              ratio={count / maxBox}
              valueText={`${count}問`}
              color={i === 0 ? COLORS.red : i >= 4 ? COLORS.green : COLORS.blue}
            />
          ))}
        </div>
      </section>

      {cloze && cloze.total > 0 && (
        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <h3 style={{ ...cardTitle, margin: 0 }}>虫食い</h3>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                background: COLORS.chipTrack,
                color: COLORS.body,
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              採点対象外
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Stat label="持っている問題" value={`${cloze.total} 問`} />
            <Stat label="今週見た問題" value={`${cloze.viewedThisWeek} 問`} color={COLORS.blue} />
            <Stat label="まだ見ていない" value={`${cloze.unviewed} 問`} color={COLORS.muted} />
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: COLORS.muted }}>
            {cloze.lastViewedAt
              ? `最終学習 ${cloze.lastViewedAt.replace(/-/g, '/')}`
              : 'まだ学習していません'}
          </div>
        </section>
      )}

      <section style={card}>
        <h3 style={cardTitle}>データの管理</h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: COLORS.sub, lineHeight: 1.8 }}>
          学習記録はこの端末のブラウザ内（localStorage）にのみ保存されます。外部には送信されません。
          <br />
          端末を移す前や、ブラウザのデータを消す前に「書き出し」でバックアップしてください。
        </p>
        <button
          type="button"
          onClick={onResetAll}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: `1px solid ${COLORS.red}`,
            background: COLORS.card,
            color: COLORS.red,
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          学習記録をすべて削除
        </button>
      </section>
    </div>
  )
}
