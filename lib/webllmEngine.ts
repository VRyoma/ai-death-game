/**
 * WebLLMエンジン管理
 *
 * MLCEngine シングルトンとモデルの初期化・プログレス管理。
 * Zustand storeにはエンジン参照を持たせず、このモジュールで一元管理する。
 */

// ============================================
// 対応モデル一覧
// ============================================

export interface WebLLMModel {
  id: string;           // WebLLMのモデルID
  displayName: string;  // UI表示名
  sizeLabel: string;    // ダウンロードサイズ表示
  description: string;  // 説明文
  recommended: boolean; // 推奨モデルか
}

export const WEBLLM_MODELS: WebLLMModel[] = [
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    displayName: 'Qwen2.5 7B（推奨）',
    sizeLabel: '約5GB',
    description: '日本語の精度が高く、複雑な会話に適している。WebGPU 6GB+ 推奨。',
    recommended: true,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    displayName: 'Llama 3.2 3B（軽量）',
    sizeLabel: '約2GB',
    description: '軽量で高速。日本語品質はやや劣るが、低スペック端末向け。',
    recommended: false,
  },
];

export const DEFAULT_WEBLLM_MODEL_ID = WEBLLM_MODELS[0].id;

// ============================================
// WebGPU対応検出
// ============================================

export function isWebGPUSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator;
}

// ============================================
// プログレスコールバック型
// ============================================

export interface WebLLMProgressCallback {
  onProgress: (progress: number, text: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

// ============================================
// エンジンシングルトン管理
// ============================================

type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

interface EngineState {
  status: EngineStatus;
  modelId: string | null;
  engine: unknown | null; // MLCEngine — unknown to avoid SSR import issues
  errorMessage: string | null;
}

let engineState: EngineState = {
  status: 'idle',
  modelId: null,
  engine: null,
  errorMessage: null,
};

let abortController: AbortController | null = null;

/** エンジンが初期化済みで、指定モデルでReadyか */
export function isEngineReady(modelId: string): boolean {
  return engineState.status === 'ready' && engineState.modelId === modelId;
}

/** 現在のエンジン状態を取得 */
export function getEngineStatus(): EngineStatus {
  return engineState.status;
}

/** 初期化済みのエンジンインスタンスを取得（未初期化の場合はnull） */
export function getEngine(): unknown | null {
  return engineState.engine;
}

/**
 * モデルのダウンロード・初期化を実行する
 * キャッシュ済みの場合はダウンロードをスキップして高速初期化する
 */
export async function initializeEngine(
  modelId: string,
  callbacks: WebLLMProgressCallback
): Promise<void> {
  // 既に同じモデルでReadyなら即完了
  if (isEngineReady(modelId)) {
    callbacks.onComplete();
    return;
  }

  // 進行中のロードをキャンセル
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const signal = abortController.signal;

  engineState = { status: 'loading', modelId, engine: null, errorMessage: null };

  try {
    const { MLCEngine } = await import('@mlc-ai/web-llm');

    if (signal.aborted) return;

    const engine = new MLCEngine();

    engine.setInitProgressCallback((report: { progress: number; text: string }) => {
      if (signal.aborted) return;
      const pct = Math.round(report.progress * 100);
      callbacks.onProgress(pct, report.text || `読み込み中… ${pct}%`);
    });

    await engine.reload(modelId);

    if (signal.aborted) return;

    engineState = { status: 'ready', modelId, engine, errorMessage: null };
    callbacks.onComplete();
  } catch (error) {
    if (signal.aborted) return;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    engineState = { status: 'error', modelId, engine: null, errorMessage: msg };
    callbacks.onError(msg);
  }
}

/** ダウンロード・初期化をキャンセルする */
export function cancelInitialization(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  if (engineState.status === 'loading') {
    engineState = { status: 'idle', modelId: null, engine: null, errorMessage: null };
  }
}
