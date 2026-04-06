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

const emptyRevision = { sectionNum: 0, field: "", before: "", after: "", alternatives: ["", ""] };

export default function Step6PlanRefine({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const revisions = data.revisions || [];

  return (
    <StepFormWrapper
      stepNum={6}
      stepName="기획안 다듬기"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 카피 대안 제안"
    >
      <div className={sectionClass}>
        <SectionHeader icon="✏️" title="기획안 수정 사항" subtitle="특정 섹션 지목하여 수정, 카피 대안 복수 제안" />
        <div className="space-y-4">
          {revisions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">수정 사항을 추가해주세요.</p>
          )}
          {revisions.map((rev: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">[수정] #{i + 1}</span>
                <RemoveRowButton onClick={() => {
                  onChange({ ...data, revisions: revisions.filter((_: any, j: number) => j !== i) });
                }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="섹션 번호">
                  <input className={inputClass} type="number" value={rev.sectionNum || ""}
                    placeholder="섹션 #"
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, sectionNum: parseInt(e.target.value) || 0 };
                      onChange({ ...data, revisions: updated });
                    }} />
                </FormField>
                <FormField label="수정 대상">
                  <select className={inputClass} value={rev.field}
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, field: e.target.value };
                      onChange({ ...data, revisions: updated });
                    }}>
                    <option value="">선택</option>
                    <option value="mainCopy">메인 카피</option>
                    <option value="subCopy">서브 카피</option>
                    <option value="visualDirection">비주얼 디렉션</option>
                    <option value="layout">레이아웃</option>
                    <option value="aeCommentary">AE Commentary</option>
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="수정 전">
                  <textarea className={textareaClass} rows={2} value={rev.before}
                    placeholder="기존 내용"
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, before: e.target.value };
                      onChange({ ...data, revisions: updated });
                    }} />
                </FormField>
                <FormField label="수정 후">
                  <textarea className={textareaClass} rows={2} value={rev.after}
                    placeholder="변경된 내용"
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, after: e.target.value };
                      onChange({ ...data, revisions: updated });
                    }} />
                </FormField>
              </div>
              {/* 카피 대안 */}
              <div className="mt-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">💡 카피 대안</label>
                {(rev.alternatives || ["", ""]).map((alt: string, j: number) => (
                  <div key={j} className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 w-6">#{j + 1}</span>
                    <input className={inputClass} value={alt} placeholder={`대안 ${j + 1}`}
                      onChange={(e) => {
                        const updated = [...revisions];
                        const alts = [...(updated[i].alternatives || ["", ""])];
                        alts[j] = e.target.value;
                        updated[i] = { ...rev, alternatives: alts };
                        onChange({ ...data, revisions: updated });
                      }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <AddRowButton label="수정 사항 추가" onClick={() => onChange({ ...data, revisions: [...revisions, { ...emptyRevision }] })} />
        </div>
      </div>

      <div className={sectionClass}>
        <SectionHeader icon="📋" title="최종 기획안" />
        <FormField label="최종 기획안 내용">
          <textarea className={textareaClass} rows={10} value={data.finalPlan || ""}
            placeholder="수정이 반영된 최종 기획안"
            onChange={(e) => onChange({ ...data, finalPlan: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
