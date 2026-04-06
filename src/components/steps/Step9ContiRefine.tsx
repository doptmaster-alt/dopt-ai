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

const emptyRevision = { cutNum: 0, field: "", before: "", after: "" };
const emptyAdded = { cutNum: 0, type: "연출", concept: "" };

export default function Step9ContiRefine({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const revisions = data.revisions || [];
  const addedCuts = data.addedCuts || [];

  return (
    <StepFormWrapper
      stepNum={9}
      stepName="콘티 수정"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 수정 제안"
    >
      {/* 수정 사항 */}
      <div className={sectionClass}>
        <SectionHeader icon="✏️" title="콘티 수정 사항" subtitle="기존 컷 수정 내역" />
        <div className="space-y-3">
          {revisions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">수정 사항을 추가해주세요.</p>
          )}
          {revisions.map((rev: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">[수정] 컷 #{rev.cutNum || "?"}</span>
                <RemoveRowButton onClick={() => {
                  onChange({ ...data, revisions: revisions.filter((_: any, j: number) => j !== i) });
                }} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="컷 번호">
                  <input className={inputClass} type="number" value={rev.cutNum || ""}
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, cutNum: parseInt(e.target.value) || 0 };
                      onChange({ ...data, revisions: updated });
                    }} />
                </FormField>
                <FormField label="수정 항목">
                  <select className={inputClass} value={rev.field}
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, field: e.target.value };
                      onChange({ ...data, revisions: updated });
                    }}>
                    <option value="">선택</option>
                    <option value="concept">콘셉트</option>
                    <option value="composition">구도</option>
                    <option value="props">소품</option>
                    <option value="type">촬영 타입</option>
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="수정 전">
                  <textarea className={textareaClass} rows={2} value={rev.before}
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, before: e.target.value };
                      onChange({ ...data, revisions: updated });
                    }} />
                </FormField>
                <FormField label="수정 후">
                  <textarea className={textareaClass} rows={2} value={rev.after}
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, after: e.target.value };
                      onChange({ ...data, revisions: updated });
                    }} />
                </FormField>
              </div>
            </div>
          ))}
          <AddRowButton label="수정 사항 추가" onClick={() => onChange({ ...data, revisions: [...revisions, { ...emptyRevision }] })} />
        </div>
      </div>

      {/* 추가 컷 */}
      <div className={sectionClass}>
        <SectionHeader icon="➕" title="추가 컷" subtitle="새로 추가할 촬영 컷" />
        <div className="space-y-3">
          {addedCuts.map((cut: any, i: number) => (
            <div key={i} className="flex items-start gap-3 bg-green-50 rounded-lg p-3 border border-green-200">
              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded mt-1">[추가]</span>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <select className={inputClass} value={cut.type}
                  onChange={(e) => {
                    const updated = [...addedCuts]; updated[i] = { ...cut, type: e.target.value };
                    onChange({ ...data, addedCuts: updated });
                  }}>
                  <option value="연출">연출컷</option>
                  <option value="GIF">GIF컷</option>
                  <option value="누끼">누끼컷</option>
                  <option value="디테일">디테일컷</option>
                </select>
                <div className="col-span-2">
                  <input className={inputClass} value={cut.concept} placeholder="컷 콘셉트"
                    onChange={(e) => {
                      const updated = [...addedCuts]; updated[i] = { ...cut, concept: e.target.value };
                      onChange({ ...data, addedCuts: updated });
                    }} />
                </div>
              </div>
              <RemoveRowButton onClick={() => {
                onChange({ ...data, addedCuts: addedCuts.filter((_: any, j: number) => j !== i) });
              }} />
            </div>
          ))}
          <AddRowButton label="컷 추가" onClick={() => onChange({ ...data, addedCuts: [...addedCuts, { ...emptyAdded }] })} />
        </div>
      </div>

      {/* 수정된 콘티 */}
      <div className={sectionClass}>
        <SectionHeader icon="📋" title="수정된 콘티 요약" />
        <FormField label="수정 콘티 요약">
          <textarea className={textareaClass} rows={8} value={data.revisedConti || ""}
            placeholder="수정이 반영된 촬영콘티 전체 요약"
            onChange={(e) => onChange({ ...data, revisedConti: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
