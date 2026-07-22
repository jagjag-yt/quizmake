import { useMemo, useState } from 'react'
import { QUESTIONS, questionKey } from './data/questions'
import { makeOrder, reorderQuestion } from './utils/shuffle'
import { usePersistentState } from './hooks/usePersistentState'
import ProgressHeader from './components/ProgressHeader'
import QuestionCard from './components/QuestionCard'
import ResultCard from './components/ResultCard'
import FooterNav from './components/FooterNav'
import EmptyBookmarks from './components/EmptyBookmarks'
import ExcelLoader from './components/ExcelLoader'

export default function App() {
  // 出題データ。初期は同梱の4問。Excel 読み込みで差し替え可能。
  const [questions, setQuestions] = useState(QUESTIONS)

  // 出題モード：'all'（全問題） / 'bookmarked'（ブックマークのみ）
  const [mode, setMode] = useState('all')
  // ブックマーク（問題キーの配列）と正答率の記録は localStorage に永続化
  const [bookmarks, setBookmarks] = usePersistentState('quizmake.bookmarks.v1', [])
  const [stats, setStats] = usePersistentState('quizmake.stats.v1', { answered: 0, correct: 0 })

  // --- 演習の進行状態 ---
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [answered, setAnswered] = useState(false)
  // 選択肢の表示順。問題移動・リトライ時に再シャッフルし、回答中は固定する。
  const [order, setOrder] = useState(() => makeOrder(QUESTIONS[0].choices.length))

  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks])

  // 現在のモードで出題対象となる問題リスト
  const activeQuestions = useMemo(
    () =>
      mode === 'bookmarked'
        ? questions.filter((q) => bookmarkSet.has(questionKey(q)))
        : questions,
    [mode, questions, bookmarkSet],
  )

  const total = activeQuestions.length
  const question = activeQuestions[currentIndex] // 空リスト時は undefined
  const displayQuestion = question ? reorderQuestion(question, order) : null
  const isBookmarked = question ? bookmarkSet.has(questionKey(question)) : false

  const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0

  // 指定インデックスの問題へ移動（選択・回答状態リセット＋選択肢再シャッフル）
  const goTo = (idx, list = activeQuestions) => {
    setCurrentIndex(idx)
    setSelectedIndex(null)
    setAnswered(false)
    if (list[idx]) setOrder(makeOrder(list[idx].choices.length))
  }

  // 未回答のときのみ、選択肢を確定して回答済みにし、正答率を記録
  const select = (idx) => {
    if (answered || !displayQuestion) return
    setSelectedIndex(idx)
    setAnswered(true)
    const correct = idx === displayQuestion.correctIndex
    setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0) }))
  }

  // 同じ問題に留まったまま回答状態をリセット（回答済みのときのみ）。並びも再シャッフル。
  const retry = () => {
    if (!answered || !question) return
    setSelectedIndex(null)
    setAnswered(false)
    setOrder(makeOrder(question.choices.length))
  }

  const goPrev = () => {
    if (currentIndex <= 0) return
    goTo(currentIndex - 1)
  }

  const goNext = () => {
    if (currentIndex >= total - 1) return
    goTo(currentIndex + 1)
  }

  // 「問題〇」への番号ジャンプ。activeQuestions 内で questionNumber が一致する問題へ移動。
  // 見つかれば true、無ければ false（呼び出し側で入力を元に戻す）。
  const jumpToNumber = (num) => {
    const idx = activeQuestions.findIndex((q) => q.questionNumber === num)
    if (idx === -1) return false
    goTo(idx)
    return true
  }

  // 現在の問題のブックマークをトグル
  const toggleBookmark = () => {
    if (!question) return
    const key = questionKey(question)
    const removing = bookmarkSet.has(key)
    const next = removing ? bookmarks.filter((k) => k !== key) : [...bookmarks, key]
    setBookmarks(next)

    // ブックマークのみ表示中に現在の問題を外した場合、リストが縮むので位置を補正
    if (removing && mode === 'bookmarked') {
      const nextSet = new Set(next)
      const newActive = questions.filter((q) => nextSet.has(questionKey(q)))
      const clamped = Math.max(0, Math.min(currentIndex, newActive.length - 1))
      goTo(clamped, newActive)
    }
  }

  // モード切替（先頭問題へリセット）
  const changeMode = (m) => {
    if (m === mode) return
    setMode(m)
    const list =
      m === 'bookmarked'
        ? questions.filter((q) => bookmarkSet.has(questionKey(q)))
        : questions
    goTo(0, list)
  }

  // Excel 読み込み成功時：出題データを差し替え、全問題モードで先頭へリセット
  const loadQuestions = (loaded) => {
    setQuestions(loaded)
    setMode('all')
    goTo(0, loaded)
  }

  const resetStats = () => setStats({ answered: 0, correct: 0 })

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
        position={total > 0 ? currentIndex + 1 : 0}
        total={total}
        mode={mode}
        onChangeMode={changeMode}
        bookmarkCount={bookmarks.length}
        accuracy={accuracy}
        stats={stats}
        onResetStats={resetStats}
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
        {displayQuestion ? (
          <>
            <QuestionCard
              question={displayQuestion}
              selectedIndex={selectedIndex}
              answered={answered}
              onSelect={select}
              bookmarked={isBookmarked}
              onToggleBookmark={toggleBookmark}
              onJump={jumpToNumber}
            />
            <ResultCard
              question={displayQuestion}
              selectedIndex={selectedIndex}
              answered={answered}
            />
          </>
        ) : (
          <EmptyBookmarks onBackToAll={() => changeMode('all')} />
        )}
      </main>

      <FooterNav
        isFirst={total === 0 || currentIndex === 0}
        isLast={total === 0 || currentIndex === total - 1}
        answered={answered}
        onPrev={goPrev}
        onRetry={retry}
        onNext={goNext}
      />
    </div>
  )
}
