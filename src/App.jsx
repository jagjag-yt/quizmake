import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COLORS,
  LETTERS,
  LIMITS,
  MODES,
  MODE_LABELS,
  QUESTION_TYPES,
  SPACING,
  VIEWS,
} from './constants'
import { compactQuestion, isCloze, isGraded, questionKey } from './data/questions'
import { hiddenCount } from './data/cloze'
import { useStudyData } from './hooks/useStudyData'
import { useQuestionPool } from './hooks/useQuestionPool'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCompactLayout, usePhoneLayout } from './hooks/useMediaQuery'
import { exportQuestionsToXlsx } from './utils/exportExcel'
import { backupFileName, downloadJson } from './utils/backupFile'
import { buildExport, parseImport } from './storage/store'
import { makeOrder, reorderQuestion, shuffled } from './utils/shuffle'
import { isDue } from './utils/srs'
import { boxDistribution, clozeStats, dailySeries, groupStats, overview, streakDays } from './utils/stats'
import ProgressHeader from './components/ProgressHeader'
import StudyToolbar from './components/StudyToolbar'
import QuestionCard from './components/QuestionCard'
import ResultCard from './components/ResultCard'
import FooterNav from './components/FooterNav'
import EmptyState from './components/EmptyState'
import DataTransfer, { TransferInput } from './components/DataTransfer'
import AppDrawer from './components/AppDrawer'
import OfflineNotice from './components/OfflineNotice'
import SettingsView from './components/SettingsView'
import AccountView from './components/AccountView'
import TrashView from './components/TrashView'
import ConfirmDialog from './components/ConfirmDialog'
import ShortcutHelp from './components/ShortcutHelp'
import SessionSummary from './components/SessionSummary'
import Dashboard from './components/Dashboard'
import QuestionsView from './components/QuestionsView'
import GroupsView from './components/GroupsView'
import EditorView from './components/EditorView'
import ExportModal from './components/ExportModal'
import ClozeQuizView from './components/ClozeQuizView'
import TypePickerDialog from './components/TypePickerDialog'
import ToastHost from './components/Toast'
import { useToast } from './hooks/useToast'

/** グループの絞り込み条件に合致するか。 */
function matchesFilters(q, groupId) {
  if (groupId && q.groupId !== groupId) return false
  return true
}

/** 出題モード・絞り込み・出題数から、実際に出す問題を選ぶ。 */
function selectQuestions(source, records, { mode, groupId, limit, qtype }) {
  let list = source.filter((q) => matchesFilters(q, groupId))

  // 種別で絞る。「すべて」のときは採点できる選択式だけを対象にする（SPEC D3）
  if (qtype === QUESTION_TYPES.CLOZE) list = list.filter(isCloze)
  else if (qtype === QUESTION_TYPES.CHOICE) list = list.filter(isGraded)
  else if (mode !== MODES.BOOKMARKED) list = list.filter(isGraded)

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
  // 未入力のまま残っている選択肢・基本事項は出題に載せない
  const list = (opts.explicitList ?? selectQuestions(source, records, opts)).map(compactQuestion)
  const startedAt = Date.now()
  return {
    questions: list,
    orders: list.map((q) => (q.choices ? makeOrder(q.choices.length) : [])),
    mode: opts.mode,
    examMode: opts.examMode,
    startedAt,
    deadline:
      opts.examMode && opts.examMinutes > 0 ? startedAt + opts.examMinutes * 60_000 : null,
  }
}

