import { useEffect, useRef } from 'react'
import { ADS, COLORS, TAP_MIN } from '../constants'
import AdBanner from './AdBanner'

/**
 * 演習を始める前に1枚だけ挟む広告の画面。
 *
 * **重ねる（ポップアップ）のではなく、本文と入れ替える1枚の画面にする。**
 * AdSense は「ポップアップの中の広告」を認めていないため、演習画面の上に
 * かぶせる作りにはしない。ここは本文そのものとして描く。
 *
 * **いつでもすぐ閉じられること（非交渉）。** 秒読みで閉じさせない・閉じるボタンを
 * 小さくしない・押しにくい場所に置かない。右上の［スキップ］と下の［演習をはじめる］は
 * どちらも同じで、押した瞬間に演習へ進む。Esc でも進む。
 * 閉じにくい広告は、規約の面でも、使い勝手の面でも損しかしない。
 */
export default function AdInterstitial({ onClose }) {
  const skipRef = useRef(null)

  // 開いた瞬間に［スキップ］へフォーカスを置く。Enter や Space でそのまま進める
  useEffect(() => {
    skipRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const skipButton = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minHeight: `${TAP_MIN}px`,
    padding: '0 20px',
    borderRadius: '999px',
    border: `1px solid ${COLORS.border}`,
    background: COLORS.card,
    color: COLORS.body,
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        alignItems: 'center',
        padding: '24px 0',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '13px', color: COLORS.sub }}>
          広告のあとに演習が始まります
        </span>
        <button
          ref={skipRef}
          type="button"
          onClick={onClose}
          style={{ ...skipButton, marginLeft: 'auto' }}
        >
          スキップ ✕
        </button>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          padding: '16px',
          borderRadius: '20px',
          border: `1px solid ${COLORS.cardBorder}`,
          background: COLORS.card,
        }}
      >
        <AdBanner slot={ADS.SLOT_START} minHeight={250} />
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          width: '100%',
          maxWidth: '720px',
          minHeight: '52px',
          borderRadius: '14px',
          border: `1px solid ${COLORS.blue}`,
          background: COLORS.blue,
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        ▶ 演習をはじめる
      </button>

      <p style={{ margin: 0, fontSize: '12px', color: COLORS.muted, lineHeight: 1.8, textAlign: 'center' }}>
        広告は、このアプリを無料で続けるための費用にあてています。
      </p>
    </div>
  )
}
