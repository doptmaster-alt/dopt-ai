"use client";

import React, { useState, useCallback, useRef } from "react";
import type { ReferenceImage, SectionData } from "./types";
import type { PendingProposal } from "./PlanEditor";

interface AnalysisStatus {
  sectionNum: number;
  status: "analyzing" | "done" | "error";
  error?: string;
}

interface Props {
  sections: SectionData[];
  images: ReferenceImage[];
  onImagesChange: (images: ReferenceImage[]) => void;
  onSectionUpdate: (index: number, patch: Partial<SectionData>) => void;
  onChatMessage?: (message: string) => void;
  onProposalReady?: (proposal: PendingProposal) => void;
  onAnalyzeStart?: () => void;
  pendingProposal?: PendingProposal | null;
  sectionSnapshots?: Map<number, SectionData>;
  onRevertSection?: (sectionNum: number) => void;
  onRemoveReferenceAndRevert?: (sectionNum: number, alsoRevert: boolean) => void;
}

export default function ReferenceBoard({
  sections, images, onImagesChange, onSectionUpdate,
  onChatMessage, onProposalReady, onAnalyzeStart, pendingProposal,
  sectionSnapshots, onRevertSection, onRemoveReferenceAndRevert,
}: Props) {
  const [activeTab, setActiveTab] = useState<"design" | "photo">("design");
  const [uploading, setUploading] = useState<number | null>(null);
  const [analysisStatuses, setAnalysisStatuses] = useState<Map<number, AnalysisStatus>>(new Map());
  const [dragOverSection, setDragOverSection] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set(sections.map((_, i) => i)));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ sectionNum: number; tab: "design" | "photo" } | null>(null);

  const getSectionImages = (sectionNum: number, tab: "design" | "photo") =>
    images.filter((img) => img.sectionNum === sectionNum && img.tab === tab);

  const uploadFiles = useCallback(async (files: FileList | File[], sectionNum: number, tab: "design" | "photo") => {
    setUploading(sectionNum);
    const newImages: ReferenceImage[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data.file?.fileUrl) {
            newImages.push({
              id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              url: data.file.fileUrl,
              tab,
              sectionNum,
            });
          }
        }
      } catch (e) {
        console.error("Upload failed:", e);
      }
    }

    if (newImages.length > 0) {
      const updated = [...images, ...newImages];
      onImagesChange(updated);

      // 디자인 레퍼런스면 자동 분석 시작
      if (tab === "design") {
        for (const img of newImages) {
          await analyzeReference(img, sectionNum);
        }
      }
    }
    setUploading(null);
  }, [images, onImagesChange]);

  // 레퍼런스 분석 → 적용 제안 생성
  const analyzeReference = useCallback(async (img: ReferenceImage, sectionNum: number) => {
    const sectionIndex = sections.findIndex((s) => s.num === sectionNum);
    if (sectionIndex === -1) return;

    const section = sections[sectionIndex];

    // 분석 시작
    setAnalysisStatuses(prev => {
      const next = new Map(prev);
      next.set(sectionNum, { sectionNum, status: "analyzing" });
      return next;
    });
    onAnalyzeStart?.();

    onChatMessage?.(`🔍 **섹션 ${sectionNum}. ${section.name}**에 디자인 레퍼런스가 업로드되었습니다.\nAI가 구조를 분석하고 우리 기획안에 맞게 적용 방안을 만들고 있습니다...`);

    try {
      const res = await fetch("/api/analyze-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: img.url,
          sectionName: section.name,
          sectionNum: section.num,
          sectionData: {
            mainCopy: section.mainCopy,
            subCopy: section.subCopy,
            visualDirection: section.visualDirection,
            layout: section.layout,
            aeCommentary: section.aeCommentary,
            planningIntent: section.planningIntent,
            productName: section.productName,
            copyBlocks: section.copyBlocks,
          },
          mode: "apply",
        }),
      });

      if (res.ok) {
        const result = await res.json();

        const pendingChanges: Partial<SectionData> = {};
        if (result.changes) {
          if (result.changes.wireframeBlocks?.length > 0) pendingChanges.wireframeBlocks = result.changes.wireframeBlocks;
          if (result.changes.copyBlocks?.length > 0) pendingChanges.copyBlocks = result.changes.copyBlocks;
          if (result.changes.layout) pendingChanges.layout = result.changes.layout;
          if (result.changes.visualDirection) pendingChanges.visualDirection = result.changes.visualDirection;
          if (result.changes.mainCopy) pendingChanges.mainCopy = result.changes.mainCopy;
          if (result.changes.subCopy) pendingChanges.subCopy = result.changes.subCopy;
        }
        pendingChanges.referenceImageUrl = img.url;
        pendingChanges.referenceNote = result.analysisNote || result.proposalSummary;

        setAnalysisStatuses(prev => {
          const next = new Map(prev);
          next.set(sectionNum, { sectionNum, status: "done" });
          return next;
        });

        // PlanEditor로 제안 전달 → 하단 고정 바 표시
        const proposal: PendingProposal = {
          sectionNum,
          sectionName: section.name,
          analysisNote: result.analysisNote || "",
          proposalSummary: result.proposalSummary || "",
          layout: result.changes?.layout || result.layout || "",
          visualDirection: result.changes?.visualDirection || result.visualDirection || "",
          wireframeCount: result.changes?.wireframeBlocks?.length || 0,
          copyCount: result.changes?.copyBlocks?.length || 0,
          mainCopy: result.changes?.mainCopy,
          subCopy: result.changes?.subCopy,
          pendingChanges,
        };
        onProposalReady?.(proposal);

        // 자동 학습: 분석 결과를 디자인 패턴 DB에 저장
        if (result.changes?.wireframeBlocks?.length > 0) {
          try {
            await fetch("/api/design-patterns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "learn",
                pattern: {
                  sectionType: "", // API에서 sectionName으로 자동 추론
                  patternName: `${section.name} - 레퍼런스 학습`,
                  description: result.analysisNote || result.proposalSummary || "",
                  wireframeBlocks: result.changes.wireframeBlocks,
                  copyBlocks: result.changes.copyBlocks || [],
                  tags: `학습,레퍼런스,${section.name}`,
                  thumbnailUrl: img.url,
                },
              }),
            });
          } catch (learnErr) {
            console.warn("[ReferenceBoard] Pattern learn failed:", learnErr);
          }
        }

        // 채팅에 분석 결과 메시지
        let chatMsg = `✅ **섹션 ${sectionNum}. ${section.name}** 레퍼런스 분석 완료!\n\n`;
        chatMsg += `📐 **분석:** ${result.analysisNote || ""}\n\n`;
        if (result.changes?.layout || result.layout) chatMsg += `**레이아웃:** ${result.changes?.layout || result.layout}\n`;
        chatMsg += `**적용 블록:** 와이어프레임 ${proposal.wireframeCount}개 + 카피 ${proposal.copyCount}개\n\n`;
        if (result.proposalSummary) chatMsg += `💡 **적용 제안:** ${result.proposalSummary}\n\n`;
        if (result.changes?.mainCopy) chatMsg += `**메인카피:** ${result.changes.mainCopy}\n`;
        if (result.changes?.subCopy) chatMsg += `**서브카피:** ${result.changes.subCopy}\n\n`;
        chatMsg += `👉 **오른쪽 패널 하단의 [적용하기] 버튼을 눌러 확정하세요.**`;
        onChatMessage?.(chatMsg);

      } else {
        const err = await res.json();
        setAnalysisStatuses(prev => {
          const next = new Map(prev);
          next.set(sectionNum, { sectionNum, status: "error", error: err.error || "분석 실패" });
          return next;
        });
        onChatMessage?.(`❌ 섹션 ${sectionNum}. ${section.name} 레퍼런스 분석 실패: ${err.error || "알 수 없는 오류"}`);
      }
    } catch (e: any) {
      setAnalysisStatuses(prev => {
        const next = new Map(prev);
        next.set(sectionNum, { sectionNum, status: "error", error: e.message });
        return next;
      });
    }
  }, [sections, onChatMessage, onProposalReady, onAnalyzeStart]);

  const handleDrop = useCallback((e: React.DragEvent, sectionNum: number) => {
    e.preventDefault();
    setDragOverSection(null);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files, sectionNum, activeTab);
    }
  }, [uploadFiles, activeTab]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && uploadTargetRef.current) {
      uploadFiles(e.target.files, uploadTargetRef.current.sectionNum, uploadTargetRef.current.tab);
      e.target.value = "";
    }
  }, [uploadFiles]);

  const openFileDialog = (sectionNum: number, tab: "design" | "photo") => {
    uploadTargetRef.current = { sectionNum, tab };
    fileInputRef.current?.click();
  };

  const removeImage = useCallback((id: string) => {
    onImagesChange(images.filter((img) => img.id !== id));
  }, [images, onImagesChange]);

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const reAnalyze = useCallback(async (sectionNum: number) => {
    const sectionImages = getSectionImages(sectionNum, "design");
    if (sectionImages.length > 0) {
      await analyzeReference(sectionImages[sectionImages.length - 1], sectionNum);
    }
  }, [images, analyzeReference]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tabs */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => setActiveTab("design")}
          className={`flex-1 py-2.5 text-sm font-semibold transition ${
            activeTab === "design" ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          디자인 레퍼런스
        </button>
        <button
          onClick={() => setActiveTab("photo")}
          className={`flex-1 py-2.5 text-sm font-semibold transition ${
            activeTab === "photo" ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          포토레퍼런스
        </button>
      </div>

      {activeTab === "design" && (
        <div className="px-3 py-1.5 bg-blue-50 text-[10px] text-blue-600 border-b shrink-0">
          레퍼런스를 올리면 AI가 구조 분석 → 우리 기획안에 맞게 적용 제안 → 컨펌 후 적용
        </div>
      )}

      {/* Section-based list */}
      <div className="flex-1 overflow-y-auto pb-40">
        {sections.map((section, i) => {
          const sectionImages = getSectionImages(section.num, activeTab);
          const isExpanded = expandedSections.has(i);
          const isUploading = uploading === section.num;
          const status = analysisStatuses.get(section.num);
          const isAnalyzing = status?.status === "analyzing";
          const isDragOver = dragOverSection === section.num;
          const isPending = pendingProposal?.sectionNum === section.num;
          const hasApplied = !!section.referenceNote && !isPending;

          return (
            <div key={section.num} className="border-b border-gray-100">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(i)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-gray-400 shrink-0">{isExpanded ? "▼" : "▶"}</span>
                  <span className="text-xs font-semibold text-gray-700 truncate">
                    섹션 {section.num}. {section.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {sectionImages.length > 0 && (
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {sectionImages.length}
                    </span>
                  )}
                  {isAnalyzing && (
                    <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded animate-pulse">
                      분석중
                    </span>
                  )}
                  {isPending && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded animate-pulse">
                      컨펌 대기
                    </span>
                  )}
                  {hasApplied && !isAnalyzing && (
                    <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                      적용됨
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div
                  className={`px-3 pb-3 space-y-2 transition ${isDragOver ? "bg-blue-50" : ""}`}
                  onDrop={(e) => handleDrop(e, section.num)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverSection(section.num); }}
                  onDragLeave={() => setDragOverSection(null)}
                >
                  {/* Images */}
                  {sectionImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {sectionImages.map((img) => (
                        <div key={img.id} className="group relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                          <img src={img.url} alt="" className="w-full h-auto object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-start justify-end p-1 opacity-0 group-hover:opacity-100">
                            <button onClick={() => removeImage(img.id)}
                              className="w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-600">
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI 분석 진행 상태 */}
                  {isAnalyzing && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-purple-700">
                          AI가 레퍼런스를 분석하고 기획안에 맞게 적용 방안을 만들고 있습니다...
                        </span>
                      </div>
                      <div className="text-[10px] text-purple-500 space-y-0.5">
                        <div>1. 디자인 레이아웃 구조 파악 중...</div>
                        <div>2. 우리 기획안 카피와 매칭 중...</div>
                        <div>3. 적용 제안 생성 중...</div>
                      </div>
                    </div>
                  )}

                  {/* 컨펌 대기 상태 안내 */}
                  {isPending && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-[11px] text-blue-800">
                      <div className="font-semibold mb-1">&#128205; 적용 대기 중</div>
                      <div className="text-blue-700">{pendingProposal?.proposalSummary}</div>
                      <div className="text-[10px] text-blue-500 mt-1.5">&#8595; 아래 [적용하기] 버튼을 눌러 확정하세요</div>
                    </div>
                  )}

                  {/* 기존 적용 정보 + 되돌리기/제거 */}
                  {activeTab === "design" && hasApplied && !isAnalyzing && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-[10px] text-gray-600">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <span className="text-green-500">&#10003;</span>
                          <span className="font-medium">레퍼런스 적용됨</span>
                        </div>
                        <button
                          onClick={() => reAnalyze(section.num)}
                          className="text-gray-400 hover:text-blue-600 underline"
                        >
                          다시 분석
                        </button>
                      </div>
                      <div>{section.referenceNote}</div>
                      {section.layout && <div className="mt-1 text-gray-500">레이아웃: {section.layout}</div>}

                      {/* 되돌리기 / 제거 버튼 */}
                      <div className="mt-2 pt-2 border-t border-gray-200 flex gap-1.5">
                        {sectionSnapshots?.has(section.num) && (
                          <button
                            onClick={() => onRevertSection?.(section.num)}
                            className="flex-1 py-1.5 text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200 rounded hover:bg-orange-100 transition"
                          >
                            ↩️ 되돌리기 (이전 상태로)
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (sectionSnapshots?.has(section.num)) {
                              // 스냅샷이 있으면 선택지 제공
                              const revert = confirm("레퍼런스를 제거합니다.\n\n[확인] → 레퍼런스 제거 + 이전 상태로 되돌리기\n[취소] → 레퍼런스 표시만 제거 (디자인 유지)");
                              onRemoveReferenceAndRevert?.(section.num, revert);
                            } else {
                              onRemoveReferenceAndRevert?.(section.num, false);
                            }
                          }}
                          className="flex-1 py-1.5 text-[10px] font-medium bg-red-50 text-red-500 border border-red-200 rounded hover:bg-red-100 transition"
                        >
                          🗑️ 레퍼런스 제거
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 분석 에러 */}
                  {status?.status === "error" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-[10px] text-red-600">
                      <div className="font-medium">분석 실패: {status.error}</div>
                      <button
                        onClick={() => reAnalyze(section.num)}
                        className="mt-1 text-red-500 hover:text-red-700 underline"
                      >
                        다시 시도
                      </button>
                    </div>
                  )}

                  {/* Upload button */}
                  <button
                    onClick={() => openFileDialog(section.num, activeTab)}
                    disabled={isUploading || isAnalyzing}
                    className={`w-full py-2.5 border border-dashed rounded-lg text-xs transition flex items-center justify-center gap-1 ${
                      isDragOver ? "border-blue-400 bg-blue-50 text-blue-500" :
                      isUploading || isAnalyzing ? "border-purple-200 bg-purple-50 text-purple-300" :
                      "border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500"
                    }`}
                  >
                    {isUploading ? "업로드 중..." :
                     isAnalyzing ? "AI 분석 진행 중..." :
                     isDragOver ? "여기에 놓으세요" :
                     sectionImages.length > 0 ? "+ 레퍼런스 추가" : "+ 레퍼런스 이미지 추가"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
