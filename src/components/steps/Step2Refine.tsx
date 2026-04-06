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

const emptyRevision = { section: "", before: "", after: "", reason: "" };

export default function Step2Refine({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const revisions = data.revisions || [];

  return (
    <StepFormWrapper
      stepNum={2}
      stepName="브리프 다듬기"
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
        <SectionHeader icon="✏️" title="수정 사항" subtitle="브리프 수정 이력을 기록합니다" />
        <div className="space-y-4">
          {revisions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">아직 수정 사항이 없습니다. 아래 버튼으로 추가하세요.</p>
          )}
          {revisions.map((rev: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">[수정] #{i + 1}</span>
                <RemoveRowButton onClick={() => {
                  onChange({ ...data, revisions: revisions.filter((_: any, j: number) => j !== i) });
                }} />
              </div>
              <FormField label="대상 섹션">
                <input className={inputClass} value={rev.section} placeholder="예: USP 테이블, 섹션 3, 슬로건 등"
                  onChange={(e) => {
                    const updated = [...revisions]; updated[i] = { ...rev, section: e.target.value };
                    onChange({ ...data, revisions: updated });
                  }} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="수정 전">
                  <textarea className={textareaClass} rows={3} value={rev.before} placeholder="기존 내용"
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, before: e.target.value };
                      onChange({ ...data, revisions: updated });
                    }} />
                </FormField>
                <FormField label="수정 후">
                  <textarea className={textareaClass} rows={3} value={rev.after} placeholder="변경된 내용"
                    onChange={(e) => {
                      const updated = [...revisions]; updated[i] = { ...rev, after: e.target.value };
                      onChange({ ...data, revisions: updated });
                    }} />
                </FormField>
              </div>
              <FormField label="수정 사유">
                <input className={inputClass} value={rev.reason} placeholder="변경 이유"
                  onChange={(e) => {
                    const updated = [...revisions]; updated[i] = { ...rev, reason: e.target.value };
                    onChange({ ...data, revisions: updated });
                  }} />
              </FormField>
            </div>
          ))}
          <AddRowButton label="수정 사항 추가" onClick={() => onChange({ ...data, revisions: [...revisions, { ...emptyRevision }] })} />
        </div>
      </div>

      {/* 최종 브리프 */}
      <div className={sectionClass}>
        <SectionHeader icon="📋" title="최종 브리프" subtitle="수정 반영된 최종 브리프" />
        <FormField label="최종 브리프 내용">
          <textarea className={textareaClass} rows={10} value={data.finalBrief || ""}
            placeholder="수정이 반영된 최종 브리프를 여기에 정리합니다"
            onChange={(e) => onChange({ ...data, finalBrief: e.target.value })} />
        </FormField>
      </div>

      {/* AE 메모 */}
      <div className={sectionClass}>
        <SectionHeader icon="📝" title="AE 메모" />
        <FormField label="기획자 메모">
          <textarea className={textareaClass} rows={3} value={data.aeNotes || ""}
            placeholder="추가 참고사항, 클라이언트 전달 시 유의점 등"
            onChange={(e) => onChange({ ...data, aeNotes: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
