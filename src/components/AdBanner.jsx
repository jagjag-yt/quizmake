import { useEffect, useRef } from 'react'
import { ADS, COLORS } from '../constants'

/**
 * 広告（Google AdSense）のバナー1枠。
 *
 * **発行者ID（VITE_AD_CLIENT）と広告ユニットID が両方そろうまで、何も描かない。**
 * 審査待ちのあいだに空っぽの枠や「広告」の文字だけが残ると、画面が壊れて見えるうえ、
 * 審査で「価値の低いコンテンツ」と受け取られかねないため。
 *
 * 置き場所の決まり（ポリシー・非交渉）:
 *   ・**選択肢のすぐ横や下には置かない。** 押し間違いを誘う配置は規約違反にあたる。
 *   ・広告だと分かるように「広告」と添える。中身の見出しに見せかけない。
 *   ・1画面に何枚も並べない。
 */
export default function AdBanner({ slot, minHeight = 100, style }) {
  const ref = useRef(null)
  // 同じ枠に二重に配信を頼まない（React の再描画で「もう広告がある」と怒られる）
  const pushed = useRef(false)
  const enabled = Boolean(ADS.CLIENT && slot)

  useEffect(() => {
    if (!enabled) return undefined
    const el = ref.current
    if (!el) return undefined

    /**
     * 幅が決まってから頼む。
     * 幅0のまま push すると AdSense が "No slot size for availableWidth=0" で失敗し、
     * その枠は二度と埋まらない（たたまれた列や開く前のドロワーの中で起きる）。
     */
    const request = () => {
      if (pushed.current) return true
      if (el.getBoundingClientRect().width < 1) return false
      pushed.current = true
      try {
        loadAdScript()
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch {
        // 広告が出せなくても学習は続けられる。画面は壊さない
      }
      return true
    }

    if (request()) return undefined
    // まだ幅が無いときは、広がるのを待ってから1回だけ頼む
    const observer = new ResizeObserver(() => {
      if (request()) observer.disconnect()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled])

  if (!enabled) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, ...style }}>
      <span style={{ fontSize: '11px', color: COLORS.muted, letterSpacing: '0.04em' }}>広告</span>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: `${minHeight}px` }}
        data-ad-client={ADS.CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}

/** AdSense の読み込みは1回だけ。枠の数だけ読み込むと表示が遅くなる。 */
let scriptAdded = false
function loadAdScript() {
  if (scriptAdded || !ADS.CLIENT || typeof document === 'undefined') return
  scriptAdded = true
  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADS.CLIENT)}`
  document.head.appendChild(script)
}
