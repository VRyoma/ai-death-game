/**
 * WebLLMアダプター
 *
 * @mlc-ai/web-llm の MLCEngine を使って LLMAdapter インターフェースを実装する。
 * 既存の prompts.ts プロンプトビルダーをそのまま再利用し、
 * OpenAI Chat Completions 形式（{role, content}[]）でラップして呼び出す。
 *
 * フォールバックチェーン: 推論失敗 → テキストフォールバック（'……'）+ onError通知
 */

import type { LLMAdapter, DiscussionTurnResult, VictoryCommentResult, ModerationResult } from './llmAdapter';
import type { Agent, Expression, LogEntry, DiscussionBatchResponse, VoteBatchResponse, VoteBatchItemResponse, DiscussionBatchItem } from './types';
import type { DynamicPromptContext } from './ruleConfig';
import { createDefaultPromptContext } from './ruleConfig';
import { parseStreamResponse } from './turnResponseParser';
import { normalizeExpression } from './prompts';
import { getEngine } from './webllmEngine';
import {
  buildDiscussionPrompt,
  buildVoteBatchPrompt,
  buildEliminationReactionPrompt,
  buildVictoryCommentPrompt,
  buildDualVictoryCommentPrompt,
  buildModerationPrompt,
  looksLikeHostSelfQuestion,
  MASTER_PROFILE,
} from './webllmPrompts';

// ============================================
// ヘルパー
// ============================================

function getMLCEngine() {
  const engine = getEngine() as { chat: { completions: { create: (opts: unknown) => Promise<unknown> } } } | null;
  if (!engine) throw new Error('WebLLM engine not initialized');
  return engine;
}

async function generateText(prompt: string): Promise<string> {
  const engine = getMLCEngine();
  const response = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
    max_tokens: 512,
  }) as { choices: { message: { content: string } }[] };
  return response.choices[0]?.message?.content?.trim() || '';
}

async function generateJSON(prompt: string): Promise<string> {
  const engine = getMLCEngine();
  // response_format: json_object は WebLLM で CompileJSONSchema エラーになるため使わない。
  // プロンプト側で JSON 出力を指示する。
  const response = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1024,
  }) as { choices: { message: { content: string } }[] };
  const text = response.choices[0]?.message?.content?.trim() || '{}';
  // コードブロックで囲まれている場合は中身だけ取り出す
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text;
}

// ============================================
// WebLLMAdapter
// ============================================

