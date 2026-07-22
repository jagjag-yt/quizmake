import { useState } from 'react'
import { QUESTIONS } from './data/questions'
import { makeOrder, reorderQuestion } from './utils/shuffle'
import ProgressHeader from './components/ProgressHeader'
import QuestionCard from './components/QuestionCard'
import ResultCard from './components/ResultCard'
import FooterNav from './components/FooterNav'
import ExcelLoader from './components/ExcelLoader'

export default function App() {
  // 出題データ。初期は同梱の4問。Excel 読み込みで差し替え可能。
  const [questions, setQuestions] = useState(QUESTIONS)

  // --- State Management（README 準拠）---
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [answered, setAnswered] = useState(false)
  // 選択肢の表示順。問題移動・リトライ時に再シャッフルし、回答中は固定する。
  const [order, setOrder] = useState(() => makeOrder(QUESTIONS[0].choices.length))

  const total = questions.length
  const question = questions[currentIndex]
  // 表示用に選択肢を並び替えた問題（正解位置も追従）。selectedIndex はこの表示順基準。
  const displayQuestion = reorderQuestion(question, order)

  // Excel 読み込み成功時：出題データを差し替え、先頭問題へリセット
  const loadQuestions = (loaded) => {
    setQuestions(loaded)
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswered(false)
    setOrder(makeOrder(loaded[0].choices.length))
  }

  // 未回答のときのみ、選択肢を確定して回答済みにする
  const select = (idx) => {
    if (answered) return
    setSelectedIndex(idx)
    setAnswered(true)
  }

  // 同じ問題に留まったまま回答状態をリセット（回答済みのときのみ）。並びも再シャッフル。
  const retry = () => {
    if (!answered) return
    setSelectedIndex(null)
    setAnswered(false)
    setOrder(makeOrder(question.choices.length))
  }

  // 問題移動時は選択・回答状態をリセットし、移動先の選択肢を再シャッフル
  const goTo = (idx) => {
    setCurrentIndex(idx)
    setSelectedIndex(null)
    setAnswered(false)
    setOrder(makeOrder(questions[idx].choices.length))
  }

  const goPrev = () => {
    if (currentIndex === 0) return
    goTo(currentIndex - 1)
  }

  const goNext = () => {
    if (currentIndex === total - 1) return
    goTo(currentIndex + 1)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafc',
        fontFamily: "'Noto Sans JP', sans-serif",
        color: '#1e293b',
      }}
    >
      <ProgressHeader
        position={currentIndex + 1}
        total={total}
        slot={<ExcelLoader onLoad={loadQuestions} />}
      />

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '28px 32px 12px 32px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          alignItems: 'stretch',
        }}
      >
        <QuestionCard
          question={displayQuestion}
          selectedIndex={selectedIndex}
          answered={answered}
          onSelect={select}
        />
        <ResultCard
          question={displayQuestion}
          selectedIndex={selectedIndex}
          answered={answered}
        />
      </main>

      <FooterNav
        isFirst={currentIndex === 0}
        isLast={currentIndex === total - 1}
        answered={answered}
        onPrev={goPrev}
        onRetry={retry}
        onNext={goNext}
      />
    </div>
  )
}