const DEFAULT_OPTS = {
  qtype: 'all',
  mode: MODES.ALL,
  groupId: '',
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
  // スマホ（縦）は2カラムだと1列が170px程度になり、問題も解説も読めない
  const phone = usePhoneLayout()
  const space = compact ? SPACING.compact : SPACING.wide

  const questions = pool.questions
  // 起動直後は設問一覧のグループ一覧から始める
  const [view, setView] = useState(VIEWS.QUESTIONS)
  const [helpOpen, setHelpOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  // 設問一覧で開いているグループ（null ならグループ一覧を表示）
  const [openGroupId, setOpenGroupId] = useState(null)
  const [editorGroupId, setEditorGroupId] = useState(null)
  // 問題作成で「追加先」に選ばれているグループ（読み込み先の判定にも使う）
  const activeEditorGroupId = editorGroupId ?? pool.groups[0]?.id ?? null
  const [exportOpen, setExportOpen] = useState(false)
  const transferInputRef = useRef(null)
  const [resetOpen, setResetOpen] = useState(false)
  // どの画面幅でも本文に重ねるため、開いたままでは中身が読めない。常に閉じて始める
  const [drawerOpen, setDrawerOpen] = useState(false)

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev)
  }, [])

  // 出題条件。1回の演習は1グループに絞るため、既定は先頭のグループにする
  const [opts, setOpts] = useState(() => ({
    ...DEFAULT_OPTS,
    groupId: pool.poolRef.current.groups[0]?.id ?? '',
  }))

  // セッションと進行状態
  const [session, setSession] = useState(() =>
    createSession(pool.poolRef.current.questions, study.dataRef.current.records, {
      ...DEFAULT_OPTS,
      groupId: pool.poolRef.current.groups[0]?.id ?? '',
    }),
  )
  const [answers, setAnswers] = useState({}) // { [問題インデックス]: 回答記録 }
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draft, setDraft] = useState([]) // 「2つ選べ」で選択中の選択肢
  // 虫食いで開いているマーカーの番号（問題を移ると閉じ直す）
  const [openedIds, setOpenedIds] = useState(() => new Set())
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [finishedAt, setFinishedAt] = useState(null)

  const records = study.data.records
  const total = session.questions.length
  const baseQuestion = session.questions[currentIndex] ?? null
  const displayQuestion =
    baseQuestion && !isCloze(baseQuestion)
      ? reorderQuestion(baseQuestion, session.orders[currentIndex])
      : baseQuestion

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

  /**
   * 問題文が変わったら、学習記録も一緒に引っ越す。
   *
   * 記録は問題文をキーにしているので、誤字を直しただけでも別の問題になり、
   * 正答率・定着度・ブックマーク・メモが行き先を失っていた。
   * id ごとに前回のキーを覚えておき、変わったものだけ付け替える。
   */
  const questionKeysRef = useRef(null)
  useEffect(() => {
    const next = new Map(questions.map((q) => [q.id, questionKey(q)]))
    const prev = questionKeysRef.current
    questionKeysRef.current = next
    if (!prev) return // 初回は控えるだけ

    for (const [id, key] of next) {
      const before = prev.get(id)
      if (!before || before === key) continue
      // 同じ問題文の問題が他にも残っているなら、その問題の記録なので動かさない
      const stillUsed = questions.some((q) => q.id !== id && questionKey(q) === before)
      if (stillUsed) continue
      study.moveRecord(before, key)
    }
  }, [questions, study])

  /**
   * 消えた問題をセッションからも外す。
   *
   * セッションは開始時の配列を持ち続けるため、グループごと削除しても
   * 演習の画面には残ったままだった。プールから消えたものは出題対象から外す。
   * 番号のずれた回答記録は当てにならないので、あわせて解答状況を捨てる。
   */
  useEffect(() => {
    const alive = new Set(questions.map((q) => q.id))
    const keep = session.questions
      .map((q, i) => i)
      .filter((i) => alive.has(session.questions[i].id))
    if (keep.length === session.questions.length) return
    setSession((prev) => ({
      ...prev,
      questions: keep.map((i) => prev.questions[i]),
      orders: keep.map((i) => prev.orders[i]),
    }))
    setAnswers({})
    setCurrentIndex(0)
    setDraft([])
    setFinishedAt(null)
  }, [questions, session])

  /**
   * 絞り込み先のグループが消えたら、残っている先頭のグループに移す。
   * 消えたグループを指したままだと、次にセッションを組んだときに0問になる。
   */
  useEffect(() => {
    if (!pool.groups.length) return
    if (pool.groups.some((g) => g.id === opts.groupId)) return
    setOpts((prev) => ({ ...prev, groupId: pool.groups[0].id }))
  }, [pool.groups, opts.groupId])

  /** 出題条件の変更（変更のたびにセッションを組み直す）。 */
  const updateOpts = useCallback(
    (patch) => {
      const next = { ...opts, ...patch }
      setOpts(next)
      startSession(next)
    },
    [opts, startSession],
  )

  // グループが削除された・空になったときは、先頭のグループへ寄せる
  useEffect(() => {
    if (!pool.groups.length) return
    if (pool.groups.some((g) => g.id === opts.groupId)) return
    setOpts((prev) => ({ ...prev, groupId: pool.groups[0].id }))
  }, [pool.groups, opts.groupId])

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

  // 虫食いを表示したら閲覧日を記録する（採点はしない: SPEC R1）
  useEffect(() => {
    if (view === VIEWS.QUIZ && baseQuestion && isCloze(baseQuestion) && key) {
      study.markViewed(key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, key])

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
      if (!displayQuestion || answered || isCloze(displayQuestion)) return
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
    setOpenedIds(new Set())
  }, [])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1))
    setDraft([])
    setOpenedIds(new Set())
  }, [])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(total - 1, i + 1))
    setDraft([])
    setOpenedIds(new Set())
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
      const q = prev.questions[currentIndex]
      orders[currentIndex] = q.choices ? makeOrder(q.choices.length) : []
      return { ...prev, orders }
    })
    setDraft([])
  }, [answered, session.examMode, currentIndex])

  /** 虫食いのマーカーを1つ開閉する。 */
  const toggleMarker = useCallback((n) => {
    setOpenedIds((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }, [])

  const openAllMarkers = useCallback(() => {
    if (!baseQuestion || !isCloze(baseQuestion)) return
    const n = hiddenCount(baseQuestion.paras)
    setOpenedIds(new Set(Array.from({ length: n }, (_, i) => i + 1)))
  }, [baseQuestion])

  const closeAllMarkers = useCallback(() => setOpenedIds(new Set()), [])

  /**
   * 「問題〇」への番号ジャンプ（枝番「12-2」も文字列として照合する）。
   * 番号はグループごとに独立しているため、複数グループを混ぜて出題していると
   * 同じ番号が複数あり得る。いま解いている問題と同じグループを優先して探す。
   */
  const jumpToNumber = useCallback(
    (num) => {
      const hit = (q) => String(q.questionNumber) === String(num)
      const currentGroupId = session.questions[session.index]?.groupId
      const idx =
        session.questions.findIndex((q) => hit(q) && q.groupId === currentGroupId) !== -1
          ? session.questions.findIndex((q) => hit(q) && q.groupId === currentGroupId)
          : session.questions.findIndex(hit)
      if (idx === -1) return false
      goTo(idx)
      return true
    },
    [session.questions, session.index, goTo],
  )

  /**
   * Excel 読み込み。
   *
   * 問題作成の途中で読み込んだときは、いま開いているグループの末尾に足す。
   * 作りかけの並びに割り込ませず、番号も続きから振る。
   * それ以外（設問一覧などから読み込んだとき）は、従来どおり
   * 1ファイル＝1グループで取り込み、そのまま演習を始められるようにする。
   */
  const loadQuestions = useCallback(
    (loaded, groupName) => {
      // activeEditorGroupId ではなく editorGroupId を見る。前者は未選択のとき
      // 先頭グループにフォールバックするので、入口の画面から読み込んだだけで
      // 関係のないグループへ入ってしまう
      const intoEditor = view === VIEWS.EDITOR && !!editorGroupId

      if (intoEditor) {
        pool.importQuestions(loaded, { groupName, groupId: editorGroupId })
        const name = pool.groups.find((g) => g.id === editorGroupId)?.name ?? groupName
        toast.show({
          tone: 'success',
          title: `${loaded.length}問を読み込みました`,
          description: `グループ「${name}」の末尾に追加しました（番号は続きから）`,
        })
        return
      }

      const groupId = pool.importQuestions(loaded, { groupName })
      setOpts(DEFAULT_OPTS)
      startSession(DEFAULT_OPTS, { source: [...pool.poolRef.current.questions, ...loaded] })
      setOpenGroupId(groupId)
      toast.show({
        tone: 'success',
        title: `${loaded.length}問を読み込みました`,
        description: `グループ「${groupName}」として追加しました`,
      })
    },
    [pool, startSession, toast, view, editorGroupId],
  )

  /**
   * 問題を1つ開いて編集する。
   *
   * 表示中のグループも、その問題の所属に合わせる。合わせないと、左の一覧には
   * 別グループの問題が並び、「＋ 追加」で足した問題も別グループに入ってしまう。
   */
  const openEditor = useCallback(
    (id) => {
      const target = pool.poolRef.current.questions.find((q) => q.id === id)
      if (target) setEditorGroupId(target.groupId)
      setEditingId(id)
      setView(VIEWS.EDITOR)
    },
    [pool.poolRef],
  )

  /**
   * 預けたものを取り戻す（設定の「預ける・取り戻す」から）。
   *
   * ファイルの読み込みと同じ道を通す。**足すだけ**で、いまある問題は消さない。
   * 置き換えを用意しないのは読み込みと同じ理由で、押し間違いが取り返しつかないため。
   *
   * @returns {{questions: number, records: number}} 取り込んだ件数
   */
  const restoreBackup = useCallback(
    (payload) => {
      const parsed = parseImport(JSON.stringify(payload))
      if (parsed.study) study.importData(parsed.study, { merge: true })
      if (parsed.pool) {
        const { dropped } = pool.importPool(parsed.pool, { merge: true }) ?? { dropped: 0 }
        if (dropped > 0) {
          toast.show({
            tone: 'error',
            title: `${dropped}問は取り込めませんでした`,
            description: `1つの端末に持てるのは ${LIMITS.QUESTIONS}問までです`,
          })
        }
      }
      return {
        questions: parsed.pool?.questions.length ?? 0,
        records: parsed.study ? Object.keys(parsed.study.records).length : 0,
      }
    },
    [pool, study, toast],
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
    async (list, groupName) => {
      setExportOpen(false)
      try {
        const { fileName, count } = await exportQuestionsToXlsx(list, { groupName })
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

  const resetAll = useCallback(() => setResetOpen(true), [])

  // --- 一覧・集計 ---
  const groupNameOf = useCallback(
    (q) => pool.groups.find((g) => g.id === q?.groupId)?.name ?? '',
    [pool.groups],
  )

  /** 設問一覧で開いているグループと、その中の問題。 */
  const openGroup = useMemo(
    () => pool.groups.find((g) => g.id === openGroupId) ?? null,
    [pool.groups, openGroupId],
  )
  const groupQuestions = useMemo(
    () => (openGroupId ? questions.filter((q) => q.groupId === openGroupId) : questions),
    [questions, openGroupId],
  )

  /**
   * グループを1つ書き出す。
   *
   * xlsx は表計算ソフトで編集するため（虫食いは形式上入らない）。
   * json はそのまま元に戻すため。そのグループの問題と、**その問題に紐づく学習記録だけ**を
   * 入れる（他のグループの記録まで持ち出さない）。
   *
   * @param {string} groupId
   * @param {'xlsx'|'json'} format
   */
  const exportGroup = useCallback(
    async (groupId, format) => {
      const group = pool.groups.find((g) => g.id === groupId)
      if (!group) return
      const list = questions.filter((q) => q.groupId === groupId)
      if (!list.length) {
        toast.show({ tone: 'error', title: 'このグループには問題がありません' })
        return
      }

      try {
        if (format === 'xlsx') {
          const target = list.filter((q) => !isCloze(q)).map(compactQuestion)
          if (!target.length) {
            toast.show({
              tone: 'error',
              title: 'Excel に書き出せる問題がありません',
              description: '虫食いは Excel の形式に入らないため、バックアップをお使いください',
            })
            return
          }
          const { fileName } = await exportQuestionsToXlsx(target, { groupName: group.name })
          toast.show({
            tone: 'success',
            title: `${fileName} を書き出しました`,
            description:
              target.length < list.length
                ? `虫食い ${list.length - target.length}問 は含まれていません`
                : 'ダウンロードフォルダに保存されました',
          })
          return
        }

        const keys = new Set(list.map((q) => questionKey(q)))
        const records = {}
        for (const [key, value] of Object.entries(study.dataRef.current.records)) {
          if (keys.has(key)) records[key] = value
        }
        const payload = buildExport(
          { ...study.dataRef.current, records },
          { groups: [group], questions: list },
        )
        const fileName = backupFileName(group.name)
        downloadJson(JSON.stringify(payload, null, 2), fileName)
        toast.show({
          tone: 'success',
          title: `${fileName} を書き出しました`,
          description: `${list.length}問と学習記録を保存しました`,
        })
      } catch {
        toast.show({ tone: 'error', title: '書き出しに失敗しました' })
      }
    },
    [pool.groups, questions, study.dataRef, toast],
  )

  /** 「読み込む」のファイル選択を開く（Excel / バックアップの共通入口）。 */
  const openFilePicker = useCallback(() => {
    transferInputRef.current?.click()
  }, [])
  const counts = useMemo(() => {
    const scoped = questions.filter((q) => matchesFilters(q, opts.groupId))
    const base =
      opts.qtype === QUESTION_TYPES.CLOZE
        ? scoped.filter(isCloze)
        : opts.qtype === QUESTION_TYPES.CHOICE
          ? scoped.filter(isGraded)
          : scoped
    const graded = base.filter(isGraded)
    const rec = (q) => records[questionKey(q)]
    return {
      [MODES.ALL]: base.length,
      [MODES.BOOKMARKED]: base.filter((q) => rec(q)?.bookmarked).length,
      [MODES.WRONG]: graded.filter((q) => rec(q)?.lastResult === 'incorrect').length,
      [MODES.DUE]: graded.filter((q) => isDue(rec(q))).length,
    }
  }, [questions, opts.groupId, opts.qtype, records])

  const dashboard = useMemo(
    () => ({
      overview: overview(questions, records, questionKey, study.data.totals),
      series: dailySeries(study.data.daily, 30),
      groups: groupStats(questions, records, questionKey, pool.groups),
      boxes: boxDistribution(questions, records, questionKey),
      cloze: clozeStats(questions, records, questionKey),
      streak: streakDays(study.data.daily),
    }),
    [questions, records, study.data.totals, study.data.daily, pool.groups],
  )

  // --- キーボードショートカット（演習画面のみ） ---
  const shortcutHandlers = useMemo(
    () => ({
      onChoice: (idx) => {
        // 虫食いには選択肢が無いので、この操作は選択式のときだけ効かせる
        if (displayQuestion && !isCloze(displayQuestion) && idx < displayQuestion.choices.length) {
          toggleChoice(idx)
        }
      },
      onEnter: () => {
        if (!displayQuestion) return
        if (isCloze(displayQuestion)) {
          if (currentIndex >= total - 1) finish()
          else goNext()
          return
        }
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
      <AppDrawer
        open={drawerOpen}
        view={view}
        trashCount={pool.trash.items.length}
        onChangeView={(next) => {
          if (next === VIEWS.QUESTIONS) setOpenGroupId(null)
          setView(next)
        }}
        onClose={toggleDrawer}
      />

      <ProgressHeader
        view={view}
        drawerOpen={drawerOpen}
        onToggleDrawer={toggleDrawer}
        onLogoClick={() => {
          setOpenGroupId(null)
          setView(VIEWS.QUESTIONS)
        }}
        position={total > 0 ? currentIndex + 1 : 0}
        total={total}
        questionTotal={questions.length}
        examMode={session.examMode}
        remainingSec={remainingSec}
        clozeMode={!!displayQuestion && isCloze(displayQuestion)}
        savedAt={pool.savedAt}
      />

      {/*
        保存の失敗は必ず画面に出す。黙っていると、直したつもりのまま編集を続けて
        次に開いたときに消えている、という形で気づく。問題側と学習記録側の両方を見る。
      */}
      {(pool.saveError || study.saveError) && (
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
          {pool.saveError || study.saveError}
        </div>
      )}

      {view === VIEWS.QUIZ && (
        <StudyToolbar
          total={total}
          qtype={opts.qtype}
          onChangeType={(qtype) =>
            updateOpts(
              // 虫食いは採点前提のモードを選べないため、全問題へ戻す
              qtype === QUESTION_TYPES.CLOZE &&
                opts.mode !== MODES.ALL &&
                opts.mode !== MODES.BOOKMARKED
                ? { qtype, mode: MODES.ALL, examMode: false }
                : { qtype },
            )
          }
          mode={opts.mode}
          onChangeMode={(mode) => updateOpts({ mode })}
          counts={counts}
          groups={pool.groups}
          groupId={opts.groupId}
          onChangeGroup={(groupId) => updateOpts({ groupId })}
          limit={opts.limit}
          onChangeLimit={(limit) => updateOpts({ limit })}
          examMode={opts.examMode}
          onChangeExamMode={(examMode) => updateOpts({ examMode })}
          examMinutes={opts.examMinutes}
          onChangeExamMinutes={(examMinutes) => updateOpts({ examMinutes })}
          onFinish={view === VIEWS.QUIZ ? finish : undefined}
        />
      )}

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          padding: `${space.mainTop}px calc(${space.pageX}px + env(safe-area-inset-right, 0px)) calc(12px + env(safe-area-inset-bottom, 0px)) calc(${space.pageX}px + env(safe-area-inset-left, 0px))`,
          display: 'grid',
          // スマホは1列にして、問題が上・答えが下の縦並びにする（DOMの順がそのまま並ぶ）
          gridTemplateColumns: phone ? '1fr' : '1fr 1fr',
          gap: `${space.gap}px`,
          alignItems: 'stretch',
        }}
      >
        {view === VIEWS.QUESTIONS && !openGroup ? (
          <GroupsView
            groups={pool.groups}
            questions={questions}
            getRecord={study.getRecord}
            onOpenGroup={setOpenGroupId}
            onEditGroup={(groupId) => {
              // そのグループの1問目を開く。まだ無ければ入口の画面のまま作り始められる
              const first = questions.find((q) => q.groupId === groupId)
              setEditorGroupId(groupId)
              setEditingId(first ? first.id : null)
              setView(VIEWS.EDITOR)
            }}
            onCreateGroup={(name) => {
              const id = pool.addGroup(name)
              toast.show({ tone: 'success', title: `グループ「${name}」を作成しました` })
              return id
            }}
            onRenameGroup={pool.renameGroup}
            onRemoveGroup={(id) => {
              pool.removeGroup(id)
              toast.show({ tone: 'info', title: 'グループを削除しました' })
            }}
            onMergeGroups={(ids, name) => {
              pool.mergeGroups(ids, name)
              toast.show({
                tone: 'success',
                title: `${ids.length}個のグループを「${name}」に統合しました`,
              })
            }}
            onStartQuiz={startQuizWith}
            onExportGroup={exportGroup}
            onImportClick={openFilePicker}
            onOpenTrash={() => setView(VIEWS.TRASH)}
            trashCount={pool.trash.items.length}
          />
        ) : view === VIEWS.QUESTIONS ? (
          <QuestionsView
            group={openGroup}
            onBackToGroups={() => setOpenGroupId(null)}
            onSplit={(ids, name) => {
              pool.splitGroup(ids, name)
              toast.show({
                tone: 'success',
                title: `${ids.length}問を「${name}」に分割しました`,
              })
            }}
            questions={groupQuestions}
            getRecord={study.getRecord}
            onToggleBookmark={study.toggleBookmark}
            onSaveNote={study.setNote}
            onStartQuiz={startQuizWith}
            onImportClick={openFilePicker}
            onCreateClick={() => {
              setEditorGroupId(openGroupId)
              setTypePickerOpen(true)
              setView(VIEWS.EDITOR)
            }}
            groups={pool.groups}
            onEdit={(id) => {
              // 編集する問題のグループへ切り替える。ここを合わせないと、左の一覧と
              // 「追加先」が別のグループのまま開き、足した問題が別の場所に入る
              openEditor(id)
            }}
            onDuplicate={(ids) => {
              ids.forEach((id) => pool.duplicateQuestion(id))
              toast.show({
                tone: 'success',
                title: `${ids.length}問を複製しました`,
                // 記録は問題文をキーにしているので、文面が同じ間は同じ記録を指す
                description: '問題文を変えるまで、学習記録は元の問題と共通です',
              })
            }}
            onMoveToGroup={(ids, groupId) => {
              const name = pool.groups.find((g) => g.id === groupId)?.name ?? ''
              pool.moveQuestionsToGroup(ids, groupId)
              toast.show({ tone: 'success', title: `${ids.length}問を「${name}」へ移動しました` })
            }}
            onDelete={(ids) => {
              ids.forEach((id) => pool.removeQuestion(id))
              toast.show({ tone: 'info', title: `${ids.length}問を削除しました` })
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
            loading={false}
          />
        ) : view === VIEWS.EDITOR ? (
          <EditorView
            questions={questions}
            authored={pool.authored}
            selectedId={editingId}
            onSelect={setEditingId}
            onAdd={() => setTypePickerOpen(true)}
            onUpdate={pool.updateQuestion}
            onRemove={pool.removeQuestion}
            onDuplicate={pool.duplicateQuestion}
            onReorderAuthored={pool.reorderAuthored}
            onMoveToGroup={(ids, groupId) => {
              const name = pool.groups.find((g) => g.id === groupId)?.name ?? ''
              pool.moveQuestionsToGroup(ids, groupId)
              toast.show({ tone: 'success', title: `${ids.length}問を「${name}」へ移動しました` })
            }}
            onGoQuiz={() => setView(VIEWS.QUIZ)}
            onImportClick={openFilePicker}
            transferSlot={
              <DataTransfer
                getStudyJson={() => study.exportJson(pool.poolRef.current)}
                onExportExcel={() => setExportOpen(true)}
                onImportClick={openFilePicker}
                onNotify={toast.show}
              />
            }
            groups={pool.groups}
            activeGroupId={activeEditorGroupId}
            onChangeActiveGroup={setEditorGroupId}
            onCreateGroup={(name) => {
              const id = pool.addGroup(name)
              setEditorGroupId(id)
              toast.show({ tone: 'success', title: `グループ「${name}」を作成しました` })
              return id
            }}
          />
        ) : view === VIEWS.TRASH ? (
          <TrashView
            trash={pool.trash}
            onRestore={(itemId) => {
              const item = pool.restoreFromTrash(itemId)
              if (!item) return
              toast.show({
                tone: item.dropped > 0 ? 'error' : 'success',
                title:
                  item.kind === 'group'
                    ? `グループ「${item.group?.name ?? ''}」を戻しました`
                    : '問題を戻しました',
                description:
                  item.dropped > 0
                    ? `${item.questions.length - item.dropped}問だけ戻りました（上限 ${LIMITS.QUESTIONS}問）`
                    : `${item.questions.length}問`,
              })
            }}
            onPurge={pool.purgeFromTrash}
            onEmpty={() => {
              pool.emptyTrash()
              toast.show({ tone: 'success', title: 'ごみ箱を空にしました' })
            }}
            onBack={() => {
              setOpenGroupId(null)
              setView(VIEWS.QUESTIONS)
            }}
          />
        ) : view === VIEWS.ACCOUNT ? (
          <AccountView
            onBuildPayload={() => buildExport(study.dataRef.current, pool.poolRef.current)}
            onRestoreBackup={restoreBackup}
            onNotify={toast.show}
          />
        ) : view === VIEWS.SETTINGS ? (
          <SettingsView
            onOpenAccount={() => setView(VIEWS.ACCOUNT)}
            onResetAll={() => {
              pool.resetPool()
              study.resetAll()
              setOpenGroupId(null)
              setEditingId(null)
              setOpts(DEFAULT_OPTS)
              toast.show({ tone: 'info', title: 'すべてのデータを削除しました' })
              setView(VIEWS.QUESTIONS)
            }}
          />
        ) : view === VIEWS.DASHBOARD ? (
          <Dashboard
            overview={dashboard.overview}
            series={dashboard.series}
            groups={dashboard.groups}
            boxes={dashboard.boxes}
            streak={dashboard.streak}
            dueCount={counts[MODES.DUE]}
            cloze={dashboard.cloze}
            onResetStats={study.resetStats}
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
        ) : displayQuestion && isCloze(displayQuestion) ? (
          <ClozeQuizView
            question={displayQuestion}
            groupName={groupNameOf(baseQuestion)}
            position={currentIndex + 1}
            total={total}
            record={record}
            noteKey={key}
            onToggleBookmark={() => study.toggleBookmark(key)}
            onSaveNote={(note) => study.setNote(key, note)}
            onPrev={goPrev}
            onNext={goNext}
            isFirst={currentIndex === 0}
            isLast={currentIndex === total - 1}
            onFinish={finish}
            openedIds={openedIds}
            onToggleMarker={toggleMarker}
            onOpenAll={openAllMarkers}
            onCloseAll={closeAllMarkers}
          />
        ) : displayQuestion ? (
          <>
            <QuestionCard
              question={displayQuestion}
              groupName={groupNameOf(baseQuestion)}
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
            onAction={() => updateOpts({ mode: MODES.ALL, groupId: '' })}
          />
        )}
      </main>

      {view === VIEWS.QUIZ && displayQuestion && !isCloze(displayQuestion) && (
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

      {typePickerOpen && (
        <TypePickerDialog
          groups={pool.groups}
          defaultGroupId={activeEditorGroupId}
          onCancel={() => setTypePickerOpen(false)}
          onCreate={({ groupId, type }) => {
            const id = pool.addQuestion(groupId, type)
            setTypePickerOpen(false)
            setEditorGroupId(groupId)
            if (id) {
              setEditingId(id)
              setView(VIEWS.EDITOR)
            }
          }}
        />
      )}

      {exportOpen && (
        <ExportModal
          questions={questions}
          groups={pool.groups}
          onClose={() => setExportOpen(false)}
          onExport={runExport}
        />
      )}

      {resetOpen && (
        <ConfirmDialog
          title="学習記録をすべて削除しますか？"
          message="正答率・ブックマーク・メモ・復習予定がすべて消えます。元に戻せません。"
          confirmLabel="削除する"
          onCancel={() => setResetOpen(false)}
          onConfirm={() => {
            study.resetAll()
            setResetOpen(false)
          }}
        />
      )}

      <TransferInput
        inputRef={transferInputRef}
        onLoadQuestions={loadQuestions}
        onImportStudyData={study.importData}
        onImportPool={(incoming, opts) => {
          const { dropped } = pool.importPool(incoming, opts) ?? { dropped: 0 }
          if (dropped > 0) {
            toast.show({
              tone: 'error',
              title: `${dropped}問は読み込めませんでした`,
              description: `1つの端末に持てるのは ${LIMITS.QUESTIONS}問までです`,
            })
          }
        }}
        onNotify={toast.show}
      />

      {/* 「?」キーの近道。一覧そのものは設定の中に常設している */}
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      <OfflineNotice />

      <ToastHost toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  )
}
