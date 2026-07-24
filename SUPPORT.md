# Support / サポート

## 日本語

問題の種類に合う窓口を選んでください。

- **レシピが動かない、または結果が誤解を招く:** `Recipe failure` Issueフォーム
- **具体的な公開データの問いを再現可能にしたい:** `Retrieval recipe request` Issueフォーム
- **初見での実行テストを行った:** `External execution test` Issueフォーム
- **一般的な利用上の質問:** 既存Issueを検索してから、レシピID、Python版、秘密情報を除いたコマンド、期待する結果を含む最小のIssue
- **脆弱性を見つけた:** [SECURITY.md](./SECURITY.md) に従い、攻撃手順や秘密情報を公開Issueに書かない

Issueを開く前に、可能であれば次を実行してください。

```sh
python3 scripts/validate_catalog.py
python3 scripts/recipe_tool.py check <recipe-id>
```

報告から、認証情報、トークン、個人情報、内部URL、環境変数、無関係なコマンド履歴を取り除いてください。

このプロジェクトは参照先サービスを運営しておらず、可用性を保証しません。probe失敗には、上流停止・レート制限、応答変更、古いレシピ、ローカルのネットワーク問題などがあります。判別できるよう、実行日時とタイムゾーンを含めてください。

対応はbest-effortであり、応答時間や上流サービスの稼働保証はありません。

## English

This repository is maintained in public. Choose the route that matches the problem:

- **A recipe no longer runs or looks misleading:** use the `Recipe failure` issue form.
- **A concrete public-data question should become reproducible:** use the `Retrieval recipe request` form.
- **You tested onboarding independently:** use the `External execution test` form.
- **You have a general usage question:** search existing issues, then open a minimal issue with the recipe ID, Python version, sanitized command, and expected outcome.
- **You found a vulnerability:** follow [SECURITY.md](./SECURITY.md) and do not publish exploit details or secrets in an issue.

Before opening an issue:

```sh
python3 scripts/validate_catalog.py
python3 scripts/recipe_tool.py check <recipe-id>
```

Remove credentials, tokens, personal data, internal URLs, environment variables, and unrelated command history from all reports.

The project does not operate or guarantee the upstream services. A failed probe can mean an upstream outage or rate limit, a response-contract change, a stale recipe, or a local networking problem. Include the time and timezone so those cases can be distinguished.

Support is best-effort. No guaranteed response time or upstream availability is offered.
