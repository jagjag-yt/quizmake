# QUIZMAKE_CLOZE_MODE.SPEC v2 — agent-target: Claude Code
# v2(2026-08-17): [[ ]]記法 / タグ廃止 / xlsx12列 / グループ別連番 / 詳細パネルの既定=答えを隠す を反映。
# v2.6(2026-08-24): 段落の番号（1. / (1) / ①）/ 元に戻す・やり直す / スクロール固定 / 空白と空行の保持。
# v2.7(2026-08-25): 演習の自己採点（左クリック=正答/右クリック=誤答・誤答だけやり直す）。
# v2.8(2026-08-25): 判定と開閉を演習中ずっと保持 / 結果画面から誤答問題だけ再演習 / Tab+Enter / 問題送りで先頭表示。
# v2.9(2026-08-25): 結果画面へ移る前に中央の確認ダイアログを1枚挟む。
# v3.0(2026-08-26): 「同じ語をすべて隠す」に2つのスイッチ（番号の付け方 / 開き方）。markerKey と markerIndex を分離。
# v3.1(2026-08-26): 番号付き段落の折り返しを本文の開始位置に揃える（ぶら下げ字下げ）。
# v3.2(2026-08-26): その字下げを em の見積もりから、箱分け（演習）と canvas 実測（編集）に置き換え。
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
        [■ 隠す](primary, enabled only when selection non-empty, shortcut **F1**（修飾キー無し。⌘/Ctrl+H も受ける）)
        [同じ語をすべて隠す](enabled when selection non-empty)
          押すと**まず設定ダイアログを出す**（v3.0）。中央・2つのスイッチ:
            番号の付け方 [連番 | 同じ番号]  … 同じ番号 = そのまとまりで表示番号を1つ共有
            開き方       [ふつう | まとめて開く] … まとめて開く = 1つ開くと仲間も開く
          **2つは独立**。「同じ番号だが1つずつ開く」も「連番だがまとめて開く」も選べる。
          前回の選び方は localStorage `quizmake.sameWord.v1` に覚える。
          どちらも既定（連番・ふつう）ならまとまりを作らず、従来と同じ独立マーカーになる。
          選んだ語と同じ語を文章全体からまとめて隠す。隠しても文字数は変わらないので、
          元の文章での位置をそのまま使って順に hideRange する。
          RATIONALE: **ブラウザは離れた複数箇所の同時選択を持てない**（Chrome 148 で実測。
          textarea も contenteditable も rangeCount は 1 に潰れる。複数レンジは Firefox のみ）。
          「飛び地を選んで一気に隠す」は実装できないため、これで代える。もう一つの手段は [[ ]] 記法。
        [□ 隠すのを解除](enabled when selection intersects a hidden run)
        divider + 番号 [1.] [(1)] [①] [なし](v2.6)
          選んだ行の先頭に番号を振る。Word の「番号を振る」と同じ感覚で使う。
          選択が無ければカーソルのある段落だけ。すでに付いている番号は種類を問わず外してから振り直す。
          直前の段落が同じ種類の番号なら、その続きから数える。空の段落は飛ばす（数に入れない）。
          丸数字は ①〜⑳ まで。21以降は「(21) 」に落とす（丸数字が存在しないため）。
          **Enter で次の番号が続く**。番号だけの行で Enter を押すと番号を外し、そこで箇条書きを終える。
          行を足したあとは、下に続く同じ種類の番号を振り直す。
          HANGING INDENT(v3.2・非交渉): 番号付きの段落は、**折り返した2行目以降を本文の開始位置に揃える**。
            **字幅を em で見積もってはいけない**（v3.1 で半角0.5em/全角1emとしたが、実測と
            ずれた。18px の Noto Sans JP で「④ 」は 22.0px、「3. 」は 19.0px、「(1) 」は 26.2px。
            見積もりの 27px / 27px / 36px とは 5〜10px 違う）。
            演習・プレビュー・詳細: **番号を別の箱に入れて横に並べる**
            （`display:flex` ＋ 先頭に `flex:0 0 auto` の span、本文は `flex:1 1 auto; min-width:0`）。
            折り返しは本文の箱の中で起きるので、**計算せずに必ず揃う**。分割は `splitNumberPrefix(para)`。
            編集画面: 入力欄は行ごとの字下げを持てないので箱に分けられない。
            **canvas で実寸を測り**（`utils/textWidth.js`）、文章中でいちばん広い番号に合わせた
            px を `padding-left` と `text-indent` に入れる。**入力欄と見た目の層に同じ値**を入れること
            （片方だけだと二重にずれて見える）。書体は後から届くので `document.fonts.ready` で測り直す。
            番号付きの段落が無ければ 0＝従来どおり。
          IMPLEMENTATION: 文字列を作り直さず、段落の先頭 run だけを足し引きする
            （numberParas / unnumberParas / renumberFollowing / splitParaWithNumber in data/cloze.js）。
            テキストから組み直すと、隠す指定と文字色が別の位置へずれる。
          判定は state ではなく入力欄の今の選択を直接読む（選んだ直後に押すと state はまだ古い）。
        divider + [↶][↷](v2.6) 元に戻す/やり直す。Ctrl+Z / Ctrl+Y（Ctrl+Shift+Z も可）
        divider + 文字色: 6 swatches 22px circle r999, active = 0 0 0 2px #fff, 0 0 0 3px #2563eb
        disabled state (empty body): swatch/button bg #f1f5f9 fg #cbd5e1
      入力欄 b1 #2563eb r10 p16 min-h230
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
      hint row: compact「［［ ］］でも隠せます」/ desktop「F1 で隠す」
    BRACKET INPUT (v2。選択操作を要らなくする第2の入力手段):
      本文に [[語句]] と入力すると、**閉じ括弧を打った時点で**括弧が消え、その語が「隠す箇所」になる。
      キャレットは括弧が消えた分だけ追従させる（ずれると連続入力ができない）。
      実装: extractBracketRanges / colorOfRange in data/cloze.js。
      copy(エディタ下): "隠したい語を [[ ]] で囲んで入力しても隠せます。
                        例：植物は葉の[[葉緑体]]で —— 閉じた時点で括弧は消え、その語が隠す箇所になります。"
      reason: 選択してボタンを押す操作は書きながらだと手が止まる。貼り付け後の一括指定にも使える。
    footnote block (bg #f8fafc, b1 cardBorder, r14): "虫食い問題は採点しないため、正答率・定着度・今日の復習には含まれません。Excelにも書き出されません。"
  UNDO/REDO(v2.6・非交渉):
    ブラウザ標準の履歴は使わない。値を React 側で差し替えているうえ、
    **「隠す」は文字が変わらないため標準の履歴に残らない**。
    本文（paras）そのものをスタックに積み、入力・隠す・番号を同じ土俵で戻す。
    続けて打った文字は 700ms 以内なら1つにまとめる（1文字ずつ戻すと何十回も押すことになる）。
    保存を通ると run の入れ物が作り直されるため、履歴の比較は **中身で行う**（sameParas）。
    `!==` で見ると自分の変更まで「外から変わった」と誤解し、1回押しても何も起きなくなる。
    上限 100 手。問題を切り替えたら作り直す。

  SCROLL(v2.6・非交渉):
    高さの測り直し（height='auto'）とカーソルの置き直し（setSelectionRange）は、
    **前後で scrollTop を保存して戻す**。どちらもページを勝手に上へ飛ばす。
    前者は一瞬ページが短くなってブラウザがスクロール位置を切り詰めるため、
    後者はカーソルを見せようとしてブラウザが動かすため。

  TEXT(v2.6・非交渉):
    run の文字は **trim しない**（前後の空白を落とさない）。落とすと「12. aaa」の aaa を隠したときに
    直前の run が「12.」になり、空白が消えてカーソルもずれる。
    空の段落も **捨てない**。捨てると Enter を2回押しても空行が作れない。

  SHORTCUT の挙動(v2.5):
    F1（⌘/Ctrl+H）は **トグル**。隠れている箇所を選んでいれば元に戻し、そうでなければ隠す。
    F1 はブラウザのヘルプに割り当てられているので、preventDefault を必ず呼ぶ。
    押したあとは選択を解き、カーソルを範囲の末尾に置く。選択が残っていると続けて押したときに
    同じ場所へ何度も効いてしまう。
    判定は **state ではなく入力欄の今の選択（selectionStart/End）を直接読む**。
    state は同じ処理の中では前の値のままで、押した瞬間の選択とずれる。
  本文の文字(v2.5): 入力欄とプレビューで **同じ 18px / 行間 2.05**（compact は 17px）にする。
    別々の値だと同じ文章でも折り返しと行数が変わり、左右で高さが揃わない。
    EditorOverlay と textarea は重ねているので、必ず同じ値を渡すこと。

  文字を打ったときの追従(v2.6, 非交渉):
    rebuildFromText は「位置をそのまま引き写す」ことをしない。
    前の文章と新しい文章で **変わっていない先頭と末尾** を求め、その間だけを今回の編集とみなし、
    末尾側の属性は文字数の差だけずらして引き継ぐ。
    NG: 絶対位置で属性を引くだけの実装。前に文字を足すと隠す箇所だけ取り残され、文字とずれる
        （実際に報告された症状）。
    打った文字は、隠す範囲の **内側** のときだけ巻き込む（直前・直後は巻き込まない）。
    実測: 先頭に挿入／直前に挿入／先頭を削除 -> 範囲は「葉緑体」のまま追従。
          内側に挿入 -> 「葉XX緑体」に伸びる。直後に挿入 -> 巻き込まない。

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
    footer: [← 前の問題] + hint "左クリックで正答／右クリックで誤答" + [↻ 誤答だけやり直す(M)][↻ 隠し直す][次の問題 →](primary)
  ↻ 隠し直す = retry equivalent (closes all + 判定も消す)。

  KEYBOARD(v2.8):
    マーカーは button なので **Tab で次のマーカーへ**移れる。焦点があるとき:
      Enter … めくる（開く→正答→閉じる）／ Shift+Enter … 誤答
    演習画面の Enter（次の問題へ）は、**マーカーに焦点があるときだけ譲る**
    （useKeyboardShortcuts が `[data-marker="true"]` を見て素通しする）。
    Enter は Marker 側で preventDefault して自分で処理する。ボタンの既定動作に
    任せると、環境によっては何も起きないことがあるため。

  SCROLL(v2.8):
    問題が変わったら **画面の先頭へ戻す**（view/currentIndex/startedAt を見て scrollTop=0）。
    前の問題で下までスクロールしていると、次の問題も途中から表示されてしまう。

  MARKER IDENTITY(v3.0・非交渉):
    マーカーは**2つの数**を持つ（`withMarkerIndexes`）。
      markerKey   … 上から数えて何個目か。**必ず一意**。開閉・○✕・連動の管理はこれで行う
      markerIndex … 画面に出す番号。「同じ番号」のまとまりでは重複する
    表示番号で状態を管理してはいけない。番号を共有した瞬間に開閉まで道連れになり、
    「同じ番号だが1つずつ開く」が作れなくなる（実装中に踏んだ）。
    run に持たせる `link` は `{id, number, open}`。隠さない run には付けない。
    `mergeRuns` は link.id が違う run を繋げない（別のまとまりが1つに溶ける）。
    連動の対応表は `openTogetherMap(paras)`（markerKey → 一緒に開く markerKey の一覧）。
    連動するのは**開く・閉じる**だけ。○✕は押した1か所だけに付く。

  SELF-MARKING(v2.7・利用者の指示で追加):
    **開いたあとに自分で ○/✕ を付ける**。採点はしない方針のままで、記録にも残さない。
    左クリック: 閉じる → 開く → 正答(緑) → 閉じる（判定も消える）
    右クリック（タッチは長押し550ms）: 誤答(赤) の付け外し。閉じているマーカーでは開くだけ。
    見た目: 正答 bg #f0fdf4 / inset 0 -2px #16a34a、誤答 bg #fef2f2 / inset 0 -2px #dc2626。
      **色だけに頼らない**。番号バッジの後ろに ○ / ✕ を出す（淡い塗りでは色差が伝わらないため）。
    条件バーに「正答 N」「誤答 M」の pill と [誤答だけやり直す（M）]。
    [誤答だけやり直す] = ✕ の箇所だけ閉じ直し、判定を消す。○ はそのまま残す。
    保持は **演習の間ずっと・問題ごと**（v2.8）。次の問題へ進んでも、戻れば開いた場所と
      ○/✕ がそのまま残る。消えるのは「隠し直す」を押したときと、演習を始め直したとき。
      RATIONALE: 戻るたびに開き直すのは手間。学習記録に残さない点は変えない。
    RATIONALE: 虫食いは採点できない（自由記述のため）が、どこを間違えたかを本人が
      印として残せると「間違えた箇所だけもう一度」ができる。記録に残さないのは
      正答率・定着度・今日の復習の意味を変えないため（R4 は維持）。
    ※ v2 までの「no ○×」は、この指示で置き換えられた。ただし**自動採点はしない**点は不変。
  on 次の問題: all markers reset to closed; write viewedAt.
  tablet: same 1 column, card p22, ← / ↻ / 次の問題 all h44, ≡ collapses メモ.

  FINISH CONFIRM(v2.9・非交渉):
    「結果を見る」「演習を終了」を押したときは、**中央の確認ダイアログを1枚挟む**。
    最後の問題で押し間違えると、見直しに戻る手間が大きいため。
    title「演習を終わって、結果を見ますか？」/ [まだ続ける][結果を見る]（danger=false・初期焦点は「まだ続ける」）
    本文: 結果画面へ移ると演習が終わること＋やり残し
      （まだ解いていない選択式 N問 / ○✕を付けていない虫食い N問）。
    キー操作（Enter・→）からの終了も同じ確認を通す。ダイアログを出している間は
    演習のショートカットを止める（Enter が二重に効くため）。
    **本番モードの時間切れだけは確認を挟まない**（そのまま終わる）。

  SUMMARY(v2.8): 結果画面に「虫食いの自己採点：正答 N ／ 誤答 M」と
    「記録に残しません」の一文を出す。[間違えた問題をもう一度（N問）] は
    **選択式の誤答 ＋ 虫食いで✕が1つ以上ある問題**を対象にする。
    虫食いは採点しないので、この✕だけが「間違えた」の手がかりになる。

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
