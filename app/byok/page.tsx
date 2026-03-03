'use client';

/**
 * BYOK / WebLLM 選択ページ
 *
 * バックエンド選択タブ:
 *   - Gemini BYOK: APIキー入力 → 検証 → 入場
 *   - WebLLM ローカル: モデル選択 → 入場（ゲームページでダウンロード）
 *
 * WebGPU非対応ブラウザではWebLLMタブを無効化する。
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { WEBLLM_MODELS, DEFAULT_WEBLLM_MODEL_ID, isWebGPUSupported } from '@/lib/webllmEngine';

/** sessionStorage のキー名 */
const BYOK_STORAGE_KEY = 'dg_byok_api_key';

/** 検証用エンドポイント（Gemini REST API） — ゲーム本番で使うモデルと合わせる */
const GEMINI_VALIDATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/** 検証状態 */
type ValidationStatus = 'idle' | 'loading' | 'success' | 'error';

type Tab = 'gemini' | 'webllm';

/**
 * Gemini APIキーの有効性をクライアントサイドで検証する
 */
async function validateGeminiApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(GEMINI_VALIDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'ping' }] }],
      }),
    });

    if (res.ok) return { ok: true };

    if (res.status === 400) return { ok: false, error: 'APIキーの形式が不正です' };
    if (res.status === 403) return { ok: false, error: 'APIキーが無効、または権限がありません' };
    if (res.status === 429) return { ok: false, error: 'レート制限中です。しばらくお待ちください' };

    try {
      const data = await res.json();
      return { ok: false, error: data?.error?.message ?? `エラー (${res.status})` };
    } catch {
      return { ok: false, error: `エラー (${res.status})` };
    }
  } catch {
    return { ok: false, error: 'ネットワークエラーが発生しました' };
  }
}

