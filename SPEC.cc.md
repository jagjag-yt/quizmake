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

THEME (v2.5. ライト／ダーク)
  色の実体は **src/index.css の CSS 変数 --c-***。constants.js の COLORS は `var(--c-*)` を指すだけ。
  切り替えは <html data-theme="light|dark"> の付け外しだけで済ませる（各画面には手を入れない）。
    data-theme 無し = 端末に合わせる（prefers-color-scheme）。設定で選んだときだけ属性が付く。
  保存: localStorage 'quizmake.theme.v1' = 'system'|'light'|'dark'。
  適用は main.jsx で **描画前**に行う（あとから当てると一瞬明るい画面が出てちらつく）。
  ダークの作り方: 下地(*Light)は暗く、その上に載る文字(*Dark)は明るく入れ替える。
    役割が対になっているので、明暗をひっくり返すだけで読める組み合わせが保たれる。
  COLORS.onAccent = '#ffffff' 固定。青・緑・赤の面に載る文字はダークでも白のまま。
  新しく色を足すときは、必ず --c-* を増やしてから COLORS 経由で使う。
  ハードコードした色（'#f1f5f9' など）を直接書かない。ダークで取り残される。
  DATA-STORED COLORS: 虫食いの文字色は **濃い hex が問題データに保存されている**。
    そのまま出すとダークで背景に沈む（標準色 #1e293b はダークのカード色と同じ）。
    表示のときだけ constants.js の inkColor() で --c-ink-* に読み替える。保存値は変えない。
  反転した帯（background: COLORS.text ＋ 白文字）は作らない。
    ダークでは COLORS.text が明るくなり、白地に白文字になる（実測 比1.23）。
    一括操作の帯はカード面（COLORS.card ＋ border）に統一する。
  背景と文字を対で決めること。片方だけトークン化すると、もう片方が取り残されて沈む。

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
  **全幅で overlay**(v2.1): 本文を押し出さない。scrim(rgba(15,23,42,.28)) を敷き、パネル w248(max 86vw) が
    左からスライドして重なる。animation: drawer-slide-in .18s ease-out / scrim は drawer-scrim-in。
    prefers-reduced-motion: reduce では animation を切る（結果の表示・非表示は同じ）。
    項目を選ぶ・scrim をクリック・Esc のいずれでも閉じる。開閉状態は保存しない（常に閉じて始まる）。
    localStorage 'quizmake.drawer' は廃止(v2.1)。開いたまま保持＋本文248px押し出しも廃止。
    reason: 開閉のたびに本文の折り返しが変わって読みづらい、と実利用で指摘された。
  Excelの 書き出す/読み込む はヘッダーから撤去 -> 問題作成の左カラムへ移動(DataTransfer)。
  **「⋯」メニューと「?」ボタンも廃止(v2.2)。** ヘッダーの左は ≡ とロゴだけ。
    ⋯ の中身が「?」1つだけになっており、しかも ? はキーボード前提でタブレットには意味が無かった。
    ショートカット一覧は **設定** に常設(SettingsView)。「?」キーの近道は残す（演習中のみ有効・中央の小窓）。
  right-slot is TAB-CONDITIONAL (ProgressHeader.jsx):
    演習     -> 演習 n/N問目 , progressbar 220x6 r999 track=border fill=blue
             (虫食い時は「虫食いは採点対象外」+「虫食い n/N問目」)
    設問一覧 -> 全 N 問
    問題作成 -> ✓ 自動保存済み hh:mm
    学習記録 -> （なし）
  **正答率はヘッダーに出さない(v2.2)。** 表示は学習記録の「通算正答率」だけ。
    リセット [↻ 正答率をリセット] も学習記録の見出し行へ移した。
    reason: 全画面に出す数字ではない。演習中に見えていると点数を追う気持ちが先に立つ。

MODEL (extend existing, no breaking change)
  Question{id; type:'choice'; questionNumber:int; groupId; segments:[{text,u:bool}]; choices:string[2..5];
           correctIndexes:int[]; explanation; keyPoints:string[]; imageUrl:string|null; origin:'authored'|'imported';
           tables:[{header:bool, rows:string[][]}]}
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
RECORD KEY (v3.0, 非交渉)
  学習記録は **問題文そのもの** をキーにしている（questionKey）。Excel を差し替えても
  同じ問題文なら記録が引き継がれる、という利点のための設計。
  代償として、**問題文を1文字直すと記録が行き先を失う**（実測: 誤字修正で
  「○正解・定着度3・★」→「未学習・○○○○○・☆」になった）。
  対策: App が id ごとに前回のキーを覚え、変わったものは study.moveRecord で引っ越す。
    同じ問題文の問題が他にも残っている場合は動かさない（その問題の記録を横取りしないため）。
  新しく問題を書き換える経路を足すときは、この引っ越しを通ること。

