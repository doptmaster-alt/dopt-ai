"use client";

import { useState, useEffect, useCallback } from "react";

interface ConfirmationPanelProps {
  projectId: number;
  dataType: "brief" | "plan";
  currentStep: number;
  refreshKey?: number;
}

interface ConfirmedInfo {
  isConfirmed: boolean;
  data: any;
  confirmedAt?: string;
  confirmedBy?: number;
  pdfPath?: string;
}

export default function ConfirmationPanel({
  projectId,
  dataType,
  currentStep,
  refreshKey,
}: ConfirmationPanelProps) {
  const [confirmedInfo, setConfirmedInfo] = useState<ConfirmedInfo | null>(null);
  const [sourceData, setSourceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const label = dataType === "brief" ? "브리프" : "기획안";
  const sourceStep = dataType === "brief" ? 2 : 4;

  // 확정 상태 조회
  const fetchConfirmStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/confirm?dataType=${dataType}`);
      if (res.ok) {
        const data = await res.json();
        setConfirmedInfo(data);
      }
    } catch (err) {
      console.error("Confirm status fetch error:", err);
    }
  }, [projectId, dataType]);

  // 소스 데이터 조회 (확정 전 미리보기)
  const fetchSourceData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/step-data?step=${sourceStep}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.form_data) {
          setSourceData(JSON.parse(data.form_data));
        }
      }
    } catch (err) {
      console.error("Source data fetch error:", err);
    }
    setLoading(false);
  }, [projectId, sourceStep]);

  useEffect(() => {
    setLoading(true);
    fetchConfirmStatus();
    fetchSourceData();
  }, [fetchConfirmStatus, fetchSourceData, refreshKey]);

  // 확정하기
  const handleConfirm = async () => {
    if (!confirm(`${label}를 확정하시겠습니까?\n\n확정 후에는 수정할 수 없습니다.`)) return;

    setConfirming(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataType,
          revisionNote: revisionNote.trim() || undefined,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        alert(`${label}가 확정되었습니다.`);
        fetchConfirmStatus();
      } else {
        alert(`확정 실패: ${result.error}`);
      }
    } catch (err: any) {
      alert(`확정 중 오류: ${err.message}`);
    }
    setConfirming(false);
  };

  // PDF 다운로드
  const handleDownloadPdf = async () => {
    setPdfGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pdf?dataType=${dataType}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${label}_확정본_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const err = await res.json();
        alert(`PDF 생성 실패: ${err.error}`);
      }
    } catch (err: any) {
      alert(`PDF 다운로드 오류: ${err.message}`);
    }
    setPdfGenerating(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // 이미 확정됨
  if (confirmedInfo?.isConfirmed) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-green-50 to-white">
        <div className="p-6 border-b border-green-200 bg-green-50">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔒</span>
            <div>
              <h2 className="text-lg font-bold text-green-800">{label} 확정 완료</h2>
              <p className="text-xs text-green-600">
                확정일시: {confirmedInfo.confirmedAt ? new Date(confirmedInfo.confirmedAt).toLocaleString("ko-KR") : "-"}
              </p>
            </div>
          </div>
          <p className="text-sm text-green-700 mt-2">
            이 {label}는 확정되어 잠금 처리되었습니다. 이후 단계에서 AI가 이 데이터를 기준으로 작업합니다.
          </p>
        </div>

        {/* 확정된 데이터 미리보기 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">확정된 {label} 내용</h3>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfGenerating}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {pdfGenerating ? (
                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <span>📥</span>
              )}
              PDF 다운로드
            </button>
          </div>
          <ConfirmedDataPreview data={confirmedInfo.data} dataType={dataType} />
        </div>
      </div>
    );
  }

  // 아직 확정 전
  const hasSourceData = sourceData && (
    dataType === "brief"
      ? (sourceData.productName || sourceData.slogan || sourceData.uspTable?.length)
      : (sourceData.sections?.length)
  );

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-amber-50 to-white">
      <div className="p-6 border-b border-amber-200 bg-amber-50">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🔓</span>
          <div>
            <h2 className="text-lg font-bold text-amber-800">{label} 확정</h2>
            <p className="text-xs text-amber-600">
              {label}를 검토한 후 확정하면 이후 단계의 기준 자료가 됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!hasSourceData ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-600 font-medium mb-2">아직 {label} 데이터가 없습니다</p>
            <p className="text-sm text-gray-400">
              먼저 이전 단계에서 AI에게 {label} 작성을 요청해주세요.
            </p>
          </div>
        ) : (
          <>
            {/* 미리보기 */}
            <div className="mb-6">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <span>{showPreview ? "▼" : "▶"}</span>
                {label} 내용 미리보기
              </button>
              {showPreview && (
                <div className="mt-3 p-4 bg-white border border-gray-200 rounded-xl max-h-[400px] overflow-y-auto">
                  <ConfirmedDataPreview data={sourceData} dataType={dataType} />
                </div>
              )}
            </div>

            {/* 수정 노트 */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                확정 메모 (선택사항)
              </label>
              <textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="특이사항이나 변경 이력을 기록하세요..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                rows={3}
              />
            </div>

            {/* 확정 버튼 */}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-medium text-sm hover:bg-amber-700 disabled:opacity-50 transition shadow-lg"
            >
              {confirming ? (
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <span>🔒</span>
              )}
              {confirming ? "확정 중..." : `${label} 확정하기`}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              확정 후에는 수정할 수 없으며, 이후 단계에서 AI가 참조합니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** 확정 데이터 미리보기 */
function ConfirmedDataPreview({ data, dataType }: { data: any; dataType: "brief" | "plan" }) {
  if (!data) return <p className="text-sm text-gray-400">데이터 없음</p>;

  if (dataType === "brief") {
    return (
      <div className="space-y-4 text-sm">
        {data.productName && (
          <div>
            <span className="font-semibold text-gray-700">제품명:</span>{" "}
            <span className="text-gray-900">{data.productName}</span>
          </div>
        )}
        {data.slogan && (
          <div>
            <span className="font-semibold text-gray-700">슬로건:</span>{" "}
            <span className="text-gray-900">{data.slogan}</span>
          </div>
        )}
        {data.targetCustomer && (
          <div>
            <span className="font-semibold text-gray-700">타겟:</span>{" "}
            <span className="text-gray-900">{data.targetCustomer}</span>
          </div>
        )}
        {data.uspTable?.length > 0 && (
          <div>
            <span className="font-semibold text-gray-700 block mb-1">USP 테이블:</span>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1 text-left">특성</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">장점</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">혜택</th>
                </tr>
              </thead>
              <tbody>
                {data.uspTable.map((row: any, i: number) => (
                  <tr key={i}>
                    <td className="border border-gray-200 px-2 py-1">{row.feature || row.F || "-"}</td>
                    <td className="border border-gray-200 px-2 py-1">{row.advantage || row.A || "-"}</td>
                    <td className="border border-gray-200 px-2 py-1">{row.benefit || row.B || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.keyMessage && (
          <div>
            <span className="font-semibold text-gray-700">키 메시지:</span>{" "}
            <span className="text-gray-900">{data.keyMessage}</span>
          </div>
        )}
        {data.toneAndManner && (
          <div>
            <span className="font-semibold text-gray-700">톤앤매너:</span>{" "}
            <span className="text-gray-900">{data.toneAndManner}</span>
          </div>
        )}
      </div>
    );
  }

  // Plan preview
  return (
    <div className="space-y-4 text-sm">
      {data.sections?.map((section: any, i: number) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
              섹션 {i + 1}
            </span>
            <span className="font-semibold text-gray-800">{section.title || section.name || `섹션 ${i + 1}`}</span>
          </div>
          {section.purpose && (
            <p className="text-xs text-gray-500 mt-1">목적: {section.purpose}</p>
          )}
          {section.copyBlocks?.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">카피 블록: {section.copyBlocks.length}개</p>
          )}
          {section.wireframeBlocks?.length > 0 && (
            <p className="text-xs text-gray-400">와이어프레임 블록: {section.wireframeBlocks.length}개</p>
          )}
        </div>
      ))}
      {(!data.sections || data.sections.length === 0) && (
        <p className="text-gray-400">기획안 섹션이 없습니다.</p>
      )}
    </div>
  );
}
