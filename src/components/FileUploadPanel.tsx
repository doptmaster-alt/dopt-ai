"use client";

import { useState, useEffect, useCallback } from "react";
import { STEPS } from "@/types";

interface FileUploadPanelProps {
  projectId: number;
  currentStep: number;
  refreshKey?: number;
  onStepComplete?: () => void;
  onWorkOrderAnalyze?: () => void;
}

interface ProjectFile {
  id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_type: string;
  step: number;
  uploaded_at: string;
}

const FILE_TYPE_MAP: Record<number, string> = {
  0: "work_order",
  7: "conti_confirmed",
  9: "design_confirmed",
  10: "final_report",
};

const STEP_ACCEPT: Record<number, string> = {
  0: ".pdf,.docx,.doc,.pptx,.xlsx,.xls,.txt,.png,.jpg,.jpeg",
  7: ".pdf,.png,.jpg,.jpeg,.ai,.psd",
  9: ".pdf,.png,.jpg,.jpeg,.ai,.psd,.fig",
  10: ".pdf",
};

const STEP_INSTRUCTIONS: Record<number, { title: string; desc: string; hint: string }> = {
  0: {
    title: "작업의뢰서 첨부",
    desc: "클라이언트로부터 받은 작업의뢰서를 첨부해주세요.\n없다면 건너뛰고 다음 단계로 진행할 수 있습니다.",
    hint: "PDF, DOCX, PPTX, 이미지 파일 지원",
  },
  7: {
    title: "촬영콘티 확정본 업로드",
    desc: "스타일리스트가 작성한 촬영콘티 확정본을 업로드해주세요.\n확정본이 업로드되면 다음 단계(디자인 가이드)로 진행합니다.",
    hint: "PDF, 이미지 파일 지원",
  },
  9: {
    title: "디자인 확정본 업로드",
    desc: "완성된 상세페이지 디자인 파일을 업로드해주세요.",
    hint: "PDF, 이미지, Figma 파일 지원",
  },
  10: {
    title: "프로젝트 마무리 파일 업로드",
    desc: "브리프, 기획안, 완성 디자인 최종본을 PDF로 업로드해주세요.\n모든 파일이 업로드되면 AI 총평 단계로 진행합니다.",
    hint: "PDF 파일만 지원",
  },
};

export default function FileUploadPanel({
  projectId,
  currentStep,
  refreshKey,
  onStepComplete,
  onWorkOrderAnalyze,
}: FileUploadPanelProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fileType = FILE_TYPE_MAP[currentStep] || "general";
  const info = STEP_INSTRUCTIONS[currentStep] || {
    title: STEPS[currentStep]?.name || "파일 업로드",
    desc: "파일을 업로드해주세요.",
    hint: "",
  };

  // 파일 목록 조회
  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files?step=${currentStep}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error("File fetch error:", err);
    }
    setLoading(false);
  }, [projectId, currentStep]);

  useEffect(() => {
    setLoading(true);
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  // 파일 업로드
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(selectedFiles)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("step", String(currentStep));
      formData.append("fileType", fileType);

      try {
        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    if (successCount > 0) {
      await fetchFiles();
      // STEP 0: 작업의뢰서 업로드 완료 → 자동 분석 시작
      if (currentStep === 0 && onWorkOrderAnalyze) {
        setAnalyzing(true);
        onWorkOrderAnalyze();
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  // 파일 삭제
  const handleDelete = async (fileId: number) => {
    if (!confirm("이 파일을 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/files?fileId=${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, name: string) => {
    const n = name || "";
    if (mimeType?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(n)) return "🖼️";
    if (mimeType === "application/pdf" || n.endsWith(".pdf")) return "📄";
    if (n.endsWith(".pptx") || n.endsWith(".ppt")) return "📊";
    if (n.endsWith(".docx") || n.endsWith(".doc")) return "📝";
    if (n.endsWith(".xlsx") || n.endsWith(".xls")) return "📊";
    if (n.endsWith(".ai")) return "🎨";
    if (n.endsWith(".psd")) return "🎨";
    return "📎";
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <div className="p-6 border-b border-green-200 bg-green-50">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{STEPS[currentStep]?.icon || "📤"}</span>
          <div>
            <h2 className="text-lg font-bold text-green-800">{info.title}</h2>
            <p className="text-xs text-green-600 whitespace-pre-line">{info.desc}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* 업로드 영역 */}
        <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition mb-6">
          <input
            type="file"
            className="hidden"
            accept={STEP_ACCEPT[currentStep] || "*"}
            multiple
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
              <p className="text-sm text-green-600 font-medium">업로드 중...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">📎</span>
              <p className="text-sm text-gray-600 font-medium">클릭하여 파일 선택 또는 드래그 앤 드롭</p>
              <p className="text-xs text-gray-400">{info.hint}</p>
              <p className="text-xs text-gray-400">최대 50MB</p>
            </div>
          )}
        </label>

        {/* 파일 목록 */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-6 w-6 border-3 border-gray-300 border-t-gray-600 rounded-full mx-auto" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">아직 업로드된 파일이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              업로드된 파일 ({files.length})
            </h3>
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition"
              >
                <span className="text-xl flex-shrink-0">
                  {getFileIcon(file.mime_type, file.file_name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{file.file_name}</p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(file.file_size)} · {new Date(file.uploaded_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(file.id)}
                  className="text-gray-400 hover:text-red-500 text-xs px-2 py-1 rounded hover:bg-red-50 transition flex-shrink-0"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        {/* STEP 0: 분석 상태 및 건너뛰기 */}
        {currentStep === 0 && (
          <div className="mt-6 space-y-3">
            {analyzing ? (
              <div className="text-center py-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-700">작업의뢰서를 분석하고 있습니다...</p>
                <p className="text-xs text-blue-500 mt-1">AI가 내용을 읽고 시장조사를 준비합니다</p>
              </div>
            ) : files.length > 0 && onWorkOrderAnalyze ? (
              <div className="text-center">
                <button
                  onClick={() => { setAnalyzing(true); onWorkOrderAnalyze(); }}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition shadow-md"
                >
                  📊 작업의뢰서 분석 시작
                </button>
              </div>
            ) : null}
            {!analyzing && (
              <div className="text-center">
                <button
                  onClick={onStepComplete}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  작업의뢰서 없이 다음 단계로 건너뛰기 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* 다음 단계 진행 */}
        {files.length > 0 && currentStep !== 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={onStepComplete}
              className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition shadow-md"
            >
              ✅ 다음 단계로 진행
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
