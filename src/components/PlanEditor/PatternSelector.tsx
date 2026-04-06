"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { DesignPattern, SectionType } from "./types";
import { SECTION_TYPE_LABELS } from "./types";
import type { WireframeBlock, CopyBlock, SectionData } from "./types";
import WireframeBlockRenderer from "./WireframeBlockRenderer";

interface Props {
  sectionNum: number;
  sectionName: string;
  industry?: string;
  onApplyPattern: (pattern: DesignPattern, sectionNum: number) => void;
  onClose: () => void;
}

export default function PatternSelector({ sectionNum, sectionName, industry, onApplyPattern, onClose }: Props) {
  const [patterns, setPatterns] = useState<DesignPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [inferredType, setInferredType] = useState<string>("");
  const [selectedPattern, setSelectedPattern] = useState<DesignPattern | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // 패턴 로드
  const loadPatterns = useCallback(async (type?: string, search?: string) => {
    setLoading(true);
    try {
      let url = "/api/design-patterns?";
      if (search) {
        url += `search=${encodeURIComponent(search)}`;
      } else if (type) {
        url += `sectionType=${type}`;
      } else {
        url += `sectionName=${encodeURIComponent(sectionName)}`;
      }
      if (industry) url += `&industry=${encodeURIComponent(industry)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPatterns(data.patterns || []);
        if (data.inferredType && !filterType) {
          setInferredType(data.inferredType);
        }
      }
    } catch (e) {
      console.error("[PatternSelector] Load error:", e);
    }
    setLoading(false);
  }, [sectionName, industry, filterType]);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  // 필터 변경
  const handleFilterChange = (type: string) => {
    setFilterType(type);
    setSelectedPattern(null);
    if (type) {
      loadPatterns(type);
    } else {
      loadPatterns();
    }
  };

  // 검색
  const handleSearch = () => {
    if (searchQuery.trim()) {
      loadPatterns(undefined, searchQuery.trim());
    }
  };

  // 패턴 적용
  const handleApply = async (pattern: DesignPattern) => {
    // 사용 기록
    try {
      await fetch("/api/design-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", patternId: pattern.id, sectionNum }),
      });
    } catch {}
    onApplyPattern(pattern, sectionNum);
  };

  // 좋아요/싫어요
  const handleFeedback = async (pattern: DesignPattern, action: "like" | "dislike") => {
    try {
      await fetch("/api/design-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, patternId: pattern.id, sectionNum }),
      });
      // 점수 업데이트 반영
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === pattern.id
            ? { ...p, score: p.score + (action === "like" ? 0.5 : -0.3) }
            : p
        )
      );
    } catch {}
  };

  const activeType = filterType || inferredType;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              디자인 패턴 선택
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              섹션 {sectionNum}. {sectionName}
              {activeType && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {SECTION_TYPE_LABELS[activeType as SectionType] || activeType}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* 필터 바 */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => handleFilterChange("")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                !filterType ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border"
              }`}
            >
              AI 추천
            </button>
            {Object.entries(SECTION_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  filterType === key ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="패턴 검색..."
              className="px-3 py-1.5 text-xs border rounded-lg w-40"
            />
            <button onClick={handleSearch} className="px-3 py-1.5 text-xs bg-gray-200 rounded-lg hover:bg-gray-300">
              검색
            </button>
          </div>
        </div>

        {/* 패턴 목록 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-gray-400">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">패턴을 불러오는 중...</span>
              </div>
            </div>
          ) : patterns.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-3">🎨</p>
              <p className="text-sm">해당 유형의 패턴이 아직 없습니다</p>
              <p className="text-xs mt-1">프로젝트를 진행하면서 AI가 자동으로 패턴을 학습합니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  onClick={() => setSelectedPattern(selectedPattern?.id === pattern.id ? null : pattern)}
                  className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedPattern?.id === pattern.id
                      ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50/30"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* 패턴 헤더 */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm text-gray-900">{pattern.pattern_name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{pattern.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {pattern.source === "learned" && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">AI 학습</span>
                      )}
                      {pattern.source === "seed" && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">기본</span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {pattern.usage_count > 0 ? `${pattern.usage_count}회 사용` : ""}
                      </span>
                    </div>
                  </div>

                  {/* 와이어프레임 미니 프리뷰 */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="space-y-1.5 max-h-48 overflow-hidden">
                      {pattern.wireframe_blocks.slice(0, 5).map((block: WireframeBlock, i: number) => (
                        <MiniWireframeBlock key={i} block={block} />
                      ))}
                      {pattern.wireframe_blocks.length > 5 && (
                        <p className="text-[10px] text-gray-400 text-center">
                          +{pattern.wireframe_blocks.length - 5}개 블록 더보기
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 태그 */}
                  {pattern.tags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pattern.tags.split(",").slice(0, 4).map((tag, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 선택된 패턴 액션 */}
                  {selectedPattern?.id === pattern.id && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(pattern);
                        }}
                        className="flex-1 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
                      >
                        이 패턴 적용하기
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFeedback(pattern, "like");
                        }}
                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm"
                        title="좋아요 — AI가 학습합니다"
                      >
                        👍
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFeedback(pattern, "dislike");
                        }}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                        title="별로에요 — AI가 학습합니다"
                      >
                        👎
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 정보 */}
        <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {patterns.length}개 패턴 · 프로젝트 진행 시 AI가 자동으로 새로운 패턴을 학습합니다
          </p>
          <button onClick={onClose} className="px-4 py-1.5 text-xs text-gray-600 hover:text-gray-800 border rounded-lg">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 미니 와이어프레임 블록 — 패턴 목록에서 미리보기용 축소판
 */
function MiniWireframeBlock({ block }: { block: WireframeBlock }) {
  const baseStyle = "text-[9px] text-gray-500";

  switch (block.type) {
    case "wf-heading":
      return (
        <div className={`${baseStyle} font-bold text-gray-700 ${block.align === "center" ? "text-center" : ""}`}>
          {block.text || "제목"}
        </div>
      );
    case "wf-text":
      return (
        <div className={`${baseStyle} ${block.align === "center" ? "text-center" : ""}`}>
          {block.text || "텍스트"}
        </div>
      );
    case "wf-image":
    case "wf-video":
      return (
        <div className="bg-gray-200 rounded h-10 flex items-center justify-center">
          <span className="text-[9px] text-gray-400">{block.type === "wf-video" ? "▶ " : "🖼 "}{block.text || "이미지"}</span>
        </div>
      );
    case "wf-icon-list":
    case "wf-card-grid":
    case "wf-badge-row":
    case "wf-trust-badges":
      return (
        <div className="flex gap-1 flex-wrap">
          {(block.items || []).slice(0, 4).map((item, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-gray-200 rounded text-[8px] text-gray-500">
              {item.label}
            </span>
          ))}
        </div>
      );
    case "wf-number-highlight":
    case "wf-stats":
      return (
        <div className="flex gap-2 justify-center">
          {(block.items || []).map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-[10px] font-bold text-gray-600">{item.value}</div>
              <div className="text-[8px] text-gray-400">{item.label}</div>
            </div>
          ))}
        </div>
      );
    case "wf-table":
      return (
        <div className="border border-gray-200 rounded overflow-hidden">
          {block.headers && (
            <div className="flex bg-gray-200">
              {block.headers.map((h, i) => (
                <span key={i} className="flex-1 px-1 py-0.5 text-[8px] text-gray-500 text-center">{h}</span>
              ))}
            </div>
          )}
          <div className="text-[8px] text-gray-400 text-center py-0.5">테이블 데이터</div>
        </div>
      );
    case "wf-timeline":
      return (
        <div className="flex gap-1 items-center justify-center">
          {(block.items || []).map((item, i) => (
            <React.Fragment key={i}>
              <span className="px-1 py-0.5 bg-gray-200 rounded text-[8px] text-gray-500">{item.label}</span>
              {i < (block.items?.length || 0) - 1 && <span className="text-gray-300">→</span>}
            </React.Fragment>
          ))}
        </div>
      );
    case "wf-button":
      return (
        <div className={`${block.align === "center" ? "text-center" : ""}`}>
          <span className="inline-block px-3 py-1 bg-gray-300 rounded text-[9px] text-gray-600">{block.text || "버튼"}</span>
        </div>
      );
    case "wf-divider":
      return <div className="border-t border-gray-200 my-1" />;
    case "wf-checklist":
      return (
        <div className="space-y-0.5">
          {(block.items || []).slice(0, 3).map((item, i) => (
            <div key={i} className="text-[8px] text-gray-500">☑ {item.label}</div>
          ))}
        </div>
      );
    case "wf-bar-chart":
      return (
        <div className="space-y-0.5">
          {(block.items || []).slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-[8px] text-gray-400 w-10 truncate">{item.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-gray-400 h-2 rounded-full" style={{ width: `${item.percent || 50}%` }} />
              </div>
            </div>
          ))}
        </div>
      );
    default:
      return (
        <div className="text-[8px] text-gray-400">[{block.type}] {block.text || ""}</div>
      );
  }
}
