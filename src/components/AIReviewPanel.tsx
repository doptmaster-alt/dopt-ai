"use client";

import { useState, useEffect, useCallback } from "react";

interface AIReviewPanelProps {
  projectId: number;
  refreshKey?: number;
}

interface ReviewData {
  id?: number;
  review_content: string;
  email_sent: number;
  email_sent_at?: string;
  gdrive_uploaded: number;
  gdrive_url?: string;
  created_at?: string;
}

export default function AIReviewPanel({ projectId, refreshKey }: AIReviewPanelProps) {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [uploadingGdrive, setUploadingGdrive] = useState(false);

  const fetchReview = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/review`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.review_content) {
          setReview(data);
        }
      }
    } catch (err) {
      console.error("Review fetch error:", err);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchReview();
  }, [fetchReview, refreshKey]);

  // AI 총평 생성 요청
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data);
      } else {
        const err = await res.json();
        alert(`총평 생성 실패: ${err.error}`);
      }
    } catch (err: any) {
      alert(`총평 생성 오류: ${err.message}`);
    }
    setGenerating(false);
  };

  // 이메일 발송
  const handleSendEmail = async () => {
    if (!confirm("dopt@doptstudio.com으로 총평 리포트를 발송하시겠습니까?")) return;

    setSendingEmail(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_email" }),
      });
      if (res.ok) {
        alert("이메일이 발송되었습니다.");
        fetchReview();
      } else {
        const err = await res.json();
        alert(`이메일 발송 실패: ${err.error}`);
      }
    } catch (err: any) {
      alert(`이메일 발송 오류: ${err.message}`);
    }
    setSendingEmail(false);
  };

  // Google Drive 업로드
  const handleGdriveUpload = async () => {
    setUploadingGdrive(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload_gdrive" }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Google Drive에 업로드되었습니다.`);
        fetchReview();
      } else {
        const err = await res.json();
        alert(`Google Drive 업로드 실패: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Google Drive 업로드 오류: ${err.message}`);
    }
    setUploadingGdrive(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <div className="p-6 border-b border-purple-200 bg-purple-50">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📊</span>
          <div>
            <h2 className="text-lg font-bold text-purple-800">AI 총평 & 리포팅</h2>
            <p className="text-xs text-purple-600">
              프로젝트 전체를 분석하여 총평, 피드백, 개선점을 리포팅합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!review ? (
          /* 아직 총평 없음 */
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">총평을 생성하세요</h3>
            <p className="text-sm text-gray-500 mb-6">
              AI가 프로젝트의 전체 파이프라인을 분석하고<br />
              총평, 피드백, 개선사항을 정리합니다.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium text-sm hover:bg-purple-700 disabled:opacity-50 transition shadow-lg"
            >
              {generating ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  총평 생성 중...
                </>
              ) : (
                <>✨ AI 총평 생성</>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-3">
              또는 채팅에서 &quot;총평 작성해줘&quot;라고 요청하세요.
            </p>
          </div>
        ) : (
          /* 총평 표시 */
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <span>📋</span> AI 총평
                {review.created_at && (
                  <span className="text-xs text-gray-400 font-normal">
                    · {new Date(review.created_at).toLocaleString("ko-KR")}
                  </span>
                )}
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                {review.review_content}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="space-y-3">
              {/* 이메일 발송 */}
              <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl">
                <span className="text-2xl">📧</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">이메일 리포트 발송</p>
                  <p className="text-xs text-gray-500">dopt@doptstudio.com으로 총평 리포트를 발송합니다.</p>
                  {review.email_sent === 1 && review.email_sent_at && (
                    <p className="text-xs text-green-600 mt-1">
                      ✅ {new Date(review.email_sent_at).toLocaleString("ko-KR")} 발송 완료
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                    review.email_sent === 1
                      ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  } disabled:opacity-50`}
                >
                  {sendingEmail ? "발송 중..." : review.email_sent === 1 ? "재발송" : "발송하기"}
                </button>
              </div>

              {/* Google Drive 업로드 */}
              <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl">
                <span className="text-2xl">📁</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">Google Drive 포트폴리오</p>
                  <p className="text-xs text-gray-500">프로젝트를 Google Drive에 포트폴리오로 정리합니다.</p>
                  {review.gdrive_uploaded === 1 && review.gdrive_url && (
                    <a
                      href={review.gdrive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 block"
                    >
                      ✅ Google Drive에서 보기 →
                    </a>
                  )}
                </div>
                <button
                  onClick={handleGdriveUpload}
                  disabled={uploadingGdrive}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                    review.gdrive_uploaded === 1
                      ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      : "bg-green-600 text-white hover:bg-green-700"
                  } disabled:opacity-50`}
                >
                  {uploadingGdrive ? "업로드 중..." : review.gdrive_uploaded === 1 ? "재업로드" : "업로드하기"}
                </button>
              </div>

              {/* 다시 생성 */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full p-3 text-center text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition"
              >
                {generating ? "총평 재생성 중..." : "🔄 총평 다시 생성"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
