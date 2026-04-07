"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { STEPS } from "@/types";
import NotionMarkdown from "@/components/NotionMarkdown";
import FigmaPanel from "@/components/FigmaPanel";
import DesignGuideEditor from "@/components/DesignGuideEditor";
import BriefPanel from "@/components/BriefPanel";
import ContiPanel from "@/components/ContiPanel";
import PlanEditor from "@/components/PlanEditor/PlanEditor";
import SchedulePanel from "@/components/SchedulePanel";
import EmailComposer from "@/components/EmailComposer";
import FileUploadPanel from "@/components/FileUploadPanel";
import AIReviewPanel from "@/components/AIReviewPanel";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  step: number;
}

interface Project {
  id: number;
  title: string;
  client_name: string;
  product_name: string;
  industry: string;
  current_step: number;
}

type ViewMode = "chat" | "form" | "split";

// 입력 영역 — 별도 컴포넌트로 분리하여 타이핑 시 부모 리렌더링 방지
interface ChatInputProps {
  isStreaming: boolean;
  currentStep: number;
  attachedFile: any;
  uploading: boolean;
  onSend: (message: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
}

function ChatInput({ isStreaming, currentStep, attachedFile, uploading, onSend, onFileUpload, onClearFile }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const msg = input.trim();
    if ((!msg && !attachedFile) || isStreaming) return;
    onSend(msg);
    setInput("");
  };

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      {attachedFile && (
        <div className="max-w-full mb-2">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-blue-600">
              {attachedFile.type === "image" ? "🖼️" :
               attachedFile.type === "pdf" ? "📄" :
               attachedFile.type === "pptx" ? "📊" :
               attachedFile.type === "docx" ? "📝" :
               attachedFile.type === "excel" ? "📊" : "📎"}
            </span>
            <span className="text-blue-800 font-medium truncate max-w-[200px]">{attachedFile.name}</span>
            <button onClick={onClearFile} className="text-blue-400 hover:text-red-500">✕</button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={onFileUpload}
          accept=".pdf,.docx,.pptx,.xlsx,.xls,.txt,.csv,.md,.json,.png,.jpg,.jpeg,.gif,.webp"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || uploading}
          className="bg-gray-100 text-gray-600 px-2.5 py-2.5 rounded-xl hover:bg-gray-200 transition disabled:opacity-50 self-end"
          title="파일 첨부"
        >
          {uploading ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
          ) : (
            <span className="text-sm">📎</span>
          )}
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "AI가 작업 중입니다..." : `메시지 입력... (${STEPS[currentStep]?.short})`}
          className={`flex-1 px-3 py-2.5 border rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm ${
            isStreaming
              ? "border-blue-200 bg-blue-50/30 text-gray-400 cursor-wait"
              : "border-gray-300 text-gray-900"
          }`}
          rows={2}
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || (!input.trim() && !attachedFile)}
          className={`px-4 py-2.5 rounded-xl font-medium transition self-end ${
            isStreaming
              ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white animate-pulse cursor-wait"
              : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          }`}
        >
          {isStreaming ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs">...</span>
            </span>
          ) : "전송"}
        </button>
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-1.5">
        Enter 전송 · Shift+Enter 줄바꿈 · 📎 파일 첨부
      </p>
    </div>
  );
}

