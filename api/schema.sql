-- quizmake のバックアップ用データベース（Cloudflare D1 / SQLite）
--
-- 段階6a「預ける・取り戻す」だけを扱う。自動同期（6b）はここには入れない。
--
-- 方針:
--   ・預かるのは「問題とグループ」「学習記録」の2つだけ。
--   ・上書きの前に必ず残す。過去7日分を日付ごとに保持し、日付を選んで戻せる。
--   ・メールアドレスは、探すために必要なので平文で持つ。それ以外の個人情報は持たない。

-- 利用者。メールアドレス1つにつき1行。
--
-- display_name は画面に出す名前。本人確認には使わない（探すのはメールアドレス）。
-- 既存のデータベースに後から足す場合は migrations/0001_add_display_name.sql を流す。
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,          -- u_xxxxx
  email        TEXT NOT NULL UNIQUE,      -- 小文字に正規化して保存する
  display_name TEXT,                      -- 20文字まで。未設定なら NULL
  created_at   TEXT NOT NULL,             -- ISO8601
  last_seen_at TEXT NOT NULL
);

-- ログイン用の6桁の数字。使い捨て。
--
-- 数字そのものは保存せず、ハッシュだけを持つ（漏れても使えないようにする）。
-- 5回間違えたら、その要求を無効にして送り直してもらう。
CREATE TABLE IF NOT EXISTS otp_requests (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,             -- 発行から10分
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,                      -- 使ったら入る。二重に使えない
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_requests (email, created_at);

-- ログイン済みの端末。1人3台まで。
--
-- トークンそのものは保存せず、ハッシュだけを持つ。
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,        -- d_xxxxx
  user_id       TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,           -- 「Windows の Chrome」程度。利用者が見分けるため
  created_at    TEXT NOT NULL,
  last_used_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices (user_id, last_used_at);

-- 預かった中身。1人あたり最大7行（1日1行）。
--
-- 同じ日に何度預けても、その日の行を上書きする。日をまたぐと新しい行になる。
-- こうすると「7日分をさかのぼれる」が素直に表現でき、行数も増えすぎない。
CREATE TABLE IF NOT EXISTS backups (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  day           TEXT NOT NULL,           -- YYYY-MM-DD（利用者の端末の日付）
  payload       TEXT NOT NULL,           -- 書き出しと同じ形の JSON
  question_count INTEGER NOT NULL,
  group_count   INTEGER NOT NULL,
  bytes         INTEGER NOT NULL,
  device_id     TEXT,                    -- どの端末から預けたか
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_backups_user ON backups (user_id, day);

-- 送りすぎ・試しすぎを止めるための記録。
--
-- 「誰が」「何を」「いつ」やったかだけを数える。中身は持たない。
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket     TEXT PRIMARY KEY,           -- 例: otp:send:someone@example.com
  count      INTEGER NOT NULL,
  reset_at   TEXT NOT NULL
);
