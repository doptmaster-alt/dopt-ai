"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Props {
  projectId: number;
  currentStep: number;
  onExportToFigma?: (step: number) => void;
  figmaLoading?: boolean;
  projectName?: string;
}

/**
 * Figma 실시간 임베드 패널
 * - 프로젝트별 Figma 파일 URL을 저장/로드
 * - Figma 라이브 임베드로 실시간 확인
 * - Figma 내보내기 버튼
 */
export default function FigmaPanel({ projectId, currentStep, onExportToFigma, figmaLoading, projectName }: Props) {
  const [figmaUrl, setFigmaUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [svgDownloading, setSvgDownloading] = useState<string | null>(null);

  // 프로젝트별 Figma URL 로드
  useEffect(() => {
    const stored = localStorage.getItem(`figma_url_${projectId}`);
    if (stored) {
      setFigmaUrl(stored);
      setInputUrl(stored);
    }
  }, [projectId]);

  // 플러그인 연결 상태 확인
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/figma-plugin/status");
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const saveFigmaUrl = () => {
    const url = inputUrl.trim();
    if (url) {
      localStorage.setItem(`figma_url_${projectId}`, url);
      setFigmaUrl(url);
    }
    setIsEditing(false);
  };

  const getEmbedUrl = (url: string): string => {
    // Figma URL → embed URL 변환
    if (!url) return "";
    // 이미 embed URL인 경우
    if (url.includes("figma.com/embed")) return url;
    // Figma URL 정규화 (design/file 모두 지원)
    let cleanUrl = url.trim();
    // /design/ → /file/ 변환 (embed가 /file/ 형식을 더 잘 지원)
    cleanUrl = cleanUrl.replace('/design/', '/file/');
    // 쿼리 파라미터 제거 후 다시 추가 (embed에 필요한 것만)
    const urlObj = new URL(cleanUrl);
    const nodeId = urlObj.searchParams.get('node-id');
    let baseUrl = `${urlObj.origin}${urlObj.pathname}`;
    if (nodeId) baseUrl += `?node-id=${nodeId}`;
    const encoded = encodeURIComponent(baseUrl);
    return `https://www.figma.com/embed?embed_host=share&url=${encoded}`;
  };

  const [iframeKey, setIframeKey] = useState(0);

  const handleExport = async () => {
    if (onExportToFigma) {
      setExportMessage(null);
      onExportToFigma(currentStep);
      // 내보내기 후 5초 뒤 iframe 새로고침 (새 페이지 반영)
      setTimeout(() => setIframeKey(k => k + 1), 5000);
    }
  };

  // SVG 다운로드 핸들러
  const handleSvgDownload = async (type: "plan" | "design-guide") => {
    setSvgDownloading(type);
    try {
      const endpoint = type === "plan"
        ? `/api/projects/${projectId}/export-svg`
        : `/api/projects/${projectId}/export-design-guide`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "다운로드 실패" }));
        setExportMessage({ text: err.error || "다운로드 실패", type: "error" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = (projectName || `project-${projectId}`).replace(/[^가-힣a-zA-Z0-9_-]/g, "_");
      a.href = url;
      a.download = type === "plan"
        ? `${safeName}_기획안.svg`
        : `${safeName}_디자인가이드.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMessage({
        text: type === "plan" ? "기획안 SVG 다운로드 완료!" : "디자인 가이드 SVG 다운로드 완료!",
        type: "success",
      });
    } catch (e) {
      setExportMessage({ text: "SVG 다운로드 중 오류가 발생했습니다.", type: "error" });
    } finally {
      setSvgDownloading(null);
    }
  };

  const stepLabels: Record<number, string> = {
    0: "시장조사 리포트",
    1: "브리프",
    5: "기획안",
    8: "촬영콘티",
    11: "디자인 가이드",
  };

  const figmaEnabledSteps = [0, 1, 5, 8, 11];
  const canExport = figmaEnabledSteps.includes(currentStep);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`} />
            <span className="text-sm font-semibold text-gray-800">Figma</span>
            <span className="text-xs text-gray-400">
              {connected ? "플러그인 연결됨" : "미연결"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* SVG 다운로드 - 기획안 */}
            <button
              onClick={() => handleSvgDownload("plan")}
              disabled={svgDownloading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="기획안을 SVG 파일로 다운로드 (Figma에서 열 수 있음)"
            >
              {svgDownloading === "plan" ? (
                <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              )}
              기획안 SVG
            </button>

            {/* SVG 다운로드 - 디자인 가이드 */}
            <button
              onClick={() => handleSvgDownload("design-guide")}
              disabled={svgDownloading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="종합 디자인 가이드를 SVG 파일로 다운로드 (기획안 + 촬영콘티 + 디자인 가이드)"
            >
              {svgDownloading === "design-guide" ? (
                <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              )}
              디자인 가이드 SVG
            </button>

            {/* Figma 플러그인 내보내기 (연결 시에만) */}
            {canExport && connected && (
              <button
                onClick={handleExport}
                disabled={figmaLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {figmaLoading ? (
                  <>
                    <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    내보내는 중...
                  </>
                ) : (
                  <>
                    🎨 플러그인 내보내기
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Export result message */}
        {exportMessage && (
          <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${
            exportMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
            {exportMessage.text}
          </div>
        )}
      </div>

      {/* Figma Embed Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {figmaUrl && !isEditing ? (
          <>
            {/* URL bar */}
            <div className="flex-shrink-0 px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
              <span className="text-xs text-gray-400 truncate flex-1">{figmaUrl}</span>
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded hover:bg-gray-200"
              >
                변경
              </button>
              <button
                onClick={() => window.open(figmaUrl, "_blank")}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50"
              >
                새 탭 ↗
              </button>
            </div>

            {/* Figma iframe */}
            <div className="flex-1 bg-white relative">
              <iframe
                key={iframeKey}
                src={getEmbedUrl(figmaUrl)}
                className="w-full h-full border-0"
                allowFullScreen
              />
              <div className="absolute bottom-2 left-2 right-2 text-center">
                <p className="text-[10px] text-gray-400">
                  임베드가 보이지 않으면: Figma 파일 → Share → &quot;Anyone with the link&quot; can view 설정 필요
                </p>
              </div>
            </div>
          </>
        ) : (
          /* URL 입력 화면 */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
                  <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
                  <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
                  <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
                  <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">Figma 파일 연결</h3>
              <p className="text-sm text-gray-500 mb-6">
                Figma 파일 URL을 입력하면 여기서 실시간으로 확인할 수 있어요
              </p>

              <div className="flex gap-2">
                <input
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://www.figma.com/design/..."
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  onKeyDown={(e) => e.key === "Enter" && saveFigmaUrl()}
                />
                <button
                  onClick={saveFigmaUrl}
                  disabled={!inputUrl.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                >
                  연결
                </button>
              </div>

              <div className="mt-8 text-left space-y-3">
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-lg mt-0.5">1️⃣</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Figma 파일 URL 입력</p>
                    <p className="text-xs text-gray-500">Figma에서 파일을 열고 URL을 복사하세요</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-lg mt-0.5">2️⃣</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">플러그인 실행</p>
                    <p className="text-xs text-gray-500">Figma에서 DIOPT AI Designer 플러그인을 실행하세요</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-lg mt-0.5">3️⃣</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">내보내기 버튼 클릭</p>
                    <p className="text-xs text-gray-500">AI가 생성한 브리프/기획안이 Figma에 자동 작성됩니다</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
