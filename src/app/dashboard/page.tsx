"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { STEPS } from "@/types";

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
  brief_due?: string;
  plan_due?: string;
  shoot_date?: string;
  design_due?: string;
  final_due?: string;
  client_email?: string;
  client_contact?: string;
  planner_email?: string;
}

interface EditForm {
  title: string;
  clientName: string;
  productName: string;
  industry: string;
  clientEmail: string;
  clientContact: string;
  plannerEmail: string;
  briefDue: string;
  planDue: string;
  shootDate: string;
  designDue: string;
  finalDue: string;
  sectionCount: string;
  shootingCutCount: string;
  budget: string;
  useModels: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<EditForm>({
    title: "", clientName: "", productName: "", industry: "",
    clientEmail: "", clientContact: "", plannerEmail: "",
    briefDue: "", planDue: "", shootDate: "", designDue: "", finalDue: "",
    sectionCount: "", shootingCutCount: "", budget: "", useModels: true,
  });
  const [showSchedule, setShowSchedule] = useState(false);
  // 프로젝트 설정 수정 모달
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "", clientName: "", productName: "", industry: "",
    clientEmail: "", clientContact: "", plannerEmail: "",
    briefDue: "", planDue: "", shootDate: "", designDue: "", finalDue: "",
    sectionCount: "", shootingCutCount: "", budget: "", useModels: true,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editShowSchedule, setEditShowSchedule] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (session) fetchProjects();
  }, [session]);

  const fetchProjects = async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  };

  const createProject = async () => {
    const {
      title, clientName, productName, industry,
      sectionCount, shootingCutCount, budget, useModels,
      ...scheduleFields
    } = form;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, clientName, productName, industry,
        schedule: scheduleFields,
        contractSettings: {
          sectionCount: parseInt(sectionCount) || 0,
          shootingCutCount: parseInt(shootingCutCount) || 0,
          budget,
          useModels,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setShowModal(false);
      setForm({
        title: "", clientName: "", productName: "", industry: "",
        clientEmail: "", clientContact: "", plannerEmail: "",
        briefDue: "", planDue: "", shootDate: "", designDue: "", finalDue: "",
        sectionCount: "", shootingCutCount: "", budget: "", useModels: true,
      });
      setShowSchedule(false);
      router.push(`/project/${data.id}`);
    }
  };

  const deleteProject = async (id: number) => {
    if (!confirm("이 프로젝트를 삭제하시겠습니까?")) return;
    await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    fetchProjects();
  };

  // 설정 수정 모달 열기
  const openEditModal = async (project: Project) => {
    setEditingProject(project);
    setEditLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/settings`);
      if (res.ok) {
        const data = await res.json();
        setEditForm({
          title: data.title || "",
          clientName: data.clientName || "",
          productName: data.productName || "",
          industry: data.industry || "",
          clientEmail: data.clientEmail || "",
          clientContact: data.clientContact || "",
          plannerEmail: data.plannerEmail || "",
          briefDue: data.briefDue || "",
          planDue: data.planDue || "",
          shootDate: data.shootDate || "",
          designDue: data.designDue || "",
          finalDue: data.finalDue || "",
          sectionCount: data.sectionCount ? String(data.sectionCount) : "",
          shootingCutCount: data.shootingCutCount ? String(data.shootingCutCount) : "",
          budget: data.budget || "",
          useModels: data.useModels !== false,
        });
      }
    } catch {}
    setEditLoading(false);
  };

  // 설정 저장
  const saveProjectSettings = async () => {
    if (!editingProject) return;
    setEditLoading(true);
    try {
      // 기본 정보 + 계약 조건 저장
      await fetch(`/api/projects/${editingProject.id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          clientName: editForm.clientName,
          productName: editForm.productName,
          industry: editForm.industry,
          sectionCount: parseInt(editForm.sectionCount) || 0,
          shootingCutCount: parseInt(editForm.shootingCutCount) || 0,
          budget: editForm.budget,
          useModels: editForm.useModels,
        }),
      });

      // 스케줄 저장
      await fetch(`/api/projects/${editingProject.id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: editForm.clientEmail,
          clientContact: editForm.clientContact,
          plannerEmail: editForm.plannerEmail,
          briefDue: editForm.briefDue,
          planDue: editForm.planDue,
          shootDate: editForm.shootDate,
          designDue: editForm.designDue,
          finalDue: editForm.finalDue,
        }),
      });

      setEditingProject(null);
      setEditShowSchedule(false);
      fetchProjects();
    } catch {}
    setEditLoading(false);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">D:OPT AI</h1>
              <p className="text-xs text-gray-500">기획 어시스턴트</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {(session?.user as any)?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                관리자 페이지
              </button>
            )}
            <span className="text-sm text-gray-600">
              {session?.user?.name}님
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">내 프로젝트</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + 새 프로젝트
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-500 mb-4">아직 프로젝트가 없습니다.</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              첫 프로젝트 시작하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition cursor-pointer group"
                onClick={() => router.push(`/project/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition">
                    {project.title || "새 프로젝트"}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    {/* 설정 수정 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(project);
                      }}
                      className="text-gray-400 hover:text-blue-500 p-1 rounded hover:bg-blue-50 transition"
                      title="프로젝트 설정 수정"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                      </svg>
                    </button>
                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                      }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition"
                      title="프로젝트 삭제"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {project.client_name && (
                  <p className="text-sm text-gray-500 mb-1">
                    {project.client_name}
                    {project.product_name ? ` - ${project.product_name}` : ""}
                  </p>
                )}
                {project.industry && (
                  <span className="inline-block text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mb-3">
                    {project.industry}
                  </span>
                )}
                {/* 다음 마감일 표시 */}
                {(() => {
                  const dues = [
                    { date: project.brief_due, label: "브리프" },
                    { date: project.plan_due, label: "기획안" },
                    { date: project.shoot_date, label: "촬영" },
                    { date: project.design_due, label: "디자인" },
                    { date: project.final_due, label: "최종" },
                  ].filter(d => d.date);
                  const today = new Date().toISOString().split("T")[0];
                  const upcoming = dues.find(d => d.date! >= today);
                  if (upcoming) {
                    const daysLeft = Math.ceil((new Date(upcoming.date!).getTime() - new Date(today).getTime()) / 86400000);
                    const isUrgent = daysLeft <= 1;
                    const isNear = daysLeft <= 3;
                    return (
                      <div className={`text-xs px-2 py-1 rounded-lg mb-2 ${
                        isUrgent ? "bg-red-50 text-red-600" : isNear ? "bg-yellow-50 text-yellow-700" : "bg-gray-50 text-gray-500"
                      }`}>
                        {upcoming.label} {upcoming.date} {isUrgent ? "(내일!)" : `(D-${daysLeft})`}
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {STEPS[project.current_step]?.short}: {STEPS[project.current_step]?.name}
                  </span>
                  <span>
                    {new Date(project.updated_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ═══ 새 프로젝트 생성 모달 ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">새 프로젝트</h3>
            <ProjectFormFields form={form} setForm={setForm} showSchedule={showSchedule} setShowSchedule={setShowSchedule} />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setShowSchedule(false); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={createProject}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 프로젝트 설정 수정 모달 ═══ */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">프로젝트 설정 수정</h3>
              <span className="text-xs text-gray-400">ID: {editingProject.id}</span>
            </div>
            {editLoading ? (
              <div className="py-10 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                <span className="text-sm text-gray-400">로딩 중...</span>
              </div>
            ) : (
              <>
                <ProjectFormFields form={editForm} setForm={setEditForm} showSchedule={editShowSchedule} setShowSchedule={setEditShowSchedule} />
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => { setEditingProject(null); setEditShowSchedule(false); }}
                    className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveProjectSettings}
                    disabled={editLoading}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ 재사용 가능한 프로젝트 폼 필드 ═══ */
function ProjectFormFields({
  form,
  setForm,
  showSchedule,
  setShowSchedule,
}: {
  form: EditForm;
  setForm: (f: EditForm) => void;
  showSchedule: boolean;
  setShowSchedule: (v: boolean) => void;
}) {
  return (
    <>
      {/* 기본 정보 */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="프로젝트 제목"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="업체명 (선택)"
            value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="text"
            placeholder="제품명 (선택)"
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">업종 선택 (선택)</option>
          <option value="건기식">건강기능식품</option>
          <option value="식품">식품/가공식품</option>
          <option value="뷰티">뷰티/화장품</option>
          <option value="리빙">리빙/가구</option>
          <option value="음료">음료</option>
          <option value="전자/가전">전자/가전</option>
          <option value="의류">의류/기능성</option>
          <option value="육아/키즈">육아/키즈</option>
          <option value="기타">기타</option>
        </select>
      </div>

      {/* 계약 조건 */}
      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs font-bold text-amber-800 mb-3 flex items-center gap-1">
          📋 계약 조건
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">섹션 수량</label>
              <input
                type="number"
                min="0"
                placeholder="예: 12"
                value={form.sectionCount}
                onChange={(e) => setForm({ ...form, sectionCount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">촬영 컷수</label>
              <input
                type="number"
                min="0"
                placeholder="예: 30"
                value={form.shootingCutCount}
                onChange={(e) => setForm({ ...form, shootingCutCount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">예산/단가</label>
            <input
              type="text"
              placeholder="예: 500만원"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-700 font-medium">모델(인물) 사용</label>
            <button
              type="button"
              onClick={() => setForm({ ...form, useModels: !form.useModels })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.useModels ? "bg-amber-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.useModels ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {!form.useModels && (
            <p className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
              모델 없이 제품/오브제 촬영만 진행합니다. 기획안과 촬영콘티에 반영됩니다.
            </p>
          )}
        </div>
      </div>

      {/* 클라이언트 & 스케줄 토글 */}
      <button
        onClick={() => setShowSchedule(!showSchedule)}
        className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition"
      >
        {showSchedule ? "▲ 스케줄 접기" : "▼ 클라이언트 정보 & 스케줄 설정"}
      </button>

      {showSchedule && (
        <div className="mt-3 space-y-4">
          {/* 클라이언트 정보 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">클라이언트 정보</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="담당자 이름"
                  value={form.clientContact}
                  onChange={(e) => setForm({ ...form, clientContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="email"
                  placeholder="클라이언트 이메일"
                  value={form.clientEmail}
                  onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <input
                type="email"
                placeholder="기획자 이메일 (리마인더 수신용)"
                value={form.plannerEmail}
                onChange={(e) => setForm({ ...form, plannerEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 스케줄 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">프로젝트 스케줄</p>
            <div className="space-y-2">
              {[
                { key: "briefDue", label: "브리프 전달일" },
                { key: "planDue", label: "기획안 전달일" },
                { key: "shootDate", label: "촬영일" },
                { key: "designDue", label: "디자인 완료일" },
                { key: "finalDue", label: "최종 전달일" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 w-24 flex-shrink-0">{label}</label>
                  <input
                    type="date"
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