SAVE FAILURE (v3.0, 非交渉)
  **保存の失敗は必ず画面に出す。** pool.saveError と study.saveError の両方を見る。
  以前は study 側しか表示しておらず、問題の保存に失敗しても画面は正常に見えたため、
  編集を続けて再読み込みで消える、という形でしか気づけなかった。
  この環境の localStorage は約50MBだが、**iPhone の Safari は約5MB**で到達しうる。

TRASH (ごみ箱, v2.9)
  削除した問題とグループは消さず、ここへ移す。**削除は取り返しがつかず、しかも一度に
  何十問も消せる**ため、戻せる場所を1つ挟む（実際に別端末で15問を失う事故が起きた）。
  保存: localStorage 'quizmake.trash.v1' = { version:1, items:[TrashItem] }
    TrashItem = { id, deletedAt, kind:'question'|'group', group, questions[] }
      kind='group' はグループと中の問題を**1件**として持ち、戻すときも一緒に戻る。
    新しいものが先頭。上限 TRASH_MAX=100 件、超えたら古いものから落とす。
    保存に失敗したら件数を半分にして再試行する（ごみ箱のせいで問題本体が保存できなくなるのを避ける）。
  入口: **削除の経路は removeQuestion / removeGroup の2つだけ**なので、そこでごみ箱へ入れる。
    UI 側（一覧・作成・詳細・一括削除）には手を入れない。新しい削除口を作らないこと。
  戻し方: 元のグループが残っていればそこへ。無ければ**同じ id で作り直す**
    （id を変えると中の問題の所属が合わなくなる）。名前は uniqueGroupName で重複を避ける。
  **すべての削除経路がここを通ること(v3.0)。** 設定の「すべてのデータを削除」も、
    消す前にグループ単位でごみ箱へ移す。ここだけ素通りしていると、いちばん被害の
    大きい操作がいちばん戻せない、という食い違いになる。
  上限は読み込み側と保存側の両方で切る。片方だけだと保存領域に超過分が残る。
  導線: ドロワー（件数つき）と、設問一覧のグループ一覧のヘッダー。
    グループを全部消したあとの空状態にも出す（そこが一番戻したい場面）。

GROUPS (設問一覧の1階層目) — 並び順 (v2.1)
  ヘッダー行: "問題グループ" + "Nグループ / 全M問" + [並び順 select][向きボタン] + [⬆ 読み込む][＋ グループを作成]
  select: 名前順 | 更新順 。向きボタンはラベルが文脈で変わる:
    名前順 -> 「↑ あ→ん」/「↓ ん→あ」   更新順 -> 「↑ 古い順」/「↓ 新しい順」
  名前は localeCompare(name,'ja')。実測で読み仮名順になる（青森→大阪→東京→北海道。コードポイント順ではない）。
  更新は ISO 文字列をそのまま比較。同着は必ず名前の昇順に落として、並びが揺れないようにする。
  保存: localStorage 'quizmake.groupSort.v1' = {by,dir}。端末ごとの好みなので session ではなく local。
  カードの操作ボタンは **grid 1fr 1fr の 2×2 固定**(v2.2)。上段=設問を見る/▶ 演習、下段=名前の変更/削除。
    NG: flex + flexWrap。カード幅によって 3個＋1個 のような中途半端な折り返しになる（実機で指摘された）。

MODEL 追記 (v2.1)
  Group{id; name; createdAt; updatedAt}
  updatedAt は setPool の中で **中身が変わったグループにだけ**打つ(storage/pool.js stampUpdatedGroups)。
  判定は問題オブジェクトの参照比較（不変更新なので、触っていない問題は同じ参照で残る）＋グループ名の変化。
  対象: 追加・編集・削除・移動(移動元と移動先の両方)・改名。旧データは createdAt で埋める。

RESET PROGRESS (v3.3, 学習状況のリセット)
  グループ見出しのカード右端に [⟲ 学習状況をリセット]。**このグループの全問**が対象。
  一括操作の帯にも [⟲ 学習状況] を置き、こちらは**選んだ問題だけ**を対象にする。
  消すもの: 解いた回数・正誤・定着度(box)・次の復習日(dueAt)・虫食いを見た日(viewedAt)。
  残すもの: **ブックマークと自分メモ**（覚え直したいだけで、印や書き込みまでは失いたくない）。
    日別の統計(daily/totals)は履歴なので触らない。
  実装は useStudyData.resetRecords(keys)。ConfirmDialog を必ず通す(R6)。
  設定の「すべてのデータを削除」とは別物。あちらは全グループ・ブックマーク・メモまで消す。

RANGE SELECT (v3.3, 非交渉)
  チェックボックスは **Shift を押しながら**で「前に触った行〜いま押した行」をまとめて
  同じ状態にする。設問一覧と、問題作成の左カラム（作成した問題）の両方。
  起点は「最後にチェックを触った行の位置」。並び順・絞り込みが変わったら捨てる（位置がずれるため）。
  **起点は setState の更新関数の外で読むこと。** 更新関数の中で ref を読むと、
  その頃には「いま押した行」に書き換わっていて範囲が常に空になる（実装時に踏んだ）。
  onChange の e.nativeEvent.shiftKey を見る（React は checkbox の onChange を click から作るため取れる）。

FOOTER-CTA card: "絞り込み中の N問 を対象に" + [⇄ シャッフル演習][▶ この条件で演習を開始](primary)
  -> start 演習 with current filtered set. **この2つは現存する**(実機で確認)。
  ※ 廃止したのは「演習」画面の条件バーにあった開始ボタンのほう(StudyToolbar)。混同しないこと。
BULK (include=YES): >=1 checked -> bottom bar bg#1e293b r14: "N問を選択中" + [★ ブックマーク][⧉ 複製][→ 移動…(group select)]
  [⇱ 別グループへ分割][▶ 演習](primary)[⟲ 学習状況][🗑 削除(confirm)]. hidden at 0.
  same 複製/移動/削除 also sit atop the detail panel.
DETAIL content order:
  headline: 問題 NNN + 科目pill + origin pill(作成|読込, blueLight/blue) + ★btn44 + [この問題から演習](primary)
  q text 18/1.9, segments u:true -> border-bottom 2px blue + bold
  image: if imageUrl -> img r14 b1 border; else omit. (design shows striped placeholder = spec only)
  choices a–e r14 h>=48: correct -> b1 green + greenLight + label chip green/#fff + text greenDark bold + right "正解"; else b1 border/#fff
  解説 (h14b+bb) 14.5/1.9 body
  基本事項 (h14b+bb) each line: blueLight r14 p12 14（記号「●」は v3.2 で廃止）。
    ここだけカードのまま。演習・プレビューは v3.3 で解説と同じ地の文にした（上の DISPLAY 参照）。
  自分メモ (h14b+bb) editable textarea-look input10, autosave onBlur; empty -> "メモはまだありません。クリックして入力できます。"
  ANSWER VISIBILITY(v2): 詳細パネルは既定で答えを伏せる。segmented [答えを隠す|答えを表示] DEFAULT=答えを隠す。
    reason: 一覧から復習に使うため、開いた瞬間に正解が見えると確認にならない。虫食いの D2 も同じ既定に揃えた。
  ACTIONS(detail panel 上部, v2.7): **1行に [▶ この問題から演習][✎ 編集][⧉ 複製][→ 移動…][🗑 削除] の順**。
    「この問題から演習」は primary(青塗り)。以前は見出し行の右端に単独で置いていたが、
    同じ問題への操作なのに離れていて探しづらいため、操作の行の先頭にまとめた。
    削除の marginLeft:auto は外す（右端に飛ぶと並び順が崩れる）。
    スマホ幅では折り返して2行になるが、順序は保たれる（実測 390px で 3個＋2個）。
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
3ペインを出す境界 (v2.1):
  **3ペインは PREVIEW_TIGHT_QUERY='(max-width:1279px)' に一致しない幅（>=1280）でだけ出す。**
  1280px 未満は画面幅にかかわらず compact と同じ segmented [編集|プレビュー] の切替に回す。
  根拠: 余白32×2 + 268 + 528 + gap20×2 = 900px を消費するため、プレビューの実測幅は「画面幅 − 900」。
        iPad Pro 横 1194px では 279px しか残らず、選択肢が折り返して確認にならない（実測値）。
  PREVIEW ACCORDION (v2.8): >=1280 の3ペインでも、プレビューは **常に開閉式**にする。
    既定は閉じたまま。閉のとき3列目は w48/h220 の縦帯ボタン「‹ プレビュー」(writing-mode: vertical-rl)。
    開のときはプレビュー見出しの上に [プレビューを畳む ›]。
    columns: 閉 '268px minmax(528px, 1fr) 48px' / 開 '268px minmax(0, 528px) minmax(360px, 1fr)'
    開いているとき editor を固定 528 にしない（固定すると狭い幅で横スクロールが出る）。
    実測(1440px): 閉 268/1004/48 -> 開 268/528/524。
    1280px 未満は従来どおり segmented [編集|プレビュー]。どちらの幅でも「出しっぱなしにしない」で揃う。
