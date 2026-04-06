"use client";

import React, { useState } from "react";

export interface QualityGrade {
  score: number;
  max: number;
  comment: string;
}

export interface QCResult {
  totalScore: number;
  grades: Record<string, QualityGrade>;
  sectionFeedback?: { sectionNum: number; sectionName?: string; score: string; issues: string[]; suggestions: string[] }[];
  cutFeedback?: { cutNum: number; score: string; issues: string[]; suggestions: string[] }[];
  typos?: { original: string; corrected: string; location: string }[];
  improvements?: { section: string; priority: string; suggestion: string }[];
  strengths?: string[];
  summary: string;
}

type QCType = "plan" | "conti" | "design-guide";

const GRADE_LABELS: Record<QCType, Record<string, string>> = {
  plan: {
    strategy: "전략적 논리성",
    copywriting: "카피라이팅",
    designStructure: "디자인 구조",
    clientNeeds: "클라이언트 니즈",
    completeness: "완성도 & 실행성",
  },
  conti: {
    planAlignment: "기획안 연계",
    executability: "촬영 실행력",
    conceptConsistency: "컨셉 일관성",
    contractCompliance: "계약 조건 충족",
    qualityDetail: "품질 & 디테일",
  },
  "design-guide": {
    planDesignFit: "기획-디자인 정합성",
    contiAlignment: "촬영콘티 연계",
    designSystem: "디자인 시스템",
    executability: "실행 가능성",
    marketingEffect: "마케팅 효과",
  },
};

const GRADE_EMOJIS: Record<string, string> = {
  strategy: "🧠", copywriting: "✍️", designStructure: "📐", clientNeeds: "🤝", completeness: "📝",
  planAlignment: "🔗", executability: "🎬", conceptConsistency: "🎨", contractCompliance: "📋", qualityDetail: "🔍",
  planDesignFit: "🔗", contiAlignment: "📸", designSystem: "🎨", marketingEffect: "📈",
};

function getScoreColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 90) return "text-green-600";
  if (pct >= 70) return "text-blue-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBg(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 90) return "bg-green-500";
  if (pct >= 70) return "bg-blue-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function getLetterGrade(score: number) {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B+";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

