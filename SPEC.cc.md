# QUIZMAKE_NEW_SCREENS.SPEC v1 — agent-target: Claude Code
# encoding: dense-kv. no prose. all UI copy = JP literal, ship verbatim.
# source-of-truth design: ./quizmake 新画面.dc.html (canvas, 6 frames). read it for pixel/inline-style reference.

META
  app: quizmake (existing). local-only. no server/auth/collab. persist: localStorage.
  add: 2 routes. do NOT touch existing 演習/結果/学習記録.
  breakpoints: >=1024 desktop(design@1440) | 768-1023 tablet(design@820) | <768 out-of-scope.

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

NAV (header, extend existing)
  tabs(order per user edit): 設問一覧 | 演習 | クイズ作成 | 学習記録
  left-buttons unchanged: 📄 Excelを読み込む / ⬇ 書き出し / ⬆ 読み込み / ?
  right-slot is TAB-CONDITIONAL:
    演習     -> 正答率 XX%（n/n）+↻ , 演習 n/N問目 , progressbar 220x6 r999 track=border fill=blue
    設問一覧 -> 正答率+↻ , 全 N 問
    クイズ作成 -> ✓ 自動保存済み hh:mm , [⬇ Excelに書き出す](primary)
    学習記録 -> 正答率+↻
  tablet: labels 作成/記録, aux buttons collapse to ⋯, tabs stay 4.

MODEL (extend existing, no breaking change)
  Question{questionNumber:int; segments:[{text,u:bool}]; choices:string[2..5]; correctIndexes:int[];
           explanation; keyPoints:string[]; subject; tags:string[]; imageUrl:string|null; origin:'authored'|'imported'}
  Record{bookmarked:bool; attempts:int; correct:int; lastResult:'correct'|'incorrect'|null; box:0..5; note:string; lastStudiedAt:ISO}
  multi := correctIndexes.length>1 -> badge「2つ選べ」
  numbering: single pool. authored=next max+1. import collision -> suffix branch (e.g. 12-2), never renumber existing.

============================================================
S1 /questions 設問プレビュー
LAYOUT desktop: master-detail, no route change on select. master 812 / gap20 / detail 544 position:sticky top:24.
  rationale(keep): scan->verify->next loop; modal=open/close cost, full-page=loses scroll+filter state.
LAYOUT tablet: master 100%; detail = right overlay panel w560 + scrim; panel header has ✕ / ★ / ← / → (prev/next without closing).
FILTERBAR (card, above table)
  row1: [search ⌕ placeholder"問題文・解説・タグを検索"] [科目▾] [タグ▾] [並び順▾ 問題番号順|正答率順|最終学習日順] all h44
  row2: label"状況" + toggle-chips: すべて / 未学習 / 要復習 / ★ブックマーク  (multi-select, すべて exclusive) + right "N問中 M問を表示"
  filters+sort+scroll persist per session (sessionStorage) so detail nav never resets them.
TABLE (card, virtualized; assume 100+ rows)
  head sticky. cols grid: 40 68 92 1fr 118 78 62 36 / gap10 / px18 / h56 / bb #f1f5f9
    [checkbox][番号 ⇅ blue b][科目 pill chipTrack][問題文冒頭 1行 ellipsis][タグ #a #b muted 11.5][学習状況][定着度][★]
  学習状況 = text+color badge (never color-only): ○ 正解 greenLight/greenDark | × 不正解 redLight/redDark | 未学習 #f8fafc/muted
  定着度 = box 0..5 rendered '●'*box+'○'*(5-box), blue, letter-spacing1
  ★: filled amber / ☆ #cbd5e1. click toggles bookmark, stopPropagation.
  row click -> select (desktop: fill detail; tablet: open panel). selected row bg=blueLight. hover bg=rowHover.
  footer: "1–n / N問を表示" + ← →
FOOTER-CTA card: "絞り込み中の N問 を対象に" + [⇄ シャッフル演習][▶ この条件で演習を開始](primary) -> start 演習 with current filtered set.
BULK (include=YES): >=1 checked -> bottom bar bg#1e293b r14: "N問を選択中" + [★ ブックマーク][タグを付与][▶ 演習](primary). hidden at 0.
DETAIL content order:
  headline: 問題 NNN + 科目pill + origin pill(作成|読込, blueLight/blue) + ★btn44 + [この問題から演習](primary)
  q text 18/1.9, segments u:true -> border-bottom 2px blue + bold
  image: if imageUrl -> img r14 b1 border; else omit. (design shows striped placeholder = spec only)
  choices a–e r14 h>=48: correct -> b1 green + greenLight + label chip green/#fff + text greenDark bold + right "正解"; else b1 border/#fff
  解説 (h14b+bb) 14.5/1.9 body
  基本事項 (h14b+bb) each bullet: blueLight r14 p12 14, "●" blue + text
  自分メモ (h14b+bb) editable textarea-look input10, autosave onBlur; empty -> "メモはまだありません。クリックして入力できます。"
  meta line muted12: 定着度 ●●●○○ · "n回中m回正解 · 最終 YYYY/MM/DD" | "未学習"
STATES
  empty: 📄 in circle chipTrack + "問題がまだありません" + "Excelを読み込むか、アプリ内で作成すると/ここに一覧が表示されます。" + [📄 Excelを読み込む][＋ 問題を作成]
  loading: "⏳ Excelを解析しています…（N問）" + 6px progress + 5 skeleton rows (pills #f1f5f9)
  toast: success greenLight/b green; info blueLight/b bluePale + [元に戻す]; error redLight/b red + [詳細]

============================================================
S2 /editor クイズ作成
LAYOUT desktop 3-pane: sidebar 268 | editor 528 | preview flex sticky top:24.
LAYOUT tablet: sidebar -> ☰ ドロワー "問題一覧（N）"; segmented [編集|プレビュー]; editor full-width; underline toolbar pinned to 問題文 label row.
SIDEBAR
  head: "作成した問題" N + [＋](blue square 36 r12)
  segmented: 作成 N | 読込 M  (pool filter)
  items h>=52: ⠿ drag handle, head 1行 ellipsis, meta "科目 · n択", trailing "!" red if invalid. selected bg=blueLight. dnd reorder -> questionNumber resequence within authored only.
  foot: [複製][削除(red text)]
EDITOR fields (top->bottom)
  問題番号: read-only pill "問題番号 NNN（自動）"
  科目: combobox h44 — pick existing OR free type => create. hint "既存から選択、入力で新規追加"
  タグ: multi-tag input, chips blueLight/blue h28 + "✕", ghost "追加…", Enter/comma commit, dup-guard
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
    問題番号 | 科目 | タグ | 問題文 | 下線キーワード | 画像URL | 選択肢a | 選択肢b | 選択肢c | 選択肢d | 選択肢e | 正解 | 解説 | 基本事項
  serialization:
    タグ: comma-joined "a,b"
    問題文: segments concat plain text (no markup)
    下線キーワード: u:true segment texts, newline-joined (multi)
    選択肢d/e: "" when absent
    正解: letters joined "a,c" (matches import parser)
    基本事項: newline-joined
    filename: quizmake_N問.xlsx
  success toast: "quizmake_N問.xlsx を書き出しました" / sub "ダウンロードフォルダに保存されました"
IMPORT COEXISTENCE
  one pool. origin flag only. imported rows fully editable+deletable. sidebar filter 作成/読込. export scope selectable. import column mismatch -> red toast "読み込みに失敗しました（列が一致しません）" + [詳細].

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