# QUIZMAKE_CLOZE_MODE.SPEC v2 — agent-target: Claude Code
# v2(2026-08-17): [[ ]]記法 / タグ廃止 / xlsx12列 / グループ別連番 / 詳細パネルの既定=答えを隠す を反映。
# encoding: dense-kv. no prose. all UI copy = JP literal, ship verbatim.
# design source-of-truth: 受け渡し用/quizmake-cloze-mode.html (frames 01-07)。7.5MB・.gitignore 済みでリポジトリには入らない。
# companion spec (already shipped): ./SPEC.cc.md (設問一覧 + 問題作成). this file EXTENDS it.

GOAL
  add 2nd question type: cloze (虫食い). existing type renamed 選択式.
  ナビは v2 でドロワー化（SPEC.cc.md の NAV を見る）: 設問一覧 / 演習 / 問題作成 / 学習記録 + アカウント(準備中) + 設定。NO new tab.
  breakpoints: >=1024 desktop(design@1440) | 601-1023 compact(design@820) | <=600 phone。
    虫食いの「演習」は phone でも使える。作成のみ phone で制限（SPEC.cc.md の PHONE GATE）。

HARD RULES (non-negotiable)
  R1 cloze is NEVER graded. excluded from: 正答率, 要復習, 今日の復習, 本番モード, 定着度(box), lastResult, attempts/correct.
  R2 1 文章 = 1 問. multiple markers inside one 文章. progress n/N counts 文章.
  R3 textColor = decoration only, independent of hide. a run may be both hidden and colored.
  R4 cloze is NOT in Excel import/export. 選択式の xlsx は **12列**（タグ列は v2 で廃止）。EXPORT_COLUMNS in constants.js が正。
  R5 1回の演習は1グループのみ。グループ絞り込みに「すべて」は無い（番号がグループ内連番のため、混ぜると一意でなくなる）。

MODEL
  Question = ChoiceQuestion | ClozeQuestion (discriminator: type:'choice'|'cloze'; immutable after create)
  ClozeQuestion{
    id; type:'cloze'; questionNumber:int; groupId;
    title:string            // 任意. empty -> list shows body head
    paras:[[{text:string; hide:bool; color:hex}]]   // 段落の配列。段落 = run の配列。改行で段落を分ける
  }
  ※ tags は廃止(v2)。選択式と同じく model から削除済み。
  ClozeRecord{ bookmarked:bool; note:string; viewedAt:ISO|null; openedCount?:int(not surfaced) }
  markerIndex = sequential over hidden runs in document order, 1-based, recomputed on edit.
  storage: same localStorage pool as 選択式 ('quizmake.pool.v2')。番号は **グループごとに 1,2,3… の連番**
           （選択式と共通の並び。全変更が setPool -> renumberByGroup を通る。枝番方式は廃止）。

MARKER RENDER (exact)
  common: display:inline-block; padding:0 6px (quiz/tablet 0 7px); line-height:1.35; border-radius:0 /*直角*/; transition:all .15s ease
  closed: background:#2563eb; color:transparent  // real text stays in DOM => width/height fit glyph box exactly
  opened: background:#eff6ff; color:<run.color>; box-shadow:inset 0 -2px 0 #93c5fd
  press:  outline:2px solid #93c5fd; outline-offset:2px (hover on pointer devices, :active on touch). no transform, no reflow.
  number badge (both states, SAME position, top-left of the fill):
    <span style="font-size:12px;font-weight:700;line-height:1;vertical-align:top;margin-right:4px">N</span>
    color closed #ffffff / opened #1e293b   // 白黒反転のみ、位置は不変
    half-width digits, tabular
  long range crossing a line: display:inline (not inline-block) + box-decoration-break:clone; -webkit-box-decoration-break:clone
    switch rule: >=5 chars OR contains 、。／,. -> inline
  body text: 18px / line-height 2.05 (tablet 17px / 2.05). marker measured height ~23-24px.
  a11y: markers are <button type=button> styled inline, tabindex order = document order, Enter/Space toggles,
        aria-pressed, aria-label "空所N を表示/隠す". markers < 44px tall by design => require >=8px horizontal
        gap between adjacent markers and rely on line-height 2.05 for vertical separation. document this exception.

TEXT COLOR PALETTE (6, tokens only, all >=4.5:1 on #ffffff)
  標準#1e293b | 青#2563eb | 緑#166534 | 赤#991b1b | 橙#b45309 | 灰#64748b
  no free color picker.

============================================================
A. TYPE PICKER (entry flow)
  sidebar ＋ button label: 「＋ 問題を追加」 h44. opens dialog, does NOT open editor directly.
  dialog「新しい問題」 card20 p32 w600:
    field グループ (select h44, default = currently open group)
    field 問題タイプ: 2 radio cards r14 p18, selected = b1 #2563eb + bg #eff6ff + 6px solid dot
      選択式: "a〜eの選択肢から選ぶ。採点され、正答率・定着度に反映される。Excelで読み書きできる。"
      虫食い: "文章の一部を隠して確認する。採点はしない。アプリ内のみで作成・保存する。"
    foot: muted "タイプは作成後に変更できません" + [キャンセル][作成して編集する](primary)
  rationale: type is structurally immutable -> force one decision before the editor exists.

B. CLOZE EDITOR (問題作成, same 3-pane shell as 選択式)
  panes desktop: sidebar 268 | editor 528 | preview flex sticky top:24
  SIDEBAR: group name + count, [＋ 問題を追加], segmented すべて / 選択式 N / 虫食い N
    item rows h>=56: ⠿ + (title|body head, 1行 ellipsis) + type pill (虫食い=#eff6ff/#2563eb, 選択式=#f1f5f9/#475569) + meta ("5か所" | "5択")
  EDITOR fields:
    見出し (optional, h44) hint "未入力なら文章の冒頭を一覧に表示"
    文章 required:
      toolbar (p8, b1 border, r12, bg #f8fafc, position:sticky top:0 on tablet):
        [■ 隠す](primary, enabled only when selection non-empty, shortcut **Ctrl+F1**（実装の主。⌘/Ctrl+H も受ける）)
        [□ 隠すのを解除](enabled when selection intersects a hidden run)
        divider + 文字色: 6 swatches 22px circle r999, active = 0 0 0 2px #fff, 0 0 0 3px #2563eb
        disabled state (empty body): swatch/button bg #f1f5f9 fg #cbd5e1
      入力欄 b1 #2563eb r10 p16 min-h230 15.5px/1.95
      IMPLEMENTATION (二層構造。contenteditable ではない):
        下: EditorOverlay(position:absolute; inset:0; pointer-events:none) がマーカーの見た目を描く
        上: <textarea>(背景 transparent, -webkit-text-fill-color: transparent) が入力と選択を受ける
        textarea を選んだ理由: selectionStart/End がそのまま範囲指定に使え、日本語入力でも壊れないため。
      AUTO-GROW (非交渉):
        textarea は **中身の高さに合わせて伸ばす**。overflow:hidden / resize:none / display:block。
        高さは height='auto' -> scrollHeight + (offsetHeight - clientHeight) で測り直す。
        text の変化と、window の resize / orientationchange で再計算する（折り返しが幅で変わるため）。
        NG: 固定高＋textarea 内スクロール。**下の層は inset:0 で固定されスクロールしないため、
            はみ出した瞬間に文字が二重にずれて見える**（実機で発生。選択すると特に目立つ）。
            display を inline-block のままにするのも不可（ベースライン分の余白で下層が数px高くなる）。
        実測(1280px幅): 73字→230px / 292字→397px / 730字→941px。いずれも内部スクロール無し、
            下層とのズレ top/left/height すべて 0px。
      edit-mode mark render (NOT the real fill — author must stay able to read own text):
        background:#eff6ff; box-shadow:inset 0 0 0 1px #93c5fd; padding:0 5px; line-height:1.35; border-radius:0
        + same number badge, color #1e293b
      status row: pill "隠す箇所 N か所" + "薄い青枠が演習でマーカーになる範囲です" + right "N文字 / N段落"
      hint row: compact「［［ ］］でも隠せます」/ desktop「Ctrl+F1 で隠す」
    BRACKET INPUT (v2。選択操作を要らなくする第2の入力手段):
      本文に [[語句]] と入力すると、**閉じ括弧を打った時点で**括弧が消え、その語が「隠す箇所」になる。
      キャレットは括弧が消えた分だけ追従させる（ずれると連続入力ができない）。
      実装: extractBracketRanges / colorOfRange in data/cloze.js。
      copy(エディタ下): "隠したい語を [[ ]] で囲んで入力しても隠せます。
                        例：植物は葉の[[葉緑体]]で —— 閉じた時点で括弧は消え、その語が隠す箇所になります。"
      reason: 選択してボタンを押す操作は書きながらだと手が止まる。貼り付け後の一括指定にも使える。
    footnote block (bg #f8fafc, b1 cardBorder, r14): "虫食い問題は採点しないため、正答率・定着度・今日の復習には含まれません。Excelにも書き出されません。"
  serialize rules: merge adjacent runs with identical (hide,color); drop empty; renumber markers.
  PREVIEW pane: exact 演習 card. segmented [閉じた状態|開いた状態] switches all markers (preview markers are not individually clickable).
    header: 虫食い pill + group pill + "N / N問目"; title 20b; body; footer "Nか所中 Mか所 表示中" + [すべて表示]
  autosave: debounce 600ms -> localStorage. header "✓ 自動保存済み hh:mm".
  tablet: sidebar -> ☰ ドロワー「問題一覧（N）」; segmented [編集|プレビュー]; card p22; toolbar sticky.

C. CLOZE QUIZ SCREEN (演習)
  LAYOUT = SINGLE COLUMN, centered, max-width 1000px. reason: right card is 正解と解説; with no grading it would be empty.
  header right slot: "虫食いは採点対象外" | divider | "虫食い n/N問目" | progressbar 220x6
    ※ v2.2 で正答率はヘッダーから全廃。選択式でも出さない（学習記録のみ）。
  condition bar (card, above): 既定は **1行の要約**「全問題 · <グループ名> / N問で出題中 / [条件を変える]」。押すと展開する。
    展開時: 種別 segmented すべて/選択式/虫食い + グループ select(「すべて」は無い) + 出題数 + 本番モード
    虫食い時は "Nか所中 Mか所 表示中" + [すべて表示|すべて隠す](toggle h44)
    ※ tag pill は廃止(v2)。「この条件で開始」ボタンも廃止(条件を変えた時点で引き直す)。
  question card p32 40 36:
    虫食い pill + right [★](44) [自分メモ](44)   // tags は廃止(v2)
    title 24b
    body 18/2.05, markers clickable (see MARKER RENDER)
    footer: [← 前の問題] + hint "クリックで開閉／もう一度押すと隠れます" + [↻ 隠し直す][次の問題 →](primary)
  ↻ 隠し直す = retry equivalent (closes all). no ○×, no 解答する, no 正解/不正解 anywhere.
  on 次の問題: all markers reset to closed; write viewedAt.
  tablet: same 1 column, card p22, ← / ↻ / 次の問題 all h44, ≡ collapses メモ.

D. DIFFS TO EXISTING SCREENS (minimal)
  D1 設問一覧 table: insert 種別 column (76px) after 番号. pill text = 選択式 | 虫食い (never color-only).
     cloze rows: 学習状況 cell -> "— 採点なし" (#94a3b8), 定着度 cell -> "隠す N か所" (#64748b). columns are NOT removed.
     種別 gains a filter; existing sort/filter/search unchanged.
  D2 設問一覧 detail panel (cloze): 問題 N + 虫食い pill + group pill + [★][この問題から演習]
     title 18b, pill "隠す箇所 N か所", segmented [答えを隠す|答えを表示] **DEFAULT=答えを隠す**(v2 で反転)。
     reason: 選択式の詳細パネルと既定を揃えた。一覧は復習にも使うため、開いた瞬間に答えが見えると確認にならない。
     body 16/2.0 with markers in opened style. 自分メモ block. NO 解説 / NO 基本事項 sections.
  D3 演習 condition bar: new independent row "種別" segmented ABOVE the range chips.
     when 種別=虫食い -> 要復習 / 今日の復習 / 本番モード chips disabled (fg #cbd5e1) + amberLight note:
     "要復習・今日の復習・本番モードは採点前提のため、種別が「虫食い」のときは選べません。「すべて」では選択式のみが対象になります。"
  D4 学習記録: append ONE independent card, never merged into 正答率/連続日数/定着度:
     heading 虫食い + pill 採点対象外; 3 stats 24b: 持っている問題 N問 / 今週見た問題 N問 / まだ見ていない N問; muted "最終学習 YYYY/MM/DD"
  D5 Excel書き出し確認: 2 stat cards 書き出す問題 N問 / 対象外 N問 + NEUTRAL grey block (#f1f5f9, NOT amber — spec'd behavior, not user error):
     "虫食い問題 N問は書き出されません。Excelの12列は選択式のための形式のため、虫食いはアプリ内にのみ保存されます（削除はされません）。"
     primary button carries the count: 「⬇ N問を書き出す」

E. STATES
  E1 一覧 empty (種別=虫食い): square blue glyph in #eff6ff circle + "虫食い問題はまだありません" +
     "文章の一部を隠して覚えたい内容に向いています。/ Excelからは読み込めないため、アプリ内で作成します。" + [＋ 虫食い問題を作成]
  E2 editor, body empty: toolbar disabled, placeholder "覚えたい文章を貼り付けるか、入力してください。", error "✕ 文章を入力してください"
  E3 editor, 0 hidden: NOT an error. blueLight info block:
     "隠す箇所が0か所です。覚えたい語句を選んで「■ 隠す」を押してください。このままでも保存できますが、演習では文章がそのまま表示されます。"
  E4 long body (10+ lines): stay 1 column / 2.05; inline+box-decoration-break markers; [すべて表示] stays reachable (sticky condition bar).

ACCEPTANCE
  [] frames 01-07 of ./quizmake 虫食いモード.dc.html reproduced at 1440 and 820
  [] marker border-radius 0, height == glyph box (~24px @18px), no baseline shift on toggle
  [] number badge same x/y in both states, 12px, white->#1e293b inversion only
  [] toggle works by click AND keyboard; すべて表示/すべて隠す/↻ 隠し直す consistent with per-marker state
  [] cloze absent from 正答率・要復習・今日の復習・本番モード・定着度 computations (unit-test the selectors)
  [] xlsx export byte-identical to SPEC.cc.md の12列; cloze rows never emitted
  [] [[語句]] を入力 -> 閉じた時点で括弧が消え、隠す箇所になる。キャレットが追従する
  [] no color/font/radius outside the token list