export default function ProjectChat() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    type: string;
    textContent?: string;
    base64Image?: string;
    mimeType?: string;
    fileUrl?: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusInfo, setStatusInfo] = useState<{
    message: string;
    emoji: string;
    type: string;
  } | null>(null);
  const [stepDataStatuses, setStepDataStatuses] = useState<Record<number, string>>({});

  const [formRefreshKey, setFormRefreshKey] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);

  // 기획안 적용 상태 — 서버에서 DB에 즉시 저장하고, 클라이언트는 "적용하기" 클릭 시 리프레시
  const [pendingPlanSections, setPendingPlanSections] = useState<number>(0); // 대기 중인 섹션 수
  const [planApplied, setPlanApplied] = useState(false);

  const handleApplyPlan = useCallback(() => {
    console.log("[Apply Plan] Refreshing PlanEditor");
    setPlanApplied(true);
    setPendingPlanSections(0);
    setViewMode("split");
    setFormRefreshKey(Date.now());
  }, []);

  // 분할 뷰 드래그 리사이즈
  const [splitRatio, setSplitRatio] = useState(50); // 왼쪽(채팅) 비율 %
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(80, Math.max(20, ratio)));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (session && projectId) {
      fetchProject();
      fetchMessages();
      fetchStepStatuses();
    }
  }, [session, projectId]);

  // 스트리밍 중에는 throttle된 스크롤
  const lastScrollRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (isStreaming) {
      if (now - lastScrollRef.current > 200) {
        lastScrollRef.current = now;
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  const fetchProject = async () => {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const projects = await res.json();
      const p = projects.find((p: any) => p.id === parseInt(projectId));
      if (p) {
        setProject(p);
        setCurrentStep(p.current_step);
      }
    }
  };

  const fetchMessages = async () => {
    const res = await fetch(`/api/projects/${projectId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.map((m: any) => ({ ...m, role: m.role as "user" | "assistant" })));
    }
  };

  const fetchStepStatuses = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/step-data`);
      if (res.ok) {
        const data = await res.json();
        const statuses: Record<number, string> = {};
        data.forEach((d: any) => { statuses[d.step] = d.status; });
        setStepDataStatuses(statuses);
      }
    } catch {}
  };

  const updateStep = async (step: number) => {
    setCurrentStep(step);
    await fetch(`/api/projects/${projectId}/step`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAttachedFile(data.file);
      } else {
        const err = await res.json();
        alert(err.error || "파일 업로드에 실패했습니다.");
      }
    } catch {
      alert("파일 업로드 중 오류가 발생했습니다.");
    }
    setUploading(false);
    // fileInputRef는 ChatInput 내부에서 관리 — 이벤트 타겟으로 리셋
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) input.value = "";
  };

  const sendMessage = async (overrideMessage?: string, overrideStep?: number) => {
    const messageToSend = overrideMessage || "";
    if ((!messageToSend && !attachedFile) || isStreaming) return;

    const userMessage = messageToSend || (attachedFile ? `[파일 업로드: ${attachedFile.name}] 이 파일을 분석해주세요.` : "");
    // overrideStep이 있으면 사용 (step 전환 후 즉시 메시지 보내는 경우 race condition 방지)
    const stepToSend = overrideStep ?? currentStep;
    setIsStreaming(true);

    // 단계 전환 명령 감지
    if (userMessage.includes("다음 단계") || userMessage.includes("다음 스텝")) {
      if (currentStep < 9) {
        updateStep(currentStep + 1);
      }
    }

    const displayContent = attachedFile
      ? `${attachedFile.name ? `📎 ${attachedFile.name}\n` : ""}${userMessage}`
      : userMessage;

    const newUserMsg: Message = {
      role: "user",
      content: displayContent,
      step: stepToSend,
    };
    setMessages((prev) => [...prev, newUserMsg]);

    const assistantMsg: Message = {
      role: "assistant",
      content: "",
      step: stepToSend,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setStatusInfo({ message: "디옵이가 생각하고 있어요", emoji: "💭", type: "thinking" });

    // 파일 첨부 정보 구성
    let fileAttachment = undefined;
    if (attachedFile) {
      if (attachedFile.base64Image) {
        fileAttachment = {
          type: "image",
          base64Image: attachedFile.base64Image,
          mimeType: attachedFile.mimeType,
          fileName: attachedFile.name,
          fileUrl: attachedFile.fileUrl,
        };
      } else if (attachedFile.textContent) {
        fileAttachment = {
          type: "text",
          textContent: attachedFile.textContent,
          fileName: attachedFile.name,
        };
      }
    }
    setAttachedFile(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: parseInt(projectId),
          message: userMessage,
          currentStep: stepToSend,
          fileAttachment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content =
            `오류가 발생했습니다: ${err.error || "알 수 없는 오류"}`;
          return updated;
        });
        setIsStreaming(false);
        setStatusInfo(null);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setIsStreaming(false);
        setStatusInfo(null);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: `오류가 발생했습니다: ${parsed.error}`,
                  };
                  return updated;
                });
              }
              if (parsed.status) {
                setStatusInfo(parseStatusMessage(parsed.status));
              }
              if (parsed.text) {
                setStatusInfo(null);
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.text,
                  };
                  return updated;
                });
              }
              if (parsed.formUpdate) {
                console.log("[SSE] formUpdate received, currentStep:", currentStep, "sections:", parsed.formUpdate.sections?.length || 0);
                // 모든 단계 즉시 적용 — DB에 이미 저장 완료, 바로 기획안 패널 리프레시
                setFormRefreshKey(Date.now());
                if (viewMode === "chat") setViewMode("split");
                if (currentStep >= 3 && currentStep <= 4 && parsed.formUpdate.sections?.length > 0) {
                  setPlanApplied(true);
                  setPendingPlanSections(0);
                  console.log("[SSE] Plan auto-applied:", parsed.formUpdate.sections.length, "sections");
                }
              }
              if (parsed.stepUpdate !== undefined) {
                setCurrentStep(parsed.stepUpdate);
              }
            } catch (parseErr) {
              console.error("[SSE] Parse error for line:", line.substring(0, 200), parseErr);
            }
          }
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content = "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
        return updated;
      });
    }

    // formUpdate SSE를 못 받았을 경우 — DB에서 직접 확인 후 패널 리프레시
    // 브리프/시장조사 (V2: step 1-2) — SSE 못 받으면 DB에서 직접 확인
    if (stepToSend >= 1 && stepToSend <= 2) {
      try {
        const res = await fetch(`/api/projects/${projectId}/step-data?step=${stepToSend}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.form_data) {
            const parsed = JSON.parse(data.form_data);
            if (parsed && Object.keys(parsed).length > 0) {
              console.log("[Post-stream] Brief/research data found in DB, refreshing BriefPanel for step", stepToSend);
              setFormRefreshKey(Date.now());
              if (viewMode === "chat") setViewMode("split");
            }
          }
        }
      } catch (e) {
        console.error("[Post-stream] Brief DB check error:", e);
      }
    }
    // 기획안 (V2: step 3)
    if (stepToSend === 3 && !planApplied) {
      try {
        const res = await fetch(`/api/projects/${projectId}/step-data?step=3`);
        if (res.ok) {
          const data = await res.json();
          if (data?.form_data) {
            const parsed = JSON.parse(data.form_data);
            if (parsed?.sections?.length > 0) {
              console.log("[Post-stream] Auto-applying plan from DB:", parsed.sections.length, "sections");
              setFormRefreshKey(Date.now());
              setPlanApplied(true);
              setPendingPlanSections(0);
              if (viewMode === "chat") setViewMode("split");
            }
          }
        }
      } catch (e) {
        console.error("[Post-stream] DB check error:", e);
      }
    }
    // 촬영콘티 (V2: step 4) — 항상 DB 확인 후 리프레시
    if (stepToSend === 4) {
      try {
        const res = await fetch(`/api/projects/${projectId}/step-data?step=4`);
        if (res.ok) {
          const data = await res.json();
          if (data?.form_data) {
            const parsed = JSON.parse(data.form_data);
            if (parsed?.cutPages?.length > 0 || parsed?.cutDetails?.length > 0 || parsed?.totalCuts) {
              console.log("[Post-stream] Conti data found in DB, refreshing ContiPanel");
              setFormRefreshKey(Date.now());
            }
          }
        }
      } catch (e) {
        console.error("[Post-stream] Conti DB check error:", e);
      }
    }

    setIsStreaming(false);
  };

  // 작업의뢰서 자동 분석
  const handleWorkOrderAnalyze = useCallback(async () => {
    try {
      // 1. 업로드된 파일 파싱
      const res = await fetch(`/api/projects/${projectId}/files/analyze`);
      if (!res.ok) {
        console.error("Work order analyze failed:", await res.text());
        return;
      }
      const data = await res.json();
      const fileContent = data.combinedText;

      if (!fileContent || fileContent.length < 10) {
        // 파일 내용이 너무 짧으면 건너뛰기
        sendMessage("작업의뢰서 파일을 업로드했지만 내용을 추출할 수 없습니다. 작업의뢰서 내용을 직접 입력해주세요.");
        return;
      }

      // 2. 파싱된 내용을 AI에게 전송하여 분석
      const analyzeMessage = `[작업의뢰서 자동 분석]\n\n다음은 업로드된 작업의뢰서 내용입니다. 이 내용을 분석하여 프로젝트 정보를 정리해주세요:\n\n${fileContent}`;

      if (viewMode === "form") setViewMode("split");
      sendMessage(analyzeMessage);

      // 3. 분석 후 STEP 1(시장조사)로 자동 진행
      setTimeout(() => {
        updateStep(1);
      }, 2000);
    } catch (e) {
      console.error("Work order analyze error:", e);
    }
  }, [projectId, viewMode]);

  // Form → Chat 연동
  const handleFormToChat = useCallback((message: string) => {
    if (viewMode === "form") setViewMode("split");
    sendMessage(message);
  }, [viewMode, isStreaming, currentStep, projectId]);

  // 레퍼런스 분석 → 채팅에 알림 표시 (AI 응답이 아닌 시스템 알림)
  const handleReferenceChatMessage = useCallback((message: string) => {
    if (viewMode === "form") setViewMode("split");
    const notificationMsg: Message = {
      role: "assistant",
      content: message,
      step: currentStep,
    };
    setMessages((prev) => [...prev, notificationMsg]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [viewMode, currentStep]);

  // Figma 내보내기
  const [figmaExporting, setFigmaExporting] = useState(false);
  const handleFigmaExport = useCallback(async (step: number) => {
    setFigmaExporting(true);
    try {
      // 해당 스텝의 폼 데이터를 가져옴 (없으면 인접 스텝도 확인)
      let formData: any = {};
      let foundStep = step;

      // 내보내기 가능한 스텝 매핑: 각 내보내기 스텝이 참조할 수 있는 데이터 스텝들
      const stepFallbacks: Record<number, number[]> = {
        0: [0],           // 시장조사
        1: [1, 2],        // 브리프
        3: [3],           // 기획안
        4: [4],           // 촬영콘티
        6: [6],           // 디자인 가이드
      };
      const stepsToTry = stepFallbacks[step] || [step];

      for (const tryStep of stepsToTry) {
        const dataRes = await fetch(`/api/projects/${projectId}/step-data?step=${tryStep}`);
        if (dataRes.ok) {
          const data = await dataRes.json();
          const candidate = data.formData || {};
          const hasContent = Object.keys(candidate).some(k => {
            const v = candidate[k];
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
            return v !== '' && v !== null && v !== undefined;
          });
          if (hasContent) {
            formData = candidate;
            foundStep = tryStep;
            break;
          }
        }
      }

      // 폼 데이터가 비어있는지 확인
      const hasData = Object.keys(formData).length > 0;

      if (!hasData) {
        alert("⚠️ 폼 데이터가 비어있습니다.\n\n먼저 AI에게 브리프/기획안 등을 생성해달라고 요청하세요.\nAI가 데이터를 자동으로 저장한 후 내보내기가 가능합니다.");
        setFigmaExporting(false);
        return;
      }

      const res = await fetch("/api/figma-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          formData,
          projectTitle: project?.title || "프로젝트",
        }),
      });

      const result = await res.json();
      if (res.ok) {
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (e: any) {
      alert(`❌ Figma 내보내기 실패: ${e.message}`);
    }
    setFigmaExporting(false);
  }, [projectId, project]);

  const sendErrorReport = (errorContent: string) => {
    const reportMatch = errorContent.match(/\[ERROR_REPORT\]([\s\S]*?)\[\/ERROR_REPORT\]/);
    const reportBody = reportMatch ? reportMatch[1].trim() : errorContent;

    const subject = encodeURIComponent(`[DIOPT AI] 에러 보고 - ${project?.title || "프로젝트"}`);
    const body = encodeURIComponent(
      `DIOPT AI 에러 보고서\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `프로젝트: ${project?.title || "알 수 없음"}\n` +
      `단계: STEP ${currentStep} - ${STEPS[currentStep]?.name || ""}\n` +
      `발생 시간: ${new Date().toLocaleString("ko-KR")}\n\n` +
      `${reportBody}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `전체 메시지:\n${errorContent.substring(0, 2000)}`
    );
    window.open(`mailto:dopt@doptstudio.com?subject=${subject}&body=${body}`, "_blank");
  };

  const hasErrorReport = (content: string) => {
    return content.includes("[ERROR_REPORT]") || content.includes("오류가 발생했습니다");
  };

  const parseStatusMessage = (status: string): { message: string; emoji: string; type: string } => {
    if (status.includes("웹 검색") || status.includes("서칭")) {
      return { message: "디옵이가 검색하고 있어요", emoji: "🔍", type: "search" };
    }
    if (status.includes("웹페이지 로딩")) {
      return { message: "디옵이가 웹페이지를 읽고 있어요", emoji: "🌐", type: "fetch" };
    }
    if (status.includes("노션 검색") || status.includes("노션 페이지") || status.includes("노션 데이터") || status.includes("노션에")) {
      return { message: "디옵이가 노션에서 자료를 찾고 있어요", emoji: "📓", type: "notion" };
    }
    if (status.includes("Knowledge") || status.includes("지식")) {
      return { message: "디옵이가 학습 데이터를 참고하고 있어요", emoji: "📚", type: "knowledge" };
    }
    if (status.includes("Figma") && status.includes("디자인 생성")) {
      return { message: "디옵이가 Figma에서 디자인하고 있어요", emoji: "🎨", type: "figma-design" };
    }
    if (status.includes("Figma")) {
      return { message: "디옵이가 Figma를 확인하고 있어요", emoji: "🎨", type: "figma" };
    }
    if (status.includes("스크린샷") && status.includes("Figma")) {
      return { message: "디옵이가 스크린샷을 Figma에 넣고 있어요", emoji: "📸", type: "screenshot-figma" };
    }
    if (status.includes("스크린샷")) {
      return { message: "디옵이가 스크린샷을 찍고 있어요", emoji: "📸", type: "screenshot" };
    }
    // 폼 데이터 저장 — 현재 스텝에 따라 다른 메시지
    if (status.includes("기획안") || status.includes("섹션 데이터") || status.includes("폼 데이터") || status.includes("update_step")) {
      if (currentStep <= 2) {
        return { message: "디옵이가 브리프를 작성하고 있어요", emoji: "📋", type: "brief" };
      }
      if (currentStep === 3) {
        return { message: "디옵이가 기획안을 작성하고 있어요", emoji: "📝", type: "plan" };
      }
      if (currentStep === 4) {
        return { message: "디옵이가 촬영콘티를 작성하고 있어요", emoji: "🎬", type: "conti" };
      }
      if (currentStep === 6) {
        return { message: "디옵이가 디자인 가이드를 작성하고 있어요", emoji: "🎨", type: "design" };
      }
      return { message: "디옵이가 산출물을 정리하고 있어요", emoji: "📝", type: "form" };
    }
    return { message: "디옵이가 작업 중이에요", emoji: "⚡", type: "working" };
  };

  const copyToClipboard = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    alert("클립보드에 복사되었습니다.");
  }, []);

  // 메시지 렌더링 메모이제이션 — input 변경 시 리렌더링 방지
  const renderedMessages = useMemo(() => {
    return messages.map((msg, i) => {
      const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
      const showThinking = isLastAssistant && isStreaming && !msg.content && statusInfo;

      return (
        <div
          key={`msg-${i}`}
          className={`${msg.role === "user" ? "flex justify-end" : ""}`}
        >
          {msg.role === "assistant" && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold">
                D
              </div>
              <span className="text-xs font-semibold text-gray-500">디옵트 AI</span>
              <span className="text-[10px] text-gray-300">{STEPS[msg.step]?.short}</span>
            </div>
          )}
          <div
            className={
              msg.role === "user"
                ? "max-w-[85%] rounded-2xl px-4 py-3 bg-blue-600 text-white"
                : "bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm text-gray-900"
            }
          >
            {msg.role === "assistant" ? (
              <div className="max-w-none">
                {showThinking ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <span className="text-lg animate-bounce">{statusInfo.emoji}</span>
                    <span className="animate-pulse font-medium text-xs">{statusInfo.message}</span>
                    <span className="inline-flex gap-0.5 items-center">
                      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" />
                      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                    </span>
                  </div>
                ) : (
                  <>
                    <NotionMarkdown content={msg.content || ""} />
                    {msg.content && !isStreaming && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => copyToClipboard(msg.content)}
                          className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        >
                          📋 복사
                        </button>
                        {hasErrorReport(msg.content) && (
                          <button
                            onClick={() => sendErrorReport(msg.content)}
                            className="text-[10px] bg-red-50 text-red-600 hover:bg-red-100 px-2 py-0.5 rounded-full border border-red-200 transition"
                          >
                            🚨 에러 보고
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        </div>
      );
    });
  }, [messages, isStreaming, statusInfo, copyToClipboard, sendErrorReport, hasErrorReport]);

  const exportAllMessages = () => {
    const text = messages
      .map(
        (m) =>
          `[${m.role === "user" ? "기획자" : "AI"}] (STEP ${m.step})\n${m.content}`
      )
      .join("\n\n---\n\n");

    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.title || "프로젝트"}_전체대화.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportByStep = (step: number) => {
    const stepMessages = messages.filter(
      (m) => m.step === step && m.role === "assistant"
    );
    if (stepMessages.length === 0) {
      alert("해당 단계의 AI 산출물이 없습니다.");
      return;
    }

    const lastMsg = stepMessages[stepMessages.length - 1];
    const blob = new Blob([lastMsg.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.title || "프로젝트"}_${STEPS[step]?.name || `STEP${step}`}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Step status indicator
  const getStepIndicator = (stepId: number) => {
    const formStatus = stepDataStatuses[stepId];
    if (formStatus === "confirmed") return { icon: "✅", color: "text-green-600 bg-green-50" };
    if (formStatus === "review" || formStatus === "delivered") return { icon: "📋", color: "text-blue-600 bg-blue-50" };
    if (formStatus === "draft" || formStatus === "revision") return { icon: "✏️", color: "text-yellow-600 bg-yellow-50" };
    if (stepId < currentStep) return { icon: "✓", color: "text-green-600" };
    if (stepId === currentStep) return { icon: "●", color: "text-blue-600" };
    return { icon: "○", color: "text-gray-400" };
  };

  if (status === "loading" || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">프로젝트 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-500 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            ←
          </button>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">
              {project.title || "새 프로젝트"}
            </h1>
            <p className="text-xs text-gray-500">
              {STEPS[currentStep]?.short}: {STEPS[currentStep]?.name}
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("chat")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              viewMode === "chat" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            💬 채팅
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              viewMode === "split" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ◫ 분할
          </button>
          <button
            onClick={() => setViewMode("form")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              viewMode === "form" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {currentStep <= 2 ? "📋 노션" : currentStep <= 4 || currentStep === 9 ? "📐 기획안" : "🎬 PPT"}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSchedule(true)}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100"
            title="스케줄 & 클라이언트"
          >
            📅
          </button>
          <button
            onClick={() => setShowEmailComposer(true)}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100"
            title="클라이언트 이메일 발송"
          >
            📧
          </button>
          <button
            onClick={() => setShowExport(!showExport)}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100"
          >
            📥
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100 lg:hidden"
          >
            ☰
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            showSidebar ? "block" : "hidden"
          } lg:block w-56 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto`}
        >
          <div className="p-3">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
              파이프라인
            </h3>
            <div className="space-y-0.5">
              {STEPS.map((step) => {
                const indicator = getStepIndicator(step.id);
                const stepIcon = ('icon' in step) ? (step as any).icon : '';
                const stepType = ('type' in step) ? (step as any).type : '';
                const isLockable = ('lockable' in step) ? (step as any).lockable : false;
                // 확정 단계 스타일
                const confirmStyle = isLockable
                  ? currentStep === step.id
                    ? "bg-amber-50 text-amber-700 font-medium border border-amber-200"
                    : "text-amber-600 hover:bg-amber-50"
                  : "";
                // 업로드 단계 스타일
                const uploadStyle = stepType === 'upload'
                  ? currentStep === step.id
                    ? "bg-green-50 text-green-700 font-medium border border-green-200"
                    : "text-green-600 hover:bg-green-50"
                  : "";
                // 기본 스타일
                const defaultStyle = !isLockable && stepType !== 'upload'
                  ? currentStep === step.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-50"
                  : "";
                const activeStyle = confirmStyle || uploadStyle || defaultStyle;

                return (
                  <button
                    key={step.id}
                    onClick={() => updateStep(step.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-2 ${activeStyle}`}
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 text-[11px] flex-shrink-0">
                      {stepIcon || indicator.icon}
                    </span>
                    <span className="truncate">{step.name}</span>
                    {step.id < currentStep && (
                      <span className="ml-auto text-[9px] text-green-500 flex-shrink-0">&#10003;</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Panel */}
          {showExport && (
            <div className="border-t border-gray-200 p-3">
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                내보내기
              </h3>
              <div className="space-y-1">
                <button
                  onClick={exportAllMessages}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
                >
                  📄 전체 대화
                </button>
                {[1, 2, 3, 4, 6].map((stepId) => (
                  <button
                    key={stepId}
                    onClick={() => exportByStep(stepId)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
                  >
                    📋 {STEPS[stepId]?.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex min-w-0" ref={splitContainerRef}>
          {/* Chat Panel */}
          {(viewMode === "chat" || viewMode === "split") && (
            <div className="flex flex-col" style={viewMode === "split" ? { width: `${splitRatio}%`, flexShrink: 0 } : { flex: 1 }}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">🤖</div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      디옵트 AI 기획 어시스턴트
                    </p>
                    <p className="text-xs">
                      메시지를 보내거나 폼에서 AI 생성을 시작하세요
                    </p>
                    <p className="text-[10px] mt-1 text-gray-400">
                      {STEPS[currentStep]?.short} - {STEPS[currentStep]?.name}
                    </p>
                  </div>
                )}

                {renderedMessages}

                {/* 스트리밍 중 상태 표시 — 도구 실행 등 상세 상태 */}
                {isStreaming && statusInfo && messages.length > 0 && messages[messages.length - 1].content && (
                  <div className="flex justify-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold mr-2 mt-1">
                      D
                    </div>
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-2xl px-3 py-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-lg animate-bounce">{statusInfo.emoji}</span>
                        <span className="text-blue-700 font-medium animate-pulse">{statusInfo.message}</span>
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 bg-blue-400 rounded-full animate-[bounce_1s_0ms_infinite]" />
                          <span className="w-1 h-1 bg-blue-400 rounded-full animate-[bounce_1s_200ms_infinite]" />
                          <span className="w-1 h-1 bg-blue-400 rounded-full animate-[bounce_1s_400ms_infinite]" />
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 스트리밍 중 글로벌 인디케이터 — AI가 동작 중임을 항상 표시 */}
                {isStreaming && (
                  <div className="flex items-center gap-2 py-2 px-3">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-[pulse_1.5s_0ms_infinite]" />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-[pulse_1.5s_300ms_infinite]" />
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-[pulse_1.5s_600ms_infinite]" />
                    </div>
                    <span className="text-[11px] text-gray-400 animate-pulse">AI 작업 중</span>
                  </div>
                )}

                {/* 기획안 자동 적용 완료 알림 */}
                {planApplied && pendingPlanSections === 0 && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-green-600 py-2">
                    <span>&#10003;</span>
                    <span>기획안이 오른쪽 패널에 적용되었습니다</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input — 별도 컴포넌트로 분리하여 타이핑 시 메시지 목록 리렌더링 방지 */}
              <ChatInput
                isStreaming={isStreaming}
                currentStep={currentStep}
                attachedFile={attachedFile}
                uploading={uploading}
                onSend={(msg) => sendMessage(msg)}
                onFileUpload={handleFileUpload}
                onClearFile={() => setAttachedFile(null)}
              />
            </div>
          )}

          {/* 드래그 리사이즈 핸들 */}
          {viewMode === "split" && (
            <div
              onMouseDown={handleSplitMouseDown}
              className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors relative group"
              title="드래그하여 크기 조절"
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-400 group-hover:bg-white transition-colors" />
            </div>
          )}

          {/* Right Panel — 스텝별 자동 전환 (V2 파이프라인, 10단계) */}
          {(viewMode === "form" || viewMode === "split") && (
            <div className="overflow-hidden" style={viewMode === "split" ? { width: `${100 - splitRatio}%`, flexShrink: 0 } : { flex: 1 }}>
              {/* STEP 0: 작업의뢰서 첨부 */}
              {currentStep === 0 ? (
                <FileUploadPanel
                  projectId={parseInt(projectId)}
                  currentStep={0}
                  refreshKey={formRefreshKey}
                  onStepComplete={() => updateStep(2)}
                  onWorkOrderAnalyze={handleWorkOrderAnalyze}
                />
              ) : /* STEP 1: 시장조사 / STEP 2: 브리프 작성 */
              currentStep >= 1 && currentStep <= 2 ? (
                <BriefPanel
                  projectId={parseInt(projectId)}
                  currentStep={currentStep}
                  refreshKey={formRefreshKey}
                  onConfirmAndNextStep={() => {
                    updateStep(3);
                  }}
                  onRequestPlan={(msg) => {
                    if (currentStep === 1) {
                      // 시장조사 → 브리프 작성 (step 2로 전환 + step override로 race condition 방지)
                      updateStep(2);
                      sendMessage(msg || "시장조사 결과를 바탕으로 브리프를 작성해줘", 2);
                    } else {
                      // 브리프 → 기획안 작성 (step 3으로 전환 + step override)
                      updateStep(3);
                      sendMessage(msg || "확정된 브리프를 기반으로 기획안을 작성해줘", 3);
                    }
                  }}
                />
              ) : /* STEP 3: 기획안 작성 */
              currentStep === 3 ? (
                <PlanEditor
                  projectId={parseInt(projectId)}
                  currentStep={currentStep}
                  refreshKey={formRefreshKey}
                  onExportToFigma={handleFigmaExport}
                  figmaLoading={figmaExporting}
                  onChatMessage={handleReferenceChatMessage}
                />
              ) : /* STEP 4: 촬영콘티 가이드 */
              currentStep === 4 ? (
                <ContiPanel
                  projectId={parseInt(projectId)}
                  currentStep={currentStep}
                  refreshKey={formRefreshKey}
                />
              ) : /* STEP 5: 촬영콘티 확정본 업로드 */
              currentStep === 5 ? (
                <FileUploadPanel
                  projectId={parseInt(projectId)}
                  currentStep={5}
                  refreshKey={formRefreshKey}
                  onStepComplete={() => updateStep(6)}
                />
              ) : /* STEP 6: 디자인 가이드 작성 */
              currentStep === 6 ? (
                <DesignGuideEditor
                  projectId={parseInt(projectId)}
                  currentStep={currentStep}
                  refreshKey={formRefreshKey}
                  projectName={project?.title}
                />
              ) : /* STEP 7: 디자인 확정본 업로드 */
              currentStep === 7 ? (
                <FileUploadPanel
                  projectId={parseInt(projectId)}
                  currentStep={7}
                  refreshKey={formRefreshKey}
                  onStepComplete={() => updateStep(8)}
                />
              ) : /* STEP 8: 프로젝트 마무리 */
              currentStep === 8 ? (
                <FileUploadPanel
                  projectId={parseInt(projectId)}
                  currentStep={8}
                  refreshKey={formRefreshKey}
                  onStepComplete={() => updateStep(9)}
                />
              ) : /* STEP 9: AI 총평 & 리포팅 */
              (
                <AIReviewPanel
                  projectId={parseInt(projectId)}
                  refreshKey={formRefreshKey}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {showSchedule && (
        <SchedulePanel
          projectId={parseInt(projectId)}
          onClose={() => setShowSchedule(false)}
        />
      )}

      {/* Email Composer Modal */}
      {showEmailComposer && (
        <EmailComposer
          projectId={parseInt(projectId)}
          deliveryType={currentStep <= 2 ? "브리프" : currentStep <= 3 ? "기획안" : currentStep <= 5 ? "촬영콘티" : "디자인가이드"}
          onClose={() => setShowEmailComposer(false)}
          onSent={() => setShowEmailComposer(false)}
        />
      )}
    </div>
  );
}
