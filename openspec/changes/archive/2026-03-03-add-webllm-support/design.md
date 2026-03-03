## Context

現在のゲームは Gemini BYOK（Bring Your Own Key）のみをサポートしており、すべてのLLM呼び出しは `lib/byokClient.ts` にまとめられている。このファイルは `@google/genai` SDK を直接使い、Gemini固有の API（`generateContent`, `ThinkingLevel`, schema付きJSONレスポンス）に依存している。

WebLLM（`@mlc-ai/web-llm`）はブラウザ上のWebGPUを用いてMLCコンパイル済みモデルを実行するライブラリで、OpenAI互換のChat Completions APIを提供する。現行のGeminiプロンプト（`lib/prompts.ts`）はGeminiの `Content[]` 形式で組み立てられており、WebLLMの `{role, content}[]` 形式とは異なる。

## Goals / Non-Goals

**Goals:**
- APIキー不要でゲームをプレイできるWebLLMバックエンドを追加する
- GeminiバックエンドとWebLLMバックエンドを `/byok` 画面で選択できるようにする
- WebLLMのモデルダウンロード・初期化をわかりやすいUIで案内する
- 既存のゲームロジック（store, gameFlow, game page）への影響を最小限に抑える

**Non-Goals:**
- WebLLMバックエンドでのストリーミング表示（初期実装はノンストリーミング）
- 複数モデルの同時実行
- Node.js / サーバーサイドでのWebLLM実行
- Gemini以外の外部APIへの対応（WebLLM以外）

## Decisions

### 1. 共通LLMクライアントインターフェースの導入

**決定**: `lib/llmAdapter.ts` に `LLMAdapter` インターフェースを定義し、GeminiとWebLLMの両方がこれを実装する。`store.ts` と `byokGameFlow.ts` はインターフェース経由でLLMを呼び出す。

**理由**: `byokClient.ts` を直接書き換えると既存のGeminiフローが壊れるリスクが高い。アダプターパターンにより、ゲームコアロジックを変更せずにバックエンドを切り替えられる。

**インターフェース（概要）**:
```ts
interface LLMAdapter {
  discussionTurn(params): Promise<DiscussionTurnResult>
  discussionBatch(params): Promise<DiscussionBatchResponse>
  voteBatch(params): Promise<VoteBatchResponse>
  eliminationReaction(params): Promise<{ reaction: string }>
  victoryComment(params): Promise<VictoryCommentResult>
  moderateIntervention(params): Promise<ModerationResult>
}
```

既存の `byokClient.ts` の関数群を `GeminiAdapter` クラスにラップし、`WebLLMAdapter` を新規実装する。

### 2. WebLLMプロンプト形式

**決定**: WebLLM用に `lib/webllmPrompts.ts` を新規作成し、既存の `lib/prompts.ts`（Gemini形式）とは別に OpenAI Chat形式のプロンプトを管理する。

**理由**: Geminiの `Content[]` 形式（`parts` ベース）とOpenAIの `{role, content}[]` 形式は互換性がなく、変換レイヤーを挟むと複雑度が増す。ゲームのプロンプト内容（各キャラのシステムプロンプト、履歴フォーマット）は共通ロジックとして `lib/promptCore.ts` に切り出し、両形式のプロンプトビルダーから参照する。

### 3. 対応モデル

**決定**: 初期実装では日本語性能と実行速度のバランスが良い以下のモデルを提供する：

| モデルID（WebLLM） | 容量 | 特徴 |
|---|---|---|
| `Qwen2.5-7B-Instruct-q4f16_1-MLC` | 約5GB | 日本語高精度、推奨 |
| `Llama-3.2-3B-Instruct-q4f16_1-MLC` | 約2GB | 軽量・高速、日本語はやや劣る |

**理由**: Qwen2.5は日本語ベンチマークで優れており、デスゲームのような複雑な日本語会話生成に適している。3Bモデルは低スペック端末向けのオプションとして提供する。

### 4. WebLLMエンジンのライフサイクル

**決定**: `MLCEngine` インスタンスをモジュールスコープのシングルトン（`lib/webllmEngine.ts`）で管理し、アプリセッション全体で再利用する。Zustand storeにはエンジン参照は持たせず、初期化状態（`idle | loading | ready | error`）とプログレス情報のみを持たせる。

**理由**: `MLCEngine` はシリアライズ不可能なオブジェクトであり Zustand store には不適。またゲーム画面への遷移後も再初期化なしに推論できるよう、セッション全体での保持が必要。

### 5. バックエンド選択のUX

**決定**: `/byok` 画面を拡張し、Gemini BYOK と WebLLM ローカルを選択するタブ/切り替えUIを追加する。WebLLMを選択するとモデル選択ドロップダウンが表示され、ダウンロード・初期化はゲーム開始前に `WebLLMSetupOverlay` コンポーネントで行う。

**理由**: ゲーム中断を避けるため、モデルの初期化（数十秒〜数分）はゲーム開始前に完了させる。

### 6. JSON構造化出力

**決定**: 投票バッチ・モデレーション等の構造化出力は、WebLLMの `response_format: { type: "json_schema", json_schema: {...} }` を使用する。

**理由**: WebLLMはOpenAI互換の `json_schema` レスポンス形式をサポートしており、Geminiの `responseSchema` と同等の機能が使える。

## Risks / Trade-offs

- **WebGPU非対応ブラウザ** → WebLLMオプション自体を非表示にし、Gemini BYOKのみ表示する
- **モデルダウンロード失敗** → リトライボタンを提供。部分ダウンロードはブラウザキャッシュ（Cache API）に自動保存されるため、再開可能
- **推論速度** → 7Bモデルで概算20〜60 tok/secのため、タイプライター演出の速度設定を調整する必要あり。初期はノンストリーミングで一括表示
- **日本語品質の低下** → WebLLMモデルはGemini 3 Flashより品質が劣る可能性がある。キャラのペルソナ維持がしづらいケースはシステムプロンプトの工夫で対応
- **メモリ使用量** → 7Bモデルで約6〜8GBのVRAMが必要。低スペック端末では動作しない可能性あり。3Bモデルを代替として提示する
- **プロンプトの二重管理** → GeminiとWebLLM向けに別プロンプトファイルを持つため、キャラ追加時に両方の更新が必要。共通ロジックを `promptCore.ts` に切り出して重複を最小化する

## Migration Plan

1. 新規ファイル（`lib/llmAdapter.ts`, `lib/webllmClient.ts`, `lib/webllmPrompts.ts`, `lib/webllmEngine.ts`）を追加
2. `byokClient.ts` の関数を `GeminiAdapter` クラスにラップ（既存の関数エクスポートは維持して後方互換）
3. `store.ts` に `llmBackend: 'gemini' | 'webllm'` と WebLLM状態フィールドを追加
4. `/byok` 画面にバックエンド選択UIを追加
5. `WebLLMSetupOverlay` コンポーネントを追加
6. `app/game/page.tsx` でバックエンド選択に応じたアダプター切り替えを実装
7. `npm run build` でTypeScriptエラーがないことを確認

ロールバック: `llmBackend` が `'gemini'` の場合は既存フローを完全に維持するため、WebLLM追加によるGeminiフローへの影響はない。

## Open Questions

- WebLLMのモデル一覧APIで実行時に利用可能なモデルを取得すべきか、それともハードコードで十分か？（→ 初期実装はハードコードで進める）
- 日本語向けのシステムプロンプトをより小さいモデルに最適化すべきか？（→ 実装後に品質評価して調整）
