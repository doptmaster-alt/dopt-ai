"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Props {
  projectId: number;
  currentStep: number;
  refreshKey?: number;
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
  slogan?: string;
  mainTarget?: string;
  massTarget?: string;
  totalSections?: number;
  uspTable?: { item: string; detail: string; vsCompetitor: string; adCheck: string; direction: string }[];
  tocSections?: { num: number; name: string; detail: string }[];
  clientPreference?: string;
  designRef?: string;
  photoRef?: string;
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

export default function BriefPanel({ projectId, currentStep, refreshKey }: Props) {
  const [briefData, setBriefData] = useState<BriefData>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "raw">("preview");
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [showQuality, setShowQuality] = useState(false);

  const fetchBriefData = useCallback(async () => {
    setLoading(true);
    try {
      // 현재 스텝의 데이터를 우선, 없으면 가장 최신 브리프 스텝 데이터 사용
      const res = await fetch(`/api/projects/${projectId}/step-data`);
      if (res.ok) {
        const allData = await res.json();
        // step 0~4 데이터만 필터, 최근 업데이트 순으로 정렬
        const briefSteps = allData
          .filter((d: any) => d.step <= 4 && d.formData && Object.keys(d.formData).length > 0)
          .sort((a: any, b: any) => {
            // updatedAt 기준 최신 우선, 없으면 step 역순
            const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return timeB - timeA;
          });

        if (briefSteps.length > 0) {
          // 가장 최근에 업데이트된 데이터를 기본으로 사용
          const base = briefSteps[0].formData;
          const merged: BriefData = { ...base };

          // 나머지에서 빈 필드만 보충
          for (let i = 1; i < briefSteps.length; i++) {
            for (const [key, val] of Object.entries(briefSteps[i].formData)) {
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

  // 노션에 붙여넣기 좋은 마크다운 형식으로 변환
  const generateNotionText = (): string => {
    const lines: string[] = [];
    const d = briefData;

    // 헤더
    lines.push(`# ${d.productName || "브리프"}`);
    if (d.slogan) lines.push(`> ${d.slogan}`);
    lines.push("");

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

    // 💡 레퍼런스
    if (d.designRef || d.photoRef || d.similarProjects) {
      lines.push("## 💡 레퍼런스");
      lines.push("");
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
    if (d.uspTable && d.uspTable.length > 0) {
      lines.push("## ⭐️ USP");
      lines.push("");
      lines.push("| 항목 | 상세 | vs 경쟁사 | 광고심의 | 방향 |");
      lines.push("|---|---|---|---|---|");
      for (const u of d.uspTable) {
        lines.push(`| ${u.item || ""} | ${u.detail || ""} | ${u.vsCompetitor || ""} | ${u.adCheck || ""} | ${u.direction || ""} |`);
      }
      lines.push("");
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
    if (d.photoRef || d.aiModelPersona) {
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
      lines.push(`총 섹션 수: ${d.totalSections || d.tocSections.length}개`);
      lines.push("");
      lines.push("| 섹션 | 이름 | 상세 |");
      lines.push("|---|---|---|");
      for (const s of d.tocSections) {
        lines.push(`| 섹션${s.num} | ${s.name || ""} | ${s.detail || ""} |`);
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

  if (isEmpty) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">📋</span>
            <span className="text-sm font-semibold text-gray-800">노션 브리프</span>
            <span className="text-xs text-gray-400">STEP {currentStep}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
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
                  <p className="text-sm font-medium text-gray-800">노션에 복사 붙여넣기</p>
                  <p className="text-xs text-gray-500">"복사" 버튼을 클릭하면 노션에 바로 붙여넣을 수 있어요</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">📋</span>
            <span className="text-sm font-semibold text-gray-800">노션 브리프</span>
            <span className="text-xs text-gray-400">STEP {currentStep}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab 전환 */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => { setActiveTab("preview"); setShowQuality(false); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === "preview" && !showQuality ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                미리보기
              </button>
              <button
                onClick={() => { setActiveTab("raw"); setShowQuality(false); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === "raw" && !showQuality ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                마크다운
              </button>
              {qualityResult && (
                <button
                  onClick={() => setShowQuality(true)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    showQuality ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  QC {qualityResult.totalScore}점
                </button>
              )}
            </div>
            <button
              onClick={handleQualityCheck}
              disabled={qualityLoading}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                qualityLoading
                  ? "bg-gray-200 text-gray-500 cursor-wait"
                  : "bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              {qualityLoading ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  검수 중...
                </>
              ) : "QC 체크"}
            </button>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                copied
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {copied ? "복사됨!" : "노션 복사"}
            </button>
            <button
              onClick={fetchBriefData}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100"
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
          <div className="p-6">
            <BriefPreview data={briefData} />
          </div>
        ) : (
          <div className="p-4">
            <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap bg-white border border-gray-200 rounded-xl p-4 leading-relaxed">
              {generateNotionText()}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// 노션 스타일 미리보기 컴포넌트
function BriefPreview({ data }: { data: BriefData }) {
  const d = data;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      {d.productName && (
        <div className="pb-4 border-b-2 border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">{d.productName}</h1>
          {d.slogan && (
            <p className="mt-2 text-base text-gray-500 italic">{d.slogan}</p>
          )}
        </div>
      )}

      {/* 📚 Data */}
      {(d.researchSummary || d.trends || d.keywords || (d.competitors && d.competitors.length > 0)) && (
        <BriefSection emoji="📚" title="Data">
          {d.trends && <BriefField label="트렌드" value={d.trends} />}
          {d.keywords && <BriefField label="키워드" value={d.keywords} />}
          {d.competitors && d.competitors.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">경쟁사 분석</p>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">경쟁사</th>
                      <th className="px-3 py-2 text-left font-semibold">강점</th>
                      <th className="px-3 py-2 text-left font-semibold">페이지 구조</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.competitors.map((c, i) => (
                      <tr key={i} className="hover:bg-blue-50/50">
                        <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                        <td className="px-3 py-2 text-gray-700">{c.strengths}</td>
                        <td className="px-3 py-2 text-gray-700">{c.pageStructure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {d.researchSummary && <BriefField label="리서치 요약" value={d.researchSummary} />}
          {d.adRegulations && <BriefField label="광고 규제 사항" value={d.adRegulations} />}
        </BriefSection>
      )}

      {/* 💡 레퍼런스 */}
      {(d.designRef || d.photoRef || d.similarProjects) && (
        <BriefSection emoji="💡" title="레퍼런스">
          {d.designRef && <BriefField label="디자인 레퍼런스" value={d.designRef} />}
          {d.photoRef && <BriefField label="촬영 레퍼런스" value={d.photoRef} />}
          {d.similarProjects && <BriefField label="유사 프로젝트" value={d.similarProjects} />}
        </BriefSection>
      )}

      {/* 🚨 Issue */}
      {(d.adRegulations || d.targetInsight) && (
        <BriefSection emoji="🚨" title="Issue">
          {d.adRegulations && <BriefField label="광고심의 이슈" value={d.adRegulations} />}
          {d.targetInsight && <BriefField label="타겟 인사이트" value={d.targetInsight} />}
        </BriefSection>
      )}

      {/* ⭐️ USP */}
      {d.uspTable && d.uspTable.length > 0 && (
        <BriefSection emoji="⭐️" title="USP">
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">항목</th>
                  <th className="px-3 py-2 text-left font-semibold">상세</th>
                  <th className="px-3 py-2 text-left font-semibold">vs 경쟁사</th>
                  <th className="px-3 py-2 text-left font-semibold">광고심의</th>
                  <th className="px-3 py-2 text-left font-semibold">방향</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.uspTable.map((u, i) => (
                  <tr key={i} className="hover:bg-blue-50/50">
                    <td className="px-3 py-2 font-medium text-gray-900">{u.item}</td>
                    <td className="px-3 py-2 text-gray-700">{u.detail}</td>
                    <td className="px-3 py-2 text-gray-700">{u.vsCompetitor}</td>
                    <td className="px-3 py-2 text-gray-700">{u.adCheck}</td>
                    <td className="px-3 py-2 text-gray-700">{u.direction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BriefSection>
      )}

      {/* 📌 Target */}
      {(d.mainTarget || d.massTarget) && (
        <BriefSection emoji="📌" title="Target">
          {d.mainTarget && <BriefField label="메인 타겟" value={d.mainTarget} />}
          {d.massTarget && <BriefField label="매스 타겟" value={d.massTarget} />}
        </BriefSection>
      )}

      {/* 📷 촬영컨셉 */}
      {(d.aiModelPersona || d.clientPreference) && (
        <BriefSection emoji="📷" title="촬영컨셉">
          {d.aiModelPersona && <BriefField label="AI 모델 페르소나" value={d.aiModelPersona} />}
          {d.clientPreference && <BriefField label="클라이언트 선호" value={d.clientPreference} />}
        </BriefSection>
      )}

      {/* 📃 기획방향 / 목차 */}
      {d.tocSections && d.tocSections.length > 0 && (
        <BriefSection emoji="📃" title="기획방향 / 상세페이지 목차">
          <p className="text-xs text-gray-500 mb-2">
            총 섹션 수: <span className="font-bold text-gray-800">{d.totalSections || d.tocSections.length}개</span>
          </p>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold w-16">섹션</th>
                  <th className="px-3 py-2 text-left font-semibold w-28">이름</th>
                  <th className="px-3 py-2 text-left font-semibold">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.tocSections.map((s, i) => (
                  <tr key={i} className="hover:bg-blue-50/50">
                    <td className="px-3 py-2 font-bold text-blue-700">섹션{s.num}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-3 py-2 text-gray-700">{s.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BriefSection>
      )}

      {/* 💬 AE Commentary */}
      {(d.aeCommentary || d.aeNotes) && (
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl px-4 py-3">
          <div className="text-xs font-bold text-amber-700 mb-1">💬 AE Commentary</div>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{d.aeCommentary || d.aeNotes}</p>
        </div>
      )}

      {/* 🔄 피드백 반영 */}
      {d.feedbackItems && d.feedbackItems.length > 0 && (
        <BriefSection emoji="🔄" title="피드백 반영 내역">
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">섹션</th>
                  <th className="px-3 py-2 text-left font-semibold">피드백</th>
                  <th className="px-3 py-2 text-left font-semibold">조치</th>
                  <th className="px-3 py-2 text-left font-semibold w-12">심의</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.feedbackItems.map((f, i) => (
                  <tr key={i} className="hover:bg-blue-50/50">
                    <td className="px-3 py-2 font-medium text-gray-900">{f.section}</td>
                    <td className="px-3 py-2 text-gray-700">{f.feedback}</td>
                    <td className="px-3 py-2 text-gray-700">{f.action}</td>
                    <td className="px-3 py-2 text-center">{f.adCheckConflict ? "⚠️" : "✅"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BriefSection>
      )}

      {/* ✅ 최종 브리프 */}
      {(d.finalBrief || d.revisedBrief) && (
        <BriefSection emoji="✅" title="최종 브리프">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {d.revisedBrief || d.finalBrief}
            </p>
          </div>
        </BriefSection>
      )}
    </div>
  );
}

// 섹션 wrapper
function BriefSection({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span>{emoji}</span>
          {title}
        </h2>
      </div>
      <div className="p-4 space-y-3">
        {children}
      </div>
    </div>
  );
}

// 필드 표시
function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
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
