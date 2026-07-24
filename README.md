# Public Data Catalog — Verified Recipes for Japan

[![CI](https://github.com/yhay81/public-data-catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/yhay81/public-data-catalog/actions/workflows/ci.yml)
[![Recipe probes](https://github.com/yhay81/public-data-catalog/actions/workflows/recipe-probes.yml/badge.svg)](https://github.com/yhay81/public-data-catalog/actions/workflows/recipe-probes.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

日本の公共データを中心に、AIや開発者が**具体的な問いから、根拠付きで再現可能な最初の取得まで**進むための、テスト済みレシピ集です。

単なるリンク集ではありません。実行可能な小さなリクエスト、期待する応答、単位・コード・改訂上の注意、出典、ライセンス、確認日を一緒に管理します。

_Japanese-first, tested retrieval recipes for getting small, attributable results from official public data._

## まず1分で試す

依存パッケージは不要です。Python 3.11以上で実行できます。

```sh
python3 scripts/recipe_tool.py run tokyo-population-2023
```

2026年7月24日の検証では、統計ダッシュボードから次のような結果を取得します。

```json
{
  "recipe_id": "tokyo-population-2023",
  "results": {
    "population": {
      "value": 14086000,
      "unit": "人"
    },
    "region-code": {
      "value": "13000"
    },
    "time-code": {
      "value": "2023CY00"
    }
  },
  "provenance": {
    "source_id": "statistics-dashboard-api",
    "credit": "出典：統計ダッシュボード（https://dashboard.e-stat.go.jp/）",
    "recipe_last_verified": "2026-07-24"
  }
}
```

値は公式ソース側で改訂される可能性があります。実行結果には、取得日時、実際のリクエストURL、解釈上の注意、出典、ライセンスも含まれます。

## 使い方

```sh
# 利用できる質問を見る
python3 scripts/recipe_tool.py list

# AIや別ツールから読めるJSON一覧
python3 scripts/recipe_tool.py list --json

# 1つのレシピを実行する
python3 scripts/recipe_tool.py run japan-unemployment-rate-2023

# 全レシピの応答契約を確認する
python3 scripts/recipe_tool.py check
```

## 検証済みレシピ

| ID | 質問 | 情報源 | 認証 |
| --- | --- | --- | --- |
| `tokyo-population-2023` | 2023年の東京都の総人口は何人か | 統計ダッシュボード | 不要 |
| `japan-unemployment-rate-2023` | 2023年の日本の完全失業率は何%か | 統計ダッシュボード | 不要 |
| `egov-population-dataset-search` | e-Govで人口データセットを探せるか | e-Govデータポータル | 不要 |
| `world-bank-japan-population-2023` | 世界銀行による2023年の日本の総人口は何人か | World Bank | 不要 |
| `usgs-noto-earthquake-2024` | USGSは能登半島地震をどう記録しているか | USGS | 不要 |

レシピの構造と安全上の制約は [docs/recipe-format.md](./docs/recipe-format.md)、現在の検証状況は [docs/status.md](./docs/status.md) にあります。初見での再現性を検証する場合は [外部実行テスト手順](./docs/external-test-protocol.md) を使ってください。

## 情報源プロファイル

| ID | 分野 | 地域 | 認証 | 主な形式 |
| --- | --- | --- | --- | --- |
| `estat-api` | 日本の公的統計 | 日本 | 要登録・アプリID | JSON / XML / CSV |
| `statistics-dashboard-api` | 日本の主要統計 | 日本・世界 | 不要 | JSON / JSON-stat / XML / CSV |
| `open-meteo` | 天気・気候 | 世界 | 不要（無料枠） | JSON / CSV / XLSX |
| `world-bank-indicators` | 開発・経済統計 | 世界 | 不要 | JSON / XML |
| `gbif-api` | 生物多様性・出現記録 | 世界 | 多くの検索は不要 | JSON |
| `us-census-api` | 人口・経済・住宅統計 | 米国 | 任意のAPIキー | JSON |
| `openalex-api` | 学術文献・研究者・機関 | 世界 | APIキー（無料） | JSON |
| `egov-data-portal` | 日本政府オープンデータ | 日本 | カタログAPIは原則不要 | JSON / CSV / XML |
| `usgs-earthquake-api` | 地震・災害観測 | 世界 | 不要 | GeoJSON / CSV / XML |
| `overpass-api` | 地理空間・地図要素 | 世界 | 不要（共有インスタンス） | JSON / XML / CSV |
| `copernicus-climate-data-store` | 気候再解析・環境 | 世界 | 登録・APIトークン | GRIB / NetCDF / CSV / Zarr |
| `europe-pmc-api` | 生命科学文献・注釈 | 世界 | 不要 | JSON / XML |
| `open-food-facts-api` | 食品・栄養・成分 | 世界 | 読み取りは不要 | JSON / CSV / JSONL |

`catalog.json` が情報源プロファイルの正本で、構造は [catalog.schema.json](./catalog.schema.json) で定義しています。レシピは [`recipes/`](./recipes/) の各JSONファイルが正本です。

## 設計原則

- **問いから始める** — 分野の穴埋めだけを理由に情報源を増やしません。
- **最小取得** — 大量データをミラーせず、問いに必要な範囲だけを取得します。
- **根拠を残す** — 値と一緒に、出典、ライセンス、単位、コード、確認日を返します。
- **失敗を検出する** — HTTP 200だけでなく、主要フィールドと識別子まで確認します。
- **安全に限定する** — 初期レシピはHTTPSのGET、明示的なホスト、最大1 MBに制限します。

「公開されている」と「無条件に再利用できる」は同じではありません。データセット単位・レコード単位の条件、出典表示、商用利用制限、APIのレート制限を必ず確認してください。

## 検証

依存パッケージなしで、カタログとレシピの構造、URL、ID、列挙値、出典の対応、秘密情報らしきクエリパラメータを検査できます。

```sh
python3 scripts/validate_catalog.py
python3 -m unittest discover -s tests -v
python3 scripts/recipe_tool.py check
```

通常のプルリクエストでは構造と単体テストだけを実行し、外部APIへのprobeは週次および手動実行に分けています。

## 貢献

新しい情報源の名前ではなく、「再現可能にしたい具体的な問い」をIssueまたはプルリクエストで提案してください。

1. [CONTRIBUTING.md](./CONTRIBUTING.md) と [レシピ仕様](./docs/recipe-format.md) を読む
2. 公式ドキュメントと利用条件を確認する
3. 1つの問いに対する、小さく読み取り専用のレシピを追加する
4. ローカル検証と対象レシピのprobeを実行する
5. 結果、根拠、注意点をプルリクエストに残す

目的と非目標は [PURPOSE.md](./PURPOSE.md)、判断の背景は [docs/value-redefinition.md](./docs/value-redefinition.md)、今後のゲートは [docs/roadmap.md](./docs/roadmap.md) にあります。

## ライセンス

このリポジトリの構造化メタデータと文書はMIT Licenseで提供します。カタログに登録された各サービス・データの利用条件は、各項目の `license` と公式ソースに従ってください。
