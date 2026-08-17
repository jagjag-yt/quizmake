/** 選択肢の表示記号（配列順が a, b, c... に対応）。 */
export const LETTERS = ['a', 'b', 'c', 'd', 'e']

/** localStorage のキー。v2 が現行、v1 は移行元（読み込み後は残しておく）。 */
export const STORAGE_KEY = 'quizmake.data.v2'
export const LEGACY_BOOKMARKS_KEY = 'quizmake.bookmarks.v1'
export const LEGACY_STATS_KEY = 'quizmake.stats.v1'

/** 出題プール（グループ＋問題）の保存キー。v1 は移行元。 */
export const POOL_KEY = 'quizmake.pool.v2'
export const LEGACY_POOL_KEY = 'quizmake.pool.v1'

/** グループ名の最大文字数。 */
export const GROUP_NAME_MAX = 60

/** グループが未指定の問題をまとめる既定グループの名前。 */
export const DEFAULT_GROUP_NAME = '未分類'

/** 設問一覧の絞り込み状態を保持するキー（セッション内のみ）。 */
export const LIST_STATE_KEY = 'quizmake.listState.v1'

/** 問題タイプ（作成後に変更できない構造上の区別）。 */
export const QUESTION_TYPES = {
  CHOICE: 'choice',
  CLOZE: 'cloze',
}

export const TYPE_LABELS = {
  [QUESTION_TYPES.CHOICE]: '選択式',
  [QUESTION_TYPES.CLOZE]: '虫食い',
}

/**
 * 虫食いの文字色パレット（6色）。
 * すべて白背景でコントラスト比 4.5:1 以上。自由な色指定は用意しない。
 */
export const TEXT_COLORS = [
  { name: '標準', value: '#1e293b' },
  { name: '青', value: '#2563eb' },
  { name: '緑', value: '#166534' },
  { name: '赤', value: '#991b1b' },
  { name: '橙', value: '#b45309' },
  { name: '灰', value: '#64748b' },
]

export const DEFAULT_TEXT_COLOR = '#1e293b'

/** 虫食いの見出し・本文の上限。 */
export const CLOZE_LIMITS = {
  TITLE_CHARS: 120,
  BODY_CHARS: 20000,
}

/** 問題の出どころ。 */
export const ORIGIN = {
  AUTHORED: 'authored',
  IMPORTED: 'imported',
}

export const ORIGIN_LABELS = {
  [ORIGIN.AUTHORED]: '作成',
  [ORIGIN.IMPORTED]: '読込',
}

/** 出題モード。 */
export const MODES = {
  ALL: 'all',
  BOOKMARKED: 'bookmarked',
  WRONG: 'wrong',
  DUE: 'due',
}

/** モードの表示名と説明。 */
export const MODE_LABELS = {
  [MODES.ALL]: { label: '全問題', hint: 'すべての問題から出題します' },
  [MODES.BOOKMARKED]: { label: '★ ブックマーク', hint: 'ブックマークした問題だけを出題します' },
  [MODES.WRONG]: { label: '要復習', hint: '直近で間違えた問題だけを出題します' },
  [MODES.DUE]: { label: '今日の復習', hint: '間隔反復で今日が復習日の問題を出題します' },
}

/** 画面（ビュー）。 */
export const VIEWS = {
  QUESTIONS: 'questions',
  QUIZ: 'quiz',
  SUMMARY: 'summary',
  EDITOR: 'editor',
  DASHBOARD: 'dashboard',
  SETTINGS: 'settings',
}

/**
 * ヘッダーのタブ。順序は SPEC の NAV に従う。
 * tablet はタブレット幅での短縮ラベル。
 */
export const TABS = [
  { view: VIEWS.QUESTIONS, label: '設問一覧', tablet: '一覧' },
  { view: VIEWS.QUIZ, label: '演習', tablet: '演習' },
  { view: VIEWS.EDITOR, label: '問題作成', tablet: '作成' },
  { view: VIEWS.DASHBOARD, label: '学習記録', tablet: '記録' },
]

/** 設問一覧の「状況」フィルタ。 */
export const STATUS_FILTERS = {
  ALL: 'all',
  UNSTUDIED: 'unstudied',
  WRONG: 'wrong',
  BOOKMARKED: 'bookmarked',
}

export const STATUS_FILTER_LABELS = {
  [STATUS_FILTERS.ALL]: 'すべて',
  [STATUS_FILTERS.UNSTUDIED]: '未学習',
  [STATUS_FILTERS.WRONG]: '要復習',
  [STATUS_FILTERS.BOOKMARKED]: '★ブックマーク',
}

