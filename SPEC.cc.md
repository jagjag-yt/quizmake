# QUIZMAKE_NEW_SCREENS.SPEC v2 — agent-target: Claude Code
# v2(2026-08-17): ナビをドロワー化 / 設定画面 / スマホでの問題作成制限 / タグ廃止 / ダイアログ規約 を反映。
# encoding: dense-kv. no prose. all UI copy = JP literal, ship verbatim.
# source-of-truth design: 受け渡し用/ 配下のバンドルHTML (7.5MB, .gitignore 済み。リポジトリには入らない)。
# 現在 working tree にあるのは 受け渡し用/quizmake-cloze-mode.html のみ。新画面版は手元に無い場合がある。

META
  app: quizmake (existing). local-only. no server/auth/collab. persist: localStorage.
  add: 2 routes. do NOT touch existing 演習/結果/学習記録.
  breakpoints (constants.js が正): COMPACT_QUERY='(max-width:1023px)' / PHONE_QUERY='(max-width:600px)'
    >=1024 desktop(design@1440) | 601-1023 compact(tablet, design@820) | <=600 phone
    phone は演習・設問一覧・学習記録・設定のみ。問題作成は案内画面に差し替える（下記 PHONE GATE）。

TOKENS (strict, no additions)
  font: 'Noto Sans JP',sans-serif
  bg#f8fafc card#fff border#e2e8f0 cardBorder#eef2f7 text#1e293b sub#64748b muted#94a3b8 body#475569
  blue#2563eb blueLight#eff6ff bluePale#93c5fd green#16a34a greenLight#f0fdf4 greenDark#166534
  red#dc2626 redLight#fef2f2 redDark#991b1b amber#f59e0b amberLight#fffbeb amberDark#b45309
  chipTrack#f1f5f9 rowHover#f8fafc rowSel=blueLight scrim rgba(15,23,42,.28)
  r: card20 row14 btn12 input10 pill999
  sh(card): 0 1px 3px rgba(15,23,42,.06)
  card{bg:card;b:1px cardBorder;p:32(tablet 22)}  page{maxw1400;center;p32(tablet 20)}  header{bg:card;bb:1px border;p:18 32(tablet 14 20)}
  type: q18/1.9 | choice15/1.6 | expl14.5/1.9 | kp14/1.7 | h14b+1px bb border | label12-13b | stat24b
  segmented: track chipTrack, pad3, active=blue bg+#fff, idle=transparent+sub
  motion: all .15s ease. tap>=44. focus-visible: 2px blue outline, offset2.

NAV (v2: drawer。ヘッダーに並ぶタブ列は廃止)
  header 左: [☰ トグル] + ロゴ のみ。ロゴ押下 -> 設問一覧のグループ一覧へ戻る(=起動時と同じ場所)。
  drawer 項目(順序 = constants.js TABS): 設問一覧 | 演習 | 問題作成 | 学習記録
    + 区切り + アカウント(disabled, title「アカウント機能は準備中です」) + 設定
    旧「クイズ作成」-> 「問題作成」に改称。compact 短縮ラベル: 一覧/演習/作成/記録。
  desktop(>=1024): 開いたまま保持する。状態は localStorage 'quizmake.drawer' = 'open'|'closed'。開時は本文を 248px 右へ。
  compact(<=1023): 本文に重ねる overlay + scrim。項目を選ぶと自動で閉じる。
  Excelの 書き出す/読み込む はヘッダーから撤去 -> 問題作成の左カラムへ移動(DataTransfer)。
  right-slot is TAB-CONDITIONAL (ProgressHeader.jsx):
    演習     -> 正答率 XX%（n/n）+↻ , 演習 n/N問目 , progressbar 220x6 r999 track=border fill=blue
             (虫食い時は正答率を出さず「虫食い n/N問目」)
    設問一覧 -> 正答率+↻ , 全 N 問
    問題作成 -> ✓ 自動保存済み hh:mm
    学習記録 -> 正答率+↻

MODEL (extend existing, no breaking change)
  Question{id; type:'choice'; questionNumber:int; groupId; segments:[{text,u:bool}]; choices:string[2..5];
           correctIndexes:int[]; explanation; keyPoints:string[]; imageUrl:string|null; origin:'authored'|'imported'}
  ※ tags は廃止(v2)。model・UI・xlsx すべてから削除済み。復活させない。
  ※ subject は groupId に置き換え済み(旧「科目」= グループ)。
  Record{bookmarked:bool; attempts:int; correct:int; lastResult:'correct'|'incorrect'|null; box:0..5; note:string; lastStudiedAt:ISO}
  multi := correctIndexes.length>1 -> badge「2つ選べ」
  numbering: per GROUP, always contiguous 1,2,3… in array order. every mutation (add/delete/move/merge/split/import/
  reorder) re-runs renumberByGroup. numbers repeat across groups by design. records key off content, not number.

