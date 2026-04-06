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

const emptyChange = { section: "", change: "" };

export default function Step7PlanConfirm({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  const changes = data.changes || [];

  const statusOptions = [
    { value: "draft", label: "초안", color: "bg-gray-200 text-gray-700" },
    { value: "review", label: "검토중", color: "bg-blue-100 text-blue-700" },
    { value: "revision", label: "수정중", color: "bg-orange-100 text-orange-700" },
    { value: "confirmed", label: "✅ 최종 컨펌 (FIX)", color: "bg-green-100 text-green-700" },
  ];

  return (
    <StepFormWrapper
      stepNum={7}
      stepName="기획안 컨펌"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="AI 수정안 정리"
    >
      {/* 컨펌 상태 */}
      <div className={sectionClass}>
        <SectionHeader icon="📊" title="컨펌 진행 상태" />
        <FormField label="버전">
          <input className={inputClass} value={data.version || ""}
            placeholder="예: 1차 수정, 2차 수정, 최종안"
            onChange={(e) => onChange({ ...data, version: e.target.value })} />
        </FormField>
        <FormField label="진행 상태">
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((opt) => (
              <button key={opt.value}
                onClick={() => onChange({ ...data, finalStatus: opt.value })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  data.finalStatus === opt.value ? opt.color + " ring-2 ring-offset-1 ring-blue-400" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </FormField>
        {data.finalStatus === "confirmed" && (
          <FormField label="컨펌 일자">
            <input className={inputClass} type="date" value={data.confirmedDate || ""}
              onChange={(e) => onChange({ ...data, confirmedDate: e.target.value })} />
          </FormField>
        )}
      </div>

      {/* 클라이언트 피드백 */}
      <div className={sectionClass}>
        <SectionHeader icon="💬" title="클라이언트 피드백" />
        <FormField label="피드백 내용">
          <textarea className={textareaClass} rows={4} value={data.clientFeedback || ""}
            placeholder="클라이언트의 피드백/수정 요청"
            onChange={(e) => onChange({ ...data, clientFeedback: e.target.value })} />
        </FormField>
      </div>

      {/* 변경 이력 */}
      <div className={sectionClass}>
        <SectionHeader icon="📝" title="변경 이력" subtitle="초안 → 1차수정 → 2차수정 → 최종안(FIX)" />
        <div className="space-y-3">
          {changes.map((ch: any, i: number) => (
            <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <input className={inputClass} value={ch.section} placeholder="대상 섹션"
                  onChange={(e) => {
                    const updated = [...changes]; updated[i] = { ...ch, section: e.target.value };
                    onChange({ ...data, changes: updated });
                  }} />
                <div className="col-span-2">
                  <input className={inputClass} value={ch.change} placeholder="변경 내용"
                    onChange={(e) => {
                      const updated = [...changes]; updated[i] = { ...ch, change: e.target.value };
                      onChange({ ...data, changes: updated });
                    }} />
                </div>
              </div>
              <RemoveRowButton onClick={() => {
                onChange({ ...data, changes: changes.filter((_: any, j: number) => j !== i) });
              }} />
            </div>
          ))}
          <AddRowButton label="변경 이력 추가" onClick={() => onChange({ ...data, changes: [...changes, { ...emptyChange }] })} />
        </div>
      </div>
    </StepFormWrapper>
  );
}