export class WebLLMAdapter implements LLMAdapter {
  async discussionTurn(params: {
    agent: Agent;
    allAgents: Agent[];
    recentLogs: LogEntry[];
    promptContext?: DynamicPromptContext;
    onError?: (msg: string) => void;
  }): Promise<DiscussionTurnResult> {
    const { agent, allAgents, recentLogs, promptContext, onError } = params;
    const ctx = promptContext || createDefaultPromptContext();

    try {
      const prompt = buildDiscussionPrompt(agent, recentLogs, allAgents, ctx, { verbose: true });
      const text = await generateText(prompt);
      const parsed = parseStreamResponse(text);

      return {
        thought: parsed.internal_thought || '……',
        speech: parsed.external_speech || '……',
        thoughtExpression: parsed.internal_expression || 'default',
        speechExpression: parsed.external_expression || 'default',
        rawText: text,
      };
    } catch (error) {
      onError?.(`WebLLM推論エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      return {
        thought: '……',
        speech: '……',
        thoughtExpression: 'default' as Expression,
        speechExpression: 'default' as Expression,
        rawText: '[default]……|||[default]……',
      };
    }
  }

  async discussionBatch(params: {
    aliveAgents: Agent[];
    allAgents: Agent[];
    recentLogs: LogEntry[];
    round: number;
    turnInRound: number;
    startSpeakerIndex: number;
    generationEpoch: number;
    promptContext?: DynamicPromptContext;
    onError?: (msg: string) => void;
  }): Promise<DiscussionBatchResponse> {
    const {
      aliveAgents, allAgents, recentLogs, round, turnInRound,
      startSpeakerIndex, generationEpoch, promptContext, onError,
    } = params;

    const speakers = aliveAgents.slice(startSpeakerIndex);
    if (speakers.length === 0) {
      return { generationEpoch, items: [], consumedInstructionTurns: 0 };
    }

    const ctx = promptContext || createDefaultPromptContext();
    const fallbackItems: DiscussionBatchItem[] = speakers.map((agent) => ({
      agent_id: agent.id,
      thought: '……',
      speech: '……',
      thought_expression: 'default' as Expression,
      speech_expression: 'default' as Expression,
    }));

    // WebLLMでは各エージェントを順次個別推論してバッチ結果を組み立てる
    const items: DiscussionBatchItem[] = [];

    for (const agent of speakers) {
      try {
        const prompt = buildDiscussionPrompt(agent, recentLogs, allAgents, ctx, { verbose: true });
        const text = await generateText(prompt);
        const parsed = parseStreamResponse(text);
        items.push({
          agent_id: agent.id,
          thought: parsed.internal_thought || '……',
          speech: parsed.external_speech || '……',
          thought_expression: parsed.internal_expression || 'default',
          speech_expression: parsed.external_expression || 'default',
        });
      } catch {
        items.push({
          agent_id: agent.id,
          thought: '……',
          speech: '……',
          thought_expression: 'default' as Expression,
          speech_expression: 'default' as Expression,
        });
      }
    }

    return { generationEpoch, items, consumedInstructionTurns: speakers.length };
  }

  async voteBatch(params: {
    voters: Agent[];
    candidates: Agent[];
    allAgents: Agent[];
    recentLogs: LogEntry[];
    promptContext?: DynamicPromptContext;
    onError?: (msg: string) => void;
  }): Promise<VoteBatchResponse> {
    const { voters, candidates, allAgents, recentLogs, promptContext, onError } = params;

    if (voters.length === 0) return { votes: [] };

    const ctx = promptContext || createDefaultPromptContext();
    const fallbackTargetId = candidates[0]?.id || voters[0].id;

    try {
      const prompt = buildVoteBatchPrompt(voters, candidates, recentLogs, allAgents, ctx, { verbose: true });
      const text = await generateJSON(prompt);
      const parsed = JSON.parse(text) as { votes?: VoteBatchItemResponse[] };

      const candidateIds = new Set(candidates.map((c) => c.id));
      const parsedMap = new Map<string, VoteBatchItemResponse>();

      if (Array.isArray(parsed.votes)) {
        for (const vote of parsed.votes) {
          if (vote && typeof vote.voter_id === 'string' && typeof vote.vote_target_id === 'string') {
            parsedMap.set(vote.voter_id, vote);
          }
        }
      }

      const normalizedVotes: VoteBatchItemResponse[] = voters.map((voter) => {
        const parsedVote = parsedMap.get(voter.id);
        const hasValidTarget =
          !!parsedVote &&
          (candidateIds.has(parsedVote.vote_target_id) || parsedVote.vote_target_id === voter.id);

        return {
          voter_id: voter.id,
          vote_target_id: hasValidTarget ? parsedVote!.vote_target_id : fallbackTargetId,
          internal_reasoning: parsedVote?.internal_reasoning || '処理エラー',
          internal_expression: 'default',
        };
      });

      return { votes: normalizedVotes };
    } catch (error) {
      onError?.(`WebLLM投票エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      return {
        votes: voters.map((voter) => ({
          voter_id: voter.id,
          vote_target_id: fallbackTargetId,
          internal_reasoning: '処理エラー',
          internal_expression: 'default',
        })),
      };
    }
  }

  async eliminationReaction(params: {
    agent: Agent;
    eliminatedAgents: { id: string; name: string }[];
    logs: LogEntry[];
    allAgents: Agent[];
    selfVoted?: boolean;
    gmVote?: { type: 'force_eliminate' | 'one_vote' | 'watch'; targetId: string | null };
    onError?: (msg: string) => void;
  }): Promise<{ reaction: string }> {
    const { agent, eliminatedAgents, logs, allAgents, selfVoted = false, gmVote, onError } = params;

    try {
      const prompt = buildEliminationReactionPrompt(agent, eliminatedAgents, logs, allAgents, selfVoted, gmVote, { verbose: true });
      const text = await generateText(prompt);
      const cleanedText = text.replace(/^[「『"']+|[」』"']+$/g, '');
      return { reaction: cleanedText || 'なぜだ...' };
    } catch (error) {
      onError?.(`WebLLM断末魔エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      return { reaction: '……' };
    }
  }

  async victoryComment(params: {
    agent: Agent;
    logs: LogEntry[];
    allAgents: Agent[];
    coSurvivor?: Agent;
    onError?: (msg: string) => void;
  }): Promise<VictoryCommentResult> {
    const { agent, logs, allAgents, coSurvivor, onError } = params;

    try {
      const prompt = coSurvivor
        ? buildDualVictoryCommentPrompt(agent, coSurvivor, logs, allAgents, { verbose: true })
        : buildVictoryCommentPrompt(agent, logs, allAgents, { verbose: true });

      const text = await generateText(prompt);
      const parsed = parseStreamResponse(text);

      return {
        thought: parsed.internal_thought || '……勝った。本当に勝ったんだ。',
        speech: parsed.external_speech || '……勝った。',
        thoughtExpression: parsed.internal_expression || 'happy',
        speechExpression: parsed.external_expression || 'happy',
      };
    } catch (error) {
      onError?.(`WebLLM勝利コメントエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      return {
        thought: coSurvivor ? `……${coSurvivor.name}と一緒に生き残った……` : '……勝った。',
        speech: coSurvivor ? `……${coSurvivor.name}、私たち生き残ったね。` : '……勝った。',
        thoughtExpression: 'happy',
        speechExpression: 'happy',
      };
    }
  }

  async moderateIntervention(params: {
    instruction: string;
    participants?: { name: string; isAlive: boolean }[];
    onError?: (msg: string) => void;
  }): Promise<ModerationResult> {
    const { instruction, participants, onError } = params;
    const forcedHostSelfAnswer = looksLikeHostSelfQuestion(instruction);

    const participantsInfo = participants
      ? participants.map((p) => `- ${p.name}${p.isAlive ? '' : '（退場済み）'}`).join('\n')
      : '（参加者情報なし）';

    try {
      const prompt = buildModerationPrompt(instruction, participantsInfo, { verbose: true });
      const text = await generateJSON(prompt);
      const result = JSON.parse(text) as {
        category?: string;
        responseMode?: string;
        reason?: string;
        masterResponse?: string;
      };

      const category = (result.category === 'unsafe' || result.category === 'rule_change')
        ? result.category
        : 'safe';

      const normalizedMode =
        result.responseMode === 'host_self_answer' ? 'host_self_answer' : 'broadcast_instruction';

      const responseMode: 'broadcast_instruction' | 'host_self_answer' =
        category === 'safe' && forcedHostSelfAnswer ? 'host_self_answer' : normalizedMode;

      return {
        category: category as 'safe' | 'unsafe' | 'rule_change',
        reason: result.reason || '',
        responseMode,
        masterResponse: result.masterResponse || `「${instruction}」`,
      };
    } catch (error) {
      onError?.(`WebLLMモデレーションエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      return {
        category: 'safe',
        reason: 'フォールバック',
        responseMode: forcedHostSelfAnswer ? 'host_self_answer' : 'broadcast_instruction',
        masterResponse: forcedHostSelfAnswer
          ? `……私のことか。好物は${MASTER_PROFILE.likes}だ。`
          : `ゲームマスターから指示だ。……「${instruction}」……だそうだ。`,
      };
    }
  }
}
