import { LETTERS } from '../data/questions'

/** 「解説」「基本事項」で共通の見出しスタイル。 */
const sectionHeading = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#1e293b',
  margin: '0 0 10px 0',
  paddingBottom: '8px',
  borderBottom: '1px solid #e2e8f0',
}

/**
 * 右カラム：回答前はプレースホルダー、回答後は正解・解説・基本事項を表示。
 *
 * @param {{
 *   question: import('../data/questions').Question,
 *   selectedIndex: number | null,
 *   answered: boolean,
 * }} props
 */
export default function ResultCard({ question, selectedIndex, answered }) {
  const correctLetter = LETTERS[question.correctIndex]
  const showIncorrectNote = answered && selectedIndex !== question.correctIndex
  const userLetter = selectedIndex !== null ? LETTERS[selectedIndex] : ''

  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        border: '1px solid #eef2f7',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {answered ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* 正解表示行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#16a34a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '15px',
                flexShrink: 0,
              }}
            >
              {correctLetter}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '17px', fontWeight: 700, color: '#166534' }}>
                正解：{correctLetter}
              </span>
              {showIncorrectNote && (
                <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 700 }}>
                  あなたの回答：{userLetter}（不正解）
                </span>
              )}
            </div>
          </div>

          {/* 解説 */}
          <div>
            <h3 style={sectionHeading}>解説</h3>
            <p
              style={{
                fontSize: '14.5px',
                lineHeight: '1.9',
                color: '#334155',
                margin: 0,
              }}
            >
              {question.explanation}
            </p>
          </div>

          {/* 基本事項 */}
          <div>
            <h3 style={sectionHeading}>基本事項</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {question.keyPoints.map((kp, i) => (
                <li
                  key={i}
                  style={{ fontSize: '14px', lineHeight: '1.7', color: '#475569' }}
                >
                  {kp}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #cbd5e1',
            borderRadius: '16px',
            padding: '40px',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              color: '#94a3b8',
              textAlign: 'center',
              lineHeight: '1.8',
            }}
          >
            選択肢を選ぶと、ここに正解と解説が
            <br />
            表示されます
          </span>
        </div>
      )}
    </section>
  )
}
