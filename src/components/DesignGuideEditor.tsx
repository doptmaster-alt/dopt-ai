"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import QCReport, { QCButton, type QCResult } from "./QCReport";

interface Props {
  projectId: number;
  currentStep: number;
  refreshKey?: number;
  projectName?: string;
}

interface DesignGuideData {
  // 디자인 가이드 메타
  toneAndManner?: {
    mainColor?: string;
    subColors?: string[];
    mood?: string;
    keywords?: string[];
  };
  typography?: {
    primaryFont?: string;
    secondaryFont?: string;
    fontSizes?: { label: string; size: string }[];
  };
  layoutGuide?: {
    maxWidth?: string;
    gridSystem?: string;
    spacing?: string;
  };
  [key: string]: any;
}

interface PlanSection {
  num: number;
  name: string;
  description?: string;
  mainCopy?: string;
  subCopy?: string;
  planningIntent?: string;
  visualDirection?: string;
  layout?: string;
  copyBlocks?: any[];
  wireframeBlocks?: any[];
  referenceImageUrl?: string;
  referenceNote?: string;
  [key: string]: any;
}

interface ContiCut {
  cutNum: number;
  conceptNum?: string;
  type?: string;
  background?: { color?: string; description?: string };
  composition?: string;
  props?: string[];
  moodLighting?: string;
  sectionMapping?: string;
  referenceNote?: string;
  note?: string;
}

/** 안전하게 문자열로 변환 (object가 React child로 직접 렌더링되는 것 방지) */
function safeStr(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return val.map(safeStr).join(", ");
  if (typeof val === "object") {
    return val.name || val.text || val.label || val.value || val.description || JSON.stringify(val);
  }
  return String(val);
}

/**
 * DesignGuideEditor — Step 8 디자인 가이드 편집기
 * 기획안 + 촬영콘티 + 디자인 메타를 하나의 뷰에서 보고 편집/SVG 내보내기
 */
