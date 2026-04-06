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

const emptyFeedback = { section: "", feedback: "", action: "", adCheckConflict: false };

export default function Step4Feedback({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const feedbackItems = data.feedbackItems || [];

  return (
    <StepFormWrapper
      stepNum={4}
      stepName="피드백 반영"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 피드백 반영"
    >
      {/* 피드백 항목 */}
      <div className={sectionClass}>
        <SectionHeader icon="💬" title="클라이언트 피드백" subtitle="피드백 항목별 반영 내역" />
        <div className="space-y-4">
          {feedbackItems.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">클라이언트 피드백을 입력해주세요.</p>
          )}
          {feedbackItems.map((fb: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">[피드백 반영] #{i + 1}</span>
                  {fb.adCheckConflict && (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">⚠️ 광고심의 충돌</span>
                  )}
                </div>
                <RemoveRowButton onClick={() => {
                  onChange({ ...data, feedbackItems: feedbackItems.filter((_: any, j: number) => j !== i) });
                }} />
              </div>
              <FormField label="대상 섹션">
                <input className={inputClass} value={fb.section} placeholder="피드백 대상 섹션"
                  onChange={(e) => {
                    const updated = [...feedbackItems]; updated[i] = { ...fb, section: e.target.value };
                    onChange({ ...data, feedbackItems: updated });
                  }} />
              </FormField>
              <FormField label="클라이언트 피드백">
                <textarea className={textareaClass} rows={2} value={fb.feedback} placeholder="클라이언트의 요청/의견"
                  onChange={(e) => {
                    const updated = [...feedbackItems]; updated[i] = { ...fb, feedback: e.target.value };
                    onChange({ ...data, feedbackItems: updated });
                  }} />
              </FormField>
              <FormField label="반영 내용">
                <textarea className={textareaClass} rows={2} value={fb.action} placeholder="실제 반영/수정한 내용"
                  onChange={(e) => {
                    const updated = [...feedbackItems]; updated[i] = { ...fb, action: e.target.value };
                    onChange({ ...data, feedbackItems: updated });
                  }} />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={fb.adCheckConflict || false}
                  className="rounded border-gray-300"
                  onChange={(e) => {
                    const updated = [...feedbackItems]; updated[i] = { ...fb, adCheckConflict: e.target.checked };
                    onChange({ ...data, feedbackItems: updated });
                  }} />
                ⚠️ 광고심의 충돌 여부
              </label>
            </div>
          ))}
          <AddRowButton label="피드백 항목 추가" onClick={() => onChange({ ...data, feedbackItems: [...feedbackItems, { ...emptyFeedback }] })} />
        </div>
      </div>

      {/* 피드백 요약 */}
      <div className={sectionClass}>
        <SectionHeader icon="📝" title="피드백 종합 요약" />
        <FormField label="요약">
          <textarea className={textareaClass} rows={4} value={data.feedbackSummary || ""}
            placeholder="피드백 반영 결과 종합 정리"
            onChange={(e) => onChange({ ...data, feedbackSummary: e.target.value })} />
        </FormField>
      </div>

      {/* 수정된 브리프 */}
      <div className={sectionClass}>
        <SectionHeader icon="📋" title="수정된 브리프" subtitle="피드백 반영 완료된 브리프" />
        <FormField label="수정 브리프">
          <textarea className={textareaClass} rows={10} value={data.revisedBrief || ""}
            placeholder="피드백이 모두 반영된 최종 브리프"
            onChange={(e) => onChange({ ...data, revisedBrief: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
