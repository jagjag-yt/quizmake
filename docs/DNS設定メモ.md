# メール送信のための DNS 設定（Resend）

Resend の画面で値が `[…]` と省略され、コピーボタンも出ないときの手順です。
**Resend の API から全文を取り出します。**

---

## 1. 全文を取り出す

Resend の API キー（`re_` で始まる文字列）を使います。
**このキーは他人に見せないでください。** 下のコマンドはあなたの端末だけで実行します。

### 手順

**①** Resend の画面 → 左メニュー **API Keys** → キーを作成してコピー

**②** PowerShell を開き、キーを一時的に変数に入れる（画面に残さないため）

```bash
$env:RESEND_KEY = "ここにキーを貼る"
```

**③** ドメインの一覧を取り、`id` を確認する

```bash
curl -s -H "Authorization: Bearer $env:RESEND_KEY" https://api.resend.com/domains
```

`quiz-make.com` の `"id": "..."` をコピーします。

**④** そのドメインの DNS レコードを**全文**表示する

```bash
curl -s -H "Authorization: Bearer $env:RESEND_KEY" https://api.resend.com/domains/ここにidを貼る
```

`records` の中に、各レコードの `name` と `value` が省略なしで入っています。

> 読みやすく整形したい場合は、末尾に `| ConvertFrom-Json | Select-Object -ExpandProperty records | Format-List` を足してください。

---

## 2. Cloudflare に追加する

`quiz-make.com` → **DNS** → **レコード** → 「レコードを追加」を4回。

| # | 種類 | 名前 | 内容 | 優先度 |
| --- | --- | --- | --- | --- |
| 1 | TXT | `resend._domainkey` | 取り出した DKIM の値（`p=MIGfMA…` で始まる長い文字列） | — |
| 2 | MX | `send` | 取り出した値（`feedback-smtp.…amazonses.com`） | **10** |
| 3 | TXT | `send` | 取り出した値（`v=spf1 include:amazonses.com ~all`） | — |
| 4 | TXT | `_dmarc` | `v=DMARC1; p=none;` | — |

### 注意

- **名前は短い形のまま**入れる。Cloudflare が自動で `.quiz-make.com` を補うため、
  `resend._domainkey.quiz-make.com` と入れると二重になる
- DKIM は400文字前後ある。**手で写さず、必ずコピーで貼る**
- プロキシ（オレンジ雲）の設定は出ない（MX・TXT は対象外）

---

## 3. 触ってはいけないもの

`support@quiz-make.com` の受信に使っています。**消したり書き換えたりしないでください。**

```
MX  quiz-make.com   route1.mx.cloudflare.net   優先度 97
MX  quiz-make.com   route2.mx.cloudflare.net   優先度 23
MX  quiz-make.com   route3.mx.cloudflare.net   優先度 28
TXT quiz-make.com   v=spf1 include:_spf.mx.cloudflare.net ~all
```

これは 2026年8月24日 時点の実測値です。**万一壊してしまった場合は、この内容に戻せば復旧します。**

今回追加するものは、すべて `send.` と `resend._domainkey.` と `_dmarc.` の
**別の名前**なので、上の4件とは衝突しません。

---

## 4. 追加したら

私に知らせてください。次を実測して確認します。

- 追加した4件が反映されているか（DKIM が途中で切れていないか）
- **ルートの MX が上の3件のままか**（support@ の受信が無事か）
- ルートの SPF が1つのままか

確認できたら、Resend の画面で **Verify** を押してもらいます。反映には数分かかります。

---

## 5. 設定した値の控え

追加が終わったら、ここに記録しておくと後で困りません（DKIM は長いので先頭20文字だけで十分）。

| 項目 | 値 | 追加日 |
| --- | --- | --- |
| DKIM（先頭20文字） | | |
| MX（send） | | |
| SPF（send） | | |
| DMARC | `v=DMARC1; p=none;` | |
