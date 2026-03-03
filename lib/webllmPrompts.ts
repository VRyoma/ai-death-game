/**
 * WebLLM用プロンプトビルダー
 *
 * 既存の prompts.ts / constants.ts のプロンプトビルダーをそのまま再利用する。
 * プロンプト文字列はGeminiもWebLLMも共通で使える自己完結型テキストのため、
 * OpenAI Chat Completions の user メッセージとして渡すだけで動作する。
 */

// prompts.ts から全ビルダーをそのまま再エクスポート
export {
  buildDiscussionPrompt,
  buildVoteBatchPrompt,
  buildEliminationReactionPrompt,
  buildVictoryCommentPrompt,
  buildDualVictoryCommentPrompt,
  buildModerationPrompt,
  looksLikeHostSelfQuestion,
} from './prompts';

// constants.ts から司会者プロファイルを再エクスポート（フォールバック用）
export { MASTER_PROFILE } from './constants';