============================================================
S1 /questions 設問プレビュー
LAYOUT desktop: master-detail, no route change on select. master 812 / gap20 / detail 544 position:sticky top:24.
  rationale(keep): scan->verify->next loop; modal=open/close cost, full-page=loses scroll+filter state.
LAYOUT tablet: master 100%; detail = right overlay panel w560 + scrim; panel header has ✕ / ★ / ← / → (prev/next without closing).
FILTERBAR (card, above table)
  row1: [search ⌕ placeholder"問題文・解説を検索"] [種別▾] [並び順▾ 問題番号順|正答率順|最終学習日順] all h44
  row2: label"状況" + toggle-chips: すべて / 未学習 / 要復習 / ★ブックマーク  (multi-select, すべて exclusive) + right "N問中 M問を表示"
  filters+sort+scroll persist per session (sessionStorage) so detail nav never resets them.
TABLE (card, virtualized; assume 100+ rows)
  head sticky. cols grid: 40 68 76 1fr 118 78 36 / gap10 / px18 / h56 / bb #f1f5f9
    [checkbox][番号 ⇅ blue b][種別 pill][問題文冒頭 1行 ellipsis][学習状況][定着度][★]
  学習状況 = text+color badge (never color-only): ○ 正解 greenLight/greenDark | × 不正解 redLight/redDark | 未学習 #f8fafc/muted
  定着度 = box 0..5 rendered '●'*box+'○'*(5-box), blue, letter-spacing1
  ★: filled amber / ☆ #cbd5e1. click toggles bookmark, stopPropagation.
  row click -> select (desktop: fill detail; tablet: open panel). selected row bg=blueLight. hover bg=rowHover.
  footer: "1–n / N問を表示" + ← →
FOOTER-CTA card: "絞り込み中の N問 を対象に" + [⇄ シャッフル演習] -> start 演習 with current filtered set.
  ※「この条件で(演習を)開始」ボタンは廃止(v2)。条件を変えた時点で出題が引き直される。
BULK (include=YES): >=1 checked -> bottom bar bg#1e293b r14: "N問を選択中" + [★ ブックマーク][⧉ 複製][→ 移動…(group select)]
  [⇱ 別グループへ分割][🗑 削除(confirm)][▶ 演習](primary). hidden at 0. same 複製/移動/削除 also sit atop the detail panel.
DETAIL content order:
  headline: 問題 NNN + 科目pill + origin pill(作成|読込, blueLight/blue) + ★btn44 + [この問題から演習](primary)
  q text 18/1.9, segments u:true -> border-bottom 2px blue + bold
  image: if imageUrl -> img r14 b1 border; else omit. (design shows striped placeholder = spec only)
  choices a–e r14 h>=48: correct -> b1 green + greenLight + label chip green/#fff + text greenDark bold + right "正解"; else b1 border/#fff
  解説 (h14b+bb) 14.5/1.9 body
  基本事項 (h14b+bb) each bullet: blueLight r14 p12 14, "●" blue + text
  自分メモ (h14b+bb) editable textarea-look input10, autosave onBlur; empty -> "メモはまだありません。クリックして入力できます。"
  ANSWER VISIBILITY(v2): 詳細パネルは既定で答えを伏せる。segmented [答えを隠す|答えを表示] DEFAULT=答えを隠す。
    reason: 一覧から復習に使うため、開いた瞬間に正解が見えると確認にならない。虫食いの D2 も同じ既定に揃えた。
  ACTIONS(detail panel 上部): [✎ 編集][⧉ 複製][→ 移動][🗑 削除]
  meta line muted12: 定着度 ●●●○○ · "n回中m回正解 · 最終 YYYY/MM/DD" | "未学習"
