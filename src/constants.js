/** 選択肢の表示記号（配列順が a, b, c... に対応）。 */
export const LETTERS = ['a', 'b', 'c', 'd', 'e']

/** localStorage のキー。v2 が現行、v1 は移行元（読み込み後は残しておく）。 */
export const STORAGE_KEY = 'quizmake.data.v2'
export const LEGACY_BOOKMARKS_KEY = 'quizmake.bookmarks.v1'
export const LEGACY_STATS_KEY = 'quizmake.stats.v1'

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
  QUIZ: 'quiz',
  SUMMARY: 'summary',
  DASHBOARD: 'dashboard',
}

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
  amber: '#f59e0b',
  amberLight: '#fffbeb',
  amberDark: '#b45309',
}
