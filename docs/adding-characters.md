# 新キャラクターの追加方法 / How to Add a New Character

このガイドでは、AIデスゲーム に新しいプレイアブルキャラクターを追加する手順を説明します。

---

## 概要

新キャラの追加には **4つのコード変更** と **11枚の画像アセット** が必要です。

| 種別 | 内容 |
|------|------|
| コード変更 | `lib/constants.ts`, `components/LandingPage.tsx`, `app/share/[slug]/page.tsx`, (任意) `lib/trophies.ts` |
| 画像アセット | ゲーム内ポートレート 7枚 + LP全身画像 1枚 + OGP画像 3枚 |

---

## Step 1: サムネイル・画像の用意

### ゲーム内ポートレート（7枚）

ゲーム中の立ち絵に使用されます。リップシンクアニメーション（口パク）のため、表情×口の開閉で計7枚必要です。

**仕様:**
- サイズ: **640x640px**
- 形式: **JPG** (品質 Q60 推奨)
- 配置先: `public/agents/`

**ファイル名の命名規則:** `{characterId}_{expression}_{mouth}.jpg`

| ファイル名 | 表情 | 口 | 用途 |
|-----------|------|-----|------|
| `{id}_default_0.jpg` | 通常 | 閉 | 待機中、キャラ選択画面、LP サムネイル |
| `{id}_default_1.jpg` | 通常 | 開 | 通常発言中のリップシンク |
| `{id}_painful_0.jpg` | 苦悶 | 閉 | 不利な状況 |
| `{id}_painful_1.jpg` | 苦悶 | 開 | 不利な状況での発言 |
| `{id}_happy_0.jpg` | 喜び/企み | 閉 | 有利な状況 |
| `{id}_happy_1.jpg` | 喜び/企み | 開 | 有利な状況での発言 |
| `{id}_fainted_0.jpg` | 退場 | 閉 | 退場後の表示（**口開きなし**） |

> **Tips:** 画像生成AIを使う場合は、同じシード/キャラクターで表情だけ変えて一貫性を保つとよいです。既存キャラのアート（`public/agents/`）を参考にしてください。

### LP（ランディングページ）全身画像（1枚）

ランディングページのキャラクターカルーセルに使用されます。

**仕様:**
- 形式: **JPG**
- 配置先: `public/images/lp/`
- ファイル名: `c-{characterId}.jpg`

### OGP（SNSシェア）画像（3枚）

トロフィー獲得時のXシェアに使われるOGP画像です。

**仕様:**
- サイズ: **1280x720px**
- 形式: **JPG**
- 配置先: `public/ogp/`

| ファイル名 | 内容 |
|-----------|------|
| `survivor_{id}.jpg` | 「{名前}を生き残らせた」 |
| `survivor_no_force_{id}.jpg` | 「強制退場なしで{名前}を生き残らせた」 |
| `survivor_no_vote_{id}.jpg` | 「投票なしで{名前}を生き残らせた」 |

> **OGP画像のデザイン:** 既存の `public/ogp/` 内の画像を参考に、キャラクター名とトロフィー名を含むデザインにしてください。

### ライセンスについて

既存のキャラクター画像は **CC BY 4.0**（`public/agents/LICENSE`）でライセンスされています。新しい画像を追加する場合は、互換性のあるライセンスを使用してください。

---

## Step 2: キャラクターの設定

2つのファイルを編集します。

### 2-1. `CHARACTER_IDS` に追加（`lib/constants.ts`）

```typescript
export const CHARACTER_IDS = [
  // オリジナル5人
  'yumi', 'kenichiro', 'kiyohiko', 'shoko', 'tetsuo',
  // 追加5人
  'yusuke', 'moka', 'tsumugu', 'nao', 'aki',
  // 隠しキャラ
  'devil',
  // 新キャラ（★到達で解放）
  'isekai', 'yurei', 'tenshi',
  // ↓ ここに追加
  'your_character_id',
] as const;
```

`characterId` はアルファベット小文字のスネークケースで、画像ファイル名のプレフィックスとしても使われます。

### 2-2. `AGENT_PERSONALITIES` にキャラ設定を追加（`lib/constants.ts`）