STATES
  empty: 📄 in circle chipTrack + "問題がまだありません" + "Excelを読み込むか、アプリ内で作成すると/ここに一覧が表示されます。" + [📄 Excelを読み込む][＋ 問題を作成]
  loading: "⏳ Excelを解析しています…（N問）" + 6px progress + 5 skeleton rows (pills #f1f5f9)
  toast: success greenLight/b green; info blueLight/b bluePale + [元に戻す]; error redLight/b red + [詳細]

============================================================
S2 /editor 問題作成 (v2。旧称「クイズ作成」)
ENTRY(v2): 入口は「グループを決める分岐画面」。この時点では左カラムを出さない。
  [＋ 新しいグループを作成]（"新しい科目や単元を作って、その中に問題を追加します。"）/ 既存グループから選ぶ。
  0件のとき: "まだグループがありません。左の「新しいグループを作成」から始めてください。"
  まだ1問も無い間は、この画面に 書き出す/読み込む を置く(左カラムが存在しないため)。
LAYOUT desktop 3-pane (編集中のみ): sidebar 268 | editor 528 | preview flex sticky top:24.
LAYOUT compact: sidebar -> ☰ ドロワー "問題一覧（N）"; segmented [編集|プレビュー]; editor full-width; underline toolbar pinned to 問題文 label row.
LAYOUT phone(<=600): 編集画面を出さず PHONE GATE に差し替え。
SIDEBAR (v2)
  head: 「追加先のグループ」select + [＋ 新規]
  items h>=52: ⠿ drag handle, head 1行 ellipsis, trailing "!" red if invalid. selected bg=blueLight.
    各行に checkbox。1件以上チェック -> [→ 移動][🗑 削除] で複数まとめて操作。
  foot: [複製][削除(red text)] + [書き出す][読み込む](DataTransfer。ヘッダーから移設)
  移動ダイアログ: 「移動先のグループ」select +
    "移動先で番号が重なった場合は、移動してきた問題の番号だけを振り直します。"
SAVE(v2): 変更があると右下に [保存]。押すと、編集した問題が属するグループの設問一覧へ移動する。
EDITOR fields (top->bottom)
  問題番号: read-only pill "問題番号 NNN（自動）"
  グループ: 左カラムの「追加先のグループ」で決まる。エディタ内の 科目 combobox は廃止(v2)。
  問題文: contenteditable-ish rich-lite; required badge red"必須"; toolbar right: [U 下線をつける](primary, enabled only when selection non-empty)[解除]
    DECISION(keep): selection-based marking, NOT a separate keyword field. reason: segments carry POSITION; keyword-string matching mis-hits repeated tokens.
    active underline render: bg blueLight + bb2 blue + bold. meta: pill"下線 n か所" + "テキストを選択すると「下線をつける」が有効になります。書き出し時は下線部が「下線キーワード」列になります。"
    serialize -> segments[]; merge adjacent same-u; strip empty.
  画像URL(任意): input10 mono13 + 64x44 thumb. debounce 400ms -> preload. fail -> red border + "✕ 画像を読み込めません。URLを確認してください"
  選択肢: 2..5 rows r14 h>=48: ⠿ + label chip a..e (auto-relabel on reorder) + text input + toggle pill [正解にする|✓ 正解] + ✕(disabled at 2)
    correct row: b1 green + greenLight; pill green/#fff
    [＋ 選択肢を追加](dashed #cbd5e1) hidden at 5
    if correctCount>=2 -> inline blueLight bar "正解が2つ →「2つ選べ」として出題されます" (mirror badge in preview)
  解説: multiline 14.5/1.9
  基本事項: repeatable rows ⠿ + text + ✕, dnd, [＋ 項目を追加](dashed)
PREVIEW (right) = exact 演習 look, reuse existing quiz card components, 1:1 not a mock.
  toggle segmented [解答前|解答後]. 解答前 = q card only. 解答後 = q card + answer card(正解 a・c pill greenLight + 解説 + 基本事項).
  q card: 科目pill + 「2つ選べ」pill(if multi) + right "N / N問目"; q text with underline segs; image; choices neutral.
VALIDATION (inline, on blur + on export)
  問題文必須 -> b1 red + bg redLight + "✕ 問題文を入力してください"
  選択肢>=2 && 正解>=1 -> "✕ 選択肢は2つ以上、正解は1つ以上必要です"
  invalid URL -> above msg. invalid question -> "!" in sidebar + counted in export warning.
AUTOSAVE: debounce 600ms -> localStorage; header shows "✓ 自動保存済み hh:mm"; on fail -> red toast.
EMPTY(0 authored): ＋ circle blueLight + "最初の問題をつくる" + "問題文と選択肢を入力すると、右側に演習画面と/同じ見た目のプレビューが表示されます。" + [＋ 問題を作成] + "または Excelを読み込む"

EXPORT xlsx (button 「Excelに書き出す」)
  pre-export modal:
    2 stat cards: 書き出す問題 N問 / うち作成分 M問
    segmented: 全問（N） | 作成分のみ（M）
    if invalid>0 -> amberLight block: "⚠ 不備のある問題がN件あります" + list "問題 117：正解が未設定" / "問題 119：選択肢が1つのみ" + "このまま書き出すと該当行は空欄になります。"
    mono line listing columns. actions: [不備を修正する][⬇ 書き出す](primary)
  COLUMNS (exact order, header row = these JP strings):
    問題番号 | 問題文 | 下線キーワード | 画像URL | 選択肢a | 選択肢b | 選択肢c | 選択肢d | 選択肢e | 正解 | 解説 | 基本事項
    (12 cols. group is per-file, not a column. タグ列は廃止)
  serialization:
    問題文: segments concat plain text (no markup)
    下線キーワード: u:true segment texts, newline-joined (multi)
    選択肢d/e: "" when absent
    正解: letters joined "a,c" (matches import parser)
    基本事項: newline-joined
    filename: quizmake_N問.xlsx
  success toast: "quizmake_N問.xlsx を書き出しました" / sub "ダウンロードフォルダに保存されました"
IMPORT COEXISTENCE
  one pool. origin flag only. imported rows fully editable+deletable. sidebar filter 作成/読込. export scope selectable. import column mismatch -> red toast "読み込みに失敗しました（列が一致しません）" + [詳細].

============================================================
S3 /settings 設定 (v2 追加。drawer 最下段から入る)
  1カラム, maxw720, card 20r。3セクション:
    通知   : pill「準備中」 + "「今日の復習」がたまったときにお知らせする機能を準備しています。
             お使いの端末に通知を届けるにはアカウントが必要なため、アカウント機能と一緒に提供します。"
    規約とプライバシー : 説明文 + 外部リンク3つ(target=_blank rel=noopener) 末尾に ↗
             [利用規約](https://quiz-make.com/terms.html) [プライバシーポリシー](https://quiz-make.com/privacy.html)
             [お問い合わせ](mailto:support@quiz-make.com)
    データ : すべて削除。ConfirmDialog「すべてのデータを削除しますか？」を必ず経由する。
  VIEWS.SETTINGS。タブ扱いにはしない(4タブの並びに入れない)。

============================================================
PHONE GATE (<=600px, 問題作成のみ)
  問題作成を開いても編集画面を出さず、案内カードを出す (EditorView.PhoneNotice)。
  reason: この幅では選択肢の入力欄が全角4文字ほどになり実用にならない。
          「壊れている」と誤解されないよう、意図的である旨と、この端末で何ができるかを書く。
  copy: 見出し「問題づくりは、画面の広い端末で」
        本文「この画面幅では選択肢の入力欄が数文字分しか取れず、まともに入力できないため、作成は開いていません。
              タブレットかパソコンでお試しください。」+「この端末では演習と復習が使えます。作った問題はそのまま解けます。」
  逃げ道は残す: [それでもこの端末で作成する] -> 強制的に編集画面へ。意図して残している。消さない。

============================================================
DIALOG RULES (v2, 非交渉)
  window.confirm / window.alert / window.prompt を使わない。
  実測: この配信環境(PWA/Workers)で prompt() は "prompt() is not supported." を投げる。
  置き換え: ConfirmDialog / PromptDialog (src/components/ConfirmDialog.jsx)。名称変更・削除・統合すべて経由する。

EMPTY FIELD RETENTION (v2, 非交渉)
  未入力の選択肢・基本事項の行は保存時に落とさない。使う直前に compactQuestion(data/questions.js) で落とす。
  reason: 保存時に消すと「＋追加」で作った空行が即座に消え、追加できなくなる。過去に踏んだバグ。

A11Y
  all interactive >=44 (table row 56, chips 34 => wrap in 44 hit area). focus-visible ring blue.
  status never color-only. contrast: greenDark/redDark/amberDark on their *Light bg only.
  table = role=grid, arrow-key row nav, Enter opens detail, Space toggles checkbox. panel = focus trap + Esc.

ACCEPTANCE
  [] 1440/820 match ./quizmake 新画面.dc.html frames 01-04
  [] 120-row list scrolls 60fps, filter+sort+search compose
  [] detail nav keeps filter/scroll
  [] underline round-trips: editor -> segments -> preview -> xlsx 下線キーワード -> re-import
  [] export columns byte-identical to list above
  [] no color/font/radius outside TOKENS