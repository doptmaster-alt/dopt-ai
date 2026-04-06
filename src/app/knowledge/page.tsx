"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  source: string;
  sourceUrl: string;
  tags: string[];
  createdAt: string;
}

interface KnowledgeStats {
  total: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
}

const CATEGORY_LABELS: Record<string, string> = {
  brief: "브리프",
  plan: "기획안",
  conti: "촬영콘티",
  final: "최종산출물",
  process: "프로세스",
  reference: "레퍼런스",
};

const SOURCE_LABELS: Record<string, string> = {
  notion: "Notion",
  gdrive: "Google Drive",
  figma: "Figma",
  upload: "파일 업로드",
};

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [loading, setLoading] = useState(true);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    title: "",
    content: "",
    category: "reference" as string,
    source: "upload" as string,
    sourceUrl: "",
    tags: "",
  });

  // Notion import state
  const [showNotionImport, setShowNotionImport] = useState(false);
  const [notionForm, setNotionForm] = useState({
    pageId: "",
    category: "reference" as string,
    tags: "",
  });
  const [notionLoading, setNotionLoading] = useState(false);

  // Notion full scan state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    message: string;
    stats: { totalFound: number; imported: number; skipped: number; errors: number };
    items: Array<{ title: string; category: string; url: string }>;
    errors: string[];
  } | null>(null);

  // Google Drive scan state
  const [scanningGDrive, setScanningGDrive] = useState(false);
  const [showGDriveSetup, setShowGDriveSetup] = useState(false);
  const [gdriveFolderId, setGdriveFolderId] = useState("");
  const [gdriveResult, setGdriveResult] = useState<{
    message: string;
    stats: { totalFound: number; readable: number; imported: number; skipped: number; errors: number };
    items: Array<{ title: string; category: string; url: string; type: string }>;
    errors: string[];
  } | null>(null);

  // File upload state
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/knowledge";
      if (searchQuery || filterCategory) {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (filterCategory) params.set("category", filterCategory);
        url = `/api/knowledge/search?${params.toString()}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch entries:", e);
    }
    setLoading(false);
  }, [searchQuery, filterCategory]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/stats");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchEntries();
      fetchStats();
    }
  }, [session, fetchEntries, fetchStats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchEntries();
      fetchStats();
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...addForm,
        tags: addForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    if (res.ok) {
      setShowAddForm(false);
      setAddForm({ title: "", content: "", category: "reference", source: "upload", sourceUrl: "", tags: "" });
      fetchEntries();
      fetchStats();
    }
  };

  const handleNotionImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotionLoading(true);
    try {
      const res = await fetch("/api/knowledge/import-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: notionForm.pageId,
          category: notionForm.category,
          tags: notionForm.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        setShowNotionImport(false);
        setNotionForm({ pageId: "", category: "reference", tags: "" });
        fetchEntries();
        fetchStats();
      } else {
        const data = await res.json();
        alert(data.error || "Notion 가져오기 실패");
      }
    } catch (err) {
      alert("Notion 가져오기 중 오류가 발생했습니다.");
    }
    setNotionLoading(false);
  };

  const handleGDriveScan = async () => {
    if (!confirm("Google Drive를 스캔하여 상세페이지 관련 문서를 찾아 가져옵니다.\n\n시간이 다소 걸릴 수 있습니다. 계속하시겠습니까?")) return;
    setScanningGDrive(true);
    setGdriveResult(null);
    setShowGDriveSetup(false);
    try {
      const res = await fetch("/api/knowledge/scan-gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: gdriveFolderId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGdriveResult(data);
        fetchEntries();
        fetchStats();
      } else {
        if (data.error?.includes('인증 정보가 없습니다')) {
          setShowGDriveSetup(true);
        } else {
          alert(data.error || "Google Drive 스캔 실패");
        }
      }
    } catch (err) {
      alert("Google Drive 스캔 중 오류가 발생했습니다.");
    }
    setScanningGDrive(false);
  };

  const handleNotionScan = async () => {
    if (!confirm("Notion 워크스페이스 전체를 스캔하여 상세페이지 관련 문서를 찾아 가져옵니다.\n\n시간이 다소 걸릴 수 있습니다. 계속하시겠습니까?")) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/knowledge/scan-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult(data);
        fetchEntries();
        fetchStats();
      } else {
        alert(data.error || "Notion 스캔 실패");
      }
    } catch (err) {
      alert("Notion 스캔 중 오류가 발생했습니다.");
    }
    setScanning(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        alert("파일 업로드 실패");
        setUploading(false);
        return;
      }
      const uploadData = await uploadRes.json();
      const textContent = uploadData.file?.textContent;
      if (!textContent) {
        alert("텍스트 추출이 불가능한 파일입니다. 텍스트 기반 파일을 업로드해주세요.");
        setUploading(false);
        return;
      }

      // Pre-fill the add form with uploaded content
      setAddForm({
        title: file.name.replace(/\.[^.]+$/, ""),
        content: textContent.slice(0, 50000),
        category: "reference",
        source: "upload",
        sourceUrl: "",
        tags: "",
      });
      setShowAddForm(true);
    } catch (err) {
      alert("파일 업로드 중 오류가 발생했습니다.");
    }
    setUploading(false);
    e.target.value = "";
  };

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const grouped = entries.reduce<Record<string, KnowledgeEntry[]>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = [];
    acc[entry.category].push(entry);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Knowledge Base</h1>
            <p className="text-sm text-gray-500">DIOPT AI 지식 저장소</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">전체</p>
            </div>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="rounded-lg border bg-white p-4">
                <p className="text-2xl font-bold text-gray-900">{stats.byCategory[key] || 0}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowNotionImport(false); }}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            직접 추가
          </button>
          <button
            onClick={() => { setShowNotionImport(!showNotionImport); setShowAddForm(false); }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Notion에서 가져오기
          </button>
          <button
            onClick={handleNotionScan}
            disabled={scanning}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Notion 전체 스캔 중...
              </span>
            ) : (
              "Notion 전체 스캔"
            )}
          </button>
          <button
            onClick={handleGDriveScan}
            disabled={scanningGDrive}
            className="rounded-lg bg-gradient-to-r from-green-600 to-teal-600 px-4 py-2 text-sm font-medium text-white hover:from-green-700 hover:to-teal-700 disabled:opacity-50"
          >
            {scanningGDrive ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Google Drive 스캔 중...
              </span>
            ) : (
              "Google Drive 스캔"
            )}
          </button>
          <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {uploading ? "업로드 중..." : "파일 업로드"}
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Notion Scan Result */}
        {scanning && (
          <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
            <div className="flex items-center gap-3">
              <div className="flex space-x-1">
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '0ms' }} />
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '150ms' }} />
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '300ms' }} />
              </div>
              <div>
                <p className="font-medium text-blue-900">Notion 워크스페이스 전체 스캔 중...</p>
                <p className="text-sm text-blue-700">작업의뢰서, 브리프, 기획안, 촬영콘티, 상세페이지 디자인을 찾고 있습니다</p>
              </div>
            </div>
          </div>
        )}

        {scanResult && (
          <div className="mb-6 rounded-lg border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notion 스캔 결과</h3>
              <button
                onClick={() => setScanResult(null)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                닫기
              </button>
            </div>

            {/* 통계 */}
            <div className="mb-4 grid grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{scanResult.stats.totalFound}</p>
                <p className="text-xs text-gray-500">발견된 페이지</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{scanResult.stats.imported}</p>
                <p className="text-xs text-green-600">새로 가져옴</p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{scanResult.stats.skipped}</p>
                <p className="text-xs text-yellow-600">이미 존재</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{scanResult.stats.errors}</p>
                <p className="text-xs text-red-600">오류</p>
              </div>
            </div>

            {/* 가져온 항목 목록 */}
            {scanResult.items.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">가져온 문서 ({scanResult.items.length}건)</h4>
                <div className="max-h-60 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">제목</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">카테고리</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">링크</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {scanResult.items.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-900">{item.title}</td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                              열기
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 에러 목록 */}
            {scanResult.errors.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-red-600">오류 ({scanResult.errors.length}건)</h4>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {scanResult.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Google Drive Setup Guide */}
        {showGDriveSetup && (
          <div className="mb-6 rounded-lg border-2 border-yellow-200 bg-yellow-50 p-6">
            <h3 className="mb-3 text-lg font-semibold text-yellow-900">Google Drive 연동 설정 필요</h3>
            <p className="mb-4 text-sm text-yellow-800">
              Google Drive에서 파일을 가져오려면 서비스 계정 설정이 필요합니다.
            </p>
            <div className="space-y-3 rounded-lg bg-white p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">설정 방법:</p>
              <ol className="list-inside list-decimal space-y-2">
                <li><a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a> 접속</li>
                <li>프로젝트 선택 또는 새 프로젝트 생성</li>
                <li><strong>&quot;API 및 서비스&quot;</strong> &rarr; <strong>&quot;라이브러리&quot;</strong>에서 <strong>&quot;Google Drive API&quot;</strong> 검색 후 활성화</li>
                <li><strong>&quot;API 및 서비스&quot;</strong> &rarr; <strong>&quot;사용자 인증 정보&quot;</strong> &rarr; <strong>&quot;서비스 계정 만들기&quot;</strong></li>
                <li>서비스 계정 생성 후 <strong>&quot;키&quot;</strong> 탭에서 <strong>&quot;JSON 키 생성&quot;</strong> &rarr; 다운로드</li>
                <li>다운로드한 JSON 파일을 프로젝트 루트에 저장 (예: <code className="rounded bg-gray-100 px-1">google-service-account.json</code>)</li>
                <li><code className="rounded bg-gray-100 px-1">.env.local</code>에 추가:<br />
                  <code className="mt-1 block rounded bg-gray-100 p-2">GOOGLE_SERVICE_ACCOUNT_KEY=./google-service-account.json</code>
                </li>
                <li>Google Drive에서 스캔할 폴더를 <strong>서비스 계정 이메일</strong>로 공유<br />
                  <span className="text-xs text-gray-500">(JSON 파일의 &quot;client_email&quot; 값을 복사해서 공유 추가)</span>
                </li>
              </ol>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-yellow-800">폴더 ID (선택사항)</label>
              <input
                type="text"
                value={gdriveFolderId}
                onChange={(e) => setGdriveFolderId(e.target.value)}
                placeholder="Google Drive 폴더 URL에서 복사 (비워두면 전체 검색)"
                className="w-full rounded-lg border border-yellow-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-yellow-600">
                폴더 URL 예시: https://drive.google.com/drive/folders/<strong>여기가_폴더ID</strong>
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleGDriveScan}
                disabled={scanningGDrive}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                설정 완료, 스캔 시작
              </button>
              <button
                onClick={() => setShowGDriveSetup(false)}
                className="rounded-lg border border-yellow-300 px-4 py-2 text-sm text-yellow-800 hover:bg-yellow-100"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* Google Drive Scan Progress */}
        {scanningGDrive && (
          <div className="mb-6 rounded-lg border-2 border-green-200 bg-green-50 p-6">
            <div className="flex items-center gap-3">
              <div className="flex space-x-1">
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-green-500" style={{ animationDelay: '0ms' }} />
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-green-500" style={{ animationDelay: '150ms' }} />
                <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-green-500" style={{ animationDelay: '300ms' }} />
              </div>
              <div>
                <p className="font-medium text-green-900">Google Drive 스캔 중...</p>
                <p className="text-sm text-green-700">Google Docs, Sheets, Slides 파일에서 상세페이지 관련 문서를 찾고 있습니다</p>
              </div>
            </div>
          </div>
        )}

        {/* Google Drive Scan Result */}
        {gdriveResult && (
          <div className="mb-6 rounded-lg border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Google Drive 스캔 결과</h3>
              <button onClick={() => setGdriveResult(null)} className="text-sm text-gray-400 hover:text-gray-600">닫기</button>
            </div>
            <div className="mb-4 grid grid-cols-5 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{gdriveResult.stats.totalFound}</p>
                <p className="text-xs text-gray-500">발견 파일</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{gdriveResult.stats.readable}</p>
                <p className="text-xs text-blue-600">읽기 가능</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{gdriveResult.stats.imported}</p>
                <p className="text-xs text-green-600">새로 가져옴</p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{gdriveResult.stats.skipped}</p>
                <p className="text-xs text-yellow-600">이미 존재</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{gdriveResult.stats.errors}</p>
                <p className="text-xs text-red-600">오류</p>
              </div>
            </div>
            {gdriveResult.items.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">가져온 문서 ({gdriveResult.items.length}건)</h4>
                <div className="max-h-60 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">제목</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">타입</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">카테고리</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">링크</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {gdriveResult.items.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-900">{item.title}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{item.type}</td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">열기</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {gdriveResult.errors.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-red-600">오류 ({gdriveResult.errors.length}건)</h4>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {gdriveResult.errors.map((err, i) => <p key={i}>{err}</p>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notion Import Form */}
        {showNotionImport && (
          <div className="mb-6 rounded-lg border bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">Notion 페이지 가져오기</h3>
            <form onSubmit={handleNotionImport} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notion 페이지 ID</label>
                <input
                  type="text"
                  value={notionForm.pageId}
                  onChange={(e) => setNotionForm({ ...notionForm, pageId: e.target.value })}
                  placeholder="예: abc123def456..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  required
                />
                <p className="mt-1 text-xs text-gray-400">Notion URL의 마지막 부분 (32자리 ID) 또는 하이픈 포함 ID</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">카테고리</label>
                <select
                  value={notionForm.category}
                  onChange={(e) => setNotionForm({ ...notionForm, category: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">태그 (쉼표 구분)</label>
                <input
                  type="text"
                  value={notionForm.tags}
                  onChange={(e) => setNotionForm({ ...notionForm, tags: e.target.value })}
                  placeholder="예: 건기식, 뷰티, 상세페이지"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={notionLoading}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {notionLoading ? "가져오는 중..." : "가져오기"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotionImport(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="mb-6 rounded-lg border bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">지식 직접 추가</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">카테고리</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">출처</label>
                  <select
                    value={addForm.source}
                    onChange={(e) => setAddForm({ ...addForm, source: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  >
                    {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">출처 URL (선택)</label>
                  <input
                    type="text"
                    value={addForm.sourceUrl}
                    onChange={(e) => setAddForm({ ...addForm, sourceUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">태그 (쉼표 구분)</label>
                <input
                  type="text"
                  value={addForm.tags}
                  onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
                  placeholder="예: 건기식, 뷰티, 상세페이지"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">내용</label>
                <textarea
                  value={addForm.content}
                  onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
                  rows={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6 flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="키워드로 검색..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="">전체 카테고리</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            검색
          </button>
        </form>

        {/* Entries grouped by category */}
        {loading ? (
          <p className="text-center text-gray-500">로딩 중...</p>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border bg-white p-12 text-center">
            <p className="text-gray-500">등록된 지식이 없습니다.</p>
            <p className="mt-1 text-sm text-gray-400">위의 버튼을 사용하여 지식을 추가해보세요.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
              const catEntries = grouped[catKey];
              if (!catEntries || catEntries.length === 0) return null;
              return (
                <div key={catKey}>
                  <h2 className="mb-3 text-lg font-semibold text-gray-900">
                    {catLabel}
                    <span className="ml-2 text-sm font-normal text-gray-400">{catEntries.length}건</span>
                  </h2>
                  <div className="space-y-3">
                    {catEntries.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function EntryCard({
  entry,
  onDelete,
}: {
  entry: KnowledgeEntry;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3
              className="cursor-pointer font-medium text-gray-900 hover:text-gray-600"
              onClick={() => setExpanded(!expanded)}
            >
              {entry.title}
            </h3>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {SOURCE_LABELS[entry.source] || entry.source}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            <span>{new Date(entry.createdAt).toLocaleDateString("ko-KR")}</span>
            {entry.sourceUrl && (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                원본 보기
              </a>
            )}
            {entry.tags.length > 0 && (
              <span>{entry.tags.map((t) => `#${t}`).join(" ")}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="ml-4 text-xs text-gray-400 hover:text-red-500"
        >
          삭제
        </button>
      </div>
      {expanded && (
        <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-700">
          {entry.content.length > 3000
            ? entry.content.slice(0, 3000) + "\n\n... (내용이 길어 일부만 표시)"
            : entry.content}
        </div>
      )}
    </div>
  );
}
