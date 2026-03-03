## 1. 依存関係の追加

- [x] 1.1 `@mlc-ai/web-llm` を `package.json` に追加し `npm install` を実行する
- [x] 1.2 `next.config.js`（または `next.config.ts`）に WebLLM の WASM ファイルを静的に配信するための設定（`headers` / `webpack` 設定）を追加する

## 2. LLMアダプターインターフェースの定義

- [x] 2.1 `lib/llmAdapter.ts` を作成し、`LLMAdapter` インターフェース（`discussionTurn`, `discussionBatch`, `voteBatch`, `eliminationReaction`, `victoryComment`, `moderateIntervention`）を定義する
- [x] 2.2 `byokClient.ts` の既存関数を `GeminiAdapter` クラスで `LLMAdapter` を実装する形にラップする（既存の関数エクスポートは後方互換のために維持する）

## 3. WebLLMエンジン管理

- [x] 3.1 `lib/webllmEngine.ts` を作成し、`MLCEngine` シングルトンとモデルの初期化・プログレス管理ロジックを実装する
- [x] 3.2 対応モデル一覧（`WEBLLM_MODELS`）を定数として定義する（Qwen2.5-7B と Llama-3.2-3B、各モデルのID・表示名・サイズ・説明を含む）
- [x] 3.3 WebGPU利用可否を検出するユーティリティ関数（`isWebGPUSupported()`）を実装する

## 4. WebLLMプロンプトの実装

- [x] 4.1 `lib/webllmPrompts.ts` を作成し、議論ターン用のOpenAI Chat形式プロンプトビルダーを実装する（キャラクターのシステムプロンプト、会話履歴の変換を含む）
- [x] 4.2 投票バッチ用のプロンプトビルダーとJSONスキーマ（`json_schema` 形式）を実装する
- [x] 4.3 断末魔・勝利コメント・GMモデレーション用のプロンプトビルダーを実装する

## 5. WebLLMアダプターの実装

- [x] 5.1 `lib/webllmClient.ts` を作成し、`LLMAdapter` インターフェースを実装する `WebLLMAdapter` クラスを定義する
- [x] 5.2 `discussionTurn` の実装：`webllmPrompts.ts` のプロンプトを使い、`MLCEngine.chat.completions.create` で推論し、結果を `[expression]内心|||[expression]発言` 形式にパースして返す
- [x] 5.3 `discussionBatch` の実装：各エージェントを順次推論してバッチ結果を組み立てる
- [x] 5.4 `voteBatch` の実装：JSON形式レスポンスで全エージェントの投票を一括取得する
- [x] 5.5 `eliminationReaction`, `victoryComment`, `moderateIntervention` の実装
- [x] 5.6 全メソッドに推論失敗時のフォールバック処理（`'……'` 返却 + `onError` コールバック）を追加する

## 6. Zustand storeの拡張

- [x] 6.1 `lib/store.ts` の `GameStore` インターフェースに `llmBackend: 'gemini' | 'webllm'` と `webllmModelId: string | null` を追加する
- [x] 6.2 WebLLMの初期化状態管理フィールド（`webllmStatus: 'idle' | 'loading' | 'ready' | 'error'`, `webllmProgress: number`, `webllmProgressText: string`）を追加する
- [x] 6.3 `setLLMBackend(backend, options)` アクションを追加する
- [x] 6.4 `setWebLLMStatus(status, progress?, text?)` アクションを追加する

## 7. バックエンド選択UI

- [x] 7.1 `app/byok/page.tsx` にバックエンド選択タブ（Gemini BYOK / WebLLM ローカル）を追加する
- [x] 7.2 WebGPU非対応の場合はWebLLMタブを無効化し、非対応の旨を表示する
- [x] 7.3 WebLLMタブ選択時にモデル選択ドロップダウン（モデル名・サイズ・説明付き）を表示する
- [x] 7.4 WebLLMタブのゲーム開始ボタンを実装し、`store.setLLMBackend('webllm', { modelId })` を呼び出してゲームページへ遷移する

## 8. WebLLMセットアップオーバーレイ

- [x] 8.1 `components/WebLLMSetupOverlay.tsx` を作成する（モデルダウンロード中に表示するフルスクリーンオーバーレイ）
- [x] 8.2 プログレスバー、ダウンロード済みサイズ表示、ステータステキストを実装する（レトロサイバーパンクビジュアルに合わせる）
- [x] 8.3 キャンセルボタンを実装する（押下時に `/byok` へ戻る）
- [x] 8.4 エラー表示とリトライボタンを実装する

## 9. ゲームページへのWebLLM統合

- [x] 9.1 `app/game/page.tsx` のゲーム開始時に `llmBackend === 'webllm'` かつ `webllmStatus !== 'ready'` の場合、`WebLLMSetupOverlay` を表示してモデルを初期化する
- [x] 9.2 ゲームフロー（`byokGameFlow.ts` の呼び出し部分）で `llmBackend` に応じて `GeminiAdapter` または `WebLLMAdapter` を使うよう切り替える
- [x] 9.3 `byokGameFlow.ts` を `LLMAdapter` インターフェースを受け取るように更新し、Gemini固有のインポートを除去する

## 10. 動作確認

- [x] 10.1 `npm run build` でTypeScriptエラーがないことを確認する
- [ ] 10.2 Gemini BYOKフローが引き続き正常に動作することを確認する
- [ ] 10.3 WebGPU対応ブラウザ（Chrome 113+）でWebLLMを選択し、モデルダウンロード〜ゲーム進行が正常に動作することを確認する
- [ ] 10.4 WebGPU非対応環境でWebLLMオプションが非表示になることを確認する
- [ ] 10.5 WebLLMでゲームを最後まで（GAME_OVER まで）プレイし、日本語の応答が返ることを確認する
