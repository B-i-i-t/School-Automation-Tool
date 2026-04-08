# CLAUDE.md

## プロジェクト概要

学校の週次振り返りシート自動化ツール。
詳細仕様は `docs/SPEC.md` を参照すること。

---

## Codex連携ルール

### 基本方針
- コーディングタスクはすべてCodex CLIに委託する
- 自分（ClaudeCode）はファイルを直接編集しない
- 各Codexインスタンスの完了後にレビューを行い、問題があれば修正指示を出す

### 起動方法

以下のコマンドでCodexを起動する。
作業ディレクトリは必ずプロジェクトルート（`--cwd .`）とし、
メッセージで止まらないよう `--dangerously-bypass-approvals-and-sandbox` を必ず付与すること。

```bash
codex --dangerously-bypass-approvals-and-sandbox "タスク内容"
```

### 並列起動戦略

フォルダ単位で同時にCodexを起動して効率化する。
各インスタンスへの指示には必ず `docs/SPEC.md` の該当セクションを参照させること。

```bash
# backend と frontend と workflows を同時起動する例
codex --dangerously-bypass-approvals-and-sandbox \
  "backend/ディレクトリのAzure Functionsを実装して。詳細はdocs/SPEC.mdのバックエンド仕様セクションを参照" &

codex --dangerously-bypass-approvals-and-sandbox \
  "frontend/ディレクトリのHTML・CSS・JSを実装して。詳細はdocs/SPEC.mdのフロントエンド仕様セクションを参照" &

codex --dangerously-bypass-approvals-and-sandbox \
  ".github/workflows/のCI/CDを実装して。詳細はdocs/SPEC.mdのCI/CDセクションを参照" &

wait  # 全インスタンスの完了を待つ
```

### タスク分割の単位

| Codexインスタンス | 担当ディレクトリ | 参照するSPEC.mdセクション |
|---|---|---|
| #1 | `backend/` | バックエンド仕様 |
| #2 | `frontend/` | フロントエンド仕様 |
| #3 | `.github/workflows/` | CI/CD |
| #4 | ルートファイル（.gitignore, README.md） | ローカル開発手順・セキュリティ要件 |

### 受け渡し方法

Codexはファイルを直接編集する。ClaudeCodeは以下のサイクルで進める：

```
Codex起動 → ファイル生成 → ClaudeCodeがレビュー → 修正指示（必要なら再度Codex起動）
```

---

## レビューチェックリスト

各Codexインスタンス完了後に以下を確認すること：

### backend/
- [ ] `GEMINI_API_KEY`・`GEMINI_MODEL`・`ALLOWED_ORIGIN` を環境変数から取得しているか
- [ ] `local.settings.json` が `.gitignore` に含まれているか
- [ ] `local.settings.json.example` が存在するか
- [ ] OPTIONSメソッドのCORSプリフライト対応があるか
- [ ] JSONパース失敗時のエラーハンドリングがあるか
- [ ] TypeScriptの型定義に `any` が使われていないか
- [ ] `GEMINI_MODEL` のフォールバック値が `gemini-2.5-flash-lite` になっているか

### frontend/
- [ ] `script.js` 先頭に `API_URL` 定数が定義されているか
- [ ] 必須フィールドのバリデーションがあるか
- [ ] ローディング表示（生成中...）が実装されているか
- [ ] コピーボタンが正しいフォーマットで出力するか
- [ ] やり直しボタンで入力値が保持されるか
- [ ] モバイル対応になっているか

### .github/workflows/
- [ ] `frontend/**` の変更のみでPages deployがトリガーされるか
- [ ] `backend/**` の変更のみでAzure deployがトリガーされるか
- [ ] `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` シークレットを参照しているか
