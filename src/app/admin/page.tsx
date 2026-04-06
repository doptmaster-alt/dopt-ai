"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { STEPS } from "@/types";

// SQLite CURRENT_TIMESTAMP는 UTC — 한국시간(KST)으로 변환
function toKST(utcStr: string) {
  if (!utcStr) return "";
  // UTC 문자열에 'Z' 접미사 추가하여 Date가 UTC로 인식하게 함
  const d = new Date(utcStr.includes("Z") || utcStr.includes("+") ? utcStr : utcStr + "Z");
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}
function toKSTDate(utcStr: string) {
  if (!utcStr) return "";
  const d = new Date(utcStr.includes("Z") || utcStr.includes("+") ? utcStr : utcStr + "Z");
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

type Tab = "dashboard" | "approvals" | "users" | "projects" | "reports" | "learning" | "errors" | "feedback";

interface PendingUser {
  id: number;
  username: string;
  name: string;
  created_at: string;
}

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
}

interface Project {
  id: number;
  title: string;
  client_name: string;
  product_name: string;
  industry: string;
  current_step: number;
  status: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  username: string;
}

interface Stats {
  totalUsers: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalMessages: number;
  aiMessages: number;
  byIndustry: { industry: string; count: number }[];
  byStep: { current_step: number; count: number }[];
  byPlanner: { name: string; username: string; project_count: number; active_count: number }[];
  dailyActivity: { date: string; count: number }[];
  recentActivity: {
    title: string;
    client_name: string;
    product_name: string;
    current_step: number;
    updated_at: string;
    user_name: string;
  }[];
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);

  // 계정 추가 폼
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", name: "" });
  const [userError, setUserError] = useState("");

  // 비밀번호 변경
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // 에러/피드백
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [errorStats, setErrorStats] = useState<any>(null);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<any>(null);
  const [errorFilter, setErrorFilter] = useState<string>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all');
  const [respondingFeedback, setRespondingFeedback] = useState<number | null>(null);
  const [adminResponse, setAdminResponse] = useState('');

  // AI 학습
  const [learningStatus, setLearningStatus] = useState<any>(null);
  const [learningRunning, setLearningRunning] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (session && (session.user as any)?.role !== "admin") router.push("/dashboard");
  }, [status, session, router]);

  useEffect(() => {
    if (session && (session.user as any)?.role === "admin") {
      fetchAll();
    }
  }, [session]);

  const fetchAll = () => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/admin/projects").then((r) => r.json()).then(setProjects);
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats);
    fetch("/api/admin/pending").then((r) => r.json()).then(setPendingUsers);
    fetchLearningStatus();
    fetchErrors();
    fetchFeedback();
  };

  const fetchErrors = async () => {
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch("/api/errors"),
        fetch("/api/errors?stats=true"),
      ]);
      if (logsRes.ok) setErrorLogs(await logsRes.json());
      if (statsRes.ok) setErrorStats(await statsRes.json());
    } catch {}
  };

  const fetchFeedback = async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch("/api/feedback"),
        fetch("/api/feedback?stats=true"),
      ]);
      if (listRes.ok) setFeedbackList(await listRes.json());
      if (statsRes.ok) setFeedbackStats(await statsRes.json());
    } catch {}
  };

  const updateErrorStatus = async (id: number, status: string, notes?: string) => {
    await fetch("/api/errors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, notes }),
    });
    fetchErrors();
  };

  const updateFeedbackStatus = async (id: number, status: string, response?: string) => {
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, adminResponse: response }),
    });
    setRespondingFeedback(null);
    setAdminResponse('');
    fetchFeedback();
  };

  const fetchLearningStatus = async () => {
    try {
      const res = await fetch("/api/learn-from-images");
      if (res.ok) {
        const data = await res.json();
        setLearningStatus(data);
      }
    } catch {}
  };

  const runLearning = async () => {
    setLearningRunning(true);
    try {
      const res = await fetch("/api/learn-from-images", { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        setLearningStatus((prev: any) => prev ? {
          ...prev,
          processed: prev.processed + (result.newProcessed || 0),
          pending: Math.max(0, prev.pending - (result.newProcessed || 0)),
        } : prev);
      }
    } catch {}
    setLearningRunning(false);
    setTimeout(fetchLearningStatus, 1000);
  };

  const handleApproval = async (id: number, action: "approve" | "reject", name: string) => {
    if (action === "reject" && !confirm(`"${name}"님의 가입을 거절하시겠습니까?`)) return;
    await fetch("/api/admin/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    fetchAll();
  };

  const addUser = async () => {
    setUserError("");
    if (!newUser.username || !newUser.password || !newUser.name) {
      setUserError("모든 항목을 입력해주세요.");
      return;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      setShowAddUser(false);
      setNewUser({ username: "", password: "", name: "" });
      fetchAll();
    } else {
      const data = await res.json();
      setUserError(data.error || "오류가 발생했습니다.");
    }
  };

  const removeUser = async (id: number, name: string) => {
    if (!confirm(`"${name}" 기획자를 삭제하시겠습니까?\n이 기획자의 모든 프로젝트와 대화도 함께 삭제됩니다.`)) return;
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    fetchAll();
  };

  const resetPassword = async () => {
    if (!resetId || !newPassword) return;
    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetId, newPassword }),
    });
    setResetId(null);
    setNewPassword("");
    alert("비밀번호가 변경되었습니다.");
  };

  if (status === "loading" || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string; badge?: number }[] = [
    { key: "dashboard", label: "대시보드", icon: "📊" },
    { key: "approvals", label: "가입 승인", icon: "🔔", badge: pendingUsers.length },
    { key: "users", label: "계정 관리", icon: "👥" },
    { key: "projects", label: "프로젝트 현황", icon: "📋" },
    { key: "reports", label: "리포팅", icon: "📈" },
    { key: "learning", label: "AI 학습", icon: "🧠", badge: learningStatus?.pending || 0 },
    { key: "errors", label: "에러 로그", icon: "🚨", badge: errorStats?.critical_open || 0 },
    { key: "feedback", label: "피드백", icon: "💬", badge: feedbackStats?.pending_count || 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">AD</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">D:OPT 관리자</h1>
              <p className="text-xs text-gray-500">Admin Console</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              기획 대시보드
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition flex items-center gap-1 ${
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon} {t.label}
                {t.badge && t.badge > 0 ? (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* === 대시보드 === */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {pendingUsers.length > 0 && (
                <button onClick={() => setTab("approvals")} className="text-left">
                  <StatCard title="가입 대기" value={pendingUsers.length} icon="🔔" color="red" />
                </button>
              )}
              <StatCard title="기획자 수" value={stats.totalUsers} icon="👥" color="blue" />
              <StatCard title="전체 프로젝트" value={stats.totalProjects} icon="📋" color="purple" />
              <StatCard title="진행 중" value={stats.activeProjects} icon="🔄" color="green" />
              <StatCard title="AI 응답 수" value={stats.aiMessages} icon="🤖" color="orange" />
            </div>

            {/* 최근 활동 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">최근 활동</h3>
              {stats.recentActivity.length === 0 ? (
                <p className="text-gray-400 text-sm">아직 활동이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <span className="font-medium text-gray-900 text-sm">
                          {item.title || "새 프로젝트"}
                        </span>
                        {item.client_name && (
                          <span className="text-gray-500 text-sm ml-2">
                            ({item.client_name})
                          </span>
                        )}
                        <span className="text-blue-600 text-xs ml-2">
                          {STEPS[item.current_step]?.short}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 block">{item.user_name}</span>
                        <span className="text-xs text-gray-400">
                          {toKSTDate(item.updated_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === 가입 승인 === */}
        {tab === "approvals" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              가입 승인 대기 ({pendingUsers.length}명)
            </h2>

            {pendingUsers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-gray-500">승인 대기 중인 가입 신청이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{user.name}</span>
                        <span className="text-sm text-gray-400">@{user.username}</span>
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                          대기중
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        신청일: {toKST(user.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproval(user.id, "reject", user.name)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-red-300 hover:text-red-600 transition"
                      >
                        거절
                      </button>
                      <button
                        onClick={() => handleApproval(user.id, "approve", user.name)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                      >
                        승인
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === 계정 관리 === */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                기획자 계정 ({users.filter((u) => u.role === "planner").length}명)
              </h2>
              <button
                onClick={() => setShowAddUser(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + 계정 추가
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">이름</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">아이디</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">역할</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">가입일</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.username}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            user.role === "admin"
                              ? "bg-red-50 text-red-600"
                              : "bg-blue-50 text-blue-600"
                          }`}>
                            {user.role === "admin" ? "관리자" : "기획자"}
                          </span>
                          {user.status === "pending" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">
                              대기중
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {toKSTDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.role !== "admin" && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setResetId(user.id)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              비밀번호 변경
                            </button>
                            <button
                              onClick={() => removeUser(user.id, user.name)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 계정 추가 모달 */}
            {showAddUser && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">기획자 계정 추가</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="이름 (예: 홍길동)"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="아이디"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="비밀번호"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {userError && <p className="text-red-500 text-sm">{userError}</p>}
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowAddUser(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">취소</button>
                    <button onClick={addUser} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">추가</button>
                  </div>
                </div>
              </div>
            )}

            {/* 비밀번호 변경 모달 */}
            {resetId !== null && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">비밀번호 변경</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {users.find((u) => u.id === resetId)?.name} ({users.find((u) => u.id === resetId)?.username})
                  </p>
                  <input
                    type="text"
                    placeholder="새 비밀번호"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => { setResetId(null); setNewPassword(""); }} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">취소</button>
                    <button onClick={resetPassword} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">변경</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === 프로젝트 현황 === */}
        {tab === "projects" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              전체 프로젝트 ({projects.length}건)
            </h2>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">프로젝트</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">업체/제품</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">업종</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">담당 기획자</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">진행 단계</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">최근 수정</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projects.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.title || "새 프로젝트"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.client_name}{p.product_name ? ` / ${p.product_name}` : ""}
                        </td>
                        <td className="px-4 py-3">
                          {p.industry && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p.industry}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.user_name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${((p.current_step + 1) / 12) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{STEPS[p.current_step]?.short}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {toKSTDate(p.updated_at)}
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                          아직 프로젝트가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* === 리포팅 === */}
        {tab === "reports" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900">리포팅</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 업종별 프로젝트 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">업종별 프로젝트</h3>
                {stats.byIndustry.length === 0 ? (
                  <p className="text-gray-400 text-sm">데이터 없음</p>
                ) : (
                  <div className="space-y-3">
                    {stats.byIndustry.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-20 flex-shrink-0">{item.industry}</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max((item.count / Math.max(...stats.byIndustry.map((i) => i.count))) * 100, 15)}%` }}
                          >
                            <span className="text-xs text-white font-medium">{item.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 기획자별 현황 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">기획자별 현황</h3>
                {stats.byPlanner.length === 0 ? (
                  <p className="text-gray-400 text-sm">데이터 없음</p>
                ) : (
                  <div className="space-y-3">
                    {stats.byPlanner.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          <span className="text-xs text-gray-400 ml-1">@{item.username}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">전체 {item.project_count}건</span>
                          <span className="text-xs text-green-600 font-medium">진행중 {item.active_count}건</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 단계별 분포 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">진행 단계별 분포 (진행중)</h3>
                {stats.byStep.length === 0 ? (
                  <p className="text-gray-400 text-sm">데이터 없음</p>
                ) : (
                  <div className="space-y-2">
                    {stats.byStep.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-32 flex-shrink-0">
                          {STEPS[item.current_step]?.short} {STEPS[item.current_step]?.name}
                        </span>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max((item.count / Math.max(...stats.byStep.map((s) => s.count))) * 100, 15)}%` }}
                          >
                            <span className="text-xs text-white font-medium">{item.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 최근 7일 활동 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">최근 7일 활동량</h3>
                {stats.dailyActivity.length === 0 ? (
                  <p className="text-gray-400 text-sm">데이터 없음</p>
                ) : (
                  <div className="space-y-2">
                    {stats.dailyActivity.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">
                          {toKSTDate(item.date)}
                        </span>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max((item.count / Math.max(...stats.dailyActivity.map((d) => d.count))) * 100, 10)}%` }}
                          >
                            <span className="text-xs text-white font-medium">{item.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 종합 통계 요약 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">종합 통계</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMessages}</p>
                  <p className="text-xs text-gray-500">총 메시지</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{stats.aiMessages}</p>
                  <p className="text-xs text-gray-500">AI 응답</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMessages - stats.aiMessages}</p>
                  <p className="text-xs text-gray-500">기획자 메시지</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalProjects > 0 ? Math.round(stats.totalMessages / stats.totalProjects) : 0}
                  </p>
                  <p className="text-xs text-gray-500">프로젝트당 평균 메시지</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ AI 학습 현황 ═══ */}
        {tab === "learning" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900">AI 학습 현황</h2>

            {/* 학습 상태 카드 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
                    🧠
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">핀터레스트 레퍼런스 자동 분석</h3>
                    <p className="text-sm text-gray-500">이미지에서 디자인 패턴, 레이아웃, 컬러 등을 학습합니다</p>
                  </div>
                </div>
                <button
                  onClick={runLearning}
                  disabled={learningRunning || !learningStatus?.pending}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition ${
                    learningRunning ? "bg-purple-100 text-purple-600 animate-pulse" :
                    learningStatus?.pending > 0 ? "bg-purple-600 text-white hover:bg-purple-700" :
                    "bg-green-50 text-green-600"
                  }`}
                >
                  {learningRunning ? "🧠 학습 중..." : learningStatus?.pending > 0 ? `${learningStatus.pending}개 새 이미지 학습하기` : "학습 완료"}
                </button>
              </div>

              {learningStatus && (
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900">{learningStatus.total}</p>
                    <p className="text-xs text-gray-500 mt-1">총 이미지</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{learningStatus.processed}</p>
                    <p className="text-xs text-gray-500 mt-1">분석 완료</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${learningStatus.pending > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
                    <p className={`text-3xl font-bold ${learningStatus.pending > 0 ? "text-orange-600" : "text-gray-400"}`}>
                      {learningStatus.pending}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">대기 중</p>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  폴더: ~/미국공략웹사이트/diopt-ai/learning/pinterest-references/
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  새 레퍼런스 이미지를 폴더에 넣으면 자동으로 감지하여 학습 대기열에 추가됩니다.
                </p>
              </div>
            </div>

            {/* 학습 데이터 요약 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-3">학습 활용</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full" />
                  레퍼런스 이미지 분석 → 디자인 패턴 DB 자동 축적
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  기획안 작성 시 업종별 레퍼런스 자동 추천
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  와이어프레임 디자인 구조 자동 생성에 학습 데이터 활용
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full" />
                  Nano Banana AI 이미지 생성 퀄리티 향상
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 에러 로그 탭 */}
        {tab === "errors" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">에러 로그</h2>
              <button onClick={fetchErrors} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">새로고침</button>
            </div>

            {/* 에러 통계 */}
            {errorStats && (
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{errorStats.total || 0}</p>
                  <p className="text-xs text-gray-500">전체</p>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{errorStats.open_count || 0}</p>
                  <p className="text-xs text-gray-500">미해결</p>
                </div>
                <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{errorStats.in_progress_count || 0}</p>
                  <p className="text-xs text-gray-500">처리 중</p>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{errorStats.resolved_count || 0}</p>
                  <p className="text-xs text-gray-500">해결됨</p>
                </div>
              </div>
            )}

            {/* 필터 */}
            <div className="flex gap-2">
              {["all", "open", "in_progress", "resolved"].map(f => (
                <button
                  key={f}
                  onClick={() => setErrorFilter(f)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${errorFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {f === "all" ? "전체" : f === "open" ? "미해결" : f === "in_progress" ? "처리 중" : "해결됨"}
                </button>
              ))}
            </div>

            {/* 에러 목록 */}
            <div className="space-y-3">
              {errorLogs
                .filter(e => errorFilter === "all" || e.status === errorFilter)
                .map(err => (
                <div key={err.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          err.severity === "critical" ? "bg-red-100 text-red-700" :
                          err.severity === "high" ? "bg-orange-100 text-orange-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {err.severity === "critical" ? "긴급" : err.severity === "high" ? "높음" : "보통"}
                        </span>
                        <span className="text-xs text-gray-400">{err.type}</span>
                        {err.user_name && <span className="text-xs text-gray-400">| {err.user_name}</span>}
                        <span className="text-xs text-gray-400">{toKST(err.created_at)}</span>
                      </div>
                      <h4 className="font-medium text-gray-900 text-sm">{err.title}</h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{err.message}</p>
                      {err.url && <p className="text-xs text-blue-500 mt-1">{err.url}</p>}
                      {err.stack_trace && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer">스택 트레이스</summary>
                          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-32">{err.stack_trace}</pre>
                        </details>
                      )}
                      {err.notes && <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded">메모: {err.notes}</p>}
                    </div>
                    <div className="flex gap-1 ml-3">
                      {err.status === "open" && (
                        <>
                          <button onClick={() => updateErrorStatus(err.id, "in_progress")} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">처리 시작</button>
                          <button onClick={() => updateErrorStatus(err.id, "resolved")} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">해결</button>
                        </>
                      )}
                      {err.status === "in_progress" && (
                        <button onClick={() => updateErrorStatus(err.id, "resolved")} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">해결 완료</button>
                      )}
                      {err.status === "resolved" && (
                        <span className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded">해결됨</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {errorLogs.filter(e => errorFilter === "all" || e.status === errorFilter).length === 0 && (
                <div className="text-center py-12 text-gray-400">에러 로그가 없습니다</div>
              )}
            </div>
          </div>
        )}

        {/* 피드백 탭 */}
        {tab === "feedback" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">피드백 관리</h2>
              <button onClick={fetchFeedback} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">새로고침</button>
            </div>

            {/* 피드백 통계 */}
            {feedbackStats && (
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{feedbackStats.total || 0}</p>
                  <p className="text-xs text-gray-500">전체</p>
                </div>
                <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{feedbackStats.pending_count || 0}</p>
                  <p className="text-xs text-gray-500">대기 중</p>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{feedbackStats.reviewed_count || 0}</p>
                  <p className="text-xs text-gray-500">검토됨</p>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{feedbackStats.implemented_count || 0}</p>
                  <p className="text-xs text-gray-500">반영됨</p>
                </div>
              </div>
            )}

            {/* 필터 */}
            <div className="flex gap-2">
              {["all", "pending", "reviewed", "implemented", "rejected"].map(f => (
                <button
                  key={f}
                  onClick={() => setFeedbackFilter(f)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${feedbackFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {f === "all" ? "전체" : f === "pending" ? "대기" : f === "reviewed" ? "검토" : f === "implemented" ? "반영" : "반려"}
                </button>
              ))}
            </div>

            {/* 피드백 목록 */}
            <div className="space-y-3">
              {feedbackList
                .filter(fb => feedbackFilter === "all" || fb.status === feedbackFilter)
                .map(fb => (
                <div key={fb.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        fb.category === "bug" ? "bg-red-100 text-red-700" :
                        fb.category === "feature" ? "bg-purple-100 text-purple-700" :
                        fb.category === "ux" ? "bg-pink-100 text-pink-700" :
                        fb.category === "performance" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {fb.category === "bug" ? "버그" : fb.category === "feature" ? "기능 제안" : fb.category === "ux" ? "UI/UX" : fb.category === "performance" ? "성능" : "기타"}
                      </span>
                      <span className={`text-xs ${
                        fb.priority === "urgent" ? "text-red-500 font-bold" :
                        fb.priority === "high" ? "text-orange-500" :
                        "text-gray-400"
                      }`}>
                        {fb.priority === "urgent" ? "긴급" : fb.priority === "high" ? "높음" : fb.priority === "normal" ? "보통" : "낮음"}
                      </span>
                      <span className="text-xs text-gray-400">| {fb.user_name}</span>
                      <span className="text-xs text-gray-400">{toKST(fb.created_at)}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      fb.status === "pending" ? "bg-orange-100 text-orange-700" :
                      fb.status === "reviewed" ? "bg-blue-100 text-blue-700" :
                      fb.status === "implemented" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {fb.status === "pending" ? "대기" : fb.status === "reviewed" ? "검토" : fb.status === "implemented" ? "반영" : "반려"}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 text-sm">{fb.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">{fb.description}</p>

                  {fb.admin_response && (
                    <div className="mt-2 bg-blue-50 p-2 rounded text-xs text-blue-700">
                      <strong>관리자 응답:</strong> {fb.admin_response}
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex gap-2 mt-3">
                    {fb.status === "pending" && (
                      <>
                        <button onClick={() => { setRespondingFeedback(fb.id); setAdminResponse(''); }} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">응답하기</button>
                        <button onClick={() => updateFeedbackStatus(fb.id, "reviewed")} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">검토 완료</button>
                        <button onClick={() => updateFeedbackStatus(fb.id, "rejected")} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">반려</button>
                      </>
                    )}
                    {fb.status === "reviewed" && (
                      <button onClick={() => updateFeedbackStatus(fb.id, "implemented")} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">반영 완료</button>
                    )}
                  </div>

                  {/* 응답 입력 */}
                  {respondingFeedback === fb.id && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={adminResponse}
                        onChange={e => setAdminResponse(e.target.value)}
                        placeholder="관리자 응답 입력..."
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={() => updateFeedbackStatus(fb.id, "reviewed", adminResponse)}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        전송
                      </button>
                      <button onClick={() => setRespondingFeedback(null)} className="px-2 py-1.5 text-sm text-gray-500">취소</button>
                    </div>
                  )}
                </div>
              ))}
              {feedbackList.filter(fb => feedbackFilter === "all" || fb.status === feedbackFilter).length === 0 && (
                <div className="text-center py-12 text-gray-400">피드백이 없습니다</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-2xl w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || ""}`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{title}</p>
    </div>
  );
}
