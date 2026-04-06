"use client";

import React, { useState, useEffect } from "react";

interface ImagePrompt {
  subject: string;
  scene: string;
  foreground: string;
  background: string;
  lighting: string;
  camera: { angle: string; lens: string; dof: string };
  style: string;
  colorPalette: string[];
  mood: string;
  negativePrompt: string;
  aspectRatio: string;
  quality: string;
}

interface CutPage {
  cutNum: number;
  conceptNum?: string;
  type?: string;
  background?: { color?: string; description?: string };
  composition?: string;
  props?: string[];
  moodLighting?: string;
  sectionMapping?: string;
  referenceNote?: string;
  note?: string;
  imagePrompt?: ImagePrompt;
}

interface ContiData {
  projectTitle?: string;
  shootDate?: string;
  location?: string;
  team?: string;
  information?: {
    productName?: string;
    lineup?: string[];
    ingredients?: string;
    features?: string;
    notes?: string;
  };
  shootGuide?: {
    imageStandard?: string;
    propNotice?: string;
    productQty?: string;
    mockupNotice?: string;
  };
  cutList?: {
    total?: number;
    styled?: number;
    gif?: number;
    nukki?: number;
    ai?: number;
    rows?: { no: number; type: string; detail: string; qty: number }[];
  };
  conceptSummary?: {
    concept?: string;
    keywords?: string[];
    colors?: { name: string; hex: string }[];
    mood?: string;
  };
  propList?: { item: string; qty: string; note: string }[];
  cutPages?: CutPage[];
  nukkiGuide?: string;
  shootNotice?: string;
}

export default function ContiDemoPage() {
  const [data, setData] = useState<ContiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("cover");

  useEffect(() => {
    fetch("/api/conti-demo")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDownloadPPT = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/conti-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contiData: data }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `[콘티]${data.projectTitle || "촬영콘티"}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      alert(`PPT 다운로드 실패: ${e.message}`);
    }
    setDownloading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">데모 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const sections = [
    { id: "cover", label: "표지", icon: "📋" },
    { id: "guide", label: "촬영 안내", icon: "📐" },
    { id: "info", label: "INFORMATION", icon: "📦" },
    { id: "props", label: "소품 LIST", icon: "🎨" },
    { id: "cutlist", label: "CUT LIST", icon: "🎞️" },
    { id: "concept", label: "CONCEPT", icon: "🎯" },
    { id: "cuts", label: `컷 페이지 (${data.cutPages?.length || 0})`, icon: "📸" },
    { id: "nukki", label: "누끼 가이드", icon: "📐" },
    { id: "notice", label: "주의사항", icon: "⚠️" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Bar */}
      <div className="bg-black text-white px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="text-xl">🍌</span>
          <div>
            <h1 className="text-lg font-bold">나노바나나 예시 촬영콘티</h1>
            <p className="text-xs text-gray-400">D:opt 표준 포맷 데모 — 스타일리스트 레퍼런스</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-xs text-gray-400 hover:text-white transition">
            대시보드로 돌아가기
          </a>
          <button
            onClick={handleDownloadPPT}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
          >
            {downloading ? (
              <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />생성 중...</>
            ) : (
              <>📥 PPT 다운로드</>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Left Nav */}
        <div className="w-48 shrink-0 sticky top-20 self-start">
          <div className="bg-white rounded-xl border border-gray-200 p-2 space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSection(s.id);
                  document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`w-full text-left text-xs px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                  activeSection === s.id
                    ? "bg-orange-50 text-orange-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* PAGE 1: 표지 */}
          <div id="section-cover" className="bg-black rounded-2xl overflow-hidden shadow-lg">
            <div className="h-1 bg-orange-500" />
            <div className="p-10 text-center">
              <p className="text-xs text-orange-400 tracking-[0.3em] mb-6">SHOOTING CONTI</p>
              <h2 className="text-3xl font-black text-white mb-2">[콘티] {data.projectTitle}</h2>
              <div className="w-16 h-0.5 bg-orange-500 mx-auto my-6" />
              <div className="space-y-2 text-sm text-gray-400">
                {data.shootDate && <p>📅 {data.shootDate}</p>}
                {data.location && <p>📍 {data.location}</p>}
                {data.team && <p>👥 {data.team}</p>}
              </div>
              <p className="text-xs text-gray-600 mt-8">ⓒ D:opt studio</p>
            </div>
          </div>

          {/* PAGE 2: 촬영 안내 가이드 */}
          {data.shootGuide && (
            <SlideCard id="section-guide" title="촬영 안내 가이드" pageNum={2}>
              <div className="space-y-3">
                {[
                  { label: "이미지 전달 기준", value: data.shootGuide.imageStandard, icon: "📐" },
                  { label: "소품 안내", value: data.shootGuide.propNotice, icon: "🎨" },
                  { label: "제품 수량", value: data.shootGuide.productQty, icon: "📦" },
                  { label: "목업 안내", value: data.shootGuide.mockupNotice, icon: "🖥️" },
                ].filter(r => r.value).map((r, i) => (
                  <div key={i} className={`flex gap-4 p-4 rounded-xl ${i % 2 === 0 ? "bg-gray-50" : "bg-white"} border border-gray-100`}>
                    <span className="text-xl">{r.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">{r.label}</p>
                      <p className="text-sm text-gray-800">{r.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SlideCard>
          )}

          {/* PAGE 3: INFORMATION */}
          {data.information && (
            <SlideCard id="section-info" title="INFORMATION" pageNum={3}>
              <div className="space-y-4">
                {data.information.productName && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">제품명</p>
                    <p className="text-lg font-bold text-gray-900">{data.information.productName}</p>
                  </div>
                )}
                {data.information.lineup && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">라인업</p>
                    <div className="flex flex-wrap gap-2">
                      {data.information.lineup.map((item, i) => (
                        <span key={i} className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-1 rounded-full text-sm font-medium">{item}</span>
                      ))}
                    </div>
                  </div>
                )}
                {data.information.ingredients && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">주요 성분/원재료</p>
                    <p className="text-sm text-gray-800">{data.information.ingredients}</p>
                  </div>
                )}
                {data.information.features && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">제품 특징</p>
                    <p className="text-sm text-gray-800">{data.information.features}</p>
                  </div>
                )}
              </div>
            </SlideCard>
          )}

          {/* PAGE 4: 소품 LIST */}
          {data.propList && data.propList.length > 0 && (
            <SlideCard id="section-props" title="소품 LIST" pageNum={4}>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900 text-white">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold w-12">No.</th>
                      <th className="px-4 py-2.5 text-left font-semibold">소품</th>
                      <th className="px-4 py-2.5 text-left font-semibold w-20">수량</th>
                      <th className="px-4 py-2.5 text-left font-semibold">비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.propList.map((p, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-2.5 text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-4 py-2.5 text-gray-900 font-medium">{p.item}</td>
                        <td className="px-4 py-2.5 text-gray-700">{p.qty}</td>
                        <td className="px-4 py-2.5 text-gray-500">{p.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SlideCard>
          )}

          {/* PAGE 5: CUT LIST */}
          <SlideCard id="section-cutlist" title="CUT LIST" pageNum={5}>
            <div className="flex flex-wrap gap-3 mb-4">
              <CutBadge label="TOTAL" count={data.cutList?.total || 0} color="black" />
              <CutBadge label="연출" count={data.cutList?.styled || 0} color="blue" />
              <CutBadge label="GIF" count={data.cutList?.gif || 0} color="purple" />
              <CutBadge label="누끼" count={data.cutList?.nukki || 0} color="green" />
              {(data.cutList?.ai || 0) > 0 && <CutBadge label="AI" count={data.cutList!.ai!} color="orange" />}
            </div>
            {data.cutList?.rows && (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900 text-white">
                    <tr>
                      <th className="px-3 py-2 text-center font-semibold w-12">No.</th>
                      <th className="px-3 py-2 text-center font-semibold w-16">구분</th>
                      <th className="px-3 py-2 text-left font-semibold">컷 상세</th>
                      <th className="px-3 py-2 text-center font-semibold w-12">수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.cutList.rows.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 text-center text-gray-400">{r.no}</td>
                        <td className="px-3 py-2 text-center"><CutTypeBadge type={r.type} /></td>
                        <td className="px-3 py-2 text-gray-800">{r.detail}</td>
                        <td className="px-3 py-2 text-center text-gray-700">{r.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SlideCard>

          {/* PAGE 6: CONCEPT SUMMARY */}
          {data.conceptSummary && (
            <SlideCard id="section-concept" title="CONCEPT SUMMARY" pageNum={6}>
              <div className="space-y-5">
                {data.conceptSummary.concept && (
                  <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-800 leading-relaxed">
                    {data.conceptSummary.concept}
                  </div>
                )}
                {data.conceptSummary.keywords && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">KEYWORD</p>
                    <div className="flex flex-wrap gap-2">
                      {data.conceptSummary.keywords.map((kw, i) => (
                        <span key={i} className="bg-black text-white text-xs px-3 py-1 rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {data.conceptSummary.colors && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">COLOR</p>
                    <div className="flex gap-4">
                      {data.conceptSummary.colors.map((c, i) => (
                        <div key={i} className="text-center">
                          <div className="w-16 h-16 rounded-xl border border-gray-200 shadow-sm" style={{ backgroundColor: c.hex }} />
                          <p className="text-xs text-gray-500 mt-1">{c.name}</p>
                          <p className="text-xs font-mono text-gray-400">{c.hex}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SlideCard>
          )}

          {/* PAGE 7+: 개별 컷 페이지 */}
          <div id="section-cuts">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              📸 개별 컷 페이지 ({data.cutPages?.length || 0}컷)
            </h2>
            <div className="space-y-5">
              {data.cutPages?.map((cut, i) => (
                <CutPageCard key={i} cut={cut} index={i} />
              ))}
            </div>
          </div>

          {/* 누끼 가이드 */}
          {data.nukkiGuide && (
            <div id="section-nukki" className="bg-green-50 border border-green-200 rounded-2xl p-6">
              <h3 className="text-base font-bold text-green-800 mb-3">📐 누끼 가이드</h3>
              <p className="text-sm text-green-700 whitespace-pre-wrap leading-relaxed">{data.nukkiGuide}</p>
            </div>
          )}

          {/* 주의사항 */}
          {data.shootNotice && (
            <div id="section-notice" className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <h3 className="text-base font-bold text-red-800 mb-3">⚠️ 촬영 주의사항</h3>
              <p className="text-sm text-red-700 whitespace-pre-wrap leading-relaxed">{data.shootNotice}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function SlideCard({ id, title, pageNum, children }: { id: string; title: string; pageNum: number; children: React.ReactNode }) {
  return (
    <div id={id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs text-gray-400">PAGE {pageNum}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function CutBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const map: Record<string, string> = {
    black: "bg-gray-900 text-white",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`text-sm px-3 py-1 rounded-full font-semibold ${map[color] || map.black}`}>
      {label} {count}컷
    </span>
  );
}

function CutTypeBadge({ type }: { type: string }) {
  const t = (type || "").toLowerCase();
  const cls = t.includes("연출") || t.includes("style")
    ? "bg-blue-100 text-blue-700"
    : t.includes("gif")
    ? "bg-purple-100 text-purple-700"
    : t.includes("누끼")
    ? "bg-green-100 text-green-700"
    : t.includes("ai")
    ? "bg-orange-100 text-orange-700"
    : "bg-gray-100 text-gray-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls} font-semibold`}>{type}</span>;
}

function CutPageCard({ cut, index }: { cut: CutPage; index: number }) {
  const bgColor = cut.background?.color || "#f0f0f0";
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopyPrompt = () => {
    if (!cut.imagePrompt) return;
    navigator.clipboard.writeText(JSON.stringify(cut.imagePrompt, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Google Imagen / 일반 AI용 한 줄 프롬프트 생성
  const flatPrompt = cut.imagePrompt
    ? `${cut.imagePrompt.subject}. ${cut.imagePrompt.scene}. ${cut.imagePrompt.foreground}. Background: ${cut.imagePrompt.background}. Lighting: ${cut.imagePrompt.lighting}. Camera: ${cut.imagePrompt.camera.angle}, ${cut.imagePrompt.camera.lens} lens, ${cut.imagePrompt.camera.dof}. Style: ${cut.imagePrompt.style}. Mood: ${cut.imagePrompt.mood}. ${cut.imagePrompt.quality}.`
    : '';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 text-white px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">{cut.conceptNum || `CUT ${cut.cutNum || index + 1}`}</span>
          {cut.type && <CutTypeBadge type={cut.type} />}
        </div>
        <div className="flex items-center gap-2">
          {cut.sectionMapping && (
            <span className="text-xs text-orange-300 font-medium">→ {cut.sectionMapping}</span>
          )}
          {cut.imagePrompt && (
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                showPrompt ? "bg-violet-500 text-white" : "bg-gray-700 text-violet-300 hover:bg-gray-600"
              }`}
            >
              {showPrompt ? "AI Prompt 닫기" : "AI Prompt"}
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="flex gap-5">
          {/* Left: Background color preview */}
          <div className="w-48 shrink-0">
            <div
              className="w-full aspect-[4/3] rounded-xl border border-gray-200 flex items-end justify-center pb-3"
              style={{ backgroundColor: bgColor }}
            >
              {bgColor !== "#f0f0f0" && (
                <span className="text-xs font-mono bg-white/80 px-2 py-0.5 rounded text-gray-600">{bgColor}</span>
              )}
            </div>
            {cut.background?.description && (
              <p className="text-xs text-gray-500 mt-2 leading-snug">{cut.background.description}</p>
            )}
          </div>

          {/* Right: Info */}
          <div className="flex-1 space-y-3">
            {/* 구도 */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-500 mb-1">구도 / COMPOSITION</p>
              <p className="text-sm text-gray-800 leading-relaxed">{cut.composition || "구도 미지정"}</p>
            </div>

            {/* 소품 */}
            {cut.props && cut.props.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 mb-1.5">소품 / PROPS</p>
                <div className="flex flex-wrap gap-1.5">
                  {cut.props.map((p, j) => (
                    <span key={j} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 무드/라이팅 */}
            {cut.moodLighting && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 mb-1">무드 / 라이팅</p>
                <p className="text-sm text-gray-700">{cut.moodLighting}</p>
              </div>
            )}

            {/* 레퍼런스 */}
            {cut.referenceNote && (
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                <p className="text-[10px] font-semibold text-orange-600 mb-0.5">레퍼런스 참고</p>
                <p className="text-sm text-orange-800">{cut.referenceNote}</p>
              </div>
            )}

            {/* 비고 */}
            {cut.note && (
              <p className="text-xs text-gray-500 italic pt-1 border-t border-gray-100">
                💡 {cut.note}
              </p>
            )}
          </div>
        </div>

        {/* AI Image Generation Prompt */}
        {showPrompt && cut.imagePrompt && (
          <div className="mt-5 border-t border-gray-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-violet-700 flex items-center gap-2">
                <span className="w-5 h-5 bg-violet-100 rounded flex items-center justify-center text-[10px]">AI</span>
                Image Generation Prompt
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(flatPrompt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-xs px-3 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition font-medium"
                >
                  {copied ? "Copied!" : "Copy Flat Prompt"}
                </button>
                <button
                  onClick={handleCopyPrompt}
                  className="text-xs px-3 py-1 rounded-md bg-violet-100 text-violet-700 hover:bg-violet-200 transition font-medium"
                >
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
              </div>
            </div>

            {/* Flat prompt (for Google / simple AI) */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-gray-500 mb-1.5">FLAT PROMPT (Google Imagen / DALL-E)</p>
              <div className="bg-gray-900 rounded-lg p-3 text-xs text-green-300 font-mono leading-relaxed break-words">
                {flatPrompt}
              </div>
            </div>

            {/* Structured JSON */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 mb-1.5">STRUCTURED JSON PROMPT</p>
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="p-4 space-y-3 text-xs font-mono">
                  {/* Subject */}
                  <PromptField label="subject" value={cut.imagePrompt.subject} color="text-yellow-300" />
                  <PromptField label="scene" value={cut.imagePrompt.scene} color="text-blue-300" />
                  <PromptField label="foreground" value={cut.imagePrompt.foreground} color="text-green-300" />
                  <PromptField label="background" value={cut.imagePrompt.background} color="text-cyan-300" />
                  <PromptField label="lighting" value={cut.imagePrompt.lighting} color="text-amber-300" />

                  {/* Camera */}
                  <div>
                    <span className="text-violet-400">"camera"</span>
                    <span className="text-gray-500">: {"{"}</span>
                    <div className="ml-4 space-y-1">
                      <div><span className="text-gray-500">"angle": </span><span className="text-orange-300">"{cut.imagePrompt.camera.angle}"</span></div>
                      <div><span className="text-gray-500">"lens": </span><span className="text-orange-300">"{cut.imagePrompt.camera.lens}"</span></div>
                      <div><span className="text-gray-500">"dof": </span><span className="text-orange-300">"{cut.imagePrompt.camera.dof}"</span></div>
                    </div>
                    <span className="text-gray-500">{"}"}</span>
                  </div>

                  <PromptField label="style" value={cut.imagePrompt.style} color="text-pink-300" />
                  <PromptField label="mood" value={cut.imagePrompt.mood} color="text-rose-300" />

                  {/* Color Palette */}
                  <div>
                    <span className="text-violet-400">"colorPalette"</span>
                    <span className="text-gray-500">: </span>
                    <div className="flex gap-2 mt-1 ml-4">
                      {cut.imagePrompt.colorPalette.map((c, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded border border-gray-600" style={{ backgroundColor: c }} />
                          <span className="text-emerald-300">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <PromptField label="negativePrompt" value={cut.imagePrompt.negativePrompt} color="text-red-400" />

                  <div className="flex gap-6">
                    <div><span className="text-violet-400">"aspectRatio"</span><span className="text-gray-500">: </span><span className="text-white">{cut.imagePrompt.aspectRatio}</span></div>
                    <div><span className="text-violet-400">"quality"</span><span className="text-gray-500">: </span><span className="text-white">{cut.imagePrompt.quality}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptField({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <span className="text-violet-400">"{label}"</span>
      <span className="text-gray-500">: </span>
      <span className={color}>"{value}"</span>
    </div>
  );
}
