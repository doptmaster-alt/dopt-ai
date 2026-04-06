"use client";

import React from "react";
import {
  StepFormWrapper, SectionHeader, FormField,
  inputClass, textareaClass, sectionClass,
  AddRowButton, RemoveRowButton,
} from "./FormElements";

interface Props {
  data: any;
  onChange: (data: any) => void;
  onSave: () => void;
  onAIGenerate: () => void;
  onFigmaExport?: () => void;
  saving: boolean;
  aiLoading: boolean;
  figmaLoading?: boolean;
  status: string;
}

const emptyCompetitor = { name: "", url: "", strengths: "", pageStructure: "" };

export default function Step0Research({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const competitors = data.competitors || [{ ...emptyCompetitor }, { ...emptyCompetitor }, { ...emptyCompetitor }];

  const updateCompetitor = (idx: number, field: string, value: string) => {
    const updated = [...competitors];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...data, competitors: updated });
  };

  return (
    <StepFormWrapper
      stepNum={0}
      stepName="시장조사 & 분석"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 리서치 시작"
    >
      {/* 경쟁사 분석 */}
      <div className={sectionClass}>
        <SectionHeader icon="🔍" title="경쟁사 상세페이지 분석" subtitle="해당 업종 탑셀러 3~5개 브랜드" />
        <div className="space-y-4">
          {competitors.map((comp: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">경쟁사 {i + 1}</span>
                {competitors.length > 1 && (
                  <RemoveRowButton onClick={() => {
                    const updated = competitors.filter((_: any, j: number) => j !== i);
                    onChange({ ...data, competitors: updated });
                  }} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="브랜드명">
                  <input className={inputClass} value={comp.name} placeholder="예: 뉴트리원"
                    onChange={(e) => updateCompetitor(i, "name", e.target.value)} />
                </FormField>
                <FormField label="상세페이지 URL">
                  <input className={inputClass} value={comp.url} placeholder="https://..."
                    onChange={(e) => updateCompetitor(i, "url", e.target.value)} />
                </FormField>
              </div>
              <FormField label="강점 & 차별점">
                <textarea className={textareaClass} rows={2} value={comp.strengths}
                  placeholder="경쟁사의 주요 강점, USP, 카피 톤 등"
                  onChange={(e) => updateCompetitor(i, "strengths", e.target.value)} />
              </FormField>
              <FormField label="페이지 구조 분석">
                <textarea className={textareaClass} rows={2} value={comp.pageStructure}
                  placeholder="섹션 구성, 비주얼 스타일, 레이아웃 특징"
                  onChange={(e) => updateCompetitor(i, "pageStructure", e.target.value)} />
              </FormField>
            </div>
          ))}
          <AddRowButton
            label="경쟁사 추가"
            onClick={() => onChange({ ...data, competitors: [...competitors, { ...emptyCompetitor }] })}
          />
        </div>
      </div>

      {/* 트렌드 & 키워드 */}
      <div className={sectionClass}>
        <SectionHeader icon="📊" title="업종 트렌드 & 키워드" subtitle="최신 마케팅 트렌드, 인기 키워드" />
        <FormField label="트렌드 분석">
          <textarea className={textareaClass} rows={4} value={data.trends || ""}
            placeholder="해당 업종의 최신 마케팅 트렌드, 소비자 선호 변화 등"
            onChange={(e) => onChange({ ...data, trends: e.target.value })} />
        </FormField>
        <FormField label="주요 키워드">
          <textarea className={textareaClass} rows={3} value={data.keywords || ""}
            placeholder="네이버/쿠팡 인기 검색어, 연관 키워드 등"
            onChange={(e) => onChange({ ...data, keywords: e.target.value })} />
        </FormField>
      </div>

      {/* 타겟 인사이트 */}
      <div className={sectionClass}>
        <SectionHeader icon="🎯" title="타겟 인사이트" subtitle="타겟의 고민, 구매 결정 요소" />
        <FormField label="타겟 분석">
          <textarea className={textareaClass} rows={4} value={data.targetInsight || ""}
            placeholder="주요 고민, 구매 결정 요소, 반응하는 카피 톤, 사용 채널 등"
            onChange={(e) => onChange({ ...data, targetInsight: e.target.value })} />
        </FormField>
      </div>

      {/* 광고심의 */}
      <div className={sectionClass}>
        <SectionHeader icon="⚠️" title="광고심의 가이드" subtitle="표현 제한사항 체크" />
        <FormField label="광고심의 주의사항">
          <textarea className={textareaClass} rows={3} value={data.adRegulations || ""}
            placeholder="건기식 효능 표현, 뷰티 과대광고 등 제한사항"
            onChange={(e) => onChange({ ...data, adRegulations: e.target.value })} />
        </FormField>
      </div>

      {/* 유사 프로젝트 */}
      <div className={sectionClass}>
        <SectionHeader icon="📁" title="디옵트 유사 프로젝트 참조" subtitle="과거 작업물 참고" />
        <FormField label="유사 프로젝트">
          <textarea className={textareaClass} rows={3} value={data.similarProjects || ""}
            placeholder="과거 유사 프로젝트의 섹션 구성, 카피 스타일 참조"
            onChange={(e) => onChange({ ...data, similarProjects: e.target.value })} />
        </FormField>
      </div>

      {/* 리서치 요약 */}
      <div className={sectionClass}>
        <SectionHeader icon="📝" title="리서치 리포트 요약" />
        <FormField label="리서치 종합 정리">
          <textarea className={textareaClass} rows={6} value={data.researchSummary || ""}
            placeholder="시장조사 결과를 종합하여 브리프 작성에 활용할 핵심 인사이트 정리"
            onChange={(e) => onChange({ ...data, researchSummary: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
