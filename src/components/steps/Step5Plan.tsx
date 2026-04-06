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

const emptySection = {
  num: 0, name: "", mainCopy: "", subCopy: "",
  visualDirection: "", layout: "", reference: "", aeCommentary: "",
};

export default function Step5Plan({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const sections = data.sections || [{ ...emptySection }];

  const updateSection = (idx: number, field: string, value: string) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...data, sections: updated });
  };

  return (
    <StepFormWrapper
      stepNum={5}
      stepName="기획안 초안 생성"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 기획안 생성"
    >
      {/* 전체 톤 */}
      <div className={sectionClass}>
        <SectionHeader icon="🎨" title="전체 디자인 톤" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="디자인 톤">
            <input className={inputClass} value={data.designTone || ""}
              placeholder="예: 클린, 모던, 내추럴"
              onChange={(e) => onChange({ ...data, designTone: e.target.value })} />
          </FormField>
          <FormField label="컬러 스킴">
            <input className={inputClass} value={data.colorScheme || ""}
              placeholder="예: #2D5A27 포레스트그린 + #F5F0EB 아이보리"
              onChange={(e) => onChange({ ...data, colorScheme: e.target.value })} />
          </FormField>
        </div>
        <FormField label="전체 기획 노트">
          <textarea className={textareaClass} rows={2} value={data.overallNote || ""}
            placeholder="기획안 전체에 적용되는 노트"
            onChange={(e) => onChange({ ...data, overallNote: e.target.value })} />
        </FormField>
      </div>

      {/* 섹션별 기획안 */}
      <div className={sectionClass}>
        <SectionHeader icon="📑" title="섹션별 상세 기획안" subtitle="각 섹션의 카피, 비주얼, 레이아웃을 상세 기획" />
        <div className="space-y-4">
          {sections.map((sec: any, i: number) => (
            <div key={i} className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </span>
                  <input className={`${inputClass} font-semibold text-base`} value={sec.name}
                    placeholder="섹션명 입력"
                    onChange={(e) => updateSection(i, "name", e.target.value)} />
                </div>
                {sections.length > 1 && (
                  <RemoveRowButton onClick={() => {
                    onChange({ ...data, sections: sections.filter((_: any, j: number) => j !== i) });
                  }} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <FormField label="메인 카피 (볼드)">
                  <textarea className={textareaClass} rows={2} value={sec.mainCopy}
                    placeholder="짧고 임팩트 있는 메인 카피"
                    onChange={(e) => updateSection(i, "mainCopy", e.target.value)} />
                </FormField>
                <FormField label="서브 카피">
                  <textarea className={textareaClass} rows={2} value={sec.subCopy}
                    placeholder="메인 카피 보충 설명"
                    onChange={(e) => updateSection(i, "subCopy", e.target.value)} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <FormField label="비주얼 디렉션">
                  <textarea className={textareaClass} rows={2} value={sec.visualDirection}
                    placeholder="📷 촬영컷 / 🎨 디자인 / AI 모델 등"
                    onChange={(e) => updateSection(i, "visualDirection", e.target.value)} />
                </FormField>
                <FormField label="레이아웃">
                  <input className={inputClass} value={sec.layout}
                    placeholder="예: 좌 이미지 + 우 텍스트, 풀 와이드"
                    onChange={(e) => updateSection(i, "layout", e.target.value)} />
                </FormField>
              </div>

              <FormField label="레퍼런스">
                <input className={inputClass} value={sec.reference}
                  placeholder="참고 레퍼런스 URL 또는 설명"
                  onChange={(e) => updateSection(i, "reference", e.target.value)} />
              </FormField>

              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <label className="block text-xs font-semibold text-yellow-700 mb-1">💬 AE&apos;s Commentary</label>
                <textarea
                  className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none resize-y min-h-[50px] bg-white"
                  rows={2} value={sec.aeCommentary}
                  placeholder="이 섹션의 기획 의도 + 차별화 포인트 + 클라이언트 확인사항"
                  onChange={(e) => updateSection(i, "aeCommentary", e.target.value)} />
              </div>
            </div>
          ))}
          <AddRowButton label="섹션 추가" onClick={() => onChange({ ...data, sections: [...sections, { ...emptySection, num: sections.length + 1 }] })} />
        </div>
      </div>
    </StepFormWrapper>
  );
}
