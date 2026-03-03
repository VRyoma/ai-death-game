'use client';

/**
 * WebLLMセットアップオーバーレイ
 *
 * WebLLMバックエンド選択時にゲームページ全体を覆うフルスクリーンオーバーレイ。
 * モデルのダウンロード・初期化が完了するまで表示し、完了後は自動で消える。
 */

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { initializeEngine, cancelInitialization, WEBLLM_MODELS } from '@/lib/webllmEngine';

interface WebLLMSetupOverlayProps {
  modelId: string;
}

export function WebLLMSetupOverlay({ modelId }: WebLLMSetupOverlayProps) {
  const router = useRouter();
  const { webllmStatus, webllmProgress, webllmProgressText, setWebLLMStatus } = useGameStore();

  const modelInfo = WEBLLM_MODELS.find((m) => m.id === modelId);

  const startInit = useCallback(async () => {
    setWebLLMStatus('loading', 0, '初期化を開始しています...');
    await initializeEngine(modelId, {
      onProgress: (progress, text) => {
        setWebLLMStatus('loading', progress, text);
      },
      onComplete: () => {
        setWebLLMStatus('ready', 100, '初期化完了');
      },
      onError: (error) => {
        setWebLLMStatus('error', 0, error);
      },
    });
  }, [modelId, setWebLLMStatus]);

  // マウント時に初期化開始
  useEffect(() => {
    startInit();
    // アンマウント時にエンジンをキャンセルしない（再利用のため）
  }, [startInit]);

  const handleCancel = () => {
    cancelInitialization();
    setWebLLMStatus('idle', 0, '');
    router.push('/byok');
  };

  const handleRetry = () => {
    startInit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]">
      {/* CRTオーバーレイ */}
      <div className="fixed inset-0 z-10 pointer-events-none crt-overlay opacity-30" />
      <div className="fixed inset-0 z-10 pointer-events-none bg-green-500/[0.02] mix-blend-overlay" />

      <div className="relative z-20 w-full max-w-md px-4">
        <div className="border-2 border-[#33ff00] bg-[#061206] p-6 shadow-[0_0_30px_rgba(51,255,0,0.25)]">
          {/* ヘッダー */}
          <div className="mb-5">
            <p className="text-xs text-[#33ff00]/60 mb-1">&gt; SYSTEM://WEBLLM_INIT</p>
            <h1 className="text-lg text-[#33ff00] font-bold">
              {webllmStatus === 'error' ? (
                <>エラーが発生しました<span className="animate-pulse">_</span></>
              ) : (
                <>モデルをロード中<span className="animate-pulse">_</span></>
              )}
            </h1>
          </div>

          {/* モデル情報 */}
          {modelInfo && (
            <div className="mb-4 border border-[#33ff00]/20 bg-[#020802] px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-[#33ff00] font-medium">{modelInfo.displayName}</span>
                <span className="text-xs text-[#33ff00]/50 border border-[#33ff00]/30 px-1.5 py-0.5">
                  {modelInfo.sizeLabel}
                </span>
              </div>
              <p className="text-xs text-[#6eb659]/70">{modelInfo.description}</p>
            </div>
          )}

          {/* エラー状態 */}
          {webllmStatus === 'error' && (
            <div className="mb-5">
              <div className="border border-[#ff4d6d]/40 bg-[#1a0008] px-3 py-2 text-sm text-[#ff4d6d] mb-4 break-all">
                ERROR - {webllmProgressText || '不明なエラーが発生しました'}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 border border-[#33ff00]/60 bg-[#0a1f0a] px-4 py-2.5 text-sm text-[#33ff00] transition hover:bg-[#33ff00]/15"
                >
                  リトライ
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 border border-[#ff0055]/40 bg-[#1a0008] px-4 py-2.5 text-sm text-[#ff4d6d] transition hover:bg-[#ff0055]/10"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* ローディング状態 */}
          {webllmStatus !== 'error' && (
            <div className="mb-5">
              {/* プログレスバー */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-[#33ff00]/60 mb-1.5">
                  <span>PROGRESS</span>
                  <span>{webllmProgress}%</span>
                </div>
                <div className="h-3 border border-[#33ff00]/30 bg-[#020802] overflow-hidden">
                  <div
                    className="h-full bg-[#33ff00]/70 transition-all duration-300"
                    style={{ width: `${webllmProgress}%` }}
                  />
                </div>
              </div>

              {/* ステータステキスト */}
              <p className="text-xs text-[#6eb659]/80 leading-relaxed min-h-[2.5em]">
                {webllmProgressText || '初期化を開始しています...'}
              </p>
            </div>
          )}

          {/* 注意文言 */}
          {webllmStatus !== 'error' && webllmProgress === 0 && (
            <div className="mb-4 text-xs text-[#6eb659]/60 leading-relaxed space-y-1">
              <p>初回はモデルのダウンロードが必要です（{modelInfo?.sizeLabel ?? '数GB'}）。</p>
              <p>2回目以降はキャッシュから高速起動します。</p>
            </div>
          )}

          {/* キャンセルボタン（エラー状態以外） */}
          {webllmStatus !== 'error' && (
            <div className="border-t border-[#33ff00]/20 pt-4">
              <button
                onClick={handleCancel}
                className="w-full border border-[#33ff00]/30 px-4 py-2 text-xs text-[#33ff00]/60 transition hover:text-[#33ff00] hover:border-[#33ff00]/60"
              >
                キャンセル（バックエンド選択に戻る）
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
