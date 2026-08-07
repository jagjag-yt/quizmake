import { useCallback, useEffect, useMemo, useState } from 'react'
import { COLORS, LETTERS, MODES, MODE_LABELS, SPACING, VIEWS } from './constants'
import { questionKey } from './data/questions'
import { useStudyData } from './hooks/useStudyData'
import { useQuestionPool } from './hooks/useQuestionPool'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCompactLayout } from './hooks/useMediaQuery'
import { exportQuestionsToXlsx } from './utils/exportExcel'
import { makeOrder, reorderQuestion, shuffled } from './utils/shuffle'
import { isDue } from './utils/srs'
import { boxDistribution, dailySeries, overview, streakDays, subjectStats } from './utils/stats'
import ProgressHeader from './components/ProgressHeader'
import StudyToolbar from './components/StudyToolbar'
import QuestionCard from './components/QuestionCard'
import ResultCard from './components/ResultCard'
import FooterNav from './components/FooterNav'
import EmptyState from './components/EmptyState'
import ExcelLoader from './components/ExcelLoader'
import DataManager from './components/DataManager'
import ShortcutHelp from './components/ShortcutHelp'
import SessionSummary from './components/SessionSummary'
import Dashboard from './components/Dashboard'
import QuestionsView from './components/QuestionsView'
import EditorView from './components/EditorView'
import ExportModal from './components/ExportModal'
import ToastHost from './components/Toast'
import { useToast } from './hooks/useToast'

/** 科目・タグの絞り込み条件に合致するか。 */
function matchesFilters(q, subject, tag) {
  if (subject && q.subject !== subject) return false
  if (tag && !q.tags.includes(tag)) return false
  return true
}

/** 出題モード・絞り込み・出題数から、実際に出す問題を選ぶ。 */
function selectQuestions(source, records, { mode, subject, tag, limit }) {
  let list = source.filter((q) => matchesFilters(q, subject, tag))

  if (mode === MODES.BOOKMARKED) {
    list = list.filter((q) => records[questionKey(q)]?.bookmarked)
  } else if (mode === MODES.WRONG) {
    list = list.filter((q) => records[questionKey(q)]?.lastResult === 'incorrect')
  } else if (mode === MODES.DUE) {
    list = list.filter((q) => isDue(records[questionKey(q)]))
  }

  // 出題数を絞る場合はランダムに抽出し、並び自体は元の順序を保つ
  if (limit > 0 && list.length > limit) {
    const keep = new Set(shuffled(list.map((_, i) => i)).slice(0, limit))
    list = list.filter((_, i) => keep.has(i))
  }
  return list
}

/**
 * セッション（1回の演習）を組み立てる。
 * 出題リストと選択肢の並びはここで確定させ、以後は固定する
 * （回答するたびにリストが変わってしまうのを防ぐため）。
 */
function createSession(source, records, opts) {
  const list = opts.explicitList ?? selectQuestions(source, records, opts)
  const startedAt = Date.now()
  return {
    questions: list,
    orders: list.map((q) => makeOrder(q.choices.length)),
    mode: opts.mode,
    examMode: opts.examMode,
    startedAt,
    deadline:
      opts.examMode && opts.examMinutes > 0 ? startedAt + opts.examMinutes * 60_000 : null,
  }
}

const DEFAULT_OPTS = {
  mode: MODES.ALL,
  subject: '',
  tag: '',
  limit: 0,
  examMode: false,
  examMinutes: 0,
}