export default function DesignGuideEditor({ projectId, currentStep, refreshKey, projectName }: Props) {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [contiCuts, setContiCuts] = useState<ContiCut[]>([]);
  const [cutSectionMap, setCutSectionMap] = useState<Record<number, ContiCut[]>>({});
  const [designMeta, setDesignMeta] = useState<DesignGuideData>({});
  const [brandName, setBrandName] = useState("");
  const [designTone, setDesignTone] = useState("");
  const [colorScheme, setColorScheme] = useState("");
  const [conceptSummary, setConceptSummary] = useState<any>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [svgDownloading, setSvgDownloading] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [qcResult, setQcResult] = useState<QCResult | null>(null);
  const [qcLoading, setQcLoading] = useState(false);
  const [showQc, setShowQc] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 데이터 로드
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 기획안 로드 (V2: step 3, fallback to old step 4/5)
      let planData: any = null;
      for (const step of [3, 4, 5]) {
        const res = await fetch(`/api/projects/${projectId}/step-data?step=${step}`);
        if (res.ok) {
          const json = await res.json();
          if (json.formData?.sections?.length) {
            const hasBlocks = json.formData.sections.some((s: any) => s.copyBlocks?.length > 0);
            if (!planData || hasBlocks) {
              planData = json.formData;
              if (hasBlocks) break;
            }
          }
        }
      }

      if (planData) {
        setSections(planData.sections || []);
        setBrandName(planData.brandName || planData.productName || "");
        setDesignTone(planData.designTone || "");
        setColorScheme(planData.colorScheme || "");
      }

      // 2. 촬영콘티 로드 (V2: step 4, fallback to old step 6/8)
      let contiData: any = null;
      for (const step of [4, 6, 8]) {
        const res = await fetch(`/api/projects/${projectId}/step-data?step=${step}`);
        if (res.ok) {
          const json = await res.json();
          if (json.formData?.cutPages?.length) {
            contiData = json.formData;
            break;
          }
        }
      }

      if (contiData) {
        setContiCuts(contiData.cutPages || []);
        if (contiData.conceptSummary) setConceptSummary(contiData.conceptSummary);

        // cutSectionMapping 빌드
        const mapping: Record<number, ContiCut[]> = {};
        for (const cut of (contiData.cutPages || [])) {
          const mapStr = cut.sectionMapping || "";
          // "섹션 1", "section 1" 등에서 숫자 추출
          const match = mapStr.match(/(\d+)/);
          const sectionNum = match ? parseInt(match[1]) : 0;
          if (!mapping[sectionNum]) mapping[sectionNum] = [];
          mapping[sectionNum].push(cut);
        }
        setCutSectionMap(mapping);
      }

      // 3. 디자인 가이드 메타 로드 (V2: step 6, fallback to old step 8/10)
      for (const step of [6, 8, 10]) {
        const res = await fetch(`/api/projects/${projectId}/step-data?step=${step}`);
        if (res.ok) {
          const json = await res.json();
          if (json.formData?.toneAndManner || json.formData?.typography || json.formData?.layoutGuide) {
            setDesignMeta(json.formData);
            break;
          }
        }
      }

      // 4. 생성된 이미지 로드
      try {
        const imgRes = await fetch(`/api/projects/${projectId}/images`);
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          const imgMap: Record<string, string> = {};
          for (const img of (imgData.images || [])) {
            if (img.imageData) {
              imgMap[img.imageKey] = img.imageData;
            }
          }
          setGeneratedImages(imgMap);
        }
      } catch {}

    } catch (e) {
      console.error("[DesignGuideEditor] Load error:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData, refreshKey]);

  // 디자인 메타 저장
  const saveDesignMeta = useCallback(async (data: DesignGuideData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("unsaved");
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/projects/${projectId}/step-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: 6, formData: data, status: "draft" }),
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, 1000);
  }, [projectId]);

  const updateDesignMeta = (patch: Partial<DesignGuideData>) => {
    setDesignMeta((prev) => {
      const updated = { ...prev, ...patch };
      saveDesignMeta(updated);
      return updated;
    });
  };

  // QC 체크
  const handleQC = useCallback(async () => {
    setQcLoading(true);
    setShowQc(true);
    try {
      const res = await fetch("/api/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "design-guide", projectId }),
      });
      if (res.ok) {
        setQcResult(await res.json());
      } else {
        const err = await res.json();
        alert(`QC 실패: ${err.error || "오류"}`);
        setShowQc(false);
      }
    } catch (e: any) {
      alert(`QC 오류: ${e.message}`);
      setShowQc(false);
    }
    setQcLoading(false);
  }, [projectId]);

  // SVG 다운로드
  const handleSvgDownload = async (type: "plan" | "design-guide") => {
    setSvgDownloading(type);
    setExportMessage(null);
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
      const safeName = (projectName || brandName || `project-${projectId}`).replace(/[^가-힣a-zA-Z0-9_-]/g, "_");
      a.href = url;
      a.download = type === "plan" ? `${safeName}_기획안.svg` : `${safeName}_디자인가이드.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMessage({
        text: type === "plan" ? "기획안 SVG 다운로드 완료!" : "디자인 가이드 SVG 다운로드 완료!",
        type: "success",
      });
    } catch {
      setExportMessage({ text: "SVG 다운로드 중 오류가 발생했습니다.", type: "error" });
    } finally {
      setSvgDownloading(null);
    }
  };

  const toggleSection = (num: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(sections.map((s) => s.num)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-purple-500 mx-auto mb-2" />
          <div className="text-sm">디자인 가이드 로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!sections.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">🎨</div>
          <div className="text-lg font-bold mb-2">디자인 가이드</div>
          <div className="text-sm leading-relaxed">
            기획안과 촬영콘티가 완성되면<br />
            이곳에서 디자인 가이드를 확인하고 편집할 수 있습니다.
          </div>
        </div>
      </div>
    );
  }

  const tm = designMeta.toneAndManner;
  const typo = designMeta.typography;
  const layout = designMeta.layoutGuide;
  const hasDesignMeta = tm || typo || layout;

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* ═══ Top Bar ═══ */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">
              {brandName || "프로젝트"} 디자인 가이드
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              saveStatus === "saved" ? "bg-green-100 text-green-600" :
              saveStatus === "saving" ? "bg-yellow-100 text-yellow-600" :
              "bg-red-100 text-red-600"
            }`}>
              {saveStatus === "saved" ? "저장됨" : saveStatus === "saving" ? "저장 중..." : "미저장"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* QC 체크 */}
            <QCButton onClick={handleQC} loading={qcLoading} score={qcResult?.totalScore} type="design-guide" />
            {/* 기획안 SVG */}
            <button
              onClick={() => handleSvgDownload("plan")}
              disabled={svgDownloading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {svgDownloading === "plan" ? (
                <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              )}
              기획안 SVG
            </button>
            {/* 디자인 가이드 SVG */}
            <button
              onClick={() => handleSvgDownload("design-guide")}
              disabled={svgDownloading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {svgDownloading === "design-guide" ? (
                <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              )}
              디자인 가이드 SVG
            </button>
          </div>
        </div>
        {exportMessage && (
          <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${
            exportMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
            {exportMessage.text}
          </div>
        )}
      </div>

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto">
        {/* ── 디자인 메타 정보 (Tone & Manner, Typography, Layout) ── */}
        <div className="border-b border-gray-200">
          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50">
            <h3 className="text-xs font-bold text-purple-800 mb-3">디자인 스타일 가이드</h3>
            <div className="grid grid-cols-3 gap-3">
              {/* 컬러 */}
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <div className="text-[10px] font-bold text-gray-500 mb-2">컬러 팔레트</div>
                {tm?.mainColor || colorScheme ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-gray-200"
                        style={{ backgroundColor: tm?.mainColor || colorScheme?.split(",")[0]?.trim() || "#333" }}
                      />
                      <input
                        className="text-xs text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-400 outline-none flex-1"
                        value={tm?.mainColor || colorScheme || ""}
                        onChange={(e) => updateDesignMeta({
                          toneAndManner: { ...tm, mainColor: e.target.value }
                        })}
                        placeholder="메인 컬러"
                      />
                    </div>
                    {tm?.subColors?.map((c: any, i: number) => {
                      const colorVal = typeof c === "string" ? c : (c?.hex || c?.color || c?.value || "");
                      const colorName = typeof c === "string" ? c : (c?.name || colorVal);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border border-gray-200" style={{ backgroundColor: colorVal }} />
                          <span className="text-[10px] text-gray-500">{colorName}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    className="text-xs text-gray-500 w-full border-b border-dashed border-gray-300 focus:border-purple-400 outline-none py-1"
                    placeholder="메인 컬러 입력 (예: #1E3A8A)"
                    onBlur={(e) => {
                      if (e.target.value) {
                        updateDesignMeta({ toneAndManner: { ...tm, mainColor: e.target.value } });
                      }
                    }}
                  />
                )}
              </div>

              {/* 톤앤매너 */}
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <div className="text-[10px] font-bold text-gray-500 mb-2">톤 & 매너</div>
                <input
                  className="text-xs text-gray-700 w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-400 outline-none mb-1"
                  value={tm?.mood || designTone || ""}
                  onChange={(e) => updateDesignMeta({
                    toneAndManner: { ...tm, mood: e.target.value }
                  })}
                  placeholder="무드 (예: 프로페셔널, 모던)"
                />
                {tm?.keywords?.length ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tm.keywords.map((kw: any, i: number) => (
                      <span key={i} className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                        {typeof kw === "string" ? kw : (kw?.name || kw?.keyword || JSON.stringify(kw))}
                      </span>
                    ))}
                  </div>
                ) : conceptSummary?.keywords?.length ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {conceptSummary.keywords.map((kw: any, i: number) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {typeof kw === "string" ? kw : (kw?.name || kw?.keyword || JSON.stringify(kw))}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* 타이포 & 레이아웃 */}
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <div className="text-[10px] font-bold text-gray-500 mb-2">타이포그래피</div>
                <input
                  className="text-xs text-gray-700 w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-400 outline-none mb-1"
                  value={typo?.primaryFont || ""}
                  onChange={(e) => updateDesignMeta({
                    typography: { ...typo, primaryFont: e.target.value }
                  })}
                  placeholder="주 폰트 (예: Pretendard)"
                />
                <input
                  className="text-[10px] text-gray-500 w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-400 outline-none"
                  value={typo?.secondaryFont || ""}
                  onChange={(e) => updateDesignMeta({
                    typography: { ...typo, secondaryFont: e.target.value }
                  })}
                  placeholder="보조 폰트"
                />
                {layout?.maxWidth && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    Max: {layout.maxWidth} | {layout.gridSystem || ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 컨셉 요약 (촬영콘티에서) ── */}
        {conceptSummary && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500">촬영 컨셉</span>
              {conceptSummary.concept && (
                <span className="text-xs text-gray-700">
                  {typeof conceptSummary.concept === "string" ? conceptSummary.concept : JSON.stringify(conceptSummary.concept)}
                </span>
              )}
              {conceptSummary.colors?.map((c: any, i: number) => {
                const colorVal = typeof c === "string" ? c : (c?.hex || c?.color || c?.value || "#999");
                const colorName = typeof c === "string" ? c : (c?.name || colorVal);
                return (
                  <div key={i} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: colorVal }} />
                    <span className="text-[10px] text-gray-500">{colorName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 섹션 전체 펼치기/접기 ── */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-500">
              {sections.length}개 섹션 · {contiCuts.length}개 촬영컷
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="text-[10px] text-blue-600 hover:underline">
              모두 펼치기
            </button>
            <button onClick={collapseAll} className="text-[10px] text-gray-500 hover:underline">
              모두 접기
            </button>
          </div>
        </div>

        {/* ── 섹션별 디자인 가이드 ── */}
        {sections.map((section, idx) => {
          const isExpanded = expandedSections.has(section.num);
          const sectionCuts = cutSectionMap[section.num] || [];
          const sectionImage = generatedImages[`section-${section.num}`];
          const cutImages = sectionCuts.map(c => generatedImages[`cut-${c.cutNum}`]).filter(Boolean);

          return (
            <div key={section.num} className="border-b border-gray-200">
              {/* 섹션 헤더 */}
              <button
                onClick={() => toggleSection(section.num)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
              >
                <div className="w-7 h-7 bg-gray-900 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {section.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">{section.name}</div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {section.mainCopy || section.copyBlocks?.find((b: any) => b.type === "copy-main")?.text || ""}
                    {sectionCuts.length > 0 && (
                      <span className="ml-2 text-orange-500">
                        · 촬영 {sectionCuts.length}컷
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {sectionImage && (
                    <div className="w-8 h-8 rounded border border-gray-200 overflow-hidden">
                      <img src={sectionImage} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* 펼쳐진 콘텐츠 */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-12 gap-3">
                    {/* 문구 (카피) — 4칸 */}
                    <div className="col-span-4">
                      <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wide">문구 구조</div>
                      <div className="space-y-1.5">
                        {section.copyBlocks?.length ? (
                          section.copyBlocks.map((block: any, bi: number) => (
                            <div key={bi} className={`px-2 py-1.5 rounded text-xs ${
                              block.type === "copy-main" || block.type === "section-title"
                                ? "bg-gray-900 text-white font-bold"
                                : block.type === "copy-sub"
                                ? "bg-gray-100 text-gray-700"
                                : block.type === "cta"
                                ? "bg-blue-600 text-white text-center font-bold"
                                : block.type === "bullet"
                                ? "bg-gray-50 text-gray-600 border-l-2 border-gray-300 pl-3"
                                : "bg-gray-50 text-gray-600"
                            }`}>
                              {block.type === "bullet" && "• "}{safeStr(block.text || block.label || "")}
                              {block.desc && (
                                <div className="text-[10px] text-gray-400 mt-0.5">{safeStr(block.desc)}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <>
                            {section.mainCopy && (
                              <div className="px-2 py-1.5 bg-gray-900 text-white text-xs font-bold rounded">
                                {section.mainCopy}
                              </div>
                            )}
                            {section.subCopy && (
                              <div className="px-2 py-1.5 bg-gray-100 text-gray-700 text-xs rounded">
                                {section.subCopy}
                              </div>
                            )}
                            {section.description && (
                              <div className="text-[10px] text-gray-500 px-2">{section.description}</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* 디자인 구조 (와이어프레임) — 4칸 */}
                    <div className="col-span-4">
                      <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wide">디자인 구조</div>
                      <div className="space-y-1 border border-gray-200 rounded-lg p-2 bg-gray-50 min-h-[80px]">
                        {section.wireframeBlocks?.length ? (
                          section.wireframeBlocks.map((block: any, bi: number) => (
                            <div key={bi} className={`rounded text-[10px] ${
                              block.type === "wf-heading"
                                ? "bg-gray-800 text-white px-2 py-1.5 font-bold"
                                : block.type === "wf-image" || block.type === "wf-hero"
                                ? "bg-gray-300 text-gray-600 px-2 py-3 text-center"
                                : block.type === "wf-cta"
                                ? "bg-blue-100 text-blue-700 px-2 py-1.5 text-center font-bold rounded-full mx-4"
                                : block.type === "wf-grid"
                                ? "bg-gray-200 text-gray-500 px-2 py-2"
                                : block.type === "wf-divider"
                                ? "border-t border-gray-300 my-1"
                                : "bg-white text-gray-600 px-2 py-1 border border-gray-200"
                            }`}>
                              {block.type === "wf-divider" ? null : safeStr(block.text || block.label || block.type)}
                              {block.desc && (
                                <div className="text-[9px] text-gray-400">{safeStr(block.desc)}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-[10px] text-gray-400 text-center py-4">
                            {section.layout || section.visualDirection || "와이어프레임 없음"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 촬영콘티 + AI 이미지 — 4칸 */}
                    <div className="col-span-4">
                      <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wide">
                        촬영콘티 {sectionCuts.length > 0 && `(${sectionCuts.length}컷)`}
                      </div>

                      {/* AI 디자인 이미지 */}
                      {sectionImage && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-purple-200">
                          <img src={sectionImage} alt={`섹션 ${section.num} AI 디자인`} className="w-full h-auto" />
                          <div className="text-[9px] text-purple-500 text-center py-0.5 bg-purple-50">
                            Nano Banana AI 디자인
                          </div>
                        </div>
                      )}

                      {/* 촬영컷 리스트 */}
                      {sectionCuts.length > 0 ? (
                        <div className="space-y-2">
                          {sectionCuts.map((cut) => {
                            const cutImg = generatedImages[`cut-${cut.cutNum}`];
                            return (
                              <div key={cut.cutNum} className="bg-orange-50 rounded-lg p-2 border border-orange-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold text-orange-700 bg-orange-200 px-1.5 py-0.5 rounded">
                                    CUT {cut.cutNum}
                                  </span>
                                  {cut.type && (
                                    <span className="text-[10px] text-orange-500">{cut.type}</span>
                                  )}
                                </div>
                                {cut.composition && (
                                  <div className="text-[10px] text-gray-700 mb-1">
                                    <span className="text-gray-400">구도: </span>{safeStr(cut.composition)}
                                  </div>
                                )}
                                {cut.background?.description && (
                                  <div className="text-[10px] text-gray-700 mb-1">
                                    <span className="text-gray-400">배경: </span>{safeStr(cut.background.description)}
                                    {cut.background.color && (
                                      <span className="inline-flex items-center gap-1 ml-1">
                                        <span className="w-2.5 h-2.5 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: cut.background.color }} />
                                      </span>
                                    )}
                                  </div>
                                )}
                                {cut.props?.length ? (
                                  <div className="text-[10px] text-gray-700 mb-1">
                                    <span className="text-gray-400">소품: </span>
                                    {cut.props.map((p: any) => typeof p === "string" ? p : (p?.item || p?.name || JSON.stringify(p))).join(", ")}
                                  </div>
                                ) : null}
                                {cut.moodLighting && (
                                  <div className="text-[10px] text-gray-700">
                                    <span className="text-gray-400">조명: </span>{safeStr(cut.moodLighting)}
                                  </div>
                                )}
                                {cutImg && (
                                  <div className="mt-1.5 rounded overflow-hidden border border-orange-100">
                                    <img src={cutImg} alt={`CUT ${cut.cutNum}`} className="w-full h-auto" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                          매핑된 촬영컷 없음
                        </div>
                      )}

                      {/* 레퍼런스 이미지 */}
                      {section.referenceImageUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-blue-200">
                          <img src={section.referenceImageUrl} alt="레퍼런스" className="w-full h-auto" />
                          {section.referenceNote && (
                            <div className="text-[9px] text-blue-500 px-2 py-1 bg-blue-50">{safeStr(section.referenceNote)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 섹션 메모 */}
                  {(section.planningIntent || section.aeCommentary || section.visualDirection) && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                      {section.planningIntent && (
                        <div className="bg-blue-50 rounded px-2 py-1.5 border border-blue-100">
                          <span className="text-blue-400 font-bold">기획의도: </span>
                          <span className="text-blue-700">{safeStr(section.planningIntent)}</span>
                        </div>
                      )}
                      {section.aeCommentary && (
                        <div className="bg-green-50 rounded px-2 py-1.5 border border-green-100">
                          <span className="text-green-400 font-bold">AE 코멘트: </span>
                          <span className="text-green-700">{safeStr(section.aeCommentary)}</span>
                        </div>
                      )}
                      {section.visualDirection && (
                        <div className="bg-purple-50 rounded px-2 py-1.5 border border-purple-100">
                          <span className="text-purple-400 font-bold">비주얼: </span>
                          <span className="text-purple-700">{safeStr(section.visualDirection)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── 미매핑 촬영컷 (섹션 0) ── */}
        {cutSectionMap[0]?.length ? (
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="text-[10px] font-bold text-orange-500 mb-2">미매핑 촬영컷</div>
            <div className="grid grid-cols-2 gap-2">
              {cutSectionMap[0].map((cut) => (
                <div key={cut.cutNum} className="bg-orange-50 rounded-lg p-2 border border-orange-200 text-[10px]">
                  <span className="font-bold text-orange-700">CUT {cut.cutNum}</span>
                  {cut.composition && <span className="text-gray-600 ml-1">— {cut.composition}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="px-4 py-3 text-center text-[10px] text-gray-300">
          D:OPT STUDIO &middot; 디자인 가이드 &middot; {new Date().toISOString().slice(0, 10)}
        </div>
      </div>

      {/* QC 리포트 오버레이 */}
      {showQc && (
        <div className="absolute inset-0 bg-gray-50 z-20 overflow-y-auto">
          <QCReport
            result={qcResult!}
            type="design-guide"
            loading={qcLoading}
            onClose={() => setShowQc(false)}
          />
        </div>
      )}
    </div>
  );
}