```typescript
{
  characterId: 'your_character_id',
  name: '名前',           // 日本語の表示名
  appearance: '名前:外見の説明文',  // 他キャラから見える外見情報（LLMプロンプトに使用）
  profile: '名前:背景ストーリー',   // 本人のみに開示される来歴（LLMプロンプトに使用）
  description: '内面の性格・戦略',  // 本人のみに開示される内面（LLMプロンプトに使用）
  tone: '口調の説明',              // 話し方のスタイル（LLMプロンプトに使用）
  stats: {
    survivalInstinct: 70,   // 0-100: 生存本能（自己保存の優先度）
    cooperativeness: 50,    // 0-100: 協調性（チーム指向度）
    cunningness: 60,        // 0-100: 狡猾さ（策略・裏切り傾向）
  },
  unlockTier: undefined,   // undefined = 常時選出可能, 数値 = ★到達で解放
},
```

#### プロンプト設計のポイント

| フィールド | LLMでの使われ方 | 注意点 |
|-----------|----------------|--------|
| `appearance` | **全キャラから見える**。他者の印象を形成する | `名前:外見描写` の形式で。服装・体格・印象を簡潔に |
| `profile` | **本人のみに開示**。行動の動機づけになる | 年齢、職業、過去、トラウマなど背景情報 |
| `description` | **本人のみに開示**。AIの振る舞いを最も左右する | 「このキャラがデスゲームでどう動くか」の核心 |
| `tone` | **本人のみに開示**。発言スタイルを決定する | 「〜だぜ」「〜ですわ」など具体的な語尾の例を含めると効果的 |

#### ステータスの設計指針

| ステータス | 低い場合 | 高い場合 |
|-----------|---------|---------|
| `survivalInstinct` | 自己犠牲的（例: 零子=10） | 何がなんでも生き残る（例: 紀代彦=95） |
| `cooperativeness` | 他人を利用する（例: 鉄雄=10） | 協力を重視する（例: 天使=100） |
| `cunningness` | 正直/戦略下手（例: 魔王=0） | 嘘・心理操作が巧い（例: 翔子=100） |

> **バランスTips:** 3つのステータスの合計が 150-220 程度に収まると、既存キャラとバランスが取れます。極端なステータス（0 や 100）はキャラの個性を際立たせますが、ゲームバランスに影響します。

---

## Step 3: LP（ランディングページ）での紹介

`components/LandingPage.tsx` の `CHARACTERS` 配列にエントリを追加します。

```typescript
const CHARACTERS: LandingCharacter[] = [
  // ... 既存キャラ ...
  { id: 'your_character_id', name: '名前', description: 'キャッチコピー', occupation: '職業', age: '年齢' },
];
```

| フィールド | 説明 | 例 |
|-----------|------|-----|
| `id` | `characterId` と一致させる | `'yumi'` |
| `name` | 表示名 | `'祐未'` |
| `description` | LP上のキャッチコピー（短く印象的に） | `'追い詰められると異常な観察眼を発揮'` |
| `occupation` | 職業/肩書 | `'派遣社員'` |
| `age` | 年齢 | `'26歳'` / `'年齢不明'` |

LP のサムネイルは `public/agents/{id}_default_0.jpg` が、全身画像は `public/images/lp/c-{id}.jpg` が自動的に参照されます。

---

## Step 4: OGP の設定

`app/share/[slug]/page.tsx` の `CHARACTER_NAMES` マップに追加します。

```typescript
const CHARACTER_NAMES: Record<string, string> = {
  // ... 既存キャラ ...
  your_character_id: '名前',
};
```

これにより、3種類のトロフィーOGPデータ（`survivor_*`, `survivor_no_force_*`, `survivor_no_vote_*`）が自動生成されます。OGP 画像自体は Step 1 で作成済みのものが使われます。

---

## Step 5: 隠しキャラ（アンロック）にする場合

キャラクターを最初からプレイ可能にするか、トロフィーで解放する隠しキャラにするか選べます。

### 常時選出可能にする場合

`unlockTier` を `undefined` にする（または省略する）だけです。特別な設定は不要です。

### 隠しキャラにする場合

#### 5-1. `unlockTier` を設定

`AGENT_PERSONALITIES` のエントリで `unlockTier` に解放に必要なトロフィーレア度（★数）を指定します。

```typescript
{
  characterId: 'your_character_id',
  // ... 他の設定 ...
  unlockTier: 3,  // ★3トロフィーを獲得すると解放
},
```

現在の解放条件:

| ★ | キャラ |
|---|--------|
| 2 | 天青（isekai） | 
| 3 | 魔王（devil） | 
| 4 | 零子（yurei） | 
| 5 | 天使（tenshi） |

#### 5-2. LP のシークレット表示

隠しキャラは LP 上で「???」としてシルエット表示されます。

`components/LandingPage.tsx` にシークレットエントリを追加:

```typescript
{ id: 'secret5', name: '???', description: '???', occupation: '???', age: '???' },
```

`components/landing/CharactersSection.tsx` の `secretMap` にマッピングを追加:

```typescript
const secretMap: Record<string, string> = {
  secret: 'c-secret-01.jpg',
  // ...
  secret5: 'c-secret-05.jpg',  // 追加
};
```

シークレット用の全身シルエット画像（`public/images/lp/c-secret-05.jpg`）も別途用意してください。

#### 5-3. レア度ボーナス（任意）

生存が難しいキャラクターには、トロフィーのレア度にボーナスを付けられます。`lib/trophies.ts`:

```typescript
const CHARACTER_RARITY_BONUS: Record<string, number> = {
  // ... 既存キャラ ...
  your_character_id: 1,  // +1ボーナス（死にやすい場合）
};
```

| ボーナス | 目安 |
|---------|------|
| +0 | 普通の難易度 |
| +1 | やや死にやすい（低 cooperativeness、低 cunningness など） |
| +2 | かなり死にやすい（極端なステータス） |
| +3 | 超高難易度（天使: cooperativeness=100, cunningness=0） |

---

## アンロックの仕組み（参考）

```
ゲームプレイ → トロフィー獲得 → レア度が localStorage に記録
                                        ↓
                           次回ゲーム起動時に AGENT_PERSONALITIES をフィルタ
                                        ↓
                           unlockTier <= 記録済みレア度 のキャラが選出プールに追加
                                        ↓
                           新解放時にゲームオーバー画面で通知表示
```

- 記録は `localStorage` の `deathgame_max_rarity` キーに保存
- プレイヤーの過去最高レア度のみ保持（累積ではない）
- 実装: `lib/hiddenCharacter.ts`

---

## 自動で処理される部分（変更不要）

以下は `characterId` を元に動的に処理されるため、新キャラ追加時にコード変更は不要です。

| 機能 | ファイル |
|------|---------|
| 画像プリロード | `lib/imagePreloader.ts` |
| ポートレート描画 | `components/FocusPortrait.tsx`, `components/MiniPortrait.tsx` |
| メンバー選出UI | `components/MemberSelectionOverlay.tsx` |
| ゲームロジック | `lib/store.ts`（`createAgents()` が `AGENT_PERSONALITIES` を読む） |
| LLMプロンプト生成 | `lib/prompts.ts` |
| トロフィー評価 | `lib/trophies.ts`（生存トロフィーは動的生成） |
| OGPデータ生成 | `app/share/[slug]/page.tsx`（`CHARACTER_NAMES` から自動生成） |

---

## チェックリスト

新キャラ追加時にすべて完了しているか確認してください。

### 画像アセット
- [ ] `public/agents/{id}_default_0.jpg` (640x640)
- [ ] `public/agents/{id}_default_1.jpg`
- [ ] `public/agents/{id}_painful_0.jpg`
- [ ] `public/agents/{id}_painful_1.jpg`
- [ ] `public/agents/{id}_happy_0.jpg`
- [ ] `public/agents/{id}_happy_1.jpg`
- [ ] `public/agents/{id}_fainted_0.jpg`
- [ ] `public/images/lp/c-{id}.jpg` （LP全身画像）
- [ ] `public/ogp/survivor_{id}.jpg` (1280x720)
- [ ] `public/ogp/survivor_no_force_{id}.jpg`
- [ ] `public/ogp/survivor_no_vote_{id}.jpg`

### コード変更
- [ ] `lib/constants.ts` — `CHARACTER_IDS` に追加
- [ ] `lib/constants.ts` — `AGENT_PERSONALITIES` に設定追加
- [ ] `components/LandingPage.tsx` — `CHARACTERS` に追加
- [ ] `app/share/[slug]/page.tsx` — `CHARACTER_NAMES` に追加
- [ ] (隠しキャラの場合) `components/LandingPage.tsx` — シークレットエントリ追加
- [ ] (隠しキャラの場合) `components/landing/CharactersSection.tsx` — `secretMap` に追加
- [ ] (任意) `lib/trophies.ts` — `CHARACTER_RARITY_BONUS` に追加

### 動作確認
- [ ] `npm run dev` でビルドエラーがないこと
- [ ] キャラ選択画面で新キャラが表示されること
- [ ] ゲーム中の全表情（default, painful, happy, fainted）が正しく表示されること
- [ ] LP のキャラカルーセルに新キャラが表示されること
- [ ] (隠しキャラの場合) 未解放時に選出プールに含まれないこと
