"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  projectId: number;
  currentStep: number;
  refreshKey?: number;
  onConfirmAndNextStep?: () => void;
  onRequestPlan?: (message?: string) => void;
}

interface BriefData {
  // Step 0 - 시장조사
  competitors?: { name: string; url: string; strengths: string; pageStructure: string }[];
  trends?: string;
  keywords?: string;
  targetInsight?: string;
  adRegulations?: string;
  similarProjects?: string;
  researchSummary?: string;
  // Step 1 - 브리프
  productName?: string;
  productComposition?: string;
  slogan?: string;
  mainTarget?: string;
  massTarget?: string;
  designSpec?: string;
  planningPurpose?: string;
  totalSections?: number;
  totalSectionsDetail?: string;
  // USP - 공통/개별 구분 지원
  uspTable?: { item: string; detail: string; vsCompetitor?: string; adCheck?: string; direction?: string }[];
  uspGroups?: { groupName: string; description?: string; items: { item: string; detail: string }[] }[];
  tocSections?: { num: number; name: string; detail: string; tag?: string }[];
  clientPreference?: string;
  designRef?: string;
  photoRef?: string;
  photoRefBySections?: { section: string; description: string }[];
  colorSuggestions?: string[];
  overallToneAndManner?: string;
  aiModelPersona?: string;
  aeCommentary?: string;
  // Step 2 - 다듬기
  revisions?: { section: string; before: string; after: string; reason: string }[];
  finalBrief?: string;
  aeNotes?: string;
  // Step 4 - 피드백
  feedbackItems?: { section: string; feedback: string; action: string; adCheckConflict: boolean }[];
  feedbackSummary?: string;
  revisedBrief?: string;
  // 범용
  [key: string]: any;
}

/**
 * 노션 복사용 브리프 패널
 * STEP 0~4 에서 사용 — AI가 생성한 브리프를 노션에 바로 붙여넣을 수 있는 형태로 표시
 */
interface QualityGrade {
  score: number;
  max: number;
  comment: string;
}

interface QualityResult {
  totalScore: number;
  grades: {
    completeness: QualityGrade;
    specificity: QualityGrade;
    logic: QualityGrade;
    adCompliance: QualityGrade;
    readability: QualityGrade;
  };
  typos: { original: string; corrected: string; location: string }[];
  improvements: { section: string; priority: string; suggestion: string }[];
  strengths: string[];
  summary: string;
}

