import { COLORS, SPACING, VIEWS } from '../constants'
import { useCompactLayout } from '../hooks/useMediaQuery'
import { AppLogo, DrawerToggle } from './AppDrawer'
import { formatDuration } from '../utils/safe'

/** 本番モードの残り時間表示。残り1分を切ると赤くなる。 */
function ExamTimer({ remainingSec }) {
  const danger = remainingSec <= 60
  return (
    <span
      title="本番モードの残り時間"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '999px',
        background: danger ? COLORS.redLight : COLORS.chipTrack,
        color: danger ? COLORS.red : COLORS.body,
        fontSize: '13px',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      &#9203; {formatDuration(remainingSec)}
    </span>
  )
}

/**
 * 上部ヘッダー。
 * 左：≡（メニュー）＋ ロゴ
 * 右：タブごとに出し分け（SPEC の NAV / right-slot は TAB-CONDITIONAL）
 *
 * @param {{
 *   view: string, drawerOpen: boolean, onToggleDrawer: () => void, onLogoClick: () => void,
 *   position: number, total: number, questionTotal: number,
 *   examMode: boolean, remainingSec: number|null,
 *   savedAt: Date|null,
 * }} props
 */
export default function ProgressHeader({
  view,
  drawerOpen,
  onToggleDrawer,
  onLogoClick,
  position,
  total,
  questionTotal,
  examMode,
  remainingSec,
  clozeMode,
  savedAt,
}) {
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide
  const fillPct = total > 0 ? (position / total) * 100 : 0

  const savedLabel = savedAt
    ? `${String(savedAt.getHours()).padStart(2, '0')}:${String(savedAt.getMinutes()).padStart(2, '0')}`
    : null

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: compact ? '10px' : '16px',
        flexWrap: 'wrap',
        padding: `calc(${space.headerY}px + env(safe-area-inset-top, 0px)) ${space.pageX}px ${space.headerY}px`,
        background: COLORS.card,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '8px' : '12px',
          flexWrap: 'wrap',
        }}
      >
        <DrawerToggle open={drawerOpen} onToggle={onToggleDrawer} />
        <AppLogo onClick={onLogoClick} compact={compact} />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          minWidth: compact ? 0 : '220px',
        }}
      >
        {/* 虫食い（PC）は正答率を出さないため、採点対象外・n/N問目・進捗バーを横1行に並べる（SPEC C） */}
        {view === VIEWS.QUIZ && clozeMode && !compact ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-end' }}>
            {examMode && remainingSec != null && <ExamTimer remainingSec={remainingSec} />}
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub, whiteSpace: 'nowrap' }}>
              虫食いは採点対象外
            </span>
            <span style={{ width: '1px', height: '24px', background: COLORS.border }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.blue, whiteSpace: 'nowrap' }}>
              虫食い {position}/{total}問目
            </span>
            <div
              style={{
                width: '220px',
                height: '6px',
                borderRadius: '999px',
                background: COLORS.border,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: '999px',
                  background: COLORS.blue,
                  width: `${fillPct}%`,
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        ) : (
          <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {view === VIEWS.QUIZ && examMode && remainingSec != null && (
            <ExamTimer remainingSec={remainingSec} />
          )}

          {view === VIEWS.QUIZ && clozeMode ? (
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.sub, whiteSpace: 'nowrap' }}>
              虫食いは採点対象外
            </span>
          ) : view === VIEWS.EDITOR ? (
            <span style={{ fontSize: '12.5px', color: COLORS.sub, whiteSpace: 'nowrap' }}>
              {savedLabel ? `✓ 自動保存済み ${savedLabel}` : '✓ 自動保存'}
            </span>
          ) : null}
        </div>

        {view === VIEWS.QUIZ && (
          <>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.blue }}>
              {clozeMode ? '虫食い' : '演習'} {position}/{total}問目
            </span>
            <div
              style={{
                width: '220px',
                height: '6px',
                borderRadius: '999px',
                background: COLORS.border,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: '999px',
                  background: COLORS.blue,
                  width: `${fillPct}%`,
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </>
        )}

        {view === VIEWS.QUESTIONS && (
          <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.blue }}>
            全 {questionTotal} 問
          </span>
        )}
          </>
        )}
      </div>
    </header>
  )
}
