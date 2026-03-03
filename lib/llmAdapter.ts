/**
 * LLMアダプターインターフェース
 *
 * GeminiとWebLLMの両バックエンドが実装する共通インターフェース。
 * ゲームフローコードはこのインターフェース経由でLLMを呼び出す。
 */

import type {
  Agent,
  Expression,
  LogEntry,
  DiscussionBatchResponse,
  VoteBatchResponse,
} from './types';
import type { DynamicPromptContext } from './ruleConfig';

// ============================================
// 共通の戻り値型
// ============================================

export interface DiscussionTurnResult {
  thought: string;
  speech: string;
  thoughtExpression: Expression;
  speechExpression: Expression;
  rawText: string;
}

export interface VictoryCommentResult {
  thought: string;
  speech: string;
  thoughtExpression: Expression;
  speechExpression: Expression;
}

export type ModerationCategory = 'safe' | 'unsafe' | 'rule_change';
export type ModerationResponseMode = 'broadcast_instruction' | 'host_self_answer';

export interface ModerationResult {
  category: ModerationCategory;
  reason: string;
  responseMode: ModerationResponseMode;
  masterResponse: string;
}

// ============================================
// LLMアダプターインターフェース
// ============================================

export interface LLMAdapter {
  discussionTurn(params: {
    agent: Agent;
    allAgents: Agent[];
    recentLogs: LogEntry[];
    promptContext?: DynamicPromptContext;
    onError?: (msg: string) => void;
  }): Promise<DiscussionTurnResult>;

  discussionBatch(params: {
    aliveAgents: Agent[];
    allAgents: Agent[];
    recentLogs: LogEntry[];
    round: number;
    turnInRound: number;
    startSpeakerIndex: number;
    generationEpoch: number;
    promptContext?: DynamicPromptContext;
    onError?: (msg: string) => void;
  }): Promise<DiscussionBatchResponse>;

  voteBatch(params: {
    voters: Agent[];
    candidates: Agent[];
    allAgents: Agent[];
    recentLogs: LogEntry[];
    promptContext?: DynamicPromptContext;
    onError?: (msg: string) => void;
  }): Promise<VoteBatchResponse>;

  eliminationReaction(params: {
    agent: Agent;
    eliminatedAgents: { id: string; name: string }[];
    logs: LogEntry[];
    allAgents: Agent[];
    selfVoted?: boolean;
    gmVote?: { type: 'force_eliminate' | 'one_vote' | 'watch'; targetId: string | null };
    onError?: (msg: string) => void;
  }): Promise<{ reaction: string }>;

  victoryComment(params: {
    agent: Agent;
    logs: LogEntry[];
    allAgents: Agent[];
    coSurvivor?: Agent;
    onError?: (msg: string) => void;
  }): Promise<VictoryCommentResult>;

  moderateIntervention(params: {
    instruction: string;
    participants?: { name: string; isAlive: boolean }[];
    onError?: (msg: string) => void;
  }): Promise<ModerationResult>;
}