export default function BriefPanel({ projectId, currentStep, refreshKey, onConfirmAndNextStep, onRequestPlan }: Props) {
  const [briefData, setBriefData] = useState<BriefData>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "raw">("preview");
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  // 편집 관련
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<BriefData>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // 이미지 드래그앤드롭
  const [refImages, setRefImages] = useState<{ id: string; name: string; url: string; section?: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBriefData = useCallback(async () => {
    setLoading(true);
    try {
      // 현재 스텝의 데이터를 우선, 없으면 가장 최신 브리프 스텝 데이터 사용
      const res = await fetch(`/api/projects/${projectId}/step-data`);
      if (res.ok) {
        const allData = await res.json();
        // step 0~2 데이터만 필터 (0:작업의뢰서, 1:시장조사, 2:브리프)
        const briefSteps = allData
          .filter((d: any) => d.step <= 2 && d.formData && Object.keys(d.formData).length > 0);

        if (briefSteps.length > 0) {
          // 브리프(step 2) 데이터를 최우선 베이스로 사용
          // 없으면 시장조사(step 1) → 작업의뢰서(step 0) 순
          const sorted = [...briefSteps].sort((a: any, b: any) => b.step - a.step);
          const base = sorted[0].formData;
          const merged: BriefData = { ...base };

          // 낮은 step 데이터에서 빈 필드만 보충 (시장조사 데이터를 브리프에 보충)
          for (let i = 1; i < sorted.length; i++) {
            for (const [key, val] of Object.entries(sorted[i].formData)) {
              if (merged[key] === undefined || merged[key] === '' || merged[key] === null) {
                merged[key] = val;
              }
            }
          }
          setBriefData(merged);
        } else {
          setBriefData({});
        }
      }
    } catch (e) {
      console.error("브리프 데이터 로드 실패:", e);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchBriefData();
  }, [fetchBriefData, currentStep, refreshKey]);

  // briefData 변경 시 editData 동기화
  useEffect(() => {
    if (!isEditing) {
      setEditData(briefData);
    }
  }, [briefData, isEditing]);

  // 레퍼런스 이미지 로드
  useEffect(() => {
    const loadImages = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/files?step=2&fileType=brief_ref`);
        if (res.ok) {
          const files = await res.json();
          setRefImages(files.map((f: any) => ({
            id: String(f.id),
            name: f.file_name,
            url: `/api/projects/${projectId}/files/${f.id}/download`,
            section: f.section_tag || "",
          })));
        }
      } catch {}
    };
    loadImages();
  }, [projectId, refreshKey]);

  // 자동 저장 (30초마다)
  useEffect(() => {
    if (hasUnsaved && isEditing) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(true);
      }, 30000);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [hasUnsaved, isEditing, editData]);

  // 편집 필드 업데이트 (자동저장 트리거)
  const updateField = (key: string, value: any) => {
    setEditData(prev => ({ ...prev, [key]: value }));
    setHasUnsaved(true);
  };

  // 저장
  const handleSave = async (isAutoSave = false) => {
    setSaving(true);
    try {
      const dataToSave = isEditing ? editData : briefData;
      await fetch(`/api/projects/${projectId}/step-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 2, // 브리프 스텝
          formData: dataToSave,
          status: confirmed ? "confirmed" : "draft",
        }),
      });
      setBriefData(dataToSave);
      setHasUnsaved(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("브리프 저장 실패:", e);
      if (!isAutoSave) alert("저장에 실패했습니다.");
    }
    setSaving(false);
  };

  // 편집 모드 토글
  const toggleEdit = () => {
    if (isEditing) {
      // 편집 종료 → 저장
      handleSave();
      setIsEditing(false);
    } else {
      setEditData({ ...briefData });
      setIsEditing(true);
    }
  };

  // 이미지 드래그 앤 드롭
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) return;
    await uploadRefImages(files);
  };
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await uploadRefImages(files);
    e.target.value = "";
  };
  const uploadRefImages = async (files: File[]) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("step", "2");
      formData.append("fileType", "brief_ref");
      try {
        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setRefImages(prev => [...prev, {
            id: String(data.id),
            name: file.name,
            url: `/api/projects/${projectId}/files/${data.id}/download`,
          }]);
        }
      } catch (err) {
        console.error("이미지 업로드 실패:", err);
      }
    }
  };
  const removeRefImage = async (imageId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/files?fileId=${imageId}`, { method: "DELETE" });
      setRefImages(prev => prev.filter(img => img.id !== imageId));
    } catch {}
  };

  // 브리프 컨펌
  const handleConfirm = async () => {
    // 편집 중이면 먼저 저장
    if (isEditing) {
      await handleSave();
      setIsEditing(false);
    }
    setConfirmed(true);
    // 상태를 confirmed로 저장
    await fetch(`/api/projects/${projectId}/step-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: 2,
        formData: editData.productName ? editData : briefData,
        status: "confirmed",
      }),
    });
  };

  // 노션에 붙여넣기 좋은 마크다운 형식으로 변환
  const generateNotionText = (): string => {
    const lines: string[] = [];
    const d = isEditing ? editData : briefData;

    // 헤더
    lines.push(`# ${d.productName || "브리프"}`);
    if (d.slogan) lines.push(`> ${d.slogan}`);
    lines.push("");

    // 제품 개요
    if (d.productComposition || d.designSpec || d.planningPurpose || d.totalSectionsDetail) {
      if (d.productComposition) lines.push(`**제품 구성:** ${d.productComposition}`);
      if (d.mainTarget) lines.push(`**주요 타겟:** ${d.mainTarget}`);
      if (d.designSpec) lines.push(`**디자인 규격:** ${d.designSpec}`);
      if (d.planningPurpose) lines.push(`**기획 목적:** ${d.planningPurpose}`);
      if (d.totalSectionsDetail) {
        lines.push(`**Total:** ${d.totalSectionsDetail}`);
      } else if (d.totalSections) {
        lines.push(`**Total:** ${d.totalSections}섹션`);
      }
      lines.push("");
    }

    // 📚 Data (시장조사)
    if (d.researchSummary || d.trends || d.keywords || (d.competitors && d.competitors.length > 0)) {
      lines.push("## 📚 Data");
      lines.push("");
      if (d.trends) {
        lines.push("**트렌드**");
        lines.push(d.trends);
        lines.push("");
      }
      if (d.keywords) {
        lines.push("**키워드**");
        lines.push(d.keywords);
        lines.push("");
      }
      if (d.competitors && d.competitors.length > 0) {
        lines.push("**경쟁사 분석**");
        lines.push("| 경쟁사 | URL | 강점 | 페이지 구조 |");
        lines.push("|---|---|---|---|");
        for (const c of d.competitors) {
          lines.push(`| ${c.name || ""} | ${c.url || ""} | ${c.strengths || ""} | ${c.pageStructure || ""} |`);
        }
        lines.push("");
      }
      if (d.researchSummary) {
        lines.push("**리서치 요약**");
        lines.push(d.researchSummary);
        lines.push("");
      }
      if (d.adRegulations) {
        lines.push("**광고 규제 사항**");
        lines.push(d.adRegulations);
        lines.push("");
      }
    }

    // 📷 촬영 및 디자인 REF
    if (d.designRef || d.photoRef || d.similarProjects || d.overallToneAndManner || (d.photoRefBySections && d.photoRefBySections.length > 0) || (d.colorSuggestions && d.colorSuggestions.length > 0)) {
      lines.push("## 📷 촬영 및 디자인 REF");
      lines.push("");
      if (d.overallToneAndManner) {
        lines.push("**전체 톤앤매너**");
        lines.push(d.overallToneAndManner);
        lines.push("");
      }
      if (d.photoRefBySections && d.photoRefBySections.length > 0) {
        lines.push("**섹션별 촬영 디렉션**");
        for (const ref of d.photoRefBySections) {
          lines.push(`- **${ref.section}**: ${ref.description}`);
        }
        lines.push("");
      }
      if (d.colorSuggestions && d.colorSuggestions.length > 0) {
        lines.push("**컬러 제안**");
        for (const c of d.colorSuggestions) {
          lines.push(`- ${c}`);
        }
        lines.push("");
      }
      if (d.designRef) {
        lines.push("**디자인 레퍼런스**");
        lines.push(d.designRef);
        lines.push("");
      }
      if (d.photoRef) {
        lines.push("**촬영 레퍼런스**");
        lines.push(d.photoRef);
        lines.push("");
      }
      if (d.similarProjects) {
        lines.push("**유사 프로젝트**");
        lines.push(d.similarProjects);
        lines.push("");
      }
    }

    // 🚨 Issue
    if (d.adRegulations || d.targetInsight) {
      lines.push("## 🚨 Issue");
      lines.push("");
      if (d.adRegulations) {
        lines.push("**광고심의 이슈**");
        lines.push(d.adRegulations);
        lines.push("");
      }
      if (d.targetInsight) {
        lines.push("**타겟 인사이트**");
        lines.push(d.targetInsight);
        lines.push("");
      }
    }

    // ⭐️ USP
    if ((d.uspGroups && d.uspGroups.length > 0) || (d.uspTable && d.uspTable.length > 0)) {
      lines.push("## ⭐️ USP");
      lines.push("");
      if (d.uspGroups && d.uspGroups.length > 0) {
        for (const group of d.uspGroups) {
          lines.push(`**▼ ${group.groupName}**`);
          if (group.description) lines.push(group.description);
          lines.push("| USP | 상세 내용 |");
          lines.push("|---|---|");
          for (const u of (group.items || [])) {
            lines.push(`| ${u?.item || ""} | ${u?.detail || ""} |`);
          }
          lines.push("");
        }
      } else if (d.uspTable && d.uspTable.length > 0) {
        lines.push("| 항목 | 상세 | vs 경쟁사 | 광고심의 | 방향 |");
        lines.push("|---|---|---|---|---|");
        for (const u of d.uspTable) {
          lines.push(`| ${u.item || ""} | ${u.detail || ""} | ${u.vsCompetitor || ""} | ${u.adCheck || ""} | ${u.direction || ""} |`);
        }
        lines.push("");
      }
    }

    // 📌 Target
    if (d.mainTarget || d.massTarget) {
      lines.push("## 📌 Target");
      lines.push("");
      if (d.mainTarget) {
        lines.push("**메인 타겟**");
        lines.push(d.mainTarget);
        lines.push("");
      }
      if (d.massTarget) {
        lines.push("**매스 타겟**");
        lines.push(d.massTarget);
        lines.push("");
      }
    }

    // 📷 촬영컨셉
    if (d.aiModelPersona || d.clientPreference) {
      lines.push("## 📷 촬영컨셉");
      lines.push("");
      if (d.aiModelPersona) {
        lines.push("**AI 모델 페르소나**");
        lines.push(d.aiModelPersona);
        lines.push("");
      }
      if (d.clientPreference) {
        lines.push("**클라이언트 선호**");
        lines.push(d.clientPreference);
        lines.push("");
      }
    }

    // 📃 기획방향
    if (d.tocSections && d.tocSections.length > 0) {
      lines.push("## 📃 기획방향 / 상세페이지 목차");
      lines.push("");
      if (d.totalSectionsDetail) {
        lines.push(`Total: ${d.totalSectionsDetail}`);
      } else {
        lines.push(`총 섹션 수: ${d.totalSections || d.tocSections.length}개`);
      }
      lines.push("");
      lines.push("| 섹션 | 이름 | 태그 | 상세 |");
      lines.push("|---|---|---|---|");
      for (const s of d.tocSections) {
        lines.push(`| 섹션${s.num} | ${s.name || ""} | ${s.tag || ""} | ${s.detail || ""} |`);
      }
      lines.push("");
    }

    // AE Commentary
    if (d.aeCommentary || d.aeNotes) {
      lines.push("---");
      lines.push("");
      lines.push("## 💬 AE Commentary");
      lines.push("");
      if (d.aeCommentary) lines.push(d.aeCommentary);
      if (d.aeNotes) lines.push(d.aeNotes);
      lines.push("");
    }

    // 피드백 반영 내역
    if (d.feedbackItems && d.feedbackItems.length > 0) {
      lines.push("---");
      lines.push("");
      lines.push("## 🔄 피드백 반영 내역");
      lines.push("");
      lines.push("| 섹션 | 피드백 | 조치 | 광고심의 충돌 |");
      lines.push("|---|---|---|---|");
      for (const f of d.feedbackItems) {
        lines.push(`| ${f.section || ""} | ${f.feedback || ""} | ${f.action || ""} | ${f.adCheckConflict ? "⚠️" : "✅"} |`);
      }
      lines.push("");
    }

    // 최종 브리프 (다듬기 결과)
    if (d.finalBrief || d.revisedBrief) {
      lines.push("---");
      lines.push("");
      lines.push("## ✅ 최종 브리프");
      lines.push("");
      lines.push(d.revisedBrief || d.finalBrief || "");
      lines.push("");
    }

    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = generateNotionText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleQualityCheck = async () => {
    setQualityLoading(true);
    setShowQuality(true);
    try {
      const markdown = generateNotionText();
      const res = await fetch("/api/brief-quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefMarkdown: markdown }),
      });
      if (res.ok) {
        const result = await res.json();
        setQualityResult(result);
      } else {
        const err = await res.json();
        alert(`퀄리티 체크 실패: ${err.error || "알 수 없는 오류"}`);
        setShowQuality(false);
      }
    } catch (e: any) {
      alert(`퀄리티 체크 오류: ${e.message}`);
      setShowQuality(false);
    }
    setQualityLoading(false);
  };

  const getScoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 90) return "text-green-600";
    if (pct >= 70) return "text-blue-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 90) return "bg-green-500";
    if (pct >= 70) return "bg-blue-500";
    if (pct >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getTotalScoreEmoji = (score: number) => {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B+";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    return "D";
  };

  const getPriorityColor = (priority: string) => {
    if (priority === "높음") return "bg-red-100 text-red-700";
    if (priority === "중간") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  };

  const isEmpty = Object.keys(briefData).length === 0 ||
    Object.values(briefData).every(v => !v || (Array.isArray(v) && v.length === 0));

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs text-gray-500">브리프 로딩 중...</p>
        </div>
      </div>
    );
  }

  // 스텝별 타이틀/아이콘
  const panelTitle = currentStep === 1 ? "시장조사 리포트" : "노션 브리프";
  const panelIcon = currentStep === 1 ? "📊" : "📋";

  if (isEmpty) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">{panelIcon}</span>
            <span className="text-sm font-semibold text-gray-800">{panelTitle}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            {currentStep === 1 ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-3xl">
                  🔍
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">시장조사 진행 중</h3>
                <p className="text-sm text-gray-500 mb-6">
                  AI가 시장조사를 완료하면 여기에 리포트가 자동으로 표시됩니다
                </p>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-lg mt-0.5">🔍</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">경쟁사 & 트렌드 분석</p>
                      <p className="text-xs text-gray-500">AI가 시장, 경쟁사, 키워드를 심층 조사합니다</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-lg mt-0.5">📊</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">리포트 자동 생성</p>
                      <p className="text-xs text-gray-500">조사 결과가 이 패널에 정리되어 표시됩니다</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-lg mt-0.5">📝</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">브리프 작성으로 진행</p>
                      <p className="text-xs text-gray-500">리포트 확인 후 "브리프 작성하기" 버튼으로 다음 단계로</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-3xl">
                  📋
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">브리프 미작성</h3>
                <p className="text-sm text-gray-500 mb-6">
                  AI에게 브리프 작성을 요청하면 여기서 노션에 바로 붙여넣을 수 있는 형태로 확인할 수 있어요
                </p>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-lg mt-0.5">1️⃣</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">AI에게 브리프 요청</p>
                      <p className="text-xs text-gray-500">"브리프 작성해줘" 또는 파일을 첨부하고 요청하세요</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-lg mt-0.5">2️⃣</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">브리프 자동 정리</p>
                      <p className="text-xs text-gray-500">AI가 디옵트 브리프 양식에 맞게 자동으로 정리합니다</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-lg mt-0.5">3️⃣</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">수정 & QC 후 확정</p>
                      <p className="text-xs text-gray-500">브리프를 자유롭게 편집하고, QC 후 확정하여 기획안으로 진행합니다</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">{panelIcon}</span>
            <span className="text-sm font-semibold text-gray-800">{panelTitle}</span>
            {confirmed && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">확정됨</span>}
            {hasUnsaved && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">미저장</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Tab 전환 */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => { setActiveTab("preview"); setShowQuality(false); }}
                className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === "preview" && !showQuality ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {isEditing ? "편집" : "미리보기"}
              </button>
              <button
                onClick={() => { setActiveTab("raw"); setShowQuality(false); }}
                className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === "raw" && !showQuality ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                마크다운
              </button>
              {qualityResult && (
                <button
                  onClick={() => setShowQuality(true)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                    showQuality ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  QC {qualityResult.totalScore}점
                </button>
              )}
            </div>
            {/* 편집 토글 */}
            <button
              onClick={toggleEdit}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
                isEditing
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {isEditing ? "편집 완료" : "편집"}
            </button>
            {/* 저장 */}
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
                saving ? "bg-gray-200 text-gray-500 cursor-wait" :
                saved ? "bg-green-100 text-green-700" :
                "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {saving ? "저장중..." : saved ? "저장됨!" : "저장"}
            </button>
            {/* QC */}
            <button
              onClick={handleQualityCheck}
              disabled={qualityLoading}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
                qualityLoading ? "bg-gray-200 text-gray-500 cursor-wait" : "bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              {qualityLoading ? "검수중..." : "QC"}
            </button>
            {/* 복사 */}
            <button
              onClick={handleCopy}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
                copied ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {copied ? "복사됨!" : "복사"}
            </button>
            <button
              onClick={fetchBriefData}
              className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-1.5 rounded-lg hover:bg-gray-100"
              title="새로고침"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showQuality ? (
          <div className="p-4">
            {qualityLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin h-8 w-8 border-3 border-orange-500 border-t-transparent rounded-full mb-3" />
                <p className="text-sm text-gray-600 font-medium">AI가 브리프 품질을 검수하고 있습니다...</p>
                <p className="text-xs text-gray-400 mt-1">오타, 논리 흐름, 광고심의 등을 확인 중</p>
              </div>
            ) : qualityResult ? (
              <QualityReport
                result={qualityResult}
                getScoreColor={getScoreColor}
                getScoreBg={getScoreBg}
                getTotalScoreEmoji={getTotalScoreEmoji}
                getPriorityColor={getPriorityColor}
              />
            ) : null}
          </div>
        ) : activeTab === "preview" ? (
          <div className="p-4">
            {isEditing ? (
              <BriefEditor data={editData} onChange={updateField} />
            ) : (
              <BriefPreview data={briefData} />
            )}

            {/* 레퍼런스 이미지 섹션 */}
            <div className="mt-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <span>📸</span> 레퍼런스 이미지
                  </h2>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100 transition"
                  >
                    + 이미지 추가
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>
                <div
                  className={`p-4 min-h-[120px] transition-colors ${isDragging ? "bg-blue-50 border-2 border-dashed border-blue-300" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {refImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                      <span className="text-3xl mb-2">📸</span>
                      <p className="text-xs">레퍼런스 이미지를 드래그 앤 드롭하세요</p>
                      <p className="text-[10px] text-gray-300 mt-1">PNG, JPG, JPEG 지원</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {refImages.map((img) => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={img.url}
                            alt={img.name}
                            className="w-full h-24 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%239ca3af' font-size='14'%3E📸%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                            <button
                              onClick={() => removeRefImage(img.id)}
                              className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs px-2 py-1 rounded-lg transition"
                            >
                              삭제
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate px-1.5 py-1 bg-white">{img.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap bg-white border border-gray-200 rounded-xl p-4 leading-relaxed">
              {generateNotionText()}
            </pre>
          </div>
        )}
      </div>

      {/* 하단 고정 — 스텝별 액션 버튼 */}
      {!isEmpty && (
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            {/* STEP 1: 시장조사 완료 → 컨펌 + 브리프 작성 */}
            {currentStep === 1 && (
              <>
                <button
                  onClick={() => onRequestPlan?.("시장조사 결과를 바탕으로 브리프를 작성해줘")}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition shadow-md"
                >
                  📝 브리프 작성하기
                </button>
              </>
            )}
            {/* STEP 2: 브리프 → 확정 + 기획안 작성 */}
            {currentStep === 2 && (
              <>
                {!confirmed ? (
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition shadow-md"
                  >
                    브리프 확정하기
                  </button>
                ) : (
                  <>
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <span>✅</span> 브리프 확정됨
                    </span>
                    <button
                      onClick={() => onRequestPlan?.()}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition shadow-md"
                    >
                      📋 기획안 작성하기
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Notion-style Brief Preview (read-only)
// ============================================================
function BriefPreview({ data }: { data: BriefData }) {
  const d = data;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ====== Section 1: 제품 개요 (Callout - light yellow) ====== */}
      {d.productName && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 p-4">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-lg leading-none mt-0.5">💡</span>
            <h2 className="text-sm font-bold text-gray-900">제품 개요</h2>
          </div>
          <div className="space-y-1.5 text-sm pl-7">
            <p><span className="font-bold text-gray-800">제품명:</span> <span className="text-gray-700">{d.productName}</span></p>
            {d.productComposition && (
              <p><span className="font-bold text-gray-800">제품 포지셔닝/구성:</span> <span className="text-gray-700">{d.productComposition}</span></p>
            )}
            {d.mainTarget && (
              <p><span className="font-bold text-gray-800">주요 타겟:</span> <span className="text-gray-700">{d.mainTarget}</span></p>
            )}
            {d.designSpec && (
              <p><span className="font-bold text-gray-800">디자인 규격:</span> <span className="text-gray-700">{d.designSpec}</span></p>
            )}
            {d.planningPurpose && (
              <div className="mt-1">
                <span className="font-bold text-gray-800">기획 목적:</span>
                <p className="text-gray-700 whitespace-pre-wrap mt-0.5">{d.planningPurpose}</p>
              </div>
            )}
            {(d.totalSections || d.totalSectionsDetail) && (
              <p className="mt-2 pt-2 border-t border-yellow-200">
                <span className="font-bold text-blue-600">Total: {d.totalSectionsDetail || `${d.totalSections}섹션`}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ====== Section 2: USP (gray heading) ====== */}
      {((d.uspTable && d.uspTable.length > 0) || (d.uspGroups && d.uspGroups.length > 0)) && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-200">
            <h2 className="text-sm font-bold text-gray-800">USP</h2>
          </div>
          <div className="bg-white">
            {/* uspGroups (공통/개별 분리) */}
            {d.uspGroups && d.uspGroups.length > 0 ? (
              <div>
                {d.uspGroups.map((group, gi) => (
                  <div key={gi}>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <span className="text-xs font-bold text-gray-700">[{group.groupName}]</span>
                      {group.description && <span className="text-xs text-gray-500 ml-2">{group.description}</span>}
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-10">No.</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-1/4">USP</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">상세내용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(group.items || []).map((u, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="px-3 py-2 text-gray-500 align-top">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900 align-top">{u?.item || ''}</td>
                            <td className="px-3 py-2 text-gray-700 whitespace-pre-wrap">{u?.detail || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : d.uspTable && d.uspTable.length > 0 ? (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-10">No.</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-1/4">USP</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">상세내용</th>
                  </tr>
                </thead>
                <tbody>
                  {d.uspTable.map((u, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-500 align-top">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 align-top">{u.item}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-pre-wrap">{u.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      )}

      {/* ====== Section 3: 상세페이지 목차 (blue heading) ====== */}
      {d.tocSections && d.tocSections.length > 0 && (
        <div className="border border-blue-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-blue-100">
            <h2 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
              <span>📄</span> 상세페이지 목차
            </h2>
          </div>
          <div className="bg-white">
            <div className="px-4 py-2 border-b border-gray-200">
              <p className="text-xs text-red-500 italic">*목차는 기획안 작성 시 기획 의도에 따라 변동될 예정입니다. 아래는 현재 기획 방향을 기반으로 한 초안입니다.</p>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-16">섹션</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-28">섹션 이름</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">상세 내용</th>
                </tr>
              </thead>
              <tbody>
                {d.tocSections.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30 align-top">
                    <td className="px-3 py-2 font-bold text-blue-700">섹션{s.num}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {s.tag && <span className="inline-block text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mb-0.5 mr-1">{s.tag}</span>}
                      {s.name}
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-pre-wrap leading-relaxed">{s.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====== Section 4: Photo & Design REF (gray heading) ====== */}
      {(d.designRef || d.photoRef || d.overallToneAndManner || (d.photoRefBySections && d.photoRefBySections.length > 0) || (d.colorSuggestions && d.colorSuggestions.length > 0)) && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-200">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span>📷</span> Photo & Design REF
            </h2>
          </div>
          <div className="bg-white p-4 space-y-4">
            {/* 전체 톤앤매너 */}
            {d.overallToneAndManner && (
              <div>
                <p className="text-xs font-bold text-gray-600 mb-1">전체 톤앤매너</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{d.overallToneAndManner}</p>
              </div>
            )}
            {/* 컬러 제안 */}
            {d.colorSuggestions && d.colorSuggestions.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-600 mb-1">컬러 제안</p>
                <div className="flex flex-wrap gap-2">
                  {d.colorSuggestions.map((c, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {/* 디자인 REF */}
            {d.designRef && (
              <div className="rounded-lg border border-yellow-200 overflow-hidden">
                <div className="px-3 py-1.5 bg-yellow-100">
                  <p className="text-xs font-bold text-yellow-800">디자인 REF</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{d.designRef}</p>
                  <div className="mt-2 border border-dashed border-gray-300 rounded p-3 text-center text-gray-400 text-xs">
                    이미지 레퍼런스 영역
                  </div>
                </div>
              </div>
            )}
            {/* 촬영 REF */}
            {d.photoRef && (
              <div className="rounded-lg border border-green-200 overflow-hidden">
                <div className="px-3 py-1.5 bg-green-100">
                  <p className="text-xs font-bold text-green-800">촬영 REF</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{d.photoRef}</p>
                  <div className="mt-2 border border-dashed border-gray-300 rounded p-3 text-center text-gray-400 text-xs">
                    이미지 레퍼런스 영역
                  </div>
                </div>
              </div>
            )}
            {/* 섹션별 촬영 디렉션 */}
            {d.photoRefBySections && d.photoRefBySections.length > 0 && (
              <div className="space-y-2">
                {d.photoRefBySections.map((ref, i) => (
                  <div key={i} className="rounded-lg border border-green-200 overflow-hidden">
                    <div className="px-3 py-1.5 bg-green-100">
                      <p className="text-xs font-bold text-green-800">촬영 REF - {ref.section}</p>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">{ref.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== Section 5: AE Commentary ====== */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-200">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <span>💬</span> AE Commentary
          </h2>
        </div>
        <div className="bg-white p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1">AE 코멘트</p>
            {d.aeCommentary ? (
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{d.aeCommentary}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">코멘트 없음</p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1">AE 노트</p>
            {d.aeNotes ? (
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{d.aeNotes}</p>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 min-h-[60px]">
                <p className="text-xs text-gray-400 italic">노트를 작성하세요 (편집 모드에서 입력 가능)</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== 추가: 시장조사 Data (존재 시) ====== */}
      {(d.researchSummary || d.trends || d.keywords || (d.competitors && d.competitors.length > 0)) && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-200">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span>📚</span> Data (시장조사)
            </h2>
          </div>
          <div className="bg-white p-4 space-y-3">
            {d.trends && <BriefField label="트렌드" value={d.trends} />}
            {d.keywords && <BriefField label="키워드" value={d.keywords} />}
            {d.competitors && d.competitors.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-600 mb-2">경쟁사 분석</p>
                <table className="w-full text-xs border-collapse border border-gray-200 rounded">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">경쟁사</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">강점</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">페이지 구조</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.competitors.map((c, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                        <td className="px-3 py-2 text-gray-700">{c.strengths}</td>
                        <td className="px-3 py-2 text-gray-700">{c.pageStructure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {d.researchSummary && <BriefField label="리서치 요약" value={d.researchSummary} />}
            {d.adRegulations && <BriefField label="광고 규제 사항" value={d.adRegulations} />}
            {d.targetInsight && <BriefField label="타겟 인사이트" value={d.targetInsight} />}
          </div>
        </div>
      )}

      {/* ====== 피드백 반영 내역 (존재 시) ====== */}
      {d.feedbackItems && d.feedbackItems.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-200">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span>🔄</span> 피드백 반영 내역
            </h2>
          </div>
          <div className="bg-white">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">섹션</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">피드백</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">조치</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-12">심의</th>
                </tr>
              </thead>
              <tbody>
                {d.feedbackItems.map((f, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-medium text-gray-900">{f.section}</td>
                    <td className="px-3 py-2 text-gray-700">{f.feedback}</td>
                    <td className="px-3 py-2 text-gray-700">{f.action}</td>
                    <td className="px-3 py-2 text-center">{f.adCheckConflict ? "⚠️" : "✅"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====== 최종 브리프 (존재 시) ====== */}
      {(d.finalBrief || d.revisedBrief) && (
        <div className="border border-green-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-green-100">
            <h2 className="text-sm font-bold text-green-900 flex items-center gap-1.5">
              <span>✅</span> 최종 브리프
            </h2>
          </div>
          <div className="bg-white p-4">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {d.revisedBrief || d.finalBrief}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Notion-style Brief Editor (inline editing)
// ============================================================
function BriefEditor({ data, onChange }: { data: BriefData; onChange: (key: string, value: any) => void }) {
  const d = data;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ====== Section 1: 제품 개요 (Callout - light yellow) ====== */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 p-4">
        <div className="flex items-start gap-2 mb-3">
          <span className="text-lg leading-none mt-0.5">💡</span>
          <h2 className="text-sm font-bold text-gray-900">제품 개요</h2>
        </div>
        <div className="space-y-2.5 pl-7">
          <EditField label="제품명" value={d.productName || ""} onChange={(v) => onChange("productName", v)} />
          <EditField label="제품 포지셔닝/구성" value={d.productComposition || ""} onChange={(v) => onChange("productComposition", v)} />
          <EditField label="주요 타겟" value={d.mainTarget || ""} onChange={(v) => onChange("mainTarget", v)} />
          <EditField label="디자인 규격" value={d.designSpec || ""} onChange={(v) => onChange("designSpec", v)} />
          <EditField label="기획 목적" value={d.planningPurpose || ""} onChange={(v) => onChange("planningPurpose", v)} multiline />
          <EditField label="Total 상세" value={d.totalSectionsDetail || ""} onChange={(v) => onChange("totalSectionsDetail", v)} placeholder="예: 13섹션 = 8USP + 5기타" />
        </div>
      </div>

      {/* ====== Section 2: USP (gray heading) ====== */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-200">
          <h2 className="text-sm font-bold text-gray-800">USP</h2>
        </div>
        <div className="bg-white p-4">
          {/* uspGroups 편집 */}
          {d.uspGroups && d.uspGroups.length > 0 ? (
            <div className="space-y-4">
              {d.uspGroups.map((group, gi) => (
                <div key={gi} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">그룹명:</span>
                    <input
                      className="flex-1 text-xs font-bold border border-gray-200 rounded px-2 py-1 focus:border-blue-400 focus:outline-none bg-white"
                      value={group.groupName}
                      onChange={(e) => {
                        const updated = [...(d.uspGroups || [])];
                        updated[gi] = { ...updated[gi], groupName: e.target.value };
                        onChange("uspGroups", updated);
                      }}
                    />
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-10">No.</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-1/4">USP</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">상세내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(group.items || []).map((u, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-500 align-top">{i + 1}</td>
                          <td className="px-1 py-1 align-top">
                            <input
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none"
                              value={u?.item || ''}
                              onChange={(e) => {
                                const updatedGroups = [...(d.uspGroups || [])];
                                const updatedItems = [...(updatedGroups[gi].items || [])];
                                updatedItems[i] = { ...updatedItems[i], item: e.target.value };
                                updatedGroups[gi] = { ...updatedGroups[gi], items: updatedItems };
                                onChange("uspGroups", updatedGroups);
                              }}
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <textarea
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none resize-none"
                              rows={2}
                              value={u?.detail || ''}
                              onChange={(e) => {
                                const updatedGroups = [...(d.uspGroups || [])];
                                const updatedItems = [...(updatedGroups[gi].items || [])];
                                updatedItems[i] = { ...updatedItems[i], detail: e.target.value };
                                updatedGroups[gi] = { ...updatedGroups[gi], items: updatedItems };
                                onChange("uspGroups", updatedGroups);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                    <button
                      onClick={() => {
                        const updatedGroups = [...(d.uspGroups || [])];
                        const updatedItems = [...(updatedGroups[gi].items || []), { item: "", detail: "" }];
                        updatedGroups[gi] = { ...updatedGroups[gi], items: updatedItems };
                        onChange("uspGroups", updatedGroups);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      + USP 추가
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  const updatedGroups = [...(d.uspGroups || []), { groupName: "새 그룹", items: [{ item: "", detail: "" }] }];
                  onChange("uspGroups", updatedGroups);
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + USP 그룹 추가
              </button>
            </div>
          ) : d.uspTable && d.uspTable.length > 0 ? (
            <div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-10">No.</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-1/4">USP</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">상세내용</th>
                  </tr>
                </thead>
                <tbody>
                  {d.uspTable.map((u, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500 align-top">{i + 1}</td>
                      <td className="px-1 py-1 align-top">
                        <input
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none"
                          value={u.item}
                          onChange={(e) => {
                            const updated = [...(d.uspTable || [])];
                            updated[i] = { ...updated[i], item: e.target.value };
                            onChange("uspTable", updated);
                          }}
                        />
                      </td>
                      <td className="px-1 py-1 align-top">
                        <textarea
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none resize-none"
                          rows={2}
                          value={u.detail}
                          onChange={(e) => {
                            const updated = [...(d.uspTable || [])];
                            updated[i] = { ...updated[i], detail: e.target.value };
                            onChange("uspTable", updated);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={() => {
                    const updated = [...(d.uspTable || []), { item: "", detail: "" }];
                    onChange("uspTable", updated);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + USP 추가
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-gray-400 mb-2">USP가 없습니다</p>
              <button
                onClick={() => onChange("uspGroups", [{ groupName: "공통 USP", items: [{ item: "", detail: "" }] }])}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + USP 추가하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ====== Section 3: 상세페이지 목차 (blue heading) ====== */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-blue-100">
          <h2 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
            <span>📄</span> 상세페이지 목차
          </h2>
        </div>
        <div className="bg-white">
          {d.tocSections && d.tocSections.length > 0 ? (
            <>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-16">섹션</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-28">섹션 이름</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">상세 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {d.tocSections.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 align-top">
                      <td className="px-3 py-2 font-bold text-blue-700">섹션{s.num}</td>
                      <td className="px-1 py-1">
                        <input
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none"
                          value={s.name}
                          onChange={(e) => {
                            const updated = [...(d.tocSections || [])];
                            updated[i] = { ...updated[i], name: e.target.value };
                            onChange("tocSections", updated);
                          }}
                          placeholder="섹션 이름"
                        />
                        <input
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 mt-1 focus:border-blue-400 focus:outline-none text-blue-600"
                          value={s.tag || ""}
                          onChange={(e) => {
                            const updated = [...(d.tocSections || [])];
                            updated[i] = { ...updated[i], tag: e.target.value };
                            onChange("tocSections", updated);
                          }}
                          placeholder="태그 (선택)"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <textarea
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none resize-none leading-relaxed"
                          rows={4}
                          value={s.detail}
                          onChange={(e) => {
                            const updated = [...(d.tocSections || [])];
                            updated[i] = { ...updated[i], detail: e.target.value };
                            onChange("tocSections", updated);
                          }}
                          placeholder="메인 카피, 서브 카피, 비주얼 디렉션 등"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={() => {
                    const nextNum = (d.tocSections || []).length + 1;
                    const updated = [...(d.tocSections || []), { num: nextNum, name: "", detail: "" }];
                    onChange("tocSections", updated);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + 섹션 추가
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-gray-400 mb-2">목차가 없습니다</p>
              <button
                onClick={() => onChange("tocSections", [{ num: 1, name: "", detail: "" }])}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + 섹션 추가하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ====== Section 4: Photo & Design REF (gray heading) ====== */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-200">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <span>📷</span> Photo & Design REF
          </h2>
        </div>
        <div className="bg-white p-4 space-y-3">
          <EditField label="전체 톤앤매너" value={d.overallToneAndManner || ""} onChange={(v) => onChange("overallToneAndManner", v)} multiline />
          {/* 디자인 REF */}
          <div className="rounded-lg border border-yellow-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-yellow-100">
              <p className="text-xs font-bold text-yellow-800">디자인 REF</p>
            </div>
            <div className="p-3">
              <textarea
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none resize-none leading-relaxed"
                rows={3}
                value={d.designRef || ""}
                onChange={(e) => onChange("designRef", e.target.value)}
                placeholder="디자인 레퍼런스 설명"
              />
            </div>
          </div>
          {/* 촬영 REF */}
          <div className="rounded-lg border border-green-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-green-100">
              <p className="text-xs font-bold text-green-800">촬영 REF</p>
            </div>
            <div className="p-3">
              <textarea
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 focus:outline-none resize-none leading-relaxed"
                rows={3}
                value={d.photoRef || ""}
                onChange={(e) => onChange("photoRef", e.target.value)}
                placeholder="촬영 레퍼런스 설명"
              />
            </div>
          </div>
          <EditField label="AI 모델 페르소나" value={d.aiModelPersona || ""} onChange={(v) => onChange("aiModelPersona", v)} multiline />
          <EditField label="클라이언트 선호" value={d.clientPreference || ""} onChange={(v) => onChange("clientPreference", v)} multiline />
        </div>
      </div>

      {/* ====== Section 5: AE Commentary ====== */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-200">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <span>💬</span> AE Commentary
          </h2>
        </div>
        <div className="bg-white p-4 space-y-3">
          <EditField label="AE 코멘트" value={d.aeCommentary || ""} onChange={(v) => onChange("aeCommentary", v)} multiline />
          <EditField label="AE 노트" value={d.aeNotes || ""} onChange={(v) => onChange("aeNotes", v)} multiline placeholder="여기에 자유롭게 노트를 작성하세요" />
        </div>
      </div>

      {/* ====== 시장조사 Data (있으면 표시) ====== */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-200">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <span>📚</span> Data (시장조사)
          </h2>
        </div>
        <div className="bg-white p-4 space-y-3">
          <EditField label="트렌드" value={d.trends || ""} onChange={(v) => onChange("trends", v)} multiline />
          <EditField label="키워드" value={d.keywords || ""} onChange={(v) => onChange("keywords", v)} multiline />
          <EditField label="리서치 요약" value={d.researchSummary || ""} onChange={(v) => onChange("researchSummary", v)} multiline />
          <EditField label="광고 규제 사항" value={d.adRegulations || ""} onChange={(v) => onChange("adRegulations", v)} multiline />
          <EditField label="타겟 인사이트" value={d.targetInsight || ""} onChange={(v) => onChange("targetInsight", v)} multiline />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helper Components
// ============================================================

// 편집 섹션 wrapper (used only by special cases)
function EditSection({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-200">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span>{emoji}</span> {title}
        </h2>
      </div>
      <div className="bg-white p-4 space-y-3">
        {children}
      </div>
    </div>
  );
}

// 편집 필드 (inline style)
function EditField({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-600 mb-1 block">{label}</label>
      {multiline ? (
        <textarea
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none leading-relaxed bg-white"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

// 섹션 wrapper (used by BriefPreview for generic sections)
function BriefSection({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-200">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <span>{emoji}</span>
          {title}
        </h2>
      </div>
      <div className="bg-white p-4 space-y-3">
        {children}
      </div>
    </div>
  );
}

// 필드 표시 (read-only)
function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-600 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

// 퀄리티 체크 리포트
function QualityReport({
  result,
  getScoreColor,
  getScoreBg,
  getTotalScoreEmoji,
  getPriorityColor,
}: {
  result: QualityResult;
  getScoreColor: (s: number, m: number) => string;
  getScoreBg: (s: number, m: number) => string;
  getTotalScoreEmoji: (s: number) => string;
  getPriorityColor: (p: string) => string;
}) {
  const gradeLabels: Record<string, string> = {
    completeness: "완성도",
    specificity: "구체성",
    logic: "논리성",
    adCompliance: "광고심의",
    readability: "표현/가독성",
  };

  const gradeEmojis: Record<string, string> = {
    completeness: "📝",
    specificity: "🎯",
    logic: "🔗",
    adCompliance: "⚖️",
    readability: "✍️",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* 총점 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Brief Quality Score</p>
            <p className="text-sm text-gray-600 mt-1">{result.summary}</p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-black ${getScoreColor(result.totalScore, 100)}`}>
              {result.totalScore}
            </div>
            <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
              result.totalScore >= 80 ? "bg-green-100 text-green-700" :
              result.totalScore >= 60 ? "bg-blue-100 text-blue-700" :
              "bg-red-100 text-red-700"
            }`}>
              {getTotalScoreEmoji(result.totalScore)}
            </div>
          </div>
        </div>
      </div>

      {/* 항목별 점수 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-800">항목별 평가</h3>
        </div>
        <div className="p-4 space-y-3">
          {Object.entries(result.grades).map(([key, grade]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">
                  {gradeEmojis[key]} {gradeLabels[key] || key}
                </span>
                <span className={`text-xs font-bold ${getScoreColor(grade.score, grade.max)}`}>
                  {grade.score}/{grade.max}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${getScoreBg(grade.score, grade.max)}`}
                  style={{ width: `${(grade.score / grade.max) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{grade.comment}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 오타 */}
      {result.typos && result.typos.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <h3 className="text-sm font-bold text-red-800">
              오타/맞춤법 ({result.typos.length}건)
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {result.typos.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 bg-red-50/50 rounded-lg">
                <span className="text-red-400 mt-0.5 flex-shrink-0">!</span>
                <div>
                  <span className="line-through text-red-500">{t.original}</span>
                  <span className="mx-1.5 text-gray-400">→</span>
                  <span className="font-semibold text-green-700">{t.corrected}</span>
                  <span className="text-gray-400 ml-2">({t.location})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 개선사항 */}
      {result.improvements && result.improvements.length > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
            <h3 className="text-sm font-bold text-yellow-800">
              개선 제안 ({result.improvements.length}건)
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {result.improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 bg-yellow-50/30 rounded-lg">
                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${getPriorityColor(imp.priority)}`}>
                  {imp.priority}
                </span>
                <div>
                  <span className="font-semibold text-gray-800">[{imp.section}]</span>
                  <span className="text-gray-600 ml-1">{imp.suggestion}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 강점 */}
      {result.strengths && result.strengths.length > 0 && (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-200">
            <h3 className="text-sm font-bold text-green-800">강점</h3>
          </div>
          <div className="p-4 space-y-1.5">
            {result.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-green-500 mt-0.5">+</span>
                <span className="text-gray-700">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
