"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { PlanData, SectionData, ReferenceImage } from "./types";
import SectionRow from "./SectionRow";
import ReferenceBoard from "./ReferenceBoard";
import PatternSelector from "./PatternSelector";
import type { DesignPattern } from "./types";
import QCReport, { QCButton, type QCResult } from "../QCReport";

export interface PendingProposal {
  sectionNum: number;
  sectionName: string;
  analysisNote: string;
  proposalSummary: string;
  layout: string;
  visualDirection: string;
  wireframeCount: number;
  copyCount: number;
  mainCopy?: string;
  subCopy?: string;
  pendingChanges: Partial<SectionData>;
}

interface Props {
  projectId: number;
  currentStep: number;
  refreshKey: number;
  onExportToFigma?: (step: number) => void;
  figmaLoading?: boolean;
  onChatMessage?: (message: string) => void;
}

export default function PlanEditor({ projectId, currentStep, refreshKey, onExportToFigma, figmaLoading, onChatMessage }: Props) {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [connected, setConnected] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [activeView, setActiveView] = useState<"plan" | "reference" | "canva">("plan");
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  // Canva AI 프리뷰
  const [canvaPreviews, setCanvaPreviews] = useState<{ sectionNum: number; sectionName: string; status: "pending" | "generating" | "done" | "error"; canvaPrompt?: string; designType?: string; error?: string; sectionData?: any; brandInfo?: any }[]>([]);
  const [canvaGenerating, setCanvaGenerating] = useState(false);
  const [patternSelector, setPatternSelector] = useState<{ sectionNum: number; sectionName: string } | null>(null);
  // 레퍼런스 적용 전 섹션 스냅샷 (되돌리기용) — sectionNum → 이전 SectionData
  const [sectionSnapshots, setSectionSnapshots] = useState<Map<number, SectionData>>(new Map());
  // QC 체크
  const [qcResult, setQcResult] = useState<QCResult | null>(null);
  const [qcLoading, setQcLoading] = useState(false);
  const [showQc, setShowQc] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<PlanData | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    console.log("[PlanEditor] loadData called, projectId:", projectId, "currentStep:", currentStep);
    try {
      const stepsToTry = [4, 5, currentStep]; // V2: step 4, fallback to old step 5
      let bestData: PlanData | null = null;
      let bestStep = -1;
      let bestHasBlocks = false;

      for (const step of stepsToTry) {
        const res = await fetch(`/api/projects/${projectId}/step-data?step=${step}`);
        if (res.ok) {
          const json = await res.json();
          if (json.formData && Object.keys(json.formData).length > 0) {
            const data: PlanData = json.formData;
            const hasBlocks = data.sections?.some((s: any) => s.copyBlocks?.length > 0 || s.wireframeBlocks?.length > 0) ?? false;
            console.log("[PlanEditor] Found data at step", step, "- sections:", data.sections?.length, "hasBlocks:", hasBlocks);

            // copyBlocks/wireframeBlocks가 있는 데이터를 우선 선택
            if (!bestData || (hasBlocks && !bestHasBlocks) || (!bestHasBlocks && !hasBlocks && (data.sections?.length || 0) > (bestData.sections?.length || 0))) {
              bestData = data;
              bestStep = step;
              bestHasBlocks = hasBlocks;
            }
          }
        }
      }

      if (bestData) {
        console.log("[PlanEditor] Using data from step", bestStep, "- sections:", bestData.sections?.length, "hasBlocks:", bestHasBlocks, "brand:", bestData.brandName || bestData.productName);
        setPlanData(bestData);
        dataRef.current = bestData;
      } else {
        setPlanData(null);
      }
      setLoading(false);
    } catch (e) {
      console.error("[PlanEditor] Load error:", e);
      setLoading(false);
    }
  }, [projectId, currentStep]);

  useEffect(() => {
    console.log("[PlanEditor] useEffect triggered, refreshKey:", refreshKey);
    loadData();
  }, [loadData, refreshKey]);

  // 플러그인 연결 상태
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/figma-plugin/status");
        if (res.ok) {
          const data = await res.json();
          setConnected(data.connected);
        }
      } catch {
        setConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // 디바운스 저장
  const debouncedSave = useCallback(async (data: PlanData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("unsaved");

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/projects/${projectId}/step-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: 5, formData: data, status: "draft" }),
        });
        setSaveStatus("saved");
      } catch (e) {
        console.error("[PlanEditor] Save error:", e);
        setSaveStatus("unsaved");
      }
    }, 800);
  }, [projectId]);

  // 카피블록 변경 → 와이어프레임 블록 자동 동기화
  const syncCopyToWireframe = useCallback((section: SectionData, newCopyBlocks: any[]): any[] => {
    const wfBlocks = [...(section.wireframeBlocks || [])];
    if (wfBlocks.length === 0) return wfBlocks;

    // 카피블록에서 텍스트 추출 (타입별 매핑)
    const copyTexts: { type: string; text: string; desc?: string }[] = [];
    for (const cb of newCopyBlocks) {
      if (cb.type === "copy-main" || cb.type === "heading" || cb.type === "section-title") {
        copyTexts.push({ type: "heading", text: cb.text || "" });
      } else if (cb.type === "copy-sub" || cb.type === "text") {
        copyTexts.push({ type: "text", text: cb.text || "", desc: cb.desc });
      }
    }

    // 와이어프레임에서 대응되는 블록 찾아서 업데이트
    let headIdx = 0;
    let textIdx = 0;
    const headings = copyTexts.filter(c => c.type === "heading");
    const texts = copyTexts.filter(c => c.type === "text");

    for (let i = 0; i < wfBlocks.length; i++) {
      const wf = wfBlocks[i];
      if (wf.type === "wf-heading" && headIdx < headings.length) {
        wfBlocks[i] = { ...wf, text: headings[headIdx].text };
        headIdx++;
      } else if (wf.type === "wf-text" && textIdx < texts.length) {
        wfBlocks[i] = { ...wf, text: texts[textIdx].text };
        if (texts[textIdx].desc) wfBlocks[i].desc = texts[textIdx].desc;
        textIdx++;
      }
    }

    return wfBlocks;
  }, []);

  // 섹션 업데이트
  const handleSectionUpdate = useCallback((index: number, patch: Partial<SectionData>) => {
    setPlanData((prev) => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      let finalPatch = { ...patch };

      // 카피블록이 변경되었으면 와이어프레임도 동기화
      if (patch.copyBlocks) {
        const currentSection = sections[index];
        const syncedWf = syncCopyToWireframe(currentSection, patch.copyBlocks);
        if (syncedWf.length > 0) {
          finalPatch.wireframeBlocks = syncedWf;
        }
      }

      sections[index] = { ...sections[index], ...finalPatch };
      const updated = { ...prev, sections };
      dataRef.current = updated;
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave, syncCopyToWireframe]);

  // 레퍼런스 이미지 업데이트
  const handleReferenceChange = useCallback((refImages: ReferenceImage[]) => {
    setPlanData((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, referenceImages: refImages };
      dataRef.current = updated;
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  // 레퍼런스 분석 결과 → 적용 대기 (ReferenceBoard에서 호출)
  const handleProposalReady = useCallback((proposal: PendingProposal) => {
    setPendingProposal(proposal);
    setAnalyzing(false);
  }, []);

  // 분석 시작 알림
  const handleAnalyzeStart = useCallback(() => {
    setAnalyzing(true);
  }, []);

  // 적용 확정 — 적용 전 스냅샷 저장
  const handleConfirmApply = useCallback(() => {
    if (!pendingProposal || !planData) return;

    const sectionIndex = planData.sections.findIndex((s) => s.num === pendingProposal.sectionNum);
    if (sectionIndex === -1) return;

    // 스냅샷 저장 (현재 상태를 복사해둠)
    const currentSection = planData.sections[sectionIndex];
    setSectionSnapshots(prev => {
      const next = new Map(prev);
      next.set(pendingProposal.sectionNum, JSON.parse(JSON.stringify(currentSection)));
      return next;
    });

    handleSectionUpdate(sectionIndex, pendingProposal.pendingChanges);
    onChatMessage?.(`✨ **섹션 ${pendingProposal.sectionNum}. ${pendingProposal.sectionName}**에 레퍼런스 디자인 구조가 적용되었습니다! 기획안 탭에서 확인하세요.\n\n↩️ 되돌리려면 레퍼런스 탭에서 해당 섹션의 [되돌리기] 버튼을 누르세요.`);
    setPendingProposal(null);
    setActiveView("plan");
  }, [pendingProposal, planData, handleSectionUpdate, onChatMessage]);

  // 적용 취소
  const handleCancelApply = useCallback(() => {
    setPendingProposal(null);
  }, []);

  // 섹션별 되돌리기 — 스냅샷에서 복원
  const handleRevertSection = useCallback((sectionNum: number) => {
    if (!planData) return;
    const snapshot = sectionSnapshots.get(sectionNum);
    if (!snapshot) return;

    const sectionIndex = planData.sections.findIndex((s) => s.num === sectionNum);
    if (sectionIndex === -1) return;

    const sectionName = planData.sections[sectionIndex].name;
    handleSectionUpdate(sectionIndex, snapshot);
    onChatMessage?.(`↩️ **섹션 ${sectionNum}. ${sectionName}**이 레퍼런스 적용 전 상태로 되돌려졌습니다.`);

    // 스냅샷 제거
    setSectionSnapshots(prev => {
      const next = new Map(prev);
      next.delete(sectionNum);
      return next;
    });
  }, [planData, sectionSnapshots, handleSectionUpdate, onChatMessage]);

  // 레퍼런스 제거 + 되돌리기
  const handleRemoveReferenceAndRevert = useCallback((sectionNum: number, alsoRevert: boolean) => {
    if (!planData) return;
    const sectionIndex = planData.sections.findIndex((s) => s.num === sectionNum);
    if (sectionIndex === -1) return;

    const sectionName = planData.sections[sectionIndex].name;

    if (alsoRevert) {
      const snapshot = sectionSnapshots.get(sectionNum);
      if (snapshot) {
        // 스냅샷 복원 (referenceImageUrl, referenceNote도 스냅샷의 원래 값으로 돌아감)
        handleSectionUpdate(sectionIndex, snapshot);
        setSectionSnapshots(prev => {
          const next = new Map(prev);
          next.delete(sectionNum);
          return next;
        });
        onChatMessage?.(`↩️ **섹션 ${sectionNum}. ${sectionName}** 레퍼런스 제거 + 이전 상태로 되돌려졌습니다.`);
      } else {
        // 스냅샷이 없으면 레퍼런스 메타만 제거
        handleSectionUpdate(sectionIndex, { referenceImageUrl: undefined, referenceNote: undefined });
        onChatMessage?.(`🗑️ **섹션 ${sectionNum}. ${sectionName}** 레퍼런스가 제거되었습니다. (이전 스냅샷이 없어 디자인 구조는 유지됩니다)`);
      }
    } else {
      // 디자인 유지, 레퍼런스 표시만 제거
      handleSectionUpdate(sectionIndex, { referenceImageUrl: undefined, referenceNote: undefined });
      onChatMessage?.(`🗑️ **섹션 ${sectionNum}. ${sectionName}** 레퍼런스 표시가 제거되었습니다. (적용된 디자인 구조는 유지)`);
    }

    // 해당 섹션의 레퍼런스 이미지도 삭제
    if (planData.referenceImages) {
      const filtered = planData.referenceImages.filter(img => img.sectionNum !== sectionNum);
      handleReferenceChange(filtered);
    }
  }, [planData, sectionSnapshots, handleSectionUpdate, handleReferenceChange, onChatMessage]);

  // 패턴 선택 → 적용
  const handleOpenPatternSelector = useCallback((sectionNum: number, sectionName: string) => {
    setPatternSelector({ sectionNum, sectionName });
  }, []);

  const handleApplyPattern = useCallback((pattern: DesignPattern, sectionNum: number) => {
    if (!planData) return;
    const sectionIndex = planData.sections.findIndex((s) => s.num === sectionNum);
    if (sectionIndex === -1) return;

    // 스냅샷 저장
    const currentSection = planData.sections[sectionIndex];
    setSectionSnapshots(prev => {
      const next = new Map(prev);
      next.set(sectionNum, JSON.parse(JSON.stringify(currentSection)));
      return next;
    });

    // 패턴의 wireframeBlocks와 copyBlocks 적용
    const patch: Partial<SectionData> = {
      wireframeBlocks: pattern.wireframe_blocks,
      copyBlocks: pattern.copy_blocks,
      layout: pattern.pattern_name,
      referenceNote: `디자인 패턴: ${pattern.pattern_name} (${pattern.description})`,
    };
    handleSectionUpdate(sectionIndex, patch);
    onChatMessage?.(`🎨 **섹션 ${sectionNum}. ${currentSection.name}**에 디자인 패턴 "${pattern.pattern_name}"이 적용되었습니다!\n\n↩️ 되돌리려면 레퍼런스 탭에서 해당 섹션의 [되돌리기] 버튼을 누르세요.`);
    setPatternSelector(null);
  }, [planData, handleSectionUpdate, onChatMessage]);

  // Nano Banana 2 프롬프트 생성 — 첫 3섹션 (항상 최신 planData 사용)
  const handleCanvaPreview = useCallback(async () => {
    // 먼저 DB에서 최신 데이터를 새로 로드
    let currentData = dataRef.current || planData;
    try {
      const freshRes = await fetch(`/api/projects/${projectId}/step-data?step=4`);
      if (freshRes.ok) {
        const freshJson = await freshRes.json();
        if (freshJson.formData?.sections?.length > 0) {
          currentData = freshJson.formData;
          setPlanData(currentData);
          dataRef.current = currentData;
          console.log("[NanoBanana] Loaded fresh plan data:", currentData?.sections?.length, "sections");
        }
      }
    } catch (e) {
      console.warn("[NanoBanana] Failed to load fresh data, using cached:", e);
    }
    if (!currentData?.sections?.length) return;
    const sectionsToPreview = currentData.sections.slice(0, 3);
    const brand = currentData.brandName || currentData.productName || "브랜드";

    setCanvaGenerating(true);
    setCanvaPreviews([]);
    setActiveView("canva");

    const results: typeof canvaPreviews = [];
    const batchSectionNames = sectionsToPreview.map(s => s.name);

    for (let idx = 0; idx < sectionsToPreview.length; idx++) {
      const section = sectionsToPreview[idx];

      // copyBlocks에서 mainCopy/subCopy 자동 추출 (기획자 편집 반영)
      let mainCopy = section.mainCopy || "";
      let subCopy = section.subCopy || "";
      if (section.copyBlocks?.length) {
        const mainBlock = section.copyBlocks.find((b: any) => b.type === "copy-main" || b.type === "section-title");
        const subBlock = section.copyBlocks.find((b: any) => b.type === "copy-sub");
        if (mainBlock?.text) mainCopy = mainBlock.text;
        if (subBlock?.text) subCopy = subBlock.text;
      }

      try {
        const res = await fetch("/api/canva-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandName: brand,
            productName: currentData.productName || "",
            designTone: currentData.designTone || "",
            colorScheme: currentData.colorScheme || "",
            overallNote: currentData.overallNote || "",
            totalSections: currentData.sections.length,
            batchIndex: idx,
            batchSections: batchSectionNames,
            section: {
              num: section.num,
              name: section.name,
              mainCopy,
              subCopy,
              description: section.description,
              planningIntent: section.planningIntent,
              aeCommentary: section.aeCommentary,
              visualDirection: section.visualDirection,
              layout: section.layout,
              referenceImageUrl: section.referenceImageUrl,
              referenceNote: section.referenceNote,
              wireframeBlocks: section.wireframeBlocks,
              copyBlocks: section.copyBlocks,
            },
          }),
        });

        if (res.ok) {
          const result = await res.json();
          results.push({
            sectionNum: section.num,
            sectionName: section.name,
            status: "done",
            canvaPrompt: result.canvaPrompt,
            designType: result.designType,
            // 원본 섹션 데이터를 함께 저장 (nano-banana에 직접 전달용)
            sectionData: {
              num: section.num,
              name: section.name,
              mainCopy,
              subCopy,
              description: section.description,
              planningIntent: section.planningIntent,
              visualDirection: section.visualDirection,
              layout: section.layout,
              wireframeBlocks: section.wireframeBlocks,
              copyBlocks: section.copyBlocks,
            },
            brandInfo: {
              brandName: brand,
              productName: currentData.productName || "",
              designTone: currentData.designTone || "",
              colorScheme: currentData.colorScheme || "",
            },
          });
        } else {
          results.push({
            sectionNum: section.num,
            sectionName: section.name,
            status: "error",
            error: "프롬프트 생성 실패",
          });
        }
      } catch (e: any) {
        results.push({
          sectionNum: section.num,
          sectionName: section.name,
          status: "error",
          error: e.message,
        });
      }
    }

    setCanvaPreviews(results);
    setCanvaGenerating(false);
  }, [planData]);

  // QC 체크
  const handleQC = useCallback(async () => {
    setQcLoading(true);
    setShowQc(true);
    setActiveView("plan");
    try {
      const res = await fetch("/api/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "plan", projectId }),
      });
      if (res.ok) {
        const data = await res.json();
        setQcResult(data);
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

  // Figma 내보내기
  const handleExport = async () => {
    if (onExportToFigma) {
      onExportToFigma(5);
    }
  };

  const hasAnyReference = planData?.sections?.some((s) => s.referenceImageUrl) || false;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500 mx-auto mb-2" />
          <div className="text-sm">기획안 로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!planData || !planData.sections?.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">&#128196;</div>
          <div className="text-lg font-bold mb-2">기획안 미리보기</div>
          <div className="text-sm leading-relaxed">
            AI와 대화하여 기획안을 생성하면<br />
            이곳에서 실시간으로 확인하고 편집할 수 있습니다.
          </div>
          <div className="text-xs text-gray-300 mt-3">
            STEP 5에서 기획안이 생성되면 자동으로 표시됩니다
          </div>
        </div>
      </div>
    );
  }

  const brandName = planData.brandName || planData.productName || "브랜드";

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Top Tabs: 기획안 / 레퍼런스 / Nano Banana 2 */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => setActiveView("plan")}
          className={`flex-1 py-2 text-sm font-semibold transition ${
            activeView === "plan"
              ? "text-gray-900 border-b-2 border-gray-900 bg-white"
              : "text-gray-400 hover:text-gray-600 bg-gray-50"
          }`}
        >
          기획안
        </button>
        <button
          onClick={() => setActiveView("reference")}
          className={`flex-1 py-2 text-sm font-semibold transition relative ${
            activeView === "reference"
              ? "text-gray-900 border-b-2 border-gray-900 bg-white"
              : "text-gray-400 hover:text-gray-600 bg-gray-50"
          }`}
        >
          레퍼런스
          {(planData.referenceImages?.length || 0) > 0 && (
            <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
              {planData.referenceImages!.length}
            </span>
          )}
          {pendingProposal && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveView("canva")}
          className={`flex-1 py-2 text-sm font-semibold transition relative ${
            activeView === "canva"
              ? "text-yellow-700 border-b-2 border-yellow-500 bg-white"
              : "text-gray-400 hover:text-gray-600 bg-gray-50"
          }`}
        >
          Nano Banana 2
          {canvaPreviews.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
              {canvaPreviews.filter(p => p.status === "done").length}/{canvaPreviews.length}
            </span>
          )}
          {canvaGenerating && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse" />
          )}
        </button>
      </div>

      {/* 분석 중 상태 바 */}
      {analyzing && (
        <div className="bg-purple-50 border-b border-purple-200 px-3 py-2 flex items-center gap-2 shrink-0">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-purple-700">AI가 레퍼런스 디자인을 분석하고 기획안에 맞게 적용 방안을 만들고 있습니다...</span>
        </div>
      )}

      {activeView === "reference" ? (
        /* Reference Board View */
        <ReferenceBoard
          sections={planData.sections}
          images={planData.referenceImages || []}
          onImagesChange={handleReferenceChange}
          onSectionUpdate={handleSectionUpdate}
          onChatMessage={onChatMessage}
          onProposalReady={handleProposalReady}
          onAnalyzeStart={handleAnalyzeStart}
          pendingProposal={pendingProposal}
          sectionSnapshots={sectionSnapshots}
          onRevertSection={handleRevertSection}
          onRemoveReferenceAndRevert={handleRemoveReferenceAndRevert}
        />
      ) : activeView === "canva" ? (
        /* Nano Banana 2 AI 디자인 */
        <div className="flex-1 overflow-y-auto">
          {/* 헤더 */}
          <div className="px-4 py-3 bg-gradient-to-r from-yellow-50 to-orange-50 border-b flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-yellow-800">Nano Banana 2</h3>
              <p className="text-[10px] text-yellow-600">AI가 섹션별 디자인 레퍼런스 이미지를 자동 생성합니다</p>
            </div>
            <button
              onClick={handleCanvaPreview}
              disabled={canvaGenerating}
              className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-yellow-900 text-xs font-semibold rounded-lg hover:bg-yellow-600 transition disabled:opacity-50 shadow-sm"
            >
              {canvaGenerating ? (
                <><span className="animate-spin w-3.5 h-3.5 border-2 border-yellow-900 border-t-transparent rounded-full" />생성 중...</>
              ) : (
                <>{canvaPreviews.length > 0 ? "프롬프트 다시 생성" : "프롬프트 + 이미지 생성"}</>
              )}
            </button>
          </div>

          {canvaPreviews.length === 0 ? (
            /* 빈 상태 */
            <div className="flex-1 flex items-center justify-center p-10">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg">
                  🍌
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Nano Banana 2 AI 디자인</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  기획안의 문구 + 디자인 구조 + 톤앤매너를 기반으로<br />
                  AI가 디자인 레퍼런스 이미지를 자동 생성합니다
                </p>
                <div className="space-y-2 text-left mb-6">
                  {[
                    "섹션별 카피/와이어프레임 자동 반영",
                    "AI가 디자인 레퍼런스 이미지 즉시 생성",
                    "수정 요청 → 피드백 반영 재생성",
                    "마음에 들면 컨펌으로 확정"
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-5 h-5 bg-yellow-100 text-yellow-700 rounded flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                      {t}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleCanvaPreview}
                  disabled={canvaGenerating || !planData?.sections?.length}
                  className="px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-900 text-sm font-semibold rounded-xl hover:from-yellow-500 hover:to-orange-600 transition disabled:opacity-50 shadow-md"
                >
                  첫 3섹션 디자인 생성
                </button>
              </div>
            </div>
          ) : (
            /* 프롬프트 결과 */
            <div className="p-4 space-y-4">
              {canvaPreviews.map((preview, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* 섹션 헤더 */}
                  <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold">섹션 {preview.sectionNum}. {preview.sectionName}</span>
                    {preview.status === "done" && (
                      <span className="text-[10px] text-green-400">준비 완료</span>
                    )}
                    {preview.status === "error" && (
                      <span className="text-[10px] text-red-400">오류</span>
                    )}
                  </div>

                  <div className="p-4">
                    {preview.status === "error" && (
                      <div className="bg-red-50 rounded-xl p-4 text-center">
                        <p className="text-sm text-red-600 font-medium mb-1">프롬프트 생성 실패</p>
                        <p className="text-xs text-red-400">{preview.error}</p>
                      </div>
                    )}

                    {preview.status === "done" && preview.canvaPrompt && (
                      <CanvaPromptCard
                        sectionNum={preview.sectionNum}
                        sectionName={preview.sectionName}
                        prompt={preview.canvaPrompt}
                        designType={preview.designType || "infographic"}
                        projectId={projectId}
                        sectionData={preview.sectionData}
                        brandInfo={preview.brandInfo}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Plan View */
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">{brandName} 기획안</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                saveStatus === "saved" ? "bg-green-100 text-green-600" :
                saveStatus === "saving" ? "bg-yellow-100 text-yellow-600" :
                "bg-red-100 text-red-600"
              }`}>
                {saveStatus === "saved" ? "저장됨" : saveStatus === "saving" ? "저장 중..." : "미저장"}
              </span>
              {planData.designTone && (
                <span className="text-[10px] text-gray-400">{planData.designTone}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* QC 체크 */}
              <QCButton onClick={handleQC} loading={qcLoading} score={qcResult?.totalScore} type="plan" />
              {/* Zoom */}
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="px-1 hover:text-gray-600">-</button>
                <span>{zoom}%</span>
                <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="px-1 hover:text-gray-600">+</button>
              </div>
              {/* SVG 내보내기 (Figma Import용) */}
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/projects/${projectId}/export-svg?step=4`);
                    if (res.ok) {
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `기획안_${projectId}.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } else {
                      alert('SVG 내보내기 실패');
                    }
                  } catch (e) {
                    alert('SVG 내보내기 오류');
                  }
                }}
                className="text-xs px-3 py-1 rounded flex items-center gap-1 bg-purple-600 text-white hover:bg-purple-700"
              >
                <span>📐</span>
                Figma 내보내기
              </button>
              {/* Figma Plugin 직접 연결 */}
              {connected && (
                <button
                  onClick={handleExport}
                  disabled={figmaLoading}
                  className="text-xs px-3 py-1 rounded flex items-center gap-1 bg-black text-white hover:bg-gray-800"
                >
                  {figmaLoading ? (
                    <span className="animate-spin">&#9696;</span>
                  ) : (
                    <span>&#127912;</span>
                  )}
                  플러그인
                </button>
              )}
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`} title={connected ? "Figma 플러그인 연결됨" : "플러그인 미연결 (SVG로 내보내기 가능)"} />
            </div>
          </div>

          {/* Column headers */}
          <div className="flex border-b text-[10px] font-bold text-gray-500 bg-gray-100 shrink-0" style={{ borderColor: "#CCCCCC" }}>
            <div className="px-3 py-1" style={{ width: hasAnyReference ? "28%" : "40%" }}>문구</div>
            <div className="px-3 py-1 border-l" style={{ width: hasAnyReference ? "42%" : "60%", borderColor: "#CCCCCC" }}>디자인 구조</div>
            {hasAnyReference && (
              <div className="px-3 py-1 border-l" style={{ width: "30%", borderColor: "#CCCCCC" }}>레퍼런스 디자인</div>
            )}
          </div>

          {/* Sections */}
          <div className="flex-1 overflow-y-auto" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
            {planData.overallNote && (
              <div className="px-3 py-2 text-xs text-gray-600 bg-gray-50 border-b" style={{ borderColor: "#CCCCCC" }}>
                {planData.overallNote}
              </div>
            )}
            {planData.sections.map((section, i) => (
              <SectionRow
                key={`section-${i}`}
                section={section}
                index={i}
                hasAnyReference={hasAnyReference}
                brandName={brandName}
                onUpdate={handleSectionUpdate}
                onOpenPatternSelector={handleOpenPatternSelector}
              />
            ))}
            {/* Footer */}
            <div className="px-3 py-2 text-center text-[10px] text-gray-300 border-t" style={{ borderColor: "#CCCCCC" }}>
              D:OPT STUDIO &middot; {new Date().toISOString().slice(0, 10)}
            </div>
          </div>
        </>
      )}

      {/* QC 리포트 오버레이 */}
      {showQc && (
        <div className="absolute inset-0 bg-gray-50 z-20 overflow-y-auto">
          <QCReport
            result={qcResult!}
            type="plan"
            loading={qcLoading}
            onClose={() => setShowQc(false)}
          />
        </div>
      )}

      {/* 패턴 선택 모달 */}
      {patternSelector && (
        <PatternSelector
          sectionNum={patternSelector.sectionNum}
          sectionName={patternSelector.sectionName}
          industry={planData?.productName}
          onApplyPattern={handleApplyPattern}
          onClose={() => setPatternSelector(null)}
        />
      )}

      {/* 하단 고정 적용 확인 바 — 어떤 탭에서든 보임 */}
      {pendingProposal && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-0 z-10">
          <div className="mx-2 mb-2 bg-blue-50 border-2 border-blue-300 rounded-xl p-3 shadow-lg">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-lg shrink-0">📐</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-blue-900 mb-0.5">
                  섹션 {pendingProposal.sectionNum}. {pendingProposal.sectionName} — 레퍼런스 적용 대기
                </div>
                <div className="text-[11px] text-blue-800 leading-relaxed">
                  {pendingProposal.proposalSummary}
                </div>
              </div>
            </div>

            {/* 적용될 핵심 변경사항 */}
            <div className="grid grid-cols-2 gap-1.5 mb-2 text-[10px]">
              <div className="bg-white rounded px-2 py-1 border border-blue-100">
                <span className="text-blue-500">레이아웃: </span>
                <span className="text-gray-700">{pendingProposal.layout}</span>
              </div>
              <div className="bg-white rounded px-2 py-1 border border-blue-100">
                <span className="text-blue-500">블록: </span>
                <span className="text-gray-700">와이어프레임 {pendingProposal.wireframeCount}개 + 카피 {pendingProposal.copyCount}개</span>
              </div>
            </div>
            {(pendingProposal.mainCopy || pendingProposal.subCopy) && (
              <div className="bg-white rounded px-2 py-1.5 border border-blue-100 mb-2 text-[10px]">
                {pendingProposal.mainCopy && (
                  <div className="text-gray-900 font-bold">{pendingProposal.mainCopy}</div>
                )}
                {pendingProposal.subCopy && (
                  <div className="text-gray-600 mt-0.5">{pendingProposal.subCopy}</div>
                )}
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleConfirmApply}
                className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                적용하기
              </button>
              <button
                onClick={handleCancelApply}
                className="px-5 py-2.5 bg-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-300 transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Nano Banana 2 Card ============ */

function CanvaPromptCard({ sectionNum, sectionName, prompt, designType, projectId, sectionData, brandInfo }: {
  sectionNum: number;
  sectionName: string;
  prompt: string;
  designType: string;
  projectId: number;
  sectionData?: any;
  brandInfo?: any;
}) {
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const imageKey = `section-${sectionNum}`;

  // 이미지 저장/로드 상태
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [imageStatus, setImageStatus] = React.useState<"none" | "generated" | "confirmed">("none");
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = React.useState<string>("");
  const [feedbackHistory, setFeedbackHistory] = React.useState<{ feedback: string; timestamp: string }[]>([]);
  const [feedbackInput, setFeedbackInput] = React.useState("");
  const [showFeedback, setShowFeedback] = React.useState(false);

  // 저장된 이미지 로드
  React.useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/images?key=${imageKey}`)
      .then(r => r.json())
      .then(data => {
        if (data.image) {
          setPreviewImage(data.image.imageData);
          setCurrentPrompt(data.image.prompt || "");
          setImageStatus(data.image.status === "confirmed" ? "confirmed" : "generated");
          setFeedbackHistory(data.image.feedbackHistory || []);
        }
      })
      .catch(() => {});
  }, [projectId, imageKey]);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 나노바나나 이미지 생성
  const handlePreviewGenerate = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/nano-banana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionData: sectionData || null,
          brandInfo: brandInfo || null,
          directPrompt: sectionData ? undefined : prompt,
          sectionNum,
        }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setPreviewImage(data.imageUrl);
        setCurrentPrompt(data.prompt || "");
        setImageStatus("generated");
        // 서버에 저장
        await fetch(`/api/projects/${projectId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageKey, imageData: data.imageUrl, prompt: data.prompt || "", feedbackHistory: [], status: "generated" }),
        });
      } else {
        setPreviewError(data.error || "미리보기 생성 실패");
      }
    } catch (e: any) {
      setPreviewError(e.message || "네트워크 오류");
    } finally {
      setPreviewLoading(false);
    }
  };

  // 피드백 반영 재생성
  const handleRevision = async () => {
    if (!feedbackInput.trim() || !currentPrompt) return;
    setPreviewLoading(true);
    setPreviewError(null);
    const newFeedback = { feedback: feedbackInput.trim(), timestamp: new Date().toISOString() };
    try {
      const res = await fetch("/api/nano-banana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedbackInput.trim(), previousPrompt: currentPrompt, sectionNum }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        const updatedHistory = [...feedbackHistory, newFeedback];
        setPreviewImage(data.imageUrl);
        setCurrentPrompt(data.prompt || "");
        setImageStatus("generated");
        setFeedbackHistory(updatedHistory);
        setFeedbackInput("");
        setShowFeedback(false);
        await fetch(`/api/projects/${projectId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageKey, imageData: data.imageUrl, prompt: data.prompt || "", feedbackHistory: updatedHistory, status: "generated" }),
        });
      } else {
        setPreviewError(data.error || "재생성 실패");
      }
    } catch (e: any) {
      setPreviewError(e.message || "네트워크 오류");
    } finally {
      setPreviewLoading(false);
    }
  };

  // 컨펌
  const handleConfirm = async () => {
    setImageStatus("confirmed");
    await fetch(`/api/projects/${projectId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", imageKey }),
    });
  };

  const handleUnconfirm = async () => {
    setImageStatus("generated");
    await fetch(`/api/projects/${projectId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageKey, imageData: previewImage, prompt: currentPrompt, feedbackHistory, status: "generated" }),
    });
  };

  return (
    <div className="space-y-3">
      {/* 프롬프트 미리보기 */}
      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-semibold text-yellow-700">디자인 프롬프트</span>
          <span className="text-[10px] text-yellow-500 bg-yellow-100 px-2 py-0.5 rounded-full">{designType}</span>
        </div>
        <p className="text-xs text-yellow-700 leading-relaxed line-clamp-3">{prompt.slice(0, 200)}...</p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition"
        >
          {copied ? "복사됨!" : "프롬프트 복사"}
        </button>
        <button
          onClick={handlePreviewGenerate}
          disabled={previewLoading}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition ${
            previewLoading ? "bg-yellow-100 text-yellow-500 cursor-wait" : "bg-yellow-500 text-yellow-900 hover:bg-yellow-600"
          }`}
        >
          {previewLoading ? (
            <><span className="animate-spin w-3 h-3 border-2 border-yellow-900 border-t-transparent rounded-full" />AI 이미지 생성 중...</>
          ) : previewImage ? "AI 이미지 다시 생성" : "AI 이미지 생성"}
        </button>
      </div>

      {/* AI 디자인 미리보기 */}
      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-yellow-600 font-semibold">AI 디자인 미리보기</span>
          {!previewImage && (
            <button
              onClick={handlePreviewGenerate}
              disabled={previewLoading}
              className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${
                previewLoading ? "bg-yellow-100 text-yellow-500 cursor-wait" : "bg-yellow-400 text-yellow-900 hover:bg-yellow-500 active:scale-95"
              }`}
            >
              {previewLoading ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  생성 중...
                </span>
              ) : "미리보기 생성"}
            </button>
          )}
        </div>

        {previewImage && (
          <div className={`rounded-lg overflow-hidden border ${imageStatus === "confirmed" ? "border-green-300" : "border-yellow-200"}`}>
            <img
              src={previewImage}
              alt={`섹션 ${sectionNum} AI 미리보기`}
              className="w-full h-auto"
            />

            {/* Action Buttons */}
            <div className="px-3 py-2 bg-gray-50 space-y-2">
              {imageStatus === "confirmed" ? (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    컨펌 완료
                  </span>
                  <button onClick={handleUnconfirm} className="text-[10px] text-gray-400 hover:text-gray-600 underline">
                    컨펌 해제
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirm}
                      className="flex-1 text-[11px] px-3 py-1.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition active:scale-95"
                    >
                      컨펌
                    </button>
                    <button
                      onClick={() => setShowFeedback(!showFeedback)}
                      className="flex-1 text-[11px] px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition active:scale-95"
                    >
                      수정 요청
                    </button>
                    <button
                      onClick={handlePreviewGenerate}
                      disabled={previewLoading}
                      className="text-[11px] px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50"
                    >
                      {previewLoading ? "..." : "새로 생성"}
                    </button>
                  </div>

                  {/* Feedback Input */}
                  {showFeedback && (
                    <div className="space-y-2">
                      <textarea
                        value={feedbackInput}
                        onChange={(e) => setFeedbackInput(e.target.value)}
                        placeholder="수정사항을 입력하세요 (예: 컬러를 좀 더 따뜻하게, 레이아웃을 세로형으로 변경, 텍스트 영역을 더 크게...)"
                        className="w-full text-xs border border-blue-200 rounded-lg p-2 h-16 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      />
                      <button
                        onClick={handleRevision}
                        disabled={previewLoading || !feedbackInput.trim()}
                        className={`w-full text-[11px] px-3 py-2 rounded-lg font-medium transition ${
                          previewLoading || !feedbackInput.trim()
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98]"
                        }`}
                      >
                        {previewLoading ? (
                          <span className="flex items-center justify-center gap-1">
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            수정사항 반영 중...
                          </span>
                        ) : "수정사항 반영하여 재생성"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Feedback History */}
              {feedbackHistory.length > 0 && (
                <details className="group">
                  <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                    수정 이력 ({feedbackHistory.length}회)
                  </summary>
                  <div className="mt-1 space-y-1">
                    {feedbackHistory.map((fb, i) => (
                      <div key={i} className="text-[10px] bg-blue-50 rounded px-2 py-1 border border-blue-100">
                        <span className="text-blue-400 font-mono">{i + 1}차</span>{" "}
                        <span className="text-blue-700">{fb.feedback}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="text-[9px] text-gray-400 text-center">
                Nano Banana 2 AI — 프롬프트 수정 요청으로 퀄리티를 높여보세요
              </div>
            </div>
          </div>
        )}

        {previewError && (
          <div className="bg-red-50 text-red-600 text-[10px] px-2 py-1.5 rounded-lg border border-red-100">
            {previewError}
          </div>
        )}
      </div>

      {/* 프롬프트 전체 보기 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-[10px] text-gray-400 hover:text-gray-600 text-center py-1"
      >
        {expanded ? "프롬프트 접기" : "프롬프트 전체 보기"}
      </button>

      {expanded && (
        <div className="bg-gray-900 rounded-lg p-4 text-xs text-green-300 font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
          {prompt}
        </div>
      )}
    </div>
  );
}