/** 設問一覧の並び順。 */
export const SORTS = {
  NUMBER: 'number',
  ACCURACY: 'accuracy',
  LAST_STUDIED: 'lastStudied',
}

export const SORT_LABELS = {
  [SORTS.NUMBER]: '問題番号順',
  [SORTS.ACCURACY]: '正答率順',
  [SORTS.LAST_STUDIED]: '最終学習日順',
}

/**
 * Excel 書き出しの列（この順序・この見出し文字列で出力する）。
 * グループは「1ファイル＝1グループ」で表すため、列には持たない。
 */
export const EXPORT_COLUMNS = [
  '問題番号',
  '問題文',
  '下線キーワード',
  '画像URL',
  '選択肢a',
  '選択肢b',
  '選択肢c',
  '選択肢d',
  '選択肢e',
  '正解',
  '解説',
  '基本事項',
]

/** 入力データの上限（DoS・メモリ枯渇の予防）。 */
export const LIMITS = {
  /** 読み込む Excel ファイルの最大バイト数（15MB）。 */
  EXCEL_BYTES: 15 * 1024 * 1024,
  /** 取り込む最大問題数。 */
  QUESTIONS: 5000,
  /** インポートする JSON の最大バイト数（8MB）。 */
  IMPORT_BYTES: 8 * 1024 * 1024,
  /** 保持する学習記録の最大件数。 */
  RECORDS: 20000,
  /** メモ1件あたりの最大文字数。 */
  NOTE_CHARS: 2000,
  /** 1問あたりの文字数上限（表示崩れ・過大データの予防）。 */
  TEXT_CHARS: 5000,
}

/**
 * レイアウトの切替条件。
 * 1024px 以上（PC・iPad 横）はハンドオフどおりの余白、
 * それ未満（iPad 縦など）は余白を詰めて内容の幅を確保する。
 */
export const COMPACT_QUERY = '(max-width: 1023px)'

/**
 * スマートフォンとみなす幅。
 *
 * この幅では問題作成の入力欄が実用にならない（選択肢の欄が全角4文字ほどに
 * なってしまう）ため、作成はタブレット・パソコンに任せ、解くことに絞る。
 * iPad mini の縦（744px）はタブレット扱いにしたいので 600px で切る。
 */
export const PHONE_QUERY = '(max-width: 600px)'

/**
 * 3ペイン（左カラム268 + 編集528 + プレビュー）で、プレビューの幅が足りなくなる画面幅。
 *
 * ページの左右余白32×2＋左カラム268＋編集528＋ペースの隙間20×2で 900px を使うため、
 * プレビューに残るのは「画面幅 − 900px」。1280px を下回ると 380px を切り、
 * 演習カードの選択肢が折り返して見た目の確認にならない（iPad Pro 横 1194px で発生）。
 * この幅では既定でプレビューを畳み、必要なときだけ開く。
 */
export const PREVIEW_TIGHT_QUERY = '(max-width: 1279px)'

/** ホバーできる入力機器か（タッチ端末では一致しない）。 */
export const HOVER_QUERY = '(hover: hover)'

/**
 * 余白のトークン。compact は iPad 縦などの中間幅で使う。
 * 数値のみを持ち、単位は利用側で付ける。
 */
export const SPACING = {
  wide: { pageX: 32, mainTop: 20, card: 32, gap: 24, headerY: 18 },
  compact: { pageX: 20, mainTop: 14, card: 22, gap: 16, headerY: 14 },
}

/**
 * タッチ操作で押しやすい最小サイズ（px）。
 * iPad もタッチ端末のため、主要な操作はこの高さ以上を確保する。
 */
export const TAP_MIN = 44

/** デザイントークン（ハンドオフ準拠）。 */
export const COLORS = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  cardBorder: '#eef2f7',
  text: '#1e293b',
  sub: '#64748b',
  muted: '#94a3b8',
  body: '#475569',
  blue: '#2563eb',
  blueLight: '#eff6ff',
  bluePale: '#93c5fd',
  green: '#16a34a',
  greenLight: '#f0fdf4',
  greenDark: '#166534',
  red: '#dc2626',
  redLight: '#fef2f2',
  redDark: '#991b1b',
  chipTrack: '#f1f5f9',
  rowHover: '#f8fafc',
  rowBorder: '#f1f5f9',
  scrim: 'rgba(15,23,42,0.28)',
  dashed: '#cbd5e1',
  amber: '#f59e0b',
  amberLight: '#fffbeb',
  amberDark: '#b45309',
}