export default function App() {
  const study = useStudyData()
  // 作成分と読込分をまとめた出題プール（localStorage に永続化）
  const pool = useQuestionPool()
  const toast = useToast()
  // iPad 縦などの中間幅では余白を詰め、問題文と選択肢の幅を確保する
  const compact = useCompactLayout()
  const space = compact ? SPACING.compact : SPACING.wide

  const questions = pool.questions
  const [view, setView] = useState(VIEWS.QUIZ)
  const [helpOpen, setHelpOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  // 出題条件
  const [opts, setOpts] = useState(DEFAULT_OPTS)

  // セッションと進行状態
  const [session, setSession] = useState(() =>
    createSession(pool.questionsRef.current, study.dataRef.current.records, DEFAULT_OPTS),
  )
  const [answers, setAnswers] = useState({}) // { [問題インデックス]: 回答記録 }
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draft, setDraft] = useState([]) // 「2つ選べ」で選択中の選択肢
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [finishedAt, setFinishedAt] = useState(null)

  const records = study.data.records
  const total = session.questions.length
  const baseQuestion = session.questions[currentIndex] ?? null
  const displayQuestion = baseQuestion
    ? reorderQuestion(baseQuestion, session.orders[currentIndex])
    : null

  const answerRec = answers[currentIndex] ?? null
  const answered = answerRec != null
  const selected = answered ? answerRec.selectedIndexes : draft

  const key = baseQuestion ? questionKey(baseQuestion) : ''
  const record = study.getRecord(key)

  /** 新しいセッションを開始する。 */
  const startSession = useCallback(
    (nextOpts, { source = questions, explicitList = null } = {}) => {
      const merged = { ...nextOpts, explicitList }
      setSession(createSession(source, study.dataRef.current.records, merged))
      setAnswers({})
      setCurrentIndex(0)
      setDraft([])
      setFinishedAt(null)
      setNowTs(Date.now())
      setView(VIEWS.QUIZ)
    },
    [questions, study.dataRef],
  )

  /** 出題条件の変更（変更のたびにセッションを組み直す）。 */
  const updateOpts = useCallback(
    (patch) => {
      const next = { ...opts, ...patch }
      setOpts(next)
      startSession(next)
    },
    [opts, startSession],
  )

  /** 演習を終了して結果画面へ。 */
  const finish = useCallback(() => {
    setFinishedAt((prev) => prev ?? Date.now())
    setView(VIEWS.SUMMARY)
  }, [])

  // 本番モードの残り時間（1秒ごとに更新）
  useEffect(() => {
    if (!session.deadline || view !== VIEWS.QUIZ) return undefined
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [session.deadline, view])

  // 制限時間に達したら自動的に終了する
  useEffect(() => {
    if (view === VIEWS.QUIZ && session.deadline && nowTs >= session.deadline) finish()
  }, [view, session.deadline, nowTs, finish])

  const remainingSec = session.deadline
    ? Math.max(0, Math.ceil((session.deadline - nowTs) / 1000))
    : null

  /** 回答を確定する。 */
  const submitAnswer = useCallback(
    (sel) => {
      if (!displayQuestion || answered) return
      const correctIndexes = displayQuestion.correctIndexes
      const isCorrect =
        sel.length === correctIndexes.length && correctIndexes.every((i) => sel.includes(i))
      const sorted = [...sel].sort((a, b) => a - b)

      setAnswers((prev) => ({
        ...prev,
        [currentIndex]: {
          correct: isCorrect,
          selectedIndexes: sorted,
          selectedLetters: sorted.map((i) => LETTERS[i]).join('・'),
          correctLetters: correctIndexes.map((i) => LETTERS[i]).join('・'),
        },
      }))
      setDraft([])
      study.recordAnswer(key, isCorrect)
    },
    [displayQuestion, answered, currentIndex, key, study],
  )

  /** 選択肢のクリック。単一選択は即採点、複数選択はトグル。 */
  const toggleChoice = useCallback(
    (idx) => {
      if (!displayQuestion || answered) return
      const need = displayQuestion.correctIndexes.length
      if (need <= 1) {
        submitAnswer([idx])
        return
      }
      setDraft((prev) => {
        if (prev.includes(idx)) return prev.filter((i) => i !== idx)
        if (prev.length >= need) return prev // 必要数を超えて選べない
        return [...prev, idx]
      })
    },
    [displayQuestion, answered, submitAnswer],
  )

  const goTo = useCallback((idx) => {
    setCurrentIndex(idx)
    setDraft([])
  }, [])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1))
    setDraft([])
  }, [])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(total - 1, i + 1))
    setDraft([])
  }, [total])

  /** リトライ：この問題の回答を取り消し、選択肢を並べ直す。 */
  const retry = useCallback(() => {
    if (!answered || session.examMode) return
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[currentIndex]
      return next
    })
    setSession((prev) => {
      const orders = [...prev.orders]
      orders[currentIndex] = makeOrder(prev.questions[currentIndex].choices.length)
      return { ...prev, orders }
    })
    setDraft([])
  }, [answered, session.examMode, currentIndex])

  /** 「問題〇」への番号ジャンプ（枝番「12-2」も文字列として照合する）。 */
  const jumpToNumber = useCallback(
    (num) => {
      const idx = session.questions.findIndex(
        (q) => String(q.questionNumber) === String(num),
      )
      if (idx === -1) return false
      goTo(idx)
      return true
    },
    [session.questions, goTo],
  )

  /**
   * Excel 読み込み：プールへ追加し（番号が衝突したら枝番）、
   * 読み込んだ問題で演習を始められるようにする。
   */
  const loadQuestions = useCallback(
    (loaded) => {
      pool.importQuestions(loaded)
      setOpts(DEFAULT_OPTS)
      startSession(DEFAULT_OPTS, { source: [...pool.questionsRef.current, ...loaded] })
      toast.show({
        tone: 'success',
        title: `${loaded.length}問を読み込みました`,
        description: '設問一覧とクイズ作成から編集できます',
      })
    },
    [pool, startSession, toast],
  )

  /** 一覧などから、指定した問題リストで演習を始める。 */
  const startQuizWith = useCallback(
    (list, { shuffle = false, startAtId = null } = {}) => {
      if (!list.length) return
      const ordered = shuffle ? shuffled(list) : list
      startSession({ ...opts, examMode: false }, { explicitList: ordered })
      if (startAtId) {
        const idx = ordered.findIndex((q) => q.id === startAtId)
        if (idx > 0) setCurrentIndex(idx)
      }
    },
    [opts, startSession],
  )

  /** Excel 書き出し。 */
  const runExport = useCallback(
    async (list) => {
      setExportOpen(false)
      try {
        const { fileName, count } = await exportQuestionsToXlsx(list)
        toast.show({
          tone: 'success',
          title: `${fileName} を書き出しました`,
          description: 'ダウンロードフォルダに保存されました',
        })
        return count
      } catch {
        toast.show({ tone: 'error', title: '書き出しに失敗しました' })
        return 0
      }
    },
    [toast],
  )

  /** 結果画面から「間違えた問題を復習」。 */
  const reviewWrong = useCallback(() => {
    const wrong = session.questions.filter((_, i) => answers[i] && !answers[i].correct)
    if (!wrong.length) return
    startSession({ ...opts, examMode: false }, { explicitList: wrong })
  }, [session.questions, answers, opts, startSession])

  const resetAll = useCallback(() => {
    const sure = window.confirm(
      '学習記録（正答率・ブックマーク・メモ・復習予定）をすべて削除します。\nこの操作は取り消せません。続行しますか？',
    )
    if (sure) study.resetAll()
  }, [study])

  // --- 一覧・集計 ---
  const subjects = useMemo(
    () => [...new Set(questions.map((q) => q.subject).filter(Boolean))].sort(),
    [questions],
  )
  const tags = useMemo(
    () => [...new Set(questions.flatMap((q) => q.tags))].sort(),
    [questions],
  )

  const counts = useMemo(() => {
    const base = questions.filter((q) => matchesFilters(q, opts.subject, opts.tag))
    const rec = (q) => records[questionKey(q)]
    return {
      [MODES.ALL]: base.length,
      [MODES.BOOKMARKED]: base.filter((q) => rec(q)?.bookmarked).length,
      [MODES.WRONG]: base.filter((q) => rec(q)?.lastResult === 'incorrect').length,
      [MODES.DUE]: base.filter((q) => isDue(rec(q))).length,
    }
  }, [questions, opts.subject, opts.tag, records])

  const dashboard = useMemo(
    () => ({
      overview: overview(questions, records, questionKey, study.data.totals),
      series: dailySeries(study.data.daily, 30),
      subjects: subjectStats(questions, records, questionKey),
      boxes: boxDistribution(questions, records, questionKey),
      streak: streakDays(study.data.daily),
    }),
    [questions, records, study.data.totals, study.data.daily],
  )

  // --- キーボードショートカット（演習画面のみ） ---
  const shortcutHandlers = useMemo(
    () => ({
      onChoice: (idx) => {
        if (displayQuestion && idx < displayQuestion.choices.length) toggleChoice(idx)
      },
      onEnter: () => {
        if (!displayQuestion) return
        const need = displayQuestion.correctIndexes.length
        if (!answered && need > 1 && draft.length === need) {
          submitAnswer(draft)
        } else if (answered) {
          if (currentIndex >= total - 1) finish()
          else goNext()
        }
      },
      onNext: () => (currentIndex >= total - 1 ? finish() : goNext()),
      onPrev: goPrev,
      onRetry: retry,
      onBookmark: () => key && study.toggleBookmark(key),
      onHelp: () => setHelpOpen((v) => !v),
    }),
    [
      displayQuestion,
      answered,
      draft,
      currentIndex,
      total,
      toggleChoice,
      submitAnswer,
      goNext,
      goPrev,
      retry,
      finish,
      key,
      study,
    ],
  )
  useKeyboardShortcuts(shortcutHandlers, view === VIEWS.QUIZ)

  const answerList = session.questions.map((_, i) => answers[i] ?? null)
  const elapsedSec = ((finishedAt ?? Date.now()) - session.startedAt) / 1000

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.bg,
        fontFamily: "'Noto Sans JP', sans-serif",
        color: COLORS.text,
      }}
    >
      <ProgressHeader
        view={view}
        onChangeView={setView}
        position={total > 0 ? currentIndex + 1 : 0}
        total={total}
        questionTotal={questions.length}
        accuracy={dashboard.overview.accuracy}
        stats={study.data.totals}
        onResetStats={study.resetStats}
        examMode={session.examMode}
        remainingSec={remainingSec}
        savedAt={pool.savedAt}
        onExport={() => setExportOpen(true)}
      >
        <ExcelLoader onLoad={loadQuestions} />
        <DataManager onExport={study.exportJson} onImport={study.importData} />
        <ShortcutHelp open={helpOpen} onToggle={() => setHelpOpen((v) => !v)} />
      </ProgressHeader>

      {study.saveError && (
        <div
          role="alert"
          style={{
            padding: '10px 32px',
            background: COLORS.redLight,
            color: COLORS.redDark,
            fontSize: '13px',
            fontWeight: 700,
            borderBottom: `1px solid ${COLORS.red}`,
          }}
        >
          {study.saveError}
        </div>
      )}

      {view === VIEWS.QUIZ && (
        <StudyToolbar
          mode={opts.mode}
          onChangeMode={(mode) => updateOpts({ mode })}
          counts={counts}
          subjects={subjects}
          subject={opts.subject}
          onChangeSubject={(subject) => updateOpts({ subject })}
          tags={tags}
          tag={opts.tag}
          onChangeTag={(tag) => updateOpts({ tag })}
          limit={opts.limit}
          onChangeLimit={(limit) => updateOpts({ limit })}
          examMode={opts.examMode}
          onChangeExamMode={(examMode) => updateOpts({ examMode })}
          examMinutes={opts.examMinutes}
          onChangeExamMinutes={(examMinutes) => updateOpts({ examMinutes })}
          onRestart={() => startSession(opts)}
        />
      )}

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          padding: `${space.mainTop}px ${space.pageX}px 12px ${space.pageX}px`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${space.gap}px`,
          alignItems: 'stretch',
        }}
      >
        {view === VIEWS.QUESTIONS ? (
          <QuestionsView
            questions={questions}
            getRecord={study.getRecord}
            onToggleBookmark={study.toggleBookmark}
            onSaveNote={study.setNote}
            onStartQuiz={startQuizWith}
            onImportClick={() => document.querySelector('input[accept=".xlsx,.xls"]')?.click()}
            onCreateClick={() => {
              setEditingId(pool.addQuestion())
              setView(VIEWS.EDITOR)
            }}
            onBulkBookmark={(ids) => {
              const picked = questions.filter((q) => ids.includes(q.id))
              picked.forEach((q) => {
                const rec = study.getRecord(questionKey(q))
                if (!rec.bookmarked) study.toggleBookmark(questionKey(q))
              })
              toast.show({
                tone: 'info',
                title: `${picked.length}問にブックマークを付けました`,
                actionLabel: '元に戻す',
                onAction: () =>
                  picked.forEach((q) => study.toggleBookmark(questionKey(q))),
              })
            }}
            onBulkTag={(ids, tag) => {
              pool.addTagToQuestions(ids, tag)
              toast.show({ tone: 'info', title: `${ids.length}問に「${tag}」を付与しました` })
            }}
            loading={false}
          />
        ) : view === VIEWS.EDITOR ? (
          <EditorView
            questions={questions}
            authored={pool.authored}
            imported={pool.imported}
            selectedId={editingId}
            onSelect={setEditingId}
            onAdd={pool.addQuestion}
            onUpdate={pool.updateQuestion}
            onRemove={pool.removeQuestion}
            onDuplicate={pool.duplicateQuestion}
            onReorderAuthored={pool.reorderAuthored}
            onImportClick={() => document.querySelector('input[accept=".xlsx,.xls"]')?.click()}
            subjects={subjects}
          />
        ) : view === VIEWS.DASHBOARD ? (
          <Dashboard
            overview={dashboard.overview}
            series={dashboard.series}
            subjects={dashboard.subjects}
            boxes={dashboard.boxes}
            streak={dashboard.streak}
            dueCount={counts[MODES.DUE]}
            onResetAll={resetAll}
          />
        ) : view === VIEWS.SUMMARY ? (
          <SessionSummary
            questions={session.questions}
            answers={answerList}
            elapsedSec={elapsedSec}
            onReviewWrong={reviewWrong}
            onRestart={() => startSession(opts)}
            onOpenDashboard={() => setView(VIEWS.DASHBOARD)}
            onJumpTo={(i) => {
              goTo(i)
              setView(VIEWS.QUIZ)
            }}
          />
        ) : displayQuestion ? (
          <>
            <QuestionCard
              question={displayQuestion}
              selected={selected}
              answered={answered}
              examMode={session.examMode}
              onToggleChoice={toggleChoice}
              onSubmit={() => submitAnswer(draft)}
              bookmarked={record.bookmarked}
              onToggleBookmark={() => study.toggleBookmark(key)}
              onJump={jumpToNumber}
            />
            <ResultCard
              question={displayQuestion}
              selected={selected}
              answered={answered}
              examMode={session.examMode}
              noteKey={key}
              note={record.note}
              onSaveNote={(note) => study.setNote(key, note)}
            />
          </>
        ) : (
          <EmptyState
            icon={opts.mode === MODES.BOOKMARKED ? '☆' : '🎉'}
            title={`${MODE_LABELS[opts.mode].label}の対象がありません`}
            message={
              opts.mode === MODES.BOOKMARKED
                ? '問題カード右上の ☆ ブックマーク を押すと、ここに集まります。'
                : opts.mode === MODES.WRONG
                  ? '間違えた問題はありません。この調子で進めましょう。'
                  : opts.mode === MODES.DUE
                    ? '今日の復習は完了しています。新しい問題に挑戦しましょう。'
                    : '絞り込み条件に合う問題がありません。条件を変えてください。'
            }
            actionLabel="全問題に戻る"
            onAction={() => updateOpts({ mode: MODES.ALL, subject: '', tag: '' })}
          />
        )}
      </main>

      {view === VIEWS.QUIZ && displayQuestion && (
        <FooterNav
          isFirst={currentIndex === 0}
          isLast={currentIndex === total - 1}
          answered={answered}
          examMode={session.examMode}
          onPrev={goPrev}
          onRetry={retry}
          onNext={goNext}
          onFinish={finish}
        />
      )}

      {exportOpen && (
        <ExportModal
          questions={questions}
          onClose={() => setExportOpen(false)}
          onExport={runExport}
        />
      )}

      <ToastHost toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  )
}
