"use client";

import React from "react";
import {
  StepFormWrapper, SectionHeader, FormField,
  inputClass, textareaClass, sectionClass,
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

export default function Step3Delivery({ data, onChange, onSave, onAIGenerate, onFigmaExport, saving, aiLoading, figmaLoading, status }: Props) {
  return (
    <StepFormWrapper
      stepNum={3}
      stepName="클라이언트 전달"
      status={status}
      onSave={onSave}
      onAIGenerate={onAIGenerate}
      onFigmaExport={onFigmaExport}
      saving={saving}
      aiLoading={aiLoading}
      figmaLoading={figmaLoading}
      aiLabel="전달 메일 생성"
    >
      {/* 전달 정보 */}
      <div className={sectionClass}>
        <SectionHeader icon="📧" title="전달 정보" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="전달 일자">
            <input className={inputClass} type="date" value={data.deliveryDate || ""}
              onChange={(e) => onChange({ ...data, deliveryDate: e.target.value })} />
          </FormField>
          <FormField label="전달 방법">
            <select className={inputClass} value={data.deliveryMethod || ""}
              onChange={(e) => onChange({ ...data, deliveryMethod: e.target.value })}>
              <option value="">선택</option>
              <option value="email">이메일</option>
              <option value="notion">노션 공유</option>
              <option value="kakaotalk">카카오톡</option>
              <option value="meeting">미팅</option>
              <option value="other">기타</option>
            </select>
          </FormField>
        </div>
      </div>

      {/* 클라이언트 확인 요청 */}
      <div className={sectionClass}>
        <SectionHeader icon="❓" title="클라이언트 확인 요청사항" subtitle="브리프 전달 시 클라이언트에게 확인받을 항목" />
        <FormField label="확인 요청사항">
          <textarea className={textareaClass} rows={5} value={data.clientQuestions || ""}
            placeholder="1. 제품 이미지/영상 소스 보유 여부&#10;2. A/S 정책 및 품질보증 기간&#10;3. 현재 진행 중인 프로모션/할인 정책&#10;4. 경쟁사 대비 강조하고 싶은 핵심 메시지 우선순위"
            onChange={(e) => onChange({ ...data, clientQuestions: e.target.value })} />
        </FormField>
      </div>

      {/* 첨부파일 */}
      <div className={sectionClass}>
        <SectionHeader icon="📎" title="첨부 파일" />
        <FormField label="첨부 파일 목록">
          <textarea className={textareaClass} rows={3} value={data.attachments || ""}
            placeholder="전달할 파일 목록 (브리프 PDF, 레퍼런스 이미지 등)"
            onChange={(e) => onChange({ ...data, attachments: e.target.value })} />
        </FormField>
      </div>

      {/* 전달 메모 */}
      <div className={sectionClass}>
        <SectionHeader icon="💬" title="전달 메모" />
        <FormField label="전달 시 메모">
          <textarea className={textareaClass} rows={4} value={data.deliveryNote || ""}
            placeholder="클라이언트에게 전달할 때 함께 보낼 메시지"
            onChange={(e) => onChange({ ...data, deliveryNote: e.target.value })} />
        </FormField>
      </div>
    </StepFormWrapper>
  );
}