LAYOUT compact: sidebar -> ☰ ドロワー "問題一覧（N）"; segmented [編集|プレビュー]; editor full-width; underline toolbar pinned to 問題文 label row.
LAYOUT phone(<=600): 編集画面を出さず PHONE GATE に差し替え。
SIDEBAR (v2)
  head: 「追加先のグループ」select + [＋ 新規]（グループを増やす操作。ここだけ）
  divider(1px cardBorder)
  [＋ 問題を追加]: **幅いっぱい・primary・h44**(v2.1)。押すと「新しい問題」ダイアログ(TypePickerDialog)。
    NG: 36px の ＋ アイコンを「作成した問題 N問」行の右端に置く形。グループの [＋ 新規] と右端で縦に並び、
        押し間違える。役割が違うものは線で分け、大きさも変える。
  NEW QUESTION DIALOG (TypePickerDialog): グループ select / 問題タイプ radio(選択式・虫食い。作成後は変更不可) /
    **問題数**(v3.3) chips [1問][3問][5問][10問][20問] + 数値入力。既定は1問。
    **数に上限は設けない**（v3.3・利用者の指示。以前は20問で頭打ちにしていた）。
      入力欄に max を付けないこと。チップはよく使う数への近道にすぎない。
    ボタンは「作成して編集する」（2問以上なら「N問を作成して編集する」）。
    まとめて作ったら**1問目を開く**。2問以上のときはトーストで「基本事項の下の『次の問題 →』で続けて書けます」。
    pool.addQuestion(groupId, type, count) が採番して足し、**{id, created} を返す**。
      越えられないのはプール全体の上限（LIMITS.QUESTIONS）だけ。そこで打ち切ったときは
      **黙って減らさず**、「頼まれたN問のうちM問は追加できませんでした」と赤いトーストで伝える。
      1問も入らないときは追加せず、その旨だけを出す。
  「作成した問題 N問」ラベル行 + segmented すべて/選択式/虫食い
  items h>=52: checkbox, **番号**, head 1行 ellipsis, trailing "!" red if invalid. selected bg=blueLight.
    並べ替え(v3.3 で廃止・利用者の指示): つまみ（⠿）とドラッグでの並べ替えを**消した**。
      一覧の順序は問題番号（グループごとの連番）だけで決まる。
      pool.reorderAuthored と storage/pool.js の reorderSubset も一緒に消した（他に使い道が無いため）。
      復活させないこと。復活させるなら、番号の振り直し（renumberByGroup）との関係から作り直しになる。
    番号(v3.3) = q.questionNumber（グループごとの連番。エディタ上部の「問題番号 N（自動）」と同じ値）。
      幅20px・右寄せ・tabular-nums。選択中の行だけ blue。**通し番号を別に振らない**
      （種別で絞ると list index と実際の番号がずれ、どちらが正なのか分からなくなる）。
    1件以上チェック -> [→ 移動][🗑 削除] で複数まとめて操作。Shift での範囲選択は RANGE SELECT に従う。
  foot: [複製][削除(red text)] + [書き出す][読み込む](DataTransfer。ヘッダーから移設)
  移動ダイアログ: 「移動先のグループ」select +
    "移動先で番号が重なった場合は、移動してきた問題の番号だけを振り直します。"
SAVE(v2.8 / v3.3): **[保存] は廃止。** 保存は 600ms デバウンスの自動保存だけにする。
  区切りのボタンは「押さないと保存されない」と誤解させるうえ、押した先で画面が移動するのも
  作成の流れを切っていた。
  **[変更を破棄] も v3.3 で廃止した（利用者の指示）。** 編集を始めた時点のスナップショット
    （snapshotRef）と、それを戻す ConfirmDialog ごと消してある。右下に出るのは不備の知らせだけ。
    復活させないこと。戻す手段が要るなら、ごみ箱と同じように**履歴として**設計し直すこと
    （その場のスナップショットは、画面を移った時点で失われるので当てにできない）。
  不備の表示: validateQuestion に引っかかる間、右下に赤いバーで
        「未完成：<不備をスラッシュ区切り>」を出し続ける。
        出す条件は **dirty かつ不備あり**。dirty を外すと、まとめて作った直後の
        まっさらな問題すべてに赤いバーが出る（触る前から不備扱いになる）。
        止める手段は無いので、未完成の問題はプールに残る。一覧では "!" が付く。
  ※ 既知の残件(v2.3時点): プールは 600ms デバウンスで自動保存されるため、保存を拒んでも
     未完成の問題自体はプールに残り、設問一覧に「（無題の問題）」等として出る（実機で確認）。扱いは未決。

