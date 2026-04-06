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

const emptyUsp = { item: "", detail: "", vsCompetitor: "", adCheck: "", direction: "" };
const emptyToc = { num: 0, name: "", detail: "" };

export default function Step1Brief({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const uspTable = data.uspTable || [{ ...emptyUsp }];
  const tocSections = data.tocSections || [{ ...emptyToc }];

  return (
    <StepFormWrapper
      stepNum={1}
      stepName="브리프 초안 생성"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 브리프 생성"
    >
      {/* 제품 개요 */}
      <div className={sectionClass}>
        <SectionHeader icon="💡" title="제품 개요" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="제품명" required>
            <input className={inputClass} value={data.productName || ""}
              placeholder="제품 이름"
              onChange={(e) => onChange({ ...data, productName: e.target.value })} />
          </FormField>
          <FormField label="슬로건">
            <input className={inputClass} value={data.slogan || ""}
              placeholder="한 줄 슬로건"
              onChange={(e) => onChange({ ...data, slogan: e.target.value })} />
          </FormField>
          <FormField label="주요 타겟" required>
            <input className={inputClass} value={data.mainTarget || ""}
              placeholder="예: 30-40대 여성, 건강 관심 높음"
              onChange={(e) => onChange({ ...data, mainTarget: e.target.value })} />
          </FormField>
          <FormField label="매스 타겟">
            <input className={inputClass} value={data.massTarget || ""}
              placeholder="예: 20-50대 남녀"
              onChange={(e) => onChange({ ...data, massTarget: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Total 섹션 수">
          <input className={inputClass} type="number" value={data.totalSections || ""}
            placeholder="예: 14"
            onChange={(e) => onChange({ ...data, totalSections: parseInt(e.target.value) || 0 })} />
        </FormField>
      </div>

      {/* USP 분석 테이블 */}
      <div className={sectionClass}>
        <SectionHeader icon="⚡" title="USP 분석 테이블" subtitle="핵심 셀링포인트별 상세 분석" />
        <div className="space-y-3">
          {uspTable.map((usp: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">USP {i + 1}</span>
                {uspTable.length > 1 && (
                  <RemoveRowButton onClick={() => {
                    onChange({ ...data, uspTable: uspTable.filter((_: any, j: number) => j !== i) });
                  }} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="항목">
                  <input className={inputClass} value={usp.item} placeholder="USP 항목명"
                    onChange={(e) => {
                      const updated = [...uspTable]; updated[i] = { ...usp, item: e.target.value };
                      onChange({ ...data, uspTable: updated });
                    }} />
                </FormField>
                <FormField label="경쟁사 대비">
                  <input className={inputClass} value={usp.vsCompetitor} placeholder="차별화 포인트"
                    onChange={(e) => {
                      const updated = [...uspTable]; updated[i] = { ...usp, vsCompetitor: e.target.value };
                      onChange({ ...data, uspTable: updated });
                    }} />
                </FormField>
              </div>
              <FormField label="상세 내용">
                <textarea className={textareaClass} rows={2} value={usp.detail}
                  placeholder="USP 상세 설명"
                  onChange={(e) => {
                    const updated = [...uspTable]; updated[i] = { ...usp, detail: e.target.value };
                    onChange({ ...data, uspTable: updated });
                  }} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="광고심의 체크">
                  <input className={inputClass} value={usp.adCheck} placeholder="✅ 표현 가능 / ⚠️ 주의"
                    onChange={(e) => {
                      const updated = [...uspTable]; updated[i] = { ...usp, adCheck: e.target.value };
                      onChange({ ...data, uspTable: updated });
                    }} />
                </FormField>
                <FormField label="표현 방향">
                  <input className={inputClass} value={usp.direction} placeholder="카피/비주얼 방향"
                    onChange={(e) => {
                      const updated = [...uspTable]; updated[i] = { ...usp, direction: e.target.value };
                      onChange({ ...data, uspTable: updated });
                    }} />
                </FormField>
              </div>
            </div>
          ))}
          <AddRowButton label="USP 추가" onClick={() => onChange({ ...data, uspTable: [...uspTable, { ...emptyUsp }] })} />
        </div>
      </div>

      {/* 상세페이지 목차 */}
      <div className={sectionClass}>
        <SectionHeader icon="📄" title="상세페이지 목차 (TOC)" subtitle="섹션별 구성 및 러프 카피" />
        <p className="text-xs text-gray-400 mb-3 ml-7">* 목차는 기획안 작성 시 변동될 수 있습니다. 러프 카피는 추후 디벨롭됩니다.</p>
        <div className="space-y-2">
          {tocSections.map((sec: any, i: number) => (
            <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold mt-1">
                {i + 1}
              </span>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <input className={inputClass} value={sec.name} placeholder="섹션명"
                  onChange={(e) => {
                    const updated = [...tocSections]; updated[i] = { ...sec, num: i + 1, name: e.target.value };
                    onChange({ ...data, tocSections: updated });
                  }} />
                <div className="col-span-2">
                  <input className={inputClass} value={sec.detail} placeholder="상세 내용 (러프 카피 + 📷/🎨 방향)"
                    onChange={(e) => {
                      const updated = [...tocSections]; updated[i] = { ...sec, num: i + 1, detail: e.target.value };
                      onChange({ ...data, tocSections: updated });
                    }} />
                </div>
              </div>
              {tocSections.length > 1 && (
                <RemoveRowButton onClick={() => {
                  onChange({ ...data, tocSections: tocSections.filter((_: any, j: number) => j !== i) });
                }} />
              )}
            </div>
          ))}
          <AddRowButton label="섹션 추가" onClick={() => onChange({ ...data, tocSections: [...tocSections, { ...emptyToc }] })} />
        </div>
      </div>

      {/* Photo & Design REF */}
      <div className={sectionClass}>
        <SectionHeader icon="📷" title="Photo & Design REF 방향" />
        <FormField label="업체 선호 방향성">
          <textarea className={textareaClass} rows={2} value={data.clientPreference || ""}
            placeholder="클라이언트가 원하는 톤앤매너, 선호 스타일"
            onChange={(e) => onChange({ ...data, clientPreference: e.target.value })} />
        </FormField>
        <FormField label="디자인 REF">
          <textarea className={textareaClass} rows={2} value={data.designRef || ""}
            placeholder="디자인 레퍼런스 URL 및 설명"
            onChange={(e) => onChange({ ...data, designRef: e.target.value })} />
        </FormField>
        <FormField label="촬영 REF">
          <textarea className={textareaClass} rows={2} value={data.photoRef || ""}
            placeholder="촬영 레퍼런스 URL 및 설명"
            onChange={(e) => onChange({ ...data, photoRef: e.target.value })} />
        </FormField>
        <FormField label="AI 모델 페르소나 (해당 시)">
          <textarea className={textareaClass} rows={2} value={data.aiModelPersona || ""}
            placeholder="연령, 스타일, 의상, 표정, 배경 등"
            onChange={(e) => onChange({ ...data, aiModelPersona: e.target.value })} />
        </FormField>
      </div>

      {/* AE Commentary */}
      <div className={sectionClass}>
        <SectionHeader icon="💬" title="AE's Commentary" subtitle="전략적 기획 의도 및 코멘터리" />
        <FormField label="AE 코멘터리">
          <textarea className={textareaClass} rows={4} value={data.aeCommentary || ""}
            placeholder="기획 전략, 차별화 포인트, 클라이언트 확인 요청사항 등"
            onChange={(e) => onChange({ ...data, aeCommentary: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