export default function ByokPage() {
  const router = useRouter();
  const setLLMBackend = useGameStore((s) => s.setLLMBackend);

  const [tab, setTab] = useState<Tab>('webllm');
  const [webGPUAvailable, setWebGPUAvailable] = useState(false);

  // Gemini タブの状態
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // WebLLM タブの状態
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_WEBLLM_MODEL_ID);

  // WebGPU対応チェック（クライアントサイドのみ）
  useEffect(() => {
    setWebGPUAvailable(isWebGPUSupported());
  }, []);

  // sessionStorage に有効なキーが残っていれば復元
  useEffect(() => {
    try {
      const encoded = sessionStorage.getItem(BYOK_STORAGE_KEY);
      const tsStr = sessionStorage.getItem(BYOK_STORAGE_KEY + '_ts');
      if (!encoded || !tsStr) return;

      const BYOK_TTL_MS = 30 * 60 * 1000;
      if (Date.now() - Number(tsStr) > BYOK_TTL_MS) {
        sessionStorage.removeItem(BYOK_STORAGE_KEY);
        sessionStorage.removeItem(BYOK_STORAGE_KEY + '_ts');
        return;
      }

      const decoded = atob(encoded);
      if (decoded) {
        setApiKey(decoded);
        setStatus('success');
      }
    } catch {
      // デコード失敗等は無視
    }
  }, []);

  const handleValidate = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;

    setStatus('loading');
    setErrorMessage('');

    const result = await validateGeminiApiKey(trimmed);

    if (result.ok) {
      setStatus('success');
      sessionStorage.setItem(BYOK_STORAGE_KEY, btoa(trimmed));
      sessionStorage.setItem(BYOK_STORAGE_KEY + '_ts', String(Date.now()));
    } else {
      setStatus('error');
      setErrorMessage(result.error ?? 'Unknown error');
    }
  };

  const handleGeminiEnter = () => {
    setLLMBackend('gemini', { apiKey: apiKey.trim() });
    router.push('/game');
  };

  const handleWebLLMEnter = () => {
    setLLMBackend('webllm', { modelId: selectedModelId });
    router.push('/game');
  };

  const isGeminiValidated = status === 'success';

  return (
    <div className="min-h-dvh relative bg-[#050505]">
      {/* CRTオーバーレイ */}
      <div className="fixed inset-0 z-50 pointer-events-none crt-overlay opacity-30" />
      <div className="fixed inset-0 z-40 pointer-events-none bg-green-500/[0.02] mix-blend-overlay" />

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="border-2 border-[#33ff00] bg-[#061206] p-6 shadow-[0_0_15px_rgba(51,255,0,0.2)]">
            {/* ヘッダー */}
            <div className="mb-5">
              <p className="text-xs text-[#33ff00]/60 mb-1">&gt; SYSTEM://LLM_BACKEND_SELECT</p>
              <h1 className="text-lg text-[#33ff00] font-bold">
                バックエンド選択<span className="animate-pulse">_</span>
              </h1>
            </div>

            {/* タブ切り替え */}
            <div className="flex mb-5 border border-[#33ff00]/30">
              <button
                onClick={() => webGPUAvailable && setTab('webllm')}
                disabled={!webGPUAvailable}
                className={`flex-1 py-2 text-sm transition ${
                  tab === 'webllm'
                    ? 'bg-[#33ff00]/15 text-[#33ff00] border-r border-[#33ff00]/30'
                    : webGPUAvailable
                      ? 'text-[#33ff00]/50 hover:text-[#33ff00]/70 border-r border-[#33ff00]/20'
                      : 'text-[#33ff00]/25 cursor-not-allowed'
                }`}
              >
                WebLLM ローカル
                {!webGPUAvailable && (
                  <span className="ml-1 text-xs text-[#ff0055]/70">[非対応]</span>
                )}
              </button>
              <button
                onClick={() => setTab('gemini')}
                className={`flex-1 py-2 text-sm transition ${
                  tab === 'gemini'
                    ? 'bg-[#33ff00]/15 text-[#33ff00]'
                    : 'text-[#33ff00]/50 hover:text-[#33ff00]/70'
                }`}
              >
                Gemini BYOK
              </button>
            </div>

            {/* === Gemini BYOKタブ === */}
            {tab === 'gemini' && (
              <>
                <div className="text-sm text-[#6eb659] mb-4 leading-relaxed space-y-1.5">
                  <p>
                    Gemini APIキーを入力してください。
                    <br />
                    待機なし・回数無制限でプレイできます。
                  </p>
                  <p className="text-xs text-[#6eb659]/70">
                    キーはサーバーに送信されず、ブラウザからGoogleに直接通信します。
                  </p>
                </div>
                <Link
                  href="/byok/guide"
                  className="mb-5 block text-xs text-[#33ff00]/70 underline hover:text-[#33ff00] transition-colors"
                >
                  APIキーとは？取得方法・セキュリティの詳細 →
                </Link>

                <div className="mb-4">
                  <label className="block text-xs text-[#33ff00]/70 mb-2">&gt; API_KEY:</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (status !== 'idle' && status !== 'loading') {
                        setStatus('idle');
                        setErrorMessage('');
                      }
                    }}
                    placeholder="AIza..."
                    className="w-full bg-[#020802] border border-[#33ff00]/40 px-3 py-2.5 text-sm text-[#33ff00] placeholder-[#33ff00]/25 outline-none focus:border-[#33ff00] focus:shadow-[0_0_8px_rgba(51,255,0,0.3)] transition"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && apiKey.trim()) handleValidate();
                    }}
                  />
                </div>

                <button
                  onClick={handleValidate}
                  disabled={!apiKey.trim() || status === 'loading'}
                  className="w-full border border-[#33ff00]/60 bg-[#0a1f0a] px-4 py-2.5 text-sm text-[#33ff00] transition hover:bg-[#33ff00]/15 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? 'VERIFYING...' : '確認'}
                </button>

                {status === 'success' && (
                  <div className="mt-4 border border-[#33ff00]/40 bg-[#001a00] px-3 py-2 text-sm text-[#33ff00]">
                    AUTHENTICATED - キーが確認されました
                  </div>
                )}
                {status === 'error' && (
                  <div className="mt-4 border border-[#ff4d6d]/40 bg-[#1a0008] px-3 py-2 text-sm text-[#ff4d6d]">
                    AUTHENTICATION FAILED - {errorMessage}
                  </div>
                )}

                <div className="my-5 border-t border-[#33ff00]/20" />

                <button
                  onClick={handleGeminiEnter}
                  disabled={!isGeminiValidated}
                  className={`w-full border-2 px-4 py-3 text-base font-bold transition ${
                    isGeminiValidated
                      ? 'border-[#33ff00] bg-[#061206] text-[#33ff00] hover:bg-[#33ff00]/15'
                      : 'border-[#33ff00]/20 bg-[#061206] text-[#33ff00]/20 cursor-not-allowed'
                  }`}
                >
                  入場
                </button>
              </>
            )}

            {/* === WebLLMタブ === */}
            {tab === 'webllm' && (
              <>
                <div className="text-sm text-[#6eb659] mb-4 leading-relaxed space-y-1.5">
                  <p>
                    APIキー不要。モデルをブラウザにダウンロードして、
                    <br />
                    完全ローカルで推論します。
                  </p>
                  <p className="text-xs text-[#6eb659]/70">
                    初回はモデルのダウンロードが必要です（数GB）。
                    2回目以降はキャッシュから高速起動します。
                  </p>
                </div>

                {/* モデル選択 */}
                <div className="mb-5">
                  <label className="block text-xs text-[#33ff00]/70 mb-2">&gt; MODEL_SELECT:</label>
                  <div className="space-y-2">
                    {WEBLLM_MODELS.map((model) => (
                      <label
                        key={model.id}
                        className={`flex items-start gap-3 border p-3 cursor-pointer transition ${
                          selectedModelId === model.id
                            ? 'border-[#33ff00] bg-[#33ff00]/10'
                            : 'border-[#33ff00]/30 hover:border-[#33ff00]/60'
                        }`}
                      >
                        <input
                          type="radio"
                          name="webllm-model"
                          value={model.id}
                          checked={selectedModelId === model.id}
                          onChange={() => setSelectedModelId(model.id)}
                          className="mt-0.5 accent-[#33ff00]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-[#33ff00] font-medium">{model.displayName}</span>
                            <span className="text-xs text-[#33ff00]/50 border border-[#33ff00]/30 px-1.5 py-0.5">
                              {model.sizeLabel}
                            </span>
                            {model.recommended && (
                              <span className="text-xs text-[#33ff00]/70 border border-[#33ff00]/40 px-1.5 py-0.5 bg-[#33ff00]/10">
                                推奨
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#6eb659]/70 mt-1 leading-relaxed">
                            {model.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="my-5 border-t border-[#33ff00]/20" />

                <button
                  onClick={handleWebLLMEnter}
                  className="w-full border-2 border-[#33ff00] bg-[#061206] px-4 py-3 text-base font-bold text-[#33ff00] transition hover:bg-[#33ff00]/15"
                >
                  入場（モデルをロード）
                </button>
              </>
            )}

            {/* WebGPU非対応の説明 */}
            {!webGPUAvailable && (
              <div className="mt-4 border border-[#ff0055]/30 bg-[#1a0008] px-3 py-2 text-xs text-[#ff4d6d]/80">
                WebLLM ローカルには WebGPU 対応ブラウザが必要です（Chrome 113+ / Edge 113+）。
              </div>
            )}

            {/* トップへ戻るリンク */}
            <div className="mt-5 text-center">
              <Link
                href="/"
                className="text-xs text-[#6eb659]/70 underline hover:text-[#33ff00] transition"
              >
                &lt; トップページに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