OFFLINE NOTICE(v2.3): 右下(bottom 84px)の「⚡オフラインです / 演習は続けられます」に ✕ を付けて消せるようにする。
  次にオフラインへ変わったときは再び出す(dismissed をリセット)。気づけないと困るため、消えっぱなしにはしない。
EDITOR fields (top->bottom)
  問題番号: read-only pill "問題番号 NNN（自動）"
  グループ: 左カラムの「追加先のグループ」で決まる。エディタ内の 科目 combobox は廃止(v2)。
  問題文: required badge red"必須"; 右に [⊞ 表を入れる] のみ。
    UNDERLINE(v3.2 で全廃・非交渉): **下線という機能そのものを消した**（利用者の指示・2026-08-26）。
      model から `u` を落とし、描画・編集UI・位置合わせ（marks）も全て外した。
      Excel は **列の並び（12列）を変えない**。「下線キーワード」列は
      **書き出しでは常に空**、**読み込みでは読み飛ばす**。既存のファイルはそのまま読める。
      復活させないこと。復活させるなら、位置で持つ設計（旧 segmentsToMarks）から作り直しになる。
    INPUT SIZE(v3.1・非交渉): 問題文・解説・基本事項と**表の1マス**は
      **中身の高さに合わせて自動で伸ばす**
      （components/AutoTextarea.jsx。resize:none / overflow:hidden）。手で高さを変える方式はやめた。
      **読み込み直後にも測る**こと。Excel から入れた長い問題文が最初の高さのままになり、
      「反映されない」と報告されたため。測るあいだページのスクロール位置は保存して戻す。
    TEXT(v3.1・非交渉): 入力中の文字を **trim しない**（editableText）。trim すると
      文頭でスペース・改行を打った瞬間に消え、「入力できない」ように見える。
      未入力の判定は使う側で trim して行う。
    NEWLINE(v3.3・非交渉): 入力欄で打った**改行をそのまま出す**。問題文を描く3か所
      （演習 QuestionCard / 詳細パネル QuestionDetail / 作成のプレビュー EditorView.Preview）の
      本文 <p> に white-space: pre-wrap を付ける。解説・基本事項は以前からこの扱いで、
      問題文だけが改行を潰していた（利用者の報告・2026-08-26）。
      設問一覧の行は1行の省略表示のまま（nowrap + ellipsis）。ここで改行を活かすと行の高さが崩れる。
    serialize -> segments[]; merge adjacent same-u; strip empty.
  解説 / 基本事項(v3.3): 見出し行の右に [⊞ 表を入れる]（問題文と同じ形・EditorView.LongTextField）。
    見出しの横に説明書きは置かない（v3.3・利用者の指示。基本事項の
    「解説と同じように、そのまま書けます…」を消した)。
  基本事項(v3.2 で変更): **1つの入力欄**（解説と同じ・自動で伸びる）。
    箇条書きの記号（●）と並べ替え・個別の削除は**廃止**（利用者の指示）。
    保存の形は変えない（1項目＝1行の配列）。Excel の「基本事項」列は
    これまでどおり改行区切りで往復する。空行は使う直前に落とす（compactQuestion）。
    表示も記号なしの行にする。数式（$…$）が使える。
    DISPLAY(v3.3・利用者の指示): **演習(ResultCard)と演習プレビュー(EditorView.Preview)では
      解説とまったく同じ見た目にする。** 字下げ・1項目ごとの隙間・囲い（カード）を付けず、
      空行を落とした配列を改行で繋いだ**1本の文章**として出す（14.5px / 1.9 / pre-wrap）。
      入力欄が1つなのに表示だけ項目に割れていると、書いたとおりに出ない。
      出す条件は keyPoints.some(trim)（length>0 だと空行だけのときに見出しだけが出る）。
      設問一覧の詳細パネル(QuestionDetail)は blueLight のカードのまま（別画面なので揃えていない）。

  数式(v3.1・任意): 本文・選択肢・解説・基本事項で `$…$`（文中）と `$$…$$`（行を分けて中央）を LaTeX として組む。
    KaTeX を使い、**数式を含む問題を開いたときにだけ読み込む**（約260KB・別チャンク）。
    読み込みが終わるまでは元の文字を出す（空白の時間を作らない）。
    書き方を誤ったところは赤字で元の文字を出す（画面は壊さない）。
    utils/mathText.js が切り分け、components/MathText.jsx が描く。
    **描く場所すべてに通すこと(v3.3)。** 選択肢は演習(QuestionCard.Choice)だけが MathText を
      通していて、作成のプレビュー(EditorView.Preview)と設問一覧の詳細パネル(QuestionDetail)は
      素の文字のままだった。同じ問題が場所によって違って見えるので、書いた人が確認できない。
      選択肢を描く場所は3つ。新しく足すときも MathText を通す。

  並べ替え(v3.1・非交渉 / v3.3 で対象は**選択肢のみ**): 行の並べ替えは
    **つまみ（⠿）を押している間だけ** draggable にする。
    行全体を draggable にすると、入力欄の中で文字を選ぼうとした瞬間に並べ替えが始まり、
    選択できない（基本事項で報告）。Sortable は children を関数で受け、handleProps を渡す。
    残っているのは選択肢だけ。基本事項(v3.2)・左カラムの問題一覧(v3.3) は並べ替えごと廃止した。

  サイドバーの件数(v3.1): 「作成した問題 N問」は**表示中のグループだけ**を数える。
    全体を数えると、下の [選択式 n][虫食い n] と食い違う（48問なのに一覧は10問、と報告）。

  表(v3・任意 / v3.3 で置ける場所を拡張): **問題文・解説・基本事項**の途中に差し込む。
    1問に9つまで（3つの欄で共有する）。30行×10列・1マス200字まで。
    MODEL: 表そのものは `question.tables`。本文には**目印 `[[表N]]` だけ**を置く。
      理由: 問題文は「テキスト＋下線位置」から毎回組み直している（buildSegmentsFromMarks）。
      表を segments に混ぜると、1字打つたびに消える。目印なら文字と一緒に動き、
      位置合わせの計算も要らない。目印を消せば本文から外れる（表は残り、editor が
      「本文に置かれていません」と出して入れ直せる）。
    表を消したら、後ろの表の番号を繰り上げること（ずれると別の表が出る）。
      **3つの欄すべてを振り直す**こと。1か所だけ直すと、別の欄に残った目印が違う表を指す。
      目印の数え直し・振り直し・書き出し時の除去は data/questions.js に集約してある
      （placedTableNumbers / usedTableCount / stripQuestionTables）。新しい欄を足すときは
      tableHostTexts に足せば全部そろう。
    入力: 3つの欄それぞれの見出し右に [⊞ 表を入れる]（その欄のカーソル位置に挿入）。
      CARD PLACEMENT(v3.3・利用者の指示): 表カードは**目印を置いた欄の入力欄のすぐ下**に出す。
        欄と表が離れていると、どの欄の表を直しているのか分からない。
        振り分けは EditorView が毎描画で計算する（3つの欄を順に走査し、その表の目印が
        最初に見つかった欄を持ち主にする）。**表の番号は通し番号のまま**にすること
        （欄ごとに振り直すと目印と合わなくなる）。
      どこにも目印が無い表は問題文の下にまとめ、[問題文に入れる] で本文の末尾に目印を足す。
      その警告は**3つの欄のどこにも目印が無いとき**だけ出す。
    セルの改行(v3.3・利用者の指示): 1マスは textarea（AutoTextarea・minRows 1）。
      input のままだと Enter が効かず、1マスを2行に分けられない。
      保存では **trim しない**（editableText）。trim すると打った改行がその場で消える。
      表示側（QuestionTable の th/td）は white-space: pre-wrap。
    描画: 解説・基本事項は components/RichText.jsx（目印で切って表を挟み、文章側は MathText に通す）。
      演習の解答後・設問一覧の詳細・作成のプレビューで同じ見た目。
      Excel から範囲を貼り付け（行=改行・列=タブ）と、1マスずつの手入力の両方。
      [＋行][−行][＋列][−列]、「1行目を見出しにする」（既定 on）。
      **行ごとの列数は必ず揃える**（崩れた表は直す手段が無い）。
    描画: 演習・詳細・プレビューで同じ見た目（components/QuestionTable.jsx）。
      狭い画面では**表だけ横スクロール**（ページ全体を横に伸ばさない）。見出し行は th。
    xlsx: **表は書き出さない**（12列は選択式のための形式）。目印を外した本文だけを出し、
      「表 N問ぶん は含まれていません」と伝える。バックアップ(.json)には入る。

  画像URL(任意): input10 mono13 + 64x44 thumb. debounce 400ms -> preload. fail -> red border + "✕ 画像を読み込めません。URLを確認してください"
  選択肢: 2..5 rows r14 h>=48: ⠿ + label chip a..e (auto-relabel on reorder) + text input + toggle pill [正解にする|✓ 正解] + ✕(disabled at 2)
    PASTE(v3.3・非交渉): 入力欄に**複数行**を貼ったら、**1行＝1選択肢**に分ける（onPaste で既定の貼り付けを止める）。
      入力欄は1行なので、そのままでは改行が潰れて1つの選択肢になってしまう（利用者の報告）。
      貼った欄から順に上書きし、足りなければ足す。空行は捨て、各行は trim する。
      5つを超えた分は入れられないので「選択肢は5つまでのため、余ったN行は入れていません」を欄の下に出す
      （黙って落とさない）。1行だけの貼り付けは**何もしない**（普通の貼り付けのまま）。
    correct row: b1 green + greenLight; pill green/#fff
    [＋ 選択肢を追加](dashed #cbd5e1) hidden at 5
    if correctCount>=2 -> inline blueLight bar "正解が2つ →「2つ選べ」として出題されます" (mirror badge in preview)
  解説: multiline 14.5/1.9
  基本事項: 解説と同じ1つの入力欄（v3.2 で行ごとの ⠿ / ✕ / [＋ 項目を追加] は廃止）
  問題の移動(v3.3): 基本事項の下に [← 前の問題][N / M問目][次の問題 →]（EditorView.QuestionNav）。
    並びは左カラムの一覧と同じ（＝種別の絞り込みも効く）。端では disabled。
    虫食いの編集にも同じ帯を専用エディタの下に置く（3ペインでは grid の1マスに収まるよう箱で包む）。
    reason: 長い問題を書いたあと、次の1問へ行くのに左カラムまで目とマウスを戻す必要があった。

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
    validateQuestion の文言: 問題文が未入力 / 選択肢が未入力(0個) / 選択肢が1つのみ(1個) / 正解が未設定
    mono line listing columns. actions: [不備を修正する][⬇ 書き出す](primary)
  COLUMNS (exact order, header row = these JP strings):
    問題番号 | 問題文 | 下線キーワード | 画像URL | 選択肢a | 選択肢b | 選択肢c | 選択肢d | 選択肢e | 正解 | 解説 | 基本事項
    (12 cols. group is per-file, not a column. タグ列は廃止)
  serialization:
    問題文: segments concat plain text (no markup)。**表の目印 `[[表N]]` は取り除く**
    下線キーワード: u:true segment texts, newline-joined (multi)
    選択肢d/e: "" when absent
    正解: letters joined "a,c" (matches import parser)
    基本事項: newline-joined
    filename: quizmake_N問.xlsx
  success toast: "quizmake_N問.xlsx を書き出しました" / sub "ダウンロードフォルダに保存されました"
IMPORT COEXISTENCE
  取り込み先の決定(v2.2):
    view=問題作成 かつ **editorGroupId が立っている**(グループを実際に選んでいる)とき
      -> そのグループの **末尾に足す**。新しいグループは作らない。番号は既存の続きから振られる
         (renumberByGroup が配列順で振るため、末尾に足せば既存の番号は動かない)。
         トースト「N問を読み込みました / グループ「X」の末尾に追加しました（番号は続きから）」
      -> 画面は動かさない（作成の途中なので、演習を開始したり一覧へ飛んだりしない）
    それ以外 -> 従来どおり 1ファイル＝1グループ。取り込み後そのまま演習を始められる
    ※ activeEditorGroupId(未選択時に先頭グループへフォールバックする値)で判定しないこと。
      入口の画面から読み込んだだけで無関係なグループへ入ってしまう。
  **「置き換える」は用意しない(v2.9)。** 今ある問題を丸ごと消す操作で取り返しがつかない。
    読み込みは常に追加。ダイアログは [キャンセル][追加する] の2つだけ。
  one pool. origin flag only. imported rows fully editable+deletable. sidebar filter 作成/読込. export scope selectable. import column mismatch -> red toast "読み込みに失敗しました（列が一致しません）" + [詳細].

============================================================
S3 /settings 設定 (v2 追加。drawer 最下段から入る)
  1カラム, maxw720, card 20r。3セクション:
    見た目 : segmented [端末に合わせる|ライト|ダーク]（THEME を見よ）
    キーボードショートカット : 説明文 + 一覧(ShortcutList)。ヘッダーから移設した常設の置き場。
    通知   : pill「準備中」 + "「今日の復習」がたまったときにお知らせする機能を準備しています。
             お使いの端末に通知を届けるにはアカウントが必要なため、アカウント機能と一緒に提供します。"
    規約とプライバシー : 説明文 + 外部リンク3つ(target=_blank rel=noopener) 末尾に ↗
             [利用規約](https://quiz-make.com/terms.html) [プライバシーポリシー](https://quiz-make.com/privacy.html)
             [お問い合わせ](mailto:support@quiz-make.com)
    データ : すべて削除。ConfirmDialog「すべてのデータを削除しますか？」を必ず経由する。
  VIEWS.SETTINGS。タブ扱いにはしない(4タブの並びに入れない)。

============================================================
PHONE LAYOUT (<=600px, v2.4)
  想定端末: iPhone / Android の縦持ち。実測は 390x844(iPhone) と 360x800(Android) で行う。
  main grid: phone は '1fr'（PC/タブレットは '1fr 1fr'）。
    演習は DOM の順がそのまま縦並びになり、**問題が上・答えが下**になる。
    実測(390px): 問題カード y=135 h=545 / 答えカード y=696 h=621、横スクロール無し。
  設問一覧の表: 7列(GRID=40 68 76 1fr 118 78 36, MIN_TABLE_W=760)は入らない。
    phone は 1行を2段に組み替える: columns '28px 1fr 36px' / ROW_H_PHONE=78
      上段: 番号 + 種別pill + 学習状況    下段: 問題文(1行 ellipsis)    右: ★
    見出し行は phone では出さない（並べ替えはフィルタバーの「並び順」で行う）。
    仮想スクロールの計算(start/end/スペーサ)は ROW_H ではなく rowH を使うこと。
    NG: 列を残して横スクロールさせる。実測で 390px の画面に 782px はみ出した。
  SAFE AREA: index.html が **viewport-fit=cover** のため、安全領域は自分で足す。
    header: padding-top に env(safe-area-inset-top)
    main  : 左右に env(safe-area-inset-left/right)、下に env(safe-area-inset-bottom)
    画面下に固定するもの（保存/破棄・一括操作バー・統合バー・オフライン通知）は
      bottom: calc(元の値 + env(safe-area-inset-bottom, 0px))
    ※ デスクトップのブラウザでは env() が 0 になるため、**実機でしか検証できない**。
  WRAP (非交渉): 本文の折り返しは **body の overflow-wrap: anywhere** 1か所で効かせる（継承する）。
    各所にインラインで書かない。書き忘れた場所だけ半角の長い連続文字が枠から飛び出す。
    **break-word ではなく anywhere。** break-word は折り返しの計算しか変えず、要素の最小幅には
    影響しないため、flex/grid の子（選択肢の行など）が長い語の幅のまま縮まず溢れる
    （実測: 幅495pxの行に中身1423px）。anywhere は最小幅も縮む。
    折り返してほしくない箇所（1行省略の行・ボタン・pill）は white-space: nowrap を付ける。
    実測(修正前): 虫食いプレビュー 幅434px に中身1188px、ページ全体が 1440px→2101px に膨張。

  MIN-WIDTH (非交渉。新しい画面を足すときも必ず): **main の子（各 View のルート）には min-width:0 を付ける。**
    grid/flex の子は既定で min-width:auto のため、中身の最小幅にページごと押し広げられる。
    このとき header は width:100%（=表示幅）のままなので、**ヘッダーだけ短く見える**という形で表面化する。
    ページが横に伸びているのが原因で、ヘッダー側の不具合ではない。
    対象は gridColumn:'1 / -1' を持つ全ルート（Cloze/Editor/Empty/Groups/Questions/Summary/Settings/Dashboard）。
    タイル状の子（flex: '1 1 140px' など）にも同じ理由で min-width:0 が要る。
    実測: Dashboard 360px→386px はみ出し / SessionSummary 390px→457px はみ出し。
  TAP: チェックボックスは phone/compact で 22px（既定 18px は指で押しづらい）。
  FOOTER NAV: 3つのボタンで幅を分けるため、phone では1つ 100px しか取れない。
    左右の余白 24px のままだと文字に 52px しか回らず「リトライ」でも2行に折れる（実測 h=68px）。
    phone は padding '10px 6px' / font 13px / white-space:nowrap にして1行に収める（実測 h=44px）。
    高さは TAP_MIN(44) を下回らせない。
  DASHBOARD: 棒グラフの svg は既定で min-width 320px。phone のカード内側は 276px しかなく、
    そのままだとカードから 23px はみ出して切れる（実測 右端 363px / カード右端 340px）。
    phone では min-width を外す（viewBox で縮む）。
    BarRow は 110px + 112px の固定幅を並べるとバーが 30px しか残らないため、
    phone では「名前を上の段、バーと数値を下の段」の2段に組み替える。

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