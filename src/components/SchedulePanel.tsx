"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Props {
  projectId: number;
  onClose: () => void;
}

interface Schedule {
  clientEmail: string;
  clientContact: string;
  plannerEmail: string;
  briefDue: string;
  planDue: string;
  shootDate: string;
  designDue: string;
  finalDue: string;
}

const emptySchedule: Schedule = {
  clientEmail: "", clientContact: "", plannerEmail: "",
  briefDue: "", planDue: "", shootDate: "", designDue: "", finalDue: "",
};

export default function SchedulePanel({ projectId, onClose }: Props) {
  const [schedule, setSchedule] = useState<Schedule>(emptySchedule);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/schedule`);
      if (res.ok) setSchedule(await res.json());
    } catch (e) {
      console.error("스케줄 로드 실패:", e);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      alert("저장 실패");
    }
    setSaving(false);
  };

  const today = new Date().toISOString().split("T")[0];

  const milestones = [
    { key: "briefDue" as const, label: "브리프 전달", icon: "📋", color: "blue" },
    { key: "planDue" as const, label: "기획안 전달", icon: "📐", color: "purple" },
    { key: "shootDate" as const, label: "촬영 진행", icon: "📷", color: "orange" },
    { key: "designDue" as const, label: "디자인 완료", icon: "🎨", color: "pink" },
    { key: "finalDue" as const, label: "최종 전달", icon: "🚀", color: "green" },
  ];

  const getStatus = (dateStr: string) => {
    if (!dateStr) return "none";
    if (dateStr < today) return "past";
    if (dateStr === today) return "today";
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000);
    if (diff <= 3) return "soon";
    return "future";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "past": return { text: "완료", cls: "bg-gray-100 text-gray-500" };
      case "today": return { text: "오늘!", cls: "bg-red-100 text-red-700 animate-pulse" };
      case "soon": return { text: "임박", cls: "bg-yellow-100 text-yellow-700" };
      case "future": return { text: "예정", cls: "bg-blue-50 text-blue-600" };
      default: return { text: "미설정", cls: "bg-gray-50 text-gray-400" };
    }
  };

  const getDaysLeft = (dateStr: string) => {
    if (!dateStr) return "";
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000);
    if (diff < 0) return `D+${Math.abs(diff)}`;
    if (diff === 0) return "D-Day";
    return `D-${diff}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">프로젝트 스케줄 & 클라이언트</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* 타임라인 */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3">프로젝트 타임라인</h3>
            <div className="space-y-3">
              {milestones.map((m) => {
                const status = getStatus(schedule[m.key]);
                const badge = getStatusBadge(status);
                return (
                  <div key={m.key} className={`flex items-center gap-3 p-3 rounded-xl border ${
                    status === "today" ? "border-red-300 bg-red-50" :
                    status === "soon" ? "border-yellow-200 bg-yellow-50/50" :
                    "border-gray-200 bg-white"
                  }`}>
                    <span className="text-xl">{m.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{m.label}</p>
                      <input
                        type="date"
                        value={schedule[m.key]}
                        onChange={(e) => setSchedule({ ...schedule, [m.key]: e.target.value })}
                        className="mt-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.text}
                      </span>
                      {schedule[m.key] && (
                        <p className={`text-xs font-bold mt-1 ${
                          status === "today" || status === "soon" ? "text-red-600" : "text-gray-400"
                        }`}>
                          {getDaysLeft(schedule[m.key])}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 클라이언트 정보 */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3">클라이언트 정보</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">담당자 이름</label>
                  <input
                    type="text"
                    placeholder="홍길동"
                    value={schedule.clientContact}
                    onChange={(e) => setSchedule({ ...schedule, clientContact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">클라이언트 이메일</label>
                  <input
                    type="email"
                    placeholder="client@company.com"
                    value={schedule.clientEmail}
                    onChange={(e) => setSchedule({ ...schedule, clientEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">기획자 이메일 (마감 리마인더 수신)</label>
                <input
                  type="email"
                  placeholder="planner@doptstudio.com"
                  value={schedule.plannerEmail}
                  onChange={(e) => setSchedule({ ...schedule, plannerEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 알림 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-800 mb-1">자동 리마인더</p>
            <p className="text-xs text-blue-600">
              각 마감일 하루 전 기획자 이메일로 자동 알림이 발송됩니다.
              기획자 이메일과 마감일을 설정해주세요.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              saved ? "bg-green-500 text-white" :
              saving ? "bg-gray-300 text-gray-500" :
              "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {saved ? "저장됨!" : saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
