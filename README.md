# 振り返りシート自動化ツール

## 概要

学校の週次振り返りシート入力を自動化する Web アプリケーションです。ユーザーがキーワードを入力すると、Azure Functions 経由で Gemini API を 1 回呼び出し、全体目標・個人目標・振り返り 6 行・行動項目 4 件をまとめて生成します。

## アーキテクチャ

```text
GitHub Pages (frontend/)
        |
        | POST /api/generate
        v
Azure Functions (backend/)
        |
        | Gemini API を1回呼び出し
        v
Gemini API
```

## ローカル開発手順

### バックエンド

```bash
cd backend
npm install
cp local.settings.json.example local.settings.json
# local.settings.json に GEMINI_API_KEY・GEMINI_MODEL・ALLOWED_ORIGIN を設定
npm run start
```

### フロントエンド

```bash
# script.js の API_URL を http://localhost:7071/api/generate に変更して
# frontend/index.html をブラウザで直接開く or Live Server で起動
```

## Azureデプロイ手順

1. Azure 上に Function App を作成し、バックエンドのデプロイ先を用意します。
2. Azure Portal の Function App 設定で `GEMINI_API_KEY`、`GEMINI_MODEL`、`ALLOWED_ORIGIN` を環境変数として登録します。
3. GitHub Secrets に `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` を、GitHub Variables に `AZURE_FUNCTIONAPP_NAME`（Function App 名）を登録し、`backend/**` の変更で Azure Functions にデプロイできるようにします。
4. `frontend/script.js` の `API_URL` を本番の `https://YOUR_FUNCTION_APP.azurewebsites.net/api/generate` に設定します。
5. `frontend/**` の変更を `main` ブランチへ push した際に GitHub Pages へ反映されるよう、GitHub Pages の公開設定または Actions を構成します。
6. フロントエンドとバックエンドを push し、それぞれのワークフローが正しく実行されることを確認します。

## 環境変数一覧

| 変数名 | 説明 |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini API キー |
| `GEMINI_MODEL` | 使用する Gemini モデル名。未指定時の既定値は `gemini-2.5-flash-lite` |
| `ALLOWED_ORIGIN` | CORS で許可するオリジン。GitHub Pages の URL を指定 |

## セキュリティ注意事項

- `GEMINI_API_KEY` は Azure の環境変数のみに設定し、ソースコードやフロントエンドへ埋め込まないでください。
- `backend/local.settings.json` はローカル開発専用であり、`.gitignore` に追加済みです。
- CORS は `ALLOWED_ORIGIN` で必要最小限のオリジンだけを許可してください。
