/**
 * GeminiAdapter
 *
 * 既存の byokClient.ts 関数群を LLMAdapter インターフェースでラップする。
 * byokClient.ts の既存エクスポートは後方互換のために維持する。
 */

import type { LLMAdapter, DiscussionTurnResult, VictoryCommentResult, ModerationResult } from './llmAdapter';
import type { Agent, LogEntry, DiscussionBatchResponse, VoteBatchResponse } from './types';
import type { DynamicPromptContext } from './ruleConfig';
import {
  byokDiscussionTurn,
  byokDiscussionBatch,
  byokVoteBatch,
  byokEliminationReaction,
  byokVictoryComment,
  byokModerateIntervention,
} from './byokClient';

export class GeminiAdapter implements LLMAdapter {
  constructor(private readonly apiKey: string) {}

  async discussionTurn(params: {
    agent: Agent;
    allAgents: Agent[];
    recentLogs: LogEntry[];
    promptContext?: DynamicPromptContext;
    onError?: (msg: string) => void;
  }): Promise<DiscussionTurnResult> {
    return byokDiscussionTurn(params, this.apiKey);
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
    return byokDiscussionBatch(params, this.apiKey);
  }

  async voteBatch(params: {
    voters: Agent[];
    candidates: Agent[];
    allAgents: Agent[];
    recentLogs: LogEntry[];
    promptContext?: DynamicPromptContext;
    onError?: (msg: string) => void;
  }): Promise<VoteBatchResponse> {
    return byokVoteBatch(params, this.apiKey);
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
    return byokEliminationReaction(params, this.apiKey);
  }

  async victoryComment(params: {
    agent: Agent;
    logs: LogEntry[];
    allAgents: Agent[];
    coSurvivor?: Agent;
    onError?: (msg: string) => void;
  }): Promise<VictoryCommentResult> {
    return byokVictoryComment(params, this.apiKey);
  }

  async moderateIntervention(params: {
    instruction: string;
    participants?: { name: string; isAlive: boolean }[];
    onError?: (msg: string) => void;
  }): Promise<ModerationResult> {
    return byokModerateIntervention(params, this.apiKey);
  }
}
