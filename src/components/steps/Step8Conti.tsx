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

const emptyProp = { item: "", qty: "", note: "" };
const emptyCut = { cutNum: 0, type: "연출", concept: "", composition: "", props: "", note: "" };

export default function Step8Conti({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const propList = data.propList || [];
  const cutDetails = data.cutDetails || [{ ...emptyCut }];
  const concept = data.conceptSummary || { background: "", keyColor: "", lighting: "", mood: "" };

  return (
    <StepFormWrapper
      stepNum={8}
      stepName="촬영콘티 생성"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 콘티 생성"
    >
      {/* 표지 정보 */}
      <div className={sectionClass}>
        <SectionHeader icon="📋" title="표지 정보" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="프로젝트명">
            <input className={inputClass} value={data.projectTitle || ""}
              placeholder="프로젝트 제목"
              onChange={(e) => onChange({ ...data, projectTitle: e.target.value })} />
          </FormField>
          <FormField label="촬영 일정">
            <input className={inputClass} type="date" value={data.shootDate || ""}
              onChange={(e) => onChange({ ...data, shootDate: e.target.value })} />
          </FormField>
          <FormField label="촬영 장소">
            <input className={inputClass} value={data.location || ""}
              placeholder="스튜디오/로케이션"
              onChange={(e) => onChange({ ...data, location: e.target.value })} />
          </FormField>
          <FormField label="담당팀">
            <input className={inputClass} value={data.team || ""}
              placeholder="기획/촬영/디자인"
              onChange={(e) => onChange({ ...data, team: e.target.value })} />
          </FormField>
        </div>
      </div>

      {/* 컷 리스트 요약 */}
      <div className={sectionClass}>
        <SectionHeader icon="🎬" title="컷 리스트 요약" />
        <div className="grid grid-cols-4 gap-3">
          <FormField label="Total">
            <input className={inputClass} type="number" value={data.totalCuts || ""}
              placeholder="총 컷수"
              onChange={(e) => onChange({ ...data, totalCuts: parseInt(e.target.value) || 0 })} />
          </FormField>
          <FormField label="연출컷">
            <input className={inputClass} type="number" value={data.styledCuts || ""}
              onChange={(e) => onChange({ ...data, styledCuts: parseInt(e.target.value) || 0 })} />
          </FormField>
          <FormField label="GIF컷">
            <input className={inputClass} type="number" value={data.gifCuts || ""}
              onChange={(e) => onChange({ ...data, gifCuts: parseInt(e.target.value) || 0 })} />
          </FormField>
          <FormField label="누끼컷">
            <input className={inputClass} type="number" value={data.nukkiCuts || ""}
              onChange={(e) => onChange({ ...data, nukkiCuts: parseInt(e.target.value) || 0 })} />
          </FormField>
        </div>
      </div>

      {/* 콘셉트 서머리 */}
      <div className={sectionClass}>
        <SectionHeader icon="🎨" title="CONCEPT SUMMARY" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="배경 톤">
            <input className={inputClass} value={concept.background}
              placeholder="예: 화이트/아이보리 톤"
              onChange={(e) => onChange({ ...data, conceptSummary: { ...concept, background: e.target.value } })} />
          </FormField>
          <FormField label="키컬러">
            <input className={inputClass} value={concept.keyColor}
              placeholder="예: #2D5A27 포레스트그린"
              onChange={(e) => onChange({ ...data, conceptSummary: { ...concept, keyColor: e.target.value } })} />
          </FormField>
          <FormField label="조명">
            <input className={inputClass} value={concept.lighting}
              placeholder="예: 소프트 자연광"
              onChange={(e) => onChange({ ...data, conceptSummary: { ...concept, lighting: e.target.value } })} />
          </FormField>
          <FormField label="무드">
            <input className={inputClass} value={concept.mood}
              placeholder="예: 클린, 모던, 내추럴"
              onChange={(e) => onChange({ ...data, conceptSummary: { ...concept, mood: e.target.value } })} />
          </FormField>
        </div>
      </div>

      {/* 촬영 공지사항 */}
      <div className={sectionClass}>
        <SectionHeader icon="📢" title="촬영 공지사항" />
        <FormField label="공지사항">
          <textarea className={textareaClass} rows={3} value={data.shootNotice || ""}
            placeholder="촬영 시 주의사항, 준비물 안내 등"
            onChange={(e) => onChange({ ...data, shootNotice: e.target.value })} />
        </FormField>
      </div>

      {/* PROP LIST */}
      <div className={sectionClass}>
        <SectionHeader icon="🧸" title="PROP LIST (소품 리스트)" />
        <div className="space-y-2">
          {propList.map((prop: any, i: number) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
              <input className={`${inputClass} flex-1`} value={prop.item} placeholder="소품명"
                onChange={(e) => {
                  const updated = [...propList]; updated[i] = { ...prop, item: e.target.value };
                  onChange({ ...data, propList: updated });
                }} />
              <input className={`${inputClass} w-20`} value={prop.qty} placeholder="수량"
                onChange={(e) => {
                  const updated = [...propList]; updated[i] = { ...prop, qty: e.target.value };
                  onChange({ ...data, propList: updated });
                }} />
              <input className={`${inputClass} flex-1`} value={prop.note} placeholder="비고"
                onChange={(e) => {
                  const updated = [...propList]; updated[i] = { ...prop, note: e.target.value };
                  onChange({ ...data, propList: updated });
                }} />
              <RemoveRowButton onClick={() => {
                onChange({ ...data, propList: propList.filter((_: any, j: number) => j !== i) });
              }} />
            </div>
          ))}
          <AddRowButton label="소품 추가" onClick={() => onChange({ ...data, propList: [...propList, { ...emptyProp }] })} />
        </div>
      </div>

      {/* 컷별 상세 */}
      <div className={sectionClass}>
        <SectionHeader icon="📸" title="연출별 콘셉트 상세" subtitle="각 컷의 구도, 소품, 콘셉트" />
        <div className="space-y-4">
          {cutDetails.map((cut: any, i: number) => (
            <div key={i} className="bg-white rounded-xl p-4 border-2 border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500 to-red-500 text-white flex items-center justify-center font-bold text-xs">
                    #{i + 1}
                  </span>
                  <select className={`${inputClass} w-28`} value={cut.type}
                    onChange={(e) => {
                      const updated = [...cutDetails]; updated[i] = { ...cut, type: e.target.value };
                      onChange({ ...data, cutDetails: updated });
                    }}>
                    <option value="연출">연출컷</option>
                    <option value="GIF">GIF컷</option>
                    <option value="누끼">누끼컷</option>
                    <option value="디테일">디테일컷</option>
                    <option value="라이프">라이프스타일</option>
                  </select>
                </div>
                {cutDetails.length > 1 && (
                  <RemoveRowButton onClick={() => {
                    onChange({ ...data, cutDetails: cutDetails.filter((_: any, j: number) => j !== i) });
                  }} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="콘셉트">
                  <textarea className={textareaClass} rows={2} value={cut.concept}
                    placeholder="촬영 콘셉트, 분위기"
                    onChange={(e) => {
                      const updated = [...cutDetails]; updated[i] = { ...cut, concept: e.target.value };
                      onChange({ ...data, cutDetails: updated });
                    }} />
                </FormField>
                <FormField label="구도/앵글">
                  <textarea className={textareaClass} rows={2} value={cut.composition}
                    placeholder="예: 45도 하이앵글, 클로즈업"
                    onChange={(e) => {
                      const updated = [...cutDetails]; updated[i] = { ...cut, composition: e.target.value };
                      onChange({ ...data, cutDetails: updated });
                    }} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="사용 소품">
                  <input className={inputClass} value={cut.props}
                    placeholder="사용할 소품 목록"
                    onChange={(e) => {
                      const updated = [...cutDetails]; updated[i] = { ...cut, props: e.target.value };
                      onChange({ ...data, cutDetails: updated });
                    }} />
                </FormField>
                <FormField label="비고">
                  <input className={inputClass} value={cut.note}
                    placeholder="추가 참고사항"
                    onChange={(e) => {
                      const updated = [...cutDetails]; updated[i] = { ...cut, note: e.target.value };
                      onChange({ ...data, cutDetails: updated });
                    }} />
                </FormField>
              </div>
            </div>
          ))}
          <AddRowButton label="컷 추가" onClick={() => onChange({ ...data, cutDetails: [...cutDetails, { ...emptyCut, cutNum: cutDetails.length + 1 }] })} />
        </div>
      </div>

      {/* 누끼 가이드 */}
      <div className={sectionClass}>
        <SectionHeader icon="✂️" title="누끼컷 가이드" />
        <FormField label="누끼 촬영 가이드">
          <textarea className={textareaClass} rows={3} value={data.nukkiGuide || ""}
            placeholder="누끼컷 촬영 시 주의사항, 제품 배치 방법 등"
            onChange={(e) => onChange({ ...data, nukkiGuide: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