function getPriorityColor(p: string) {
  if (p.includes("높")) return "bg-red-100 text-red-700";
  if (p.includes("중")) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

function getSectionScoreColor(s: string) {
  if (s === "A") return "bg-green-100 text-green-700";
  if (s === "B") return "bg-blue-100 text-blue-700";
  if (s === "C") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

interface Props {
  result: QCResult;
  type: QCType;
  loading?: boolean;
  onClose?: () => void;
}

export function QCButton({
  onClick,
  loading,
  score,
  type,
}: {
  onClick: () => void;
  loading: boolean;
  score?: number;
  type: QCType;
}) {
  const labels = { plan: "기획안", conti: "촬영콘티", "design-guide": "디자인 가이드" };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
        loading
          ? "bg-orange-100 text-orange-500 cursor-wait"
          : score !== undefined
          ? score >= 80
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : score >= 60
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
            : "bg-red-100 text-red-700 hover:bg-red-200"
          : "bg-orange-500 text-white hover:bg-orange-600"
      }`}
    >
      {loading ? (
        <>
          <span className="animate-spin w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full" />
          QC 검수 중...
        </>
      ) : score !== undefined ? (
        <>QC {score}점</>
      ) : (
        <>QC 체크</>
      )}
    </button>
  );
}

export default function QCReport({ result, type, loading, onClose }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const labels = GRADE_LABELS[type] || {};

  const toggleSection = (num: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-orange-300 border-t-orange-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-orange-700">QC 검수 중...</p>
          <p className="text-xs text-gray-400 mt-1">AI가 면밀히 분석하고 있습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* 닫기 버튼 */}
      {onClose && (
        <div className="flex justify-end">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
            닫기 ✕
          </button>
        </div>
      )}

      {/* ═══ 총점 카드 ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {type === "plan" ? "Plan" : type === "conti" ? "Conti" : "Design Guide"} Quality Score
            </p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{result.summary}</p>
          </div>
          <div className="text-center ml-4 flex-shrink-0">
            <div className={`text-4xl font-black ${getScoreColor(result.totalScore, 100)}`}>
              {result.totalScore}
            </div>
            <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
              result.totalScore >= 80 ? "bg-green-100 text-green-700" :
              result.totalScore >= 60 ? "bg-blue-100 text-blue-700" :
              "bg-red-100 text-red-700"
            }`}>
              {getLetterGrade(result.totalScore)}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 항목별 점수 ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-800">항목별 평가</h3>
        </div>
        <div className="p-4 space-y-3">
          {Object.entries(result.grades).map(([key, grade]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">
                  {GRADE_EMOJIS[key] || "📊"} {labels[key] || key}
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

      {/* ═══ 섹션별 피드백 (기획안/디자인가이드) ═══ */}
      {result.sectionFeedback && result.sectionFeedback.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200">
            <h3 className="text-sm font-bold text-indigo-800">
              섹션별 피드백 ({result.sectionFeedback.length}개)
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {result.sectionFeedback.map((sf, i) => {
              const isExpanded = expandedSections.has(sf.sectionNum);
              return (
                <div key={i}>
                  <button
                    onClick={() => toggleSection(sf.sectionNum)}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800">
                        섹션 {sf.sectionNum}{sf.sectionName ? `. ${sf.sectionName}` : ''}
                      </span>
                      {sf.issues?.length > 0 && (
                        <span className="text-[10px] text-gray-400">{sf.issues.length}개 이슈</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${getSectionScoreColor(sf.score)}`}>
                        {sf.score}
                      </span>
                      <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {sf.issues?.map((issue, j) => (
                        <div key={j} className="text-xs text-red-600 flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5 flex-shrink-0">!</span>
                          <span>{issue}</span>
                        </div>
                      ))}
                      {sf.suggestions?.map((sug, j) => (
                        <div key={j} className="text-xs text-blue-600 flex items-start gap-1.5">
                          <span className="text-blue-400 mt-0.5 flex-shrink-0">+</span>
                          <span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ 컷별 피드백 (촬영콘티) ═══ */}
      {result.cutFeedback && result.cutFeedback.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
            <h3 className="text-sm font-bold text-orange-800">
              촬영컷별 피드백 ({result.cutFeedback.length}컷)
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {result.cutFeedback.map((cf, i) => {
              const isExpanded = expandedSections.has(1000 + cf.cutNum);
              return (
                <div key={i}>
                  <button
                    onClick={() => toggleSection(1000 + cf.cutNum)}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 text-left"
                  >
                    <span className="text-xs font-bold text-gray-800">CUT {cf.cutNum}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${getSectionScoreColor(cf.score)}`}>
                        {cf.score}
                      </span>
                      <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {cf.issues?.map((issue, j) => (
                        <div key={j} className="text-xs text-red-600 flex items-start gap-1.5">
                          <span className="text-red-400 flex-shrink-0">!</span><span>{issue}</span>
                        </div>
                      ))}
                      {cf.suggestions?.map((sug, j) => (
                        <div key={j} className="text-xs text-blue-600 flex items-start gap-1.5">
                          <span className="text-blue-400 flex-shrink-0">+</span><span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ 오타 ═══ */}
      {result.typos && result.typos.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <h3 className="text-sm font-bold text-red-800">오타/맞춤법 ({result.typos.length}건)</h3>
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

      {/* ═══ 개선사항 ═══ */}
      {result.improvements && result.improvements.length > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
            <h3 className="text-sm font-bold text-yellow-800">개선 제안 ({result.improvements.length}건)</h3>
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

      {/* ═══ 강점 ═══ */}
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
