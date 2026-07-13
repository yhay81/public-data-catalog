# AI Public Data Catalog

AIが公開APIとオープンデータを短時間で見つけ、正しく使い始めるためのカタログです。
個別サービスの単なるリンク集ではなく、機械可読なメタデータ、認証方式、データ形式、ライセンス、検索のヒント、注意点を一緒に管理します。

## AIから読むとき

1. [catalog.json](./catalog.json) を読む
2. `entries[].domains`、`geography`、`temporal_coverage` で候補を絞る
3. `access` と `license` を確認して利用可能性を判断する
4. `ai_summary`、`query_hints`、`caveats` を読んでクエリを組み立てる
5. 最後に `source_urls` の公式ドキュメントで最新仕様を確認する

`catalog.json` が正本です。項目の構造は [catalog.schema.json](./catalog.schema.json) で定義しています。

## 初期カタログ

| ID | 分野 | 地域 | 認証 | 主な形式 |
| --- | --- | --- | --- | --- |
| `estat-api` | 日本の公的統計 | 日本 | 要登録・アプリID | JSON / XML / CSV |
| `open-meteo` | 天気・気候 | 世界 | 不要（無料枠） | JSON / CSV / XLSX |
| `world-bank-indicators` | 開発・経済統計 | 世界 | 不要 | JSON / XML |
| `gbif-api` | 生物多様性・出現記録 | 世界 | 多くの検索は不要 | JSON |
| `us-census-api` | 人口・経済・住宅統計 | 米国 | 任意のAPIキー | JSON |
| `openalex-api` | 学術文献・研究者・機関 | 世界 | APIキー（無料） | JSON |

## 登録基準

- 公式ドキュメントまたは公式データポータルが存在すること
- API、ダウンロード、検索などの機械的なアクセス方法が明示されていること
- 利用条件・ライセンス・認証・レート制限を確認できること
- AIが誤用しやすい前提やデータ品質上の注意点を記録できること
- 個人情報、認証情報、利用規約に反するスクレイピングを登録しないこと

「公開されている」と「無条件に再利用できる」は同じではありません。データセット単位・レコード単位の条件、出典表示、商用利用制限、APIのレート制限を必ず確認してください。

## 検証

依存パッケージなしで、構造・URL・重複ID・秘密情報らしきクエリパラメータを検査できます。

```sh
python3 scripts/validate_catalog.py
```

## 追加方法

1. [CONTRIBUTING.md](./CONTRIBUTING.md) とスキーマを読む
2. `catalog.json` に1件追加する
3. 公式ドキュメント、利用条件、ライセンス、確認日を記録する
4. `python3 scripts/validate_catalog.py` を実行する
5. 変更理由と、AIが知るべき注意点をプルリクエストに書く

## ライセンス

このリポジトリの構造化メタデータと文書はMIT Licenseで提供します。カタログに登録された各サービス・データの利用条件は、各項目の `license` と公式ソースに従ってください。
