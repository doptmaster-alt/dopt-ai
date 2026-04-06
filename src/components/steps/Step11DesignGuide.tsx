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

const emptyLayout = { sectionNum: 0, layoutType: "", description: "" };
const emptyMapping = { cutNum: 0, sectionNum: 0, usage: "" };

export default function Step11DesignGuide({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const tone = data.toneAndManner || { mainColor: "", subColors: "", mood: "", style: "" };
  const typo = data.typography || { headingFont: "", bodyFont: "", sizes: "", weights: "" };
  const layoutGuide = data.layoutGuide || [{ ...emptyLayout }];
  const cutMapping = data.cutSectionMapping || [{ ...emptyMapping }];

  return (
    <StepFormWrapper
      stepNum={11}
      stepName="디자인 가이드"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 가이드 생성"
    >
      {/* A. 톤앤매너 */}
      <div className={sectionClass}>
        <SectionHeader icon="🎨" title="A. 전체 톤앤매너" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="메인 컬러 (HEX)">
            <div className="flex gap-2">
              <input className={inputClass} value={tone.mainColor}
                placeholder="#2D5A27"
                onChange={(e) => onChange({ ...data, toneAndManner: { ...tone, mainColor: e.target.value } })} />
              {tone.mainColor && tone.mainColor.startsWith("#") && (
                <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0"
                  style={{ backgroundColor: tone.mainColor }} />
              )}
            </div>
          </FormField>
          <FormField label="서브 컬러">
            <input className={inputClass} value={tone.subColors}
              placeholder="#F5F0EB, #E8E0D8"
              onChange={(e) => onChange({ ...data, toneAndManner: { ...tone, subColors: e.target.value } })} />
          </FormField>
          <FormField label="무드">
            <input className={inputClass} value={tone.mood}
              placeholder="예: 클린, 모던, 내추럴"
              onChange={(e) => onChange({ ...data, toneAndManner: { ...tone, mood: e.target.value } })} />
          </FormField>
          <FormField label="스타일">
            <input className={inputClass} value={tone.style}
              placeholder="예: 미니멀, 고급감, 감성적"
              onChange={(e) => onChange({ ...data, toneAndManner: { ...tone, style: e.target.value } })} />
          </FormField>
        </div>
      </div>

      {/* B. 타이포그래피 */}
      <div className={sectionClass}>
        <SectionHeader icon="✍️" title="B. 타이포그래피" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="헤딩 폰트">
            <input className={inputClass} value={typo.headingFont}
              placeholder="예: Pretendard Bold"
              onChange={(e) => onChange({ ...data, typography: { ...typo, headingFont: e.target.value } })} />
          </FormField>
          <FormField label="본문 폰트">
            <input className={inputClass} value={typo.bodyFont}
              placeholder="예: Pretendard Regular"
              onChange={(e) => onChange({ ...data, typography: { ...typo, bodyFont: e.target.value } })} />
          </FormField>
          <FormField label="사이즈 체계">
            <input className={inputClass} value={typo.sizes}
              placeholder="예: H1 36px, H2 24px, Body 16px, Caption 12px"
              onChange={(e) => onChange({ ...data, typography: { ...typo, sizes: e.target.value } })} />
          </FormField>
          <FormField label="웨이트">
            <input className={inputClass} value={typo.weights}
              placeholder="예: Bold(700), Medium(500), Regular(400)"
              onChange={(e) => onChange({ ...data, typography: { ...typo, weights: e.target.value } })} />
          </FormField>
        </div>
      </div>

      {/* C. 섹션별 레이아웃 가이드 */}
      <div className={sectionClass}>
        <SectionHeader icon="📐" title="C. 섹션별 레이아웃 가이드" />
        <div className="space-y-2">
          {layoutGuide.map((layout: any, i: number) => (
            <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold mt-1">
                {i + 1}
              </span>
              <div className="flex-1 grid grid-cols-4 gap-2">
                <input className={inputClass} type="number" value={layout.sectionNum || ""}
                  placeholder="섹션#"
                  onChange={(e) => {
                    const updated = [...layoutGuide]; updated[i] = { ...layout, sectionNum: parseInt(e.target.value) || 0 };
                    onChange({ ...data, layoutGuide: updated });
                  }} />
                <input className={inputClass} value={layout.layoutType}
                  placeholder="레이아웃 타입"
                  onChange={(e) => {
                    const updated = [...layoutGuide]; updated[i] = { ...layout, layoutType: e.target.value };
                    onChange({ ...data, layoutGuide: updated });
                  }} />
                <div className="col-span-2">
                  <input className={inputClass} value={layout.description}
                    placeholder="상세 설명"
                    onChange={(e) => {
                      const updated = [...layoutGuide]; updated[i] = { ...layout, description: e.target.value };
                      onChange({ ...data, layoutGuide: updated });
                    }} />
                </div>
              </div>
              {layoutGuide.length > 1 && (
                <RemoveRowButton onClick={() => {
                  onChange({ ...data, layoutGuide: layoutGuide.filter((_: any, j: number) => j !== i) });
                }} />
              )}
            </div>
          ))}
          <AddRowButton label="레이아웃 가이드 추가" onClick={() => onChange({ ...data, layoutGuide: [...layoutGuide, { ...emptyLayout }] })} />
        </div>
      </div>

      {/* D. 촬영컷 ↔ 섹션 매핑 */}
      <div className={sectionClass}>
        <SectionHeader icon="🔗" title="D. 촬영컷 ↔ 섹션 매핑표" />
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-gray-500 px-2">
            <span>컷 번호</span>
            <span>섹션 번호</span>
            <span className="col-span-4">사용 용도</span>
            <span></span>
          </div>
          {cutMapping.map((map: any, i: number) => (
            <div key={i} className="grid grid-cols-7 gap-2 items-center bg-gray-50 rounded-lg p-2 border border-gray-100">
              <input className={inputClass} type="number" value={map.cutNum || ""} placeholder="컷#"
                onChange={(e) => {
                  const updated = [...cutMapping]; updated[i] = { ...map, cutNum: parseInt(e.target.value) || 0 };
                  onChange({ ...data, cutSectionMapping: updated });
                }} />
              <input className={inputClass} type="number" value={map.sectionNum || ""} placeholder="섹션#"
                onChange={(e) => {
                  const updated = [...cutMapping]; updated[i] = { ...map, sectionNum: parseInt(e.target.value) || 0 };
                  onChange({ ...data, cutSectionMapping: updated });
                }} />
              <div className="col-span-4">
                <input className={inputClass} value={map.usage} placeholder="사용 용도 (메인 이미지, 서브 이미지 등)"
                  onChange={(e) => {
                    const updated = [...cutMapping]; updated[i] = { ...map, usage: e.target.value };
                    onChange({ ...data, cutSectionMapping: updated });
                  }} />
              </div>
              <RemoveRowButton onClick={() => {
                onChange({ ...data, cutSectionMapping: cutMapping.filter((_: any, j: number) => j !== i) });
              }} />
            </div>
          ))}
          <AddRowButton label="매핑 추가" onClick={() => onChange({ ...data, cutSectionMapping: [...cutMapping, { ...emptyMapping }] })} />
        </div>
      </div>

      {/* 추가 노트 */}
      <div className={sectionClass}>
        <SectionHeader icon="📝" title="추가 노트" />
        <FormField label="디자이너 전달 사항">
          <textarea className={textareaClass} rows={4} value={data.additionalNotes || ""}
            placeholder="디자이너에게 전달할 추가 참고사항, 주의점 등"
            onChange={(e) => onChange({ ...data, additionalNotes: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
