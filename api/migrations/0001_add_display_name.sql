-- users にユーザー名の列を足す（2026-08-24）。
--
-- schema.sql は CREATE TABLE IF NOT EXISTS のため、すでにあるテーブルには
-- 列が増えない。稼働中のデータベースには、こちらを1回だけ流す。
--
--   npx wrangler d1 execute quizmake --remote --file=migrations/0001_add_display_name.sql
--
-- 既存の利用者は NULL になる。次にログインしたときに画面から名前を決めてもらう。
-- 2回流すと「duplicate column name」で失敗するが、データは壊れない。
ALTER TABLE users ADD COLUMN display_name TEXT;
