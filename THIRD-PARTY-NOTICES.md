# サードパーティ ライセンス表記

本アプリケーションは、以下のオープンソースソフトウェアを利用しています。
各ソフトウェアの著作権は原著作者に帰属し、それぞれのライセンス条件に従って利用・再配布しています。

ライセンス全文は、各パッケージに同梱の `LICENSE` ファイル
（`node_modules/<パッケージ名>/LICENSE`）および下記の配布元をご参照ください。

## 実行時に配布されるもの（ビルド成果物に含まれる）

| ソフトウェア | バージョン | ライセンス | 著作権表示 |
| --- | --- | --- | --- |
| [React](https://react.dev/) | 19.2.x | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [React DOM](https://react.dev/) | 19.2.x | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [SheetJS Community Edition (`xlsx`)](https://sheetjs.com/) | 0.20.3 | **Apache License 2.0** | Copyright (C) 2012-present SheetJS LLC |

### SheetJS（Apache-2.0）について

Apache License 2.0 の条件に従い、以下を明示します。

- 本アプリは SheetJS Community Edition (`xlsx`) を **改変せずに** 利用しています。
- ライセンス全文: <https://www.apache.org/licenses/LICENSE-2.0>
- 配布元: <https://cdn.sheetjs.com/>

> **入手元に関する注意**
> npm レジストリ上の `xlsx@0.18.5` には既知の脆弱性
> （プロトタイプ汚染 CVE-2023-30533、ReDoS CVE-2024-22363）があり、
> 修正版は npm レジストリには公開されていません。
> このため本プロジェクトでは、SheetJS 公式配布サイトの修正済みバージョン
> `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` を `package.json` で直接指定しています。
> バージョンを変更する際は、必ず公式配布サイトの最新版を使用してください。

## 開発時のみ使用するもの（ビルド成果物には含まれない）

| ソフトウェア | ライセンス | 著作権表示 |
| --- | --- | --- |
| [Vite](https://vite.dev/) | MIT | Copyright (c) 2019-present, VoidZero Inc. and Vite contributors |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | MIT | Copyright (c) Vite contributors |
| [Tailwind CSS](https://tailwindcss.com/) | MIT | Copyright (c) Tailwind Labs, Inc. |
| [@tailwindcss/vite](https://tailwindcss.com/) | MIT | Copyright (c) Tailwind Labs, Inc. |
| [Oxlint](https://oxc.rs/) | MIT | Copyright (c) Boshen and oxc contributors |
| [@types/react, @types/react-dom](https://github.com/DefinitelyTyped/DefinitelyTyped) | MIT | Copyright (c) Microsoft Corporation and contributors |

## フォント

| フォント | ライセンス | 提供元 |
| --- | --- | --- |
| Noto Sans JP | [SIL Open Font License 1.1](https://openfontlicense.org/) | Google Fonts（`fonts.googleapis.com` から読み込み） |

SIL OFL 1.1 は Web フォントとしての利用・埋め込みを許諾しています。

> **プライバシーに関する注意**
> Noto Sans JP は Google Fonts の CDN から読み込んでいるため、閲覧者の IP アドレス等が
> Google に送信されます。これを避けたい場合（EU の GDPR 対応など）は、
> フォントファイルを自己ホストして `index.html` の `<link>` を差し替えてください。

## 自前で実装している部分（依存を増やさない方針）

依存パッケージを増やさないことで、ライセンス管理と脆弱性の管理対象を最小限に保っています。
以下は外部ライブラリを使わずに実装しています。

| 機能 | 一般的なライブラリ | 本プロジェクトでの実装 |
| --- | --- | --- |
| ダッシュボードのグラフ | Chart.js / Recharts など | SVG と CSS で自作 |
| PWA（オフライン対応） | vite-plugin-pwa / Workbox | `public/sw.js` に必要な分だけ自作 |
| アプリアイコンの生成 | sharp / ImageMagick など | `scripts/generate-icons.mjs`（Node 標準の zlib のみ使用） |

---

ライセンス一覧は次のコマンドでも確認できます。

```bash
npm ls --all
```
