## Why

現在のゲームはGemini APIキー（BYOK）が必須だが、APIキーの取得・管理が敷居となりカジュアルなユーザーが試しづらい。WebLLMを使えばブラウザ上でモデルをローカル実行でき、APIキー不要・ゼロコストでプレイできるようになる。

## What Changes

- WebLLMバックエンドを新規追加し、Gemini BYOKと並列で選択できるようにする
- `/byok` 画面をバックエンド選択画面（Gemini BYOK / WebLLM ローカル）に拡張する
- WebLLM用のモデルダウンロード・初期化UI（プログレスバー付き）を追加する
- WebLLMクライアント（`lib/webllmClient.ts`）を新規作成し、`byokClient.ts` と同一インターフェースで呼び出せるようにする
- Zustand storeにバックエンド種別（`'gemini' | 'webllm'`）を追加し、ゲームフロー全体でバックエンドを切り替える

## Capabilities

### New Capabilities

- `webllm-backend`: WebLLMを使ったブラウザ内ローカルLLM実行。モデルのダウンロード・キャッシュ・推論を管理し、既存のゲームフローに対してGemini BYOKと置き換え可能なインターフェースを提供する。

### Modified Capabilities

<!-- なし：既存のゲームロジック・ルール要件は変更しない -->

## Impact

- **新規依存**: `@mlc-ai/web-llm` パッケージ（WebGPU必須）
- **影響するファイル**:
  - `lib/byokClient.ts` — 共通インターフェース型の抽出（実装変更なし）
  - `lib/store.ts` — バックエンド種別フィールド追加
  - `app/byok/page.tsx` — バックエンド選択UI追加
  - `app/game/page.tsx` — バックエンド切り替えロジック
- **新規ファイル**: `lib/webllmClient.ts`, `components/WebLLMSetupOverlay.tsx`
- **ブラウザ要件**: WebGPU対応ブラウザ（Chrome 113+, Edge 113+）が必要。非対応環境ではWebLLMオプションを無効化する
- **モデルサイズ**: 初回起動時にモデルを数GB〜十数GBダウンロード（ブラウザキャッシュに保存）
