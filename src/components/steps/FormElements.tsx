"use client";

import React from "react";

// 공통 스타일
export const sectionClass = "bg-white rounded-xl border border-gray-200 p-5 mb-4";
export const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";
export const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition";
export const textareaClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y min-h-[80px] transition";
export const btnPrimary = "bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50";
export const btnSecondary = "bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition";
export const btnDanger = "bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100 transition";
export const btnSuccess = "bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition";

// Section Header
export function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 ml-7">{subtitle}</p>}
    </div>
  );
}

// Form Field
export function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-3">
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// Status Badge
export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    empty: "bg-gray-100 text-gray-500",
    draft: "bg-yellow-100 text-yellow-700",
    review: "bg-blue-100 text-blue-700",
    revision: "bg-orange-100 text-orange-700",
    confirmed: "bg-green-100 text-green-700",
    delivered: "bg-purple-100 text-purple-700",
  };
  const labels: Record<string, string> = {
    empty: "미시작",
    draft: "작성중",
    review: "검토중",
    revision: "수정중",
    confirmed: "확정",
    delivered: "전달완료",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.empty}`}>
      {labels[status] || "미시작"}
    </span>
  );
}

// AI Generate Button
export function AIGenerateButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 shadow-sm"
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          AI 생성 중...
        </>
      ) : (
        <>
          <span>🤖</span>
          {label || "AI로 자동 생성"}
        </>
      )}
    </button>
  );
}

// Add Row Button
export function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
    >
      + {label}
    </button>
  );
}

// Remove Row Button
export function RemoveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
      title="삭제"
    >
      ✕
    </button>
  );
}

// Figma Export Button
export function FigmaExportButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-violet-500 text-white px-3 py-2 rounded-xl text-xs font-medium hover:from-pink-600 hover:to-violet-600 transition disabled:opacity-50 shadow-sm"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Figma 작성중...
        </>
      ) : (
        <>
          <span>🎨</span>
          Figma에 작성
        </>
      )}
    </button>
  );
}

// Step Form Wrapper
export function StepFormWrapper({
  stepNum,
  stepName,
  status,
  children,
  onSave,
  onAIGenerate,
  onFigmaExport,
  saving,
  aiLoading,
  aiLabel,
  figmaLoading,
}: {
  stepNum: number;
  stepName: string;
  status: string;
  children: React.ReactNode;
  onSave: () => void;
  onAIGenerate?: () => void;
  onFigmaExport?: () => void;
  saving: boolean;
  aiLoading?: boolean;
  aiLabel?: string;
  figmaLoading?: boolean;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Form Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">
            {stepNum}
          </span>
          <div>
            <h2 className="text-sm font-bold text-gray-900">{stepName}</h2>
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAIGenerate && (
            <AIGenerateButton onClick={onAIGenerate} loading={aiLoading || false} label={aiLabel} />
          )}
          {onFigmaExport && (
            <FigmaExportButton onClick={onFigmaExport} loading={figmaLoading || false} />
          )}
          <button onClick={onSave} disabled={saving} className={btnPrimary}>
            {saving ? "저장 중..." : "💾 저장"}
          </button>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
        {children}
      </div>
    </div>
  );
}
