"use client";

import React, { useState, useEffect } from "react";

interface Props {
  projectId: number;
  deliveryType: string;
  briefContent?: string;
  onClose: () => void;
  onSent: () => void;
}

export default function EmailComposer({ projectId, deliveryType, briefContent, onClose, onSent }: Props) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [composing, setComposing] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    composeEmail();
  }, []);

  const composeEmail = async () => {
    setComposing(true);
    try {
      const res = await fetch("/api/email/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, deliveryType, briefContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setTo(data.to || "");
        setSubject(data.subject || "");
        setBody(data.body || "");
      } else {
        const err = await res.json();
        setError(err.error || "이메일 작성 실패");
      }
    } catch (e: any) {
      setError(e.message);
    }
    setComposing(false);
  };

  const handleSend = async () => {
    if (!to) { setError("수신자 이메일을 입력하세요."); return; }
    if (!subject) { setError("제목을 입력하세요."); return; }

    setSending(true);
    setError("");

    // body를 서버로 보내서 서명+CAUTION 포함 HTML 생성
    const html = "USE_TEMPLATE";

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, to, cc, subject, bodyText: body, emailType: "delivery" }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        setTimeout(() => onSent(), 2000);
      } else {
        setError(data.error || "발송 실패");
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">📧</span>
            <h2 className="text-lg font-bold text-gray-900">클라이언트 이메일 발송</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {composing ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-gray-600">AI가 이메일을 작성하고 있습니다...</p>
          </div>
        ) : sent ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-lg font-bold text-green-700">이메일 발송 완료!</p>
            <p className="text-sm text-gray-500 mt-1">{to}</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* 수신자 */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">받는 사람</label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@company.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* CC */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">참조 (CC)</label>
              <input
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@doptstudio.com (선택)"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* 제목 */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">제목</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* 본문 */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">본문</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none resize-y leading-relaxed"
              />
            </div>

            {/* 안내 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                Hiworks 이메일로 발송됩니다. 발송 전 내용을 확인하세요.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!composing && !sent && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between rounded-b-2xl">
            <button
              onClick={composeEmail}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              AI 다시 작성
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                  sending ? "bg-gray-300 text-gray-500" : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {sending ? "발송 중..." : "📧 발송하기"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
