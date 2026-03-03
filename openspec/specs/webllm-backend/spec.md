## ADDED Requirements

### Requirement: Backend selection
ユーザーは `/byok` 画面でLLMバックエンドとして「Gemini BYOK」または「WebLLM ローカル」を選択できる。WebGPUが利用できないブラウザではWebLLMオプションをSHALL非表示にする。

#### Scenario: WebGPU対応ブラウザでWebLLMオプションが表示される
- **WHEN** ユーザーがWebGPU対応ブラウザで `/byok` 画面を開く
- **THEN** 「Gemini BYOK」と「WebLLM ローカル」の2つの選択肢が表示される

#### Scenario: WebGPU非対応ブラウザでWebLLMオプションが非表示になる
- **WHEN** ユーザーがWebGPU非対応ブラウザで `/byok` 画面を開く
- **THEN** WebLLMオプションは表示されず、Gemini BYOKのみが利用可能

#### Scenario: Geminiバックエンドを選択した場合の既存フロー維持
- **WHEN** ユーザーが「Gemini BYOK」を選択してAPIキーを入力し進む
- **THEN** 既存のGemini BYOKフローと同じ動作でゲームが開始する

### Requirement: Model selection
WebLLMバックエンド選択時、ユーザーはサポートされたモデルの一覧から使用するモデルを選択できる。各モデルにはダウンロードサイズと説明が表示される。

#### Scenario: モデル一覧の表示
- **WHEN** ユーザーが「WebLLM ローカル」を選択する
- **THEN** 利用可能なモデルのリストがダウンロードサイズと共に表示される

#### Scenario: デフォルトモデルの自動選択
- **WHEN** WebLLMバックエンドが選択された状態で画面が開く
- **THEN** 推奨モデル（Qwen2.5-7B）がデフォルトで選択されている

### Requirement: Model download and initialization
WebLLMバックエンドでゲームを開始する前に、選択したモデルのダウンロードと初期化をSHALL完了させる。初期化中はプログレスバーと状態テキストを表示する。

#### Scenario: 初回ダウンロード
- **WHEN** ユーザーが未キャッシュのモデルを選択してゲーム開始ボタンを押す
- **THEN** モデルダウンロードが開始し、進捗率（パーセント）とダウンロード済みサイズがリアルタイムで表示される

#### Scenario: キャッシュ済みモデルの高速初期化
- **WHEN** ユーザーが以前ダウンロード済みのモデルを選択してゲーム開始ボタンを押す
- **THEN** ダウンロードをスキップしてモデルの初期化のみ実行され、数秒以内にゲームが開始する

#### Scenario: ダウンロード中のキャンセル
- **WHEN** ユーザーがダウンロード中にキャンセルボタンを押す
- **THEN** ダウンロードが停止し、バックエンド選択画面に戻る

#### Scenario: ダウンロードエラー
- **WHEN** ネットワークエラー等でダウンロードが失敗する
- **THEN** エラーメッセージとリトライボタンが表示される

### Requirement: Local inference execution
WebLLMバックエンドが初期化済みの状態でゲームを実行すると、すべてのLLM推論がブラウザ内でローカルに実行される。外部APIへのリクエストはSHALL送信しない。

#### Scenario: 議論ターンのローカル推論
- **WHEN** 議論フェーズでエージェントの発言を生成する
- **THEN** `MLCEngine` を使ってローカル推論し、`[expression]内心|||[expression]発言` 形式のテキストを返す

#### Scenario: 投票バッチのローカル推論
- **WHEN** 投票フェーズで全エージェントの投票を生成する
- **THEN** JSON形式（`{ votes: [...] }`）で投票結果をローカル推論で返す

#### Scenario: Geminiが呼ばれないこと
- **WHEN** WebLLMバックエンドでゲームが進行中
- **THEN** `byokClient.ts` のGemini API呼び出し関数はSHALL呼ばれない

### Requirement: Fallback on inference failure
WebLLM推論が失敗した場合、Gemini BYOKと同様にテキストフォールバック（`'……'`）を返し、ゲームSHALL継続する。エラーはトーストで通知する。

#### Scenario: 推論エラー時のフォールバック
- **WHEN** WebLLMの推論中に例外が発生する
- **THEN** フォールバックテキスト（`'……'`）が使用され、ゲームが継続する。エラーメッセージがトーストで表示される

### Requirement: Backend state persistence
選択されたバックエンドとモデルIDはセッション中維持される。ゲーム終了後に再プレイする際、前回の設定が引き継がれる。

#### Scenario: ゲーム再プレイ時の設定維持
- **WHEN** WebLLMバックエンドでゲームを完了し、再プレイボタンを押す
- **THEN** WebLLMバックエンドとモデルIDが維持されたまま次のゲームが開始する（再初期化不要）
