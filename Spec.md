# 振り返りシート自動化ツール 仕様書

## 概要

学校の週次振り返りシートの入力を自動化するWebアプリケーション。
キーワードを入力するだけでAIが目標文・振り返り文・行動項目を一括生成する。

---

## アーキテクチャ

```
GitHub Pages（frontend/）
    ↓ POST /api/generate
Azure Functions（backend/）
    ↓ 1回のみ
Google Gemini API（モデルは環境変数で指定）
```

---

## リポジトリ構成

```
/
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml   # frontend/ 変更時に GitHub Pages へデプロイ
│       └── deploy-backend.yml    # backend/ 変更時に Azure Functions へデプロイ
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── backend/
│   ├── src/
│   │   └── functions/
│   │       └── generate.ts       # Azure Functions HTTPトリガー
│   ├── host.json
│   ├── local.settings.json.example
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── SPEC.md
│   └── PROMPTS.md
├── .gitignore
└── README.md
```

### モノレポ構成のデプロイ戦略

- `frontend/**` に変更があった場合のみ GitHub Pages へデプロイ
- `backend/**` に変更があった場合のみ Azure Functions へデプロイ
- GitHub Pages のソースディレクトリは `frontend/` に設定

---

## バックエンド仕様

### エンドポイント

`POST /api/generate`

### リクエストボディ（JSON）

```json
{
  "personalGoalKeywords": "string",  // 個人目標のキーワード（必須）
  "reflectionKeywords": "string",    // 振り返りのキーワード（必須）
  "behaviorMemo": "string"           // 行動項目への任意メモ（任意）
}
```

### レスポンスボディ（JSON）

```json
{
  "personalGoal": "string",          // 生成された個人目標（16字以内）
  "reflection": "string",            // 生成された振り返り（160字の単一文）
  "behaviors": {
    "fiveMinEarly": "string",        // 5分前行動（40字程度）
    "greeting": "string",            // 挨拶は元気よく（40字程度）
    "listening": "string",           // 話を聞く姿勢を正す（40字程度）
    "concentration": "string"        // 集中力を高めてやる（40字程度）
  }
}
```

### エラーレスポンス

```json
{
  "error": "string"
}
```

- 400: リクエストボディ不正
- 500: Gemini API呼び出し失敗 / JSONパース失敗

### 環境変数

| 変数名 | 説明 |
|---|---|
| `GEMINI_API_KEY` | Google Gemini APIキー |
| `GEMINI_MODEL` | 使用するGeminiモデル名（デフォルト: `gemini-2.5-flash-lite`） |
| `ALLOWED_ORIGIN` | CORSで許可するオリジン（例: `https://username.github.io`） |

#### モデル選定の考え方

- デフォルトは現時点で最安の `gemini-2.5-flash-lite` を使用
- モデルが廃止された場合はAzure Portalで `GEMINI_MODEL` の値を変更するだけで対応可能（コード変更・再デプロイ不要）
- バージョン番号なしのエイリアス（例: `gemini-2.5-flash-lite`）を使うことで、同一モデルファミリーの最新stableに自動追従する

### CORS設定

- `ALLOWED_ORIGIN` 環境変数で指定したオリジンのみ許可
- ローカル開発時は `http://localhost:3000` も許可
- プリフライトリクエスト（OPTIONS）に対応

### Geminiプロンプト仕様

モデル: 環境変数 `GEMINI_MODEL`（デフォルト: `gemini-2.5-flash-lite`）
呼び出し回数: 1回（全項目を一括生成）

```
あなたは学校の週次振り返りシートの記入を補助するアシスタントです。
以下の全項目を一括で生成してください。

【個人目標】
キーワード: {personalGoalKeywords}
→ 16字以内の目標文を1つ生成してください。

【振り返り】
キーワード: {reflectionKeywords}
→ 160字ちょうどの文を1つ生成してください。
- 1つの段落として自然な文章にすること
- 具体的な行動・成果・課題を含めること
- 箇条書きや改行を使わないこと

【行動項目】
以下の4項目について「できた」前提で40字程度の理由文を生成してください。
毎回異なる表現・言い回し・具体例を使うこと。
{behaviorMemoがあれば: 以下のメモも文章に反映してください：「{behaviorMemo}」}

- 5分前行動：授業・活動の5分前には準備を完了させた
- 挨拶は元気よく：登校・授業開始時に大きな声で挨拶した
- 話を聞く姿勢を正す：発言者の方を向き背筋を伸ばして聞いた
- 集中力を高めてやる：私語をせず課題・授業に集中して取り組んだ

以下のJSON形式のみで返答してください。前後の説明文や\`\`\`は絶対に含めないこと：
{
  "personalGoal": "...",
  "reflection": "...",
  "behaviors": {
    "fiveMinEarly": "...",
    "greeting": "...",
    "listening": "...",
    "concentration": "..."
  }
}
```

---

## フロントエンド仕様

### 技術スタック

- HTML / CSS / Vanilla JS（3ファイル構成、ビルド不要）
- GitHub Pages にそのままデプロイ可能

### ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | マークアップ |
| `style.css` | スタイル |
| `script.js` | API呼び出し・UI制御 |

### 画面構成（2ステップ）

#### Step 1: キーワード入力画面

| フィールド | 必須 | 説明 |
|---|---|---|
| 個人目標キーワード | ✓ | placeholder: 例）AWS SAA 試験対策 過去問 |
| 振り返りキーワード | ✓ | textarea、placeholder: 例）過去問50問、正答率70%、EC2が苦手 |
| 今週のひとことメモ | 任意 | 行動項目の文章に反映される |

- 「生成する」ボタンでAPI呼び出し
- 必須フィールド未入力時はアラート表示
- API呼び出し中はボタンをdisabledにして「生成中...」と表示

#### Step 2: 結果表示画面

表示内容：
- 個人目標（16字以内）
- 振り返り（160字の単一文）
- 行動項目×4（5分前行動・挨拶・話を聞く姿勢・集中力）

ボタン：
- 「コピー」: 以下の形式でクリップボードにコピー
  ```
  【個人目標】{personalGoal}
  【振り返り】{reflection}
  【行動項目】
  5分前行動: {fiveMinEarly}
  挨拶は元気よく: {greeting}
  話を聞く姿勢を正す: {listening}
  集中力を高めてやる: {concentration}
  ```
- 「やり直す」: Step 1に戻る（入力値を保持）

### API接続設定

`script.js` の先頭に定数として定義：

```javascript
const API_URL = "https://YOUR_FUNCTION_APP.azurewebsites.net/api/generate";
```

### デザイン要件

- フォント: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- カラー: モノクロベース（背景白、アクセントは #333・#666）
- 最大幅: 600px、中央寄せ
- モバイルファースト

---

## CI/CD

### deploy-frontend.yml

- トリガー: `frontend/**` の変更を main にpush
- 処理: `frontend/` ディレクトリを GitHub Pages にデプロイ

### deploy-backend.yml

- トリガー: `backend/**` の変更を main にpush
- 処理: Azure Functions Core Tools でデプロイ
- シークレット: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`

---

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

---

## セキュリティ要件

- `GEMINI_API_KEY` は Azure Functions の環境変数にのみ格納、コードに含めない
- `local.settings.json` は `.gitignore` に追加
- CORS は `ALLOWED_ORIGIN` で GitHub Pages のオリジンのみ許可

---

## 非機能要件

- レスポンスタイム: 10秒以内（Gemini APIのレイテンシ依存）
- 同時利用者数: 想定10名以下（学校のクラス規模）
- Azure Functions 無料枠（月100万リクエスト）で十分に収まる想定
