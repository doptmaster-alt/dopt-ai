"use client";

import React, { useState, useEffect, useCallback } from "react";
import Step0Research from "./Step0Research";
import Step1Brief from "./Step1Brief";
import Step2Refine from "./Step2Refine";
import Step3Delivery from "./Step3Delivery";
import Step4Feedback from "./Step4Feedback";
import Step5Plan from "./Step5Plan";
import Step6PlanRefine from "./Step6PlanRefine";
import Step7PlanConfirm from "./Step7PlanConfirm";
import Step8Conti from "./Step8Conti";
import Step9ContiRefine from "./Step9ContiRefine";
import Step10ContiConfirm from "./Step10ContiConfirm";
import Step11DesignGuide from "./Step11DesignGuide";

interface Props {
  projectId: number;
  currentStep: number;
  onSendToChat: (message: string) => void;
  refreshKey?: number;
}

export default function StepFormPanel({ projectId, currentStep, onSendToChat, refreshKey }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [status, setStatus] = useState("empty");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [figmaMessage, setFigmaMessage] = useState<string | null>(null);

  // Load step data
  const loadStepData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/step-data?step=${currentStep}`);
      if (res.ok) {
        const data = await res.json();
        setFormData(data.formData || {});
        setStatus(data.status || "empty");
        if (data.updatedAt) setLastSaved(data.updatedAt);
      }
    } catch (e) {
      console.error("Failed to load step data:", e);
    }
  }, [projectId, currentStep]);

  useEffect(() => {
    loadStepData();
  }, [loadStepData, refreshKey]);

  // Save step data
  const handleSave = async () => {
    setSaving(true);
    try {
      const newStatus = status === "empty" ? "draft" : status;
      await fetch(`/api/projects/${projectId}/step-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: currentStep, formData, status: newStatus }),
      });
      setStatus(newStatus);
      setLastSaved(new Date().toISOString());
    } catch (e) {
      console.error("Failed to save:", e);
      alert("저장에 실패했습니다.");
    }
    setSaving(false);
  };

  // Figma Export
  const handleFigmaExport = async () => {
    setFigmaLoading(true);
    setFigmaMessage(null);
    try {
      // 먼저 저장
      await handleSave();

      const res = await fetch("/api/figma-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: currentStep,
          formData,
          projectTitle: document.title || "프로젝트",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFigmaMessage(data.message || "Figma에 작성 완료!");
        setTimeout(() => setFigmaMessage(null), 5000);
      } else {
        setFigmaMessage(`❌ ${data.error}`);
        setTimeout(() => setFigmaMessage(null), 8000);
      }
    } catch (e: any) {
      setFigmaMessage(`❌ 오류: ${e.message}`);
      setTimeout(() => setFigmaMessage(null), 8000);
    }
    setFigmaLoading(false);
  };

  // Figma 지원 스텝
  const figmaEnabledSteps = [0, 1, 5, 8, 11];

  // AI Generate - sends request to chat
  const handleAIGenerate = () => {
    const aiPrompts: Record<number, string> = {
      0: "STEP 0 시장조사를 시작해주세요. 경쟁사 분석, 업종 트렌드, 타겟 인사이트, 광고심의 가이드를 포함한 리서치 리포트를 작성해주세요.",
      1: "STEP 1 브리프 초안을 생성해주세요. 디옵트 브리프 폼에 맞춰서 제품 개요, USP 분석 테이블, 상세페이지 목차, Photo & Design REF 방향을 포함해주세요.",
      2: "현재 브리프를 검토하고 개선할 점을 제안해주세요.",
      3: "브리프를 클라이언트에게 전달할 메일/메시지를 작성해주세요. 클라이언트 확인 요청사항도 포함해주세요.",
      4: "클라이언트 피드백을 반영해주세요. 광고심의 충돌 여부도 확인해주세요.",
      5: "STEP 5 기획안 초안을 생성해주세요. 확정된 브리프를 기반으로 섹션별 메인/서브 카피, 비주얼 디렉션, 레이아웃, AE Commentary를 포함해주세요.",
      6: "기획안을 검토하고 카피 대안을 제안해주세요. 각 수정 사항에 대해 2-3개 대안을 포함해주세요.",
      7: "기획안 변경 이력을 정리하고 최종 컨펌 상태를 업데이트해주세요.",
      8: "STEP 8 촬영콘티를 생성해주세요. 표지, 컷 리스트, 콘셉트 서머리, 소품 리스트, 연출별 상세, 누끼 가이드를 포함해주세요.",
      9: "촬영콘티를 검토하고 수정 제안을 해주세요.",
      10: "콘티 변경 이력을 정리하고 컨펌 상태를 업데이트해주세요.",
      11: "STEP 11 디자인 인트로 가이드를 생성해주세요. 톤앤매너, 타이포그래피, 섹션별 레이아웃 가이드, 촬영컷-섹션 매핑표를 포함해주세요.",
    };

    const prompt = aiPrompts[currentStep] || "이 단계의 작업을 진행해주세요.";
    onSendToChat(prompt);
  };

  // Common props
  const commonProps = {
    data: formData,
    onChange: setFormData,
    onSave: handleSave,
    onAIGenerate: handleAIGenerate,
    onFigmaExport: figmaEnabledSteps.includes(currentStep) ? handleFigmaExport : undefined,
    saving,
    aiLoading,
    figmaLoading,
    status,
  };

  // Step components map
  const stepComponents: Record<number, React.ReactNode> = {
    0: <Step0Research {...commonProps} />,
    1: <Step1Brief {...commonProps} />,
    2: <Step2Refine {...commonProps} />,
    3: <Step3Delivery {...commonProps} />,
    4: <Step4Feedback {...commonProps} />,
    5: <Step5Plan {...commonProps} />,
    6: <Step6PlanRefine {...commonProps} />,
    7: <Step7PlanConfirm {...commonProps} />,
    8: <Step8Conti {...commonProps} />,
    9: <Step9ContiRefine {...commonProps} />,
    10: <Step10ContiConfirm {...commonProps} />,
    11: <Step11DesignGuide {...commonProps} />,
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {stepComponents[currentStep] || (
        <div className="flex items-center justify-center h-full text-gray-400">
          해당 단계의 폼이 없습니다.
        </div>
      )}
      {/* Status bar */}
      <div className="flex-shrink-0 px-4 py-1.5 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
        {figmaMessage ? (
          <span className="text-xs font-medium text-purple-600">{figmaMessage}</span>
        ) : (
          <span className="text-xs text-gray-400">
            {lastSaved ? `마지막 저장: ${new Date(lastSaved).toLocaleString("ko-KR")}` : ""}
          </span>
        )}
        {figmaEnabledSteps.includes(currentStep) && (
          <span className="text-[10px] text-gray-400">🎨 Figma 내보내기 지원</span>
        )}
      </div>
    </div>
  );
}
