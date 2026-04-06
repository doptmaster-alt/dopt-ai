"use client";

import React, { useState, useEffect, useCallback } from "react";
import QCReport, { QCButton, type QCResult } from "./QCReport";

interface Props {
  projectId: number;
  currentStep: number;
  refreshKey?: number;
}

interface ContiData {
  projectTitle?: string;
  shootDate?: string;
  location?: string;
  team?: string;
  // New: INFORMATION
  information?: {
    productName?: string;
    lineup?: string[];
    ingredients?: string;
    features?: string;
    notes?: string;
  };
  // New: 촬영 안내 가이드
  shootGuide?: {
    imageStandard?: string;
    propNotice?: string;
    productQty?: string;
    mockupNotice?: string;
  };
  // New: CUT LIST (structured)
  cutList?: {
    total?: number;
    styled?: number;
    gif?: number;
    nukki?: number;
    ai?: number;
    rows?: { no: number; type: string; detail: string; qty: number }[];
  };
  // New: CONCEPT SUMMARY (upgraded)
  conceptSummary?: {
    concept?: string;
    keywords?: string[];
    colors?: { name: string; hex: string }[];
    mood?: string;
    // Legacy fields
    background?: string;
    keyColor?: string;
    lighting?: string;
  };
  propList?: { item: string; qty: string; note: string }[];
  // New: Individual cut pages (D:opt format)
  cutPages?: {
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
    imagePrompt?: {
      subject: string;
      scene?: string;
      camera?: { angle?: string; lens?: string; dof?: string };
      foreground?: string;
      background?: string;
      lighting?: string;
      style?: string;
      colorPalette?: string[];
      mood?: string;
      negativePrompt?: string;
      quality?: string;
    };
  }[];
  // Legacy: old cutDetails (backward compat)
  cutDetails?: { cutNum: number; type: string; concept: string; composition: string; props: string; note: string }[];
  nukkiGuide?: string;
  shootNotice?: string;
  // Step 9/10
  revisions?: { cutNum: number; field: string; before: string; after: string }[];
  finalStatus?: string;
  // Legacy compat
  totalCuts?: number;
  styledCuts?: number;
  gifCuts?: number;
  nukkiCuts?: number;
  [key: string]: any;
}

export default function ContiPanel({ projectId, currentStep, refreshKey }: Props) {
  const [contiData, setContiData] = useState<ContiData>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "cuts">("preview");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [qcResult, setQcResult] = useState<QCResult | null>(null);
  const [qcLoading, setQcLoading] = useState(false);
  const [showQc, setShowQc] = useState(false);

  const fetchContiData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/step-data`);
      if (res.ok) {
        const allData = await res.json();
        const merged: ContiData = {};
        for (const d of allData) {
          // V2: step 6 (촬영콘티 가이드) + V1 fallback: step 8-10
          if ((d.step === 6 || (d.step >= 8 && d.step <= 10)) && d.formData) {
            Object.assign(merged, d.formData);
          }
        }
        setContiData(merged);
      }
    } catch (e) {
      console.error("콘티 데이터 로드 실패:", e);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchContiData();
  }, [fetchContiData, currentStep, refreshKey]);

  // 자동 저장 (디바운스)
  const saveContiData = useCallback((updatedData: ContiData) => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/projects/${projectId}/step-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: 8, formData: updatedData, status: "draft" }),
        });
        setSaveStatus("saved");
      } catch (e) {
        console.error("콘티 저장 실패:", e);
        setSaveStatus("unsaved");
      }
    }, 1000);
  }, [projectId]);

  // 컷 업데이트
  const handleCutUpdate = useCallback((cutIndex: number, patch: Record<string, any>) => {
    setContiData(prev => {
      const cuts = [...(prev.cutPages || [])];
      cuts[cutIndex] = { ...cuts[cutIndex], ...patch };
      const updated = { ...prev, cutPages: cuts };
      saveContiData(updated);
      return updated;
    });
  }, [saveContiData]);

  // 컷 삭제
  const handleCutDelete = useCallback((cutIndex: number) => {
    setContiData(prev => {
      const cuts = [...(prev.cutPages || [])];
      cuts.splice(cutIndex, 1);
      // 컷 넘버 재정렬
      cuts.forEach((c, i) => { c.cutNum = i + 1; });
      const updated = { ...prev, cutPages: cuts };
      saveContiData(updated);
      return updated;
    });
  }, [saveContiData]);

  // 컷 추가
  const handleCutAdd = useCallback((afterIndex?: number) => {
    setContiData(prev => {
      const cuts = [...(prev.cutPages || [])];
      const newCut = {
        cutNum: cuts.length + 1,
        conceptNum: `CONCEPT ${String(cuts.length + 1).padStart(2, "0")}`,
        type: "연출",
        background: { color: "#F5F5F5", description: "배경 색상" },
        composition: "[구도] ",
        props: [],
        moodLighting: "",
        sectionMapping: "",
        referenceNote: "",
        note: "",
      };
      if (afterIndex !== undefined) {
        cuts.splice(afterIndex + 1, 0, newCut);
      } else {
        cuts.push(newCut);
      }
      // 컷 넘버 재정렬
      cuts.forEach((c, i) => { c.cutNum = i + 1; c.conceptNum = `CONCEPT ${String(i + 1).padStart(2, "0")}`; });
      const updated = { ...prev, cutPages: cuts };
      saveContiData(updated);
      return updated;
    });
  }, [saveContiData]);

  // 컷 순서 이동
  const handleCutMove = useCallback((cutIndex: number, direction: "up" | "down") => {
    setContiData(prev => {
      const cuts = [...(prev.cutPages || [])];
      const targetIndex = direction === "up" ? cutIndex - 1 : cutIndex + 1;
      if (targetIndex < 0 || targetIndex >= cuts.length) return prev;
      [cuts[cutIndex], cuts[targetIndex]] = [cuts[targetIndex], cuts[cutIndex]];
      cuts.forEach((c, i) => { c.cutNum = i + 1; c.conceptNum = `CONCEPT ${String(i + 1).padStart(2, "0")}`; });
      const updated = { ...prev, cutPages: cuts };
      saveContiData(updated);
      return updated;
    });
  }, [saveContiData]);

  const loadDemo = async () => {
    try {
      const res = await fetch("/api/conti-demo");
      if (res.ok) {
        const demo = await res.json();
        setContiData(demo);
      }
    } catch (e) {
      console.error("데모 로드 실패:", e);
    }
  };

  const handleDownloadPPT = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/conti-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, contiData }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `[콘티]${contiData.projectTitle || "촬영콘티"}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const err = await res.json();
        alert(`PPT 생성 실패: ${err.error || "알 수 없는 오류"}`);
      }
    } catch (e: any) {
      alert(`PPT 다운로드 실패: ${e.message}`);
    }
    setDownloading(false);
  };

  // Normalize: support both new cutPages and legacy cutDetails
  const cuts = contiData.cutPages || (contiData.cutDetails || []).map(c => ({
    cutNum: c.cutNum,
    type: c.type,
    composition: c.composition,
    props: c.props ? c.props.split(",").map(s => s.trim()) : [],
    note: c.note,
    background: { description: c.concept },
    conceptNum: `CONCEPT ${String(c.cutNum).padStart(2, "0")}`,
  }));

  const totalCuts = contiData.cutList?.total || contiData.totalCuts || cuts.length;
  const hasData = totalCuts > 0 || cuts.length > 0;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-3 border-orange-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs text-gray-500">콘티 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <ContiHeader currentStep={currentStep} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-3xl">
              🎬
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">촬영콘티 미작성</h3>
            <p className="text-sm text-gray-500 mb-6">AI에게 촬영콘티를 요청하면 PPT로 다운로드할 수 있어요</p>
            <div className="space-y-3 text-left">
              {[
                { num: "1", title: "AI에게 콘티 요청", desc: '"촬영콘티 작성해줘" 라고 요청하세요' },
                { num: "2", title: "콘티 수정 및 확인", desc: "AI와 대화하며 컷별 구성을 수정하세요" },
                { num: "3", title: "PPT 다운로드", desc: '"PPT 다운로드" 버튼으로 파워포인트 파일을 받으세요' },
              ].map(s => (
                <div key={s.num} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-lg mt-0.5">{s.num}️⃣</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.title}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={loadDemo}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-sm font-medium rounded-xl hover:from-yellow-500 hover:to-orange-500 transition shadow-sm"
              >
                🍌 나노바나나 예시 콘티 보기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleQC = async () => {
    setQcLoading(true);
    setShowQc(true);
    try {
      const res = await fetch("/api/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "conti", projectId }),
      });
      if (res.ok) {
        setQcResult(await res.json());
      } else {
        const err = await res.json();
        alert(`QC 실패: ${err.error || "오류"}`);
        setShowQc(false);
      }
    } catch (e: any) {
      alert(`QC 오류: ${e.message}`);
      setShowQc(false);
    }
    setQcLoading(false);
  };

  const d = contiData;

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎬</span>
            <span className="text-sm font-semibold text-gray-800">촬영콘티</span>
            {d.finalStatus === "confirmed" && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">확정</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <QCButton onClick={handleQC} loading={qcLoading} score={qcResult?.totalScore} type="conti" />
            <button
              onClick={handleDownloadPPT}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
            >
              {downloading ? (
                <><span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />생성 중...</>
              ) : (
                <>📥 PPT 다운로드</>
              )}
            </button>
            <button onClick={fetchContiData} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100" title="새로고침">
              🔄
            </button>
          </div>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setActiveTab("preview")}
            className={`text-xs px-3 py-1 rounded-md font-medium transition ${activeTab === "preview" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
          >
            콘티 개요
          </button>
          <button
            onClick={() => setActiveTab("cuts")}
            className={`text-xs px-3 py-1 rounded-md font-medium transition ${activeTab === "cuts" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
          >
            컷 페이지 ({cuts.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "preview" ? (
          <>
            {/* PAGE 1: 표지 */}
            <PptSlide title="표지" pageNum={1}>
              <div className="text-center py-6">
                <p className="text-[10px] text-gray-400 tracking-widest mb-4">SHOOTING CONTI</p>
                <h2 className="text-lg font-black text-gray-900 mb-1">[콘티] {d.projectTitle || "프로젝트명"}</h2>
                <div className="w-12 h-0.5 bg-orange-500 mx-auto my-3" />
                {d.shootDate && <p className="text-xs text-gray-600 mb-1">📅 {d.shootDate}</p>}
                {d.location && <p className="text-xs text-gray-600 mb-1">📍 {d.location}</p>}
                {d.team && <p className="text-xs text-gray-600 mb-1">👥 {d.team}</p>}
                <p className="text-[10px] text-gray-400 mt-4">ⓒ D:opt studio</p>
              </div>
            </PptSlide>

            {/* PAGE 2: 촬영 안내 가이드 */}
            {d.shootGuide && (
              <PptSlide title="촬영 안내 가이드" pageNum={2}>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "이미지 전달 기준", value: d.shootGuide.imageStandard },
                    { label: "소품 안내", value: d.shootGuide.propNotice },
                    { label: "제품 수량", value: d.shootGuide.productQty },
                    { label: "목업 안내", value: d.shootGuide.mockupNotice },
                  ].filter(r => r.value).map((r, i) => (
                    <div key={i} className="flex gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 font-medium min-w-[80px]">{r.label}</span>
                      <span className="text-gray-800">{r.value}</span>
                    </div>
                  ))}
                </div>
              </PptSlide>
            )}

            {/* PAGE 3: INFORMATION */}
            {d.information && (
              <PptSlide title="INFORMATION" pageNum={3}>
                <div className="space-y-3 text-xs">
                  {d.information.productName && (
                    <div>
                      <span className="text-gray-500 font-semibold block mb-1">제품명</span>
                      <span className="text-gray-900 font-medium">{d.information.productName}</span>
                    </div>
                  )}
                  {d.information.lineup && d.information.lineup.length > 0 && (
                    <div>
                      <span className="text-gray-500 font-semibold block mb-1">라인업</span>
                      <div className="flex flex-wrap gap-1">
                        {d.information.lineup.map((item, i) => (
                          <span key={i} className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full text-[10px]">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {d.information.ingredients && (
                    <div>
                      <span className="text-gray-500 font-semibold block mb-1">주요 성분/원재료</span>
                      <span className="text-gray-800">{d.information.ingredients}</span>
                    </div>
                  )}
                  {d.information.features && (
                    <div>
                      <span className="text-gray-500 font-semibold block mb-1">제품 특징</span>
                      <span className="text-gray-800">{d.information.features}</span>
                    </div>
                  )}
                </div>
              </PptSlide>
            )}

            {/* PAGE 4: 소품 LIST */}
            {d.propList && d.propList.length > 0 && (
              <PptSlide title="소품 LIST" pageNum={4}>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">No.</th>
                        <th className="px-3 py-2 text-left font-semibold">소품</th>
                        <th className="px-3 py-2 text-left font-semibold w-14">수량</th>
                        <th className="px-3 py-2 text-left font-semibold">비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {d.propList.map((p, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-800 font-medium">{p.item}</td>
                          <td className="px-3 py-2 text-gray-800">{p.qty}</td>
                          <td className="px-3 py-2 text-gray-600">{p.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PptSlide>
            )}

            {/* PAGE 5: CUT LIST */}
            <PptSlide title="CUT LIST" pageNum={5}>
              <div className="mb-3 flex flex-wrap gap-2">
                <CutBadge label="TOTAL" count={totalCuts} color="gray" />
                <CutBadge label="연출" count={d.cutList?.styled || d.styledCuts || 0} color="blue" />
                <CutBadge label="GIF" count={d.cutList?.gif || d.gifCuts || 0} color="purple" />
                <CutBadge label="누끼" count={d.cutList?.nukki || d.nukkiCuts || 0} color="green" />
                {(d.cutList?.ai || 0) > 0 && <CutBadge label="AI" count={d.cutList!.ai!} color="orange" />}
              </div>
              {d.cutList?.rows && d.cutList.rows.length > 0 ? (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold w-10">No.</th>
                        <th className="px-2 py-1.5 text-left font-semibold w-14">구분</th>
                        <th className="px-2 py-1.5 text-left font-semibold">컷 상세</th>
                        <th className="px-2 py-1.5 text-center font-semibold w-10">수량</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {d.cutList.rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-2 py-1.5 text-gray-500">{r.no}</td>
                          <td className="px-2 py-1.5">
                            <CutTypeBadge type={r.type} />
                          </td>
                          <td className="px-2 py-1.5 text-gray-800">{r.detail}</td>
                          <td className="px-2 py-1.5 text-center text-gray-800">{r.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">컷 리스트 미작성</p>
              )}
            </PptSlide>

            {/* PAGE 6: CONCEPT SUMMARY */}
            {d.conceptSummary && (
              <PptSlide title="CONCEPT SUMMARY" pageNum={6}>
                <div className="space-y-3">
                  {/* Concept description */}
                  {(d.conceptSummary.concept || d.conceptSummary.mood) && (
                    <div className="text-xs text-gray-800 leading-relaxed bg-gray-50 p-3 rounded-lg">
                      {d.conceptSummary.concept || d.conceptSummary.mood}
                    </div>
                  )}
                  {/* Keywords */}
                  {d.conceptSummary.keywords && d.conceptSummary.keywords.length > 0 && (
                    <div>
                      <span className="text-[10px] text-gray-500 font-semibold block mb-1">KEYWORD</span>
                      <div className="flex flex-wrap gap-1">
                        {d.conceptSummary.keywords.map((kw, i) => (
                          <span key={i} className="bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded-full">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Color palette */}
                  {d.conceptSummary.colors && d.conceptSummary.colors.length > 0 ? (
                    <div>
                      <span className="text-[10px] text-gray-500 font-semibold block mb-1">COLOR</span>
                      <div className="flex gap-2">
                        {d.conceptSummary.colors.map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-md border border-gray-200" style={{ backgroundColor: c.hex }} />
                            <div>
                              <p className="text-[10px] text-gray-500">{c.name}</p>
                              <p className="text-[10px] font-mono text-gray-700">{c.hex}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : d.conceptSummary.keyColor && (
                    <div className="text-xs">
                      <span className="text-gray-500">키 컬러: </span>
                      <span className="text-gray-800">{d.conceptSummary.keyColor}</span>
                    </div>
                  )}
                  {/* Legacy fields */}
                  {d.conceptSummary.background && !d.conceptSummary.concept && (
                    <div className="text-xs">
                      <span className="text-gray-500">배경: </span>
                      <span className="text-gray-800">{d.conceptSummary.background}</span>
                    </div>
                  )}
                  {d.conceptSummary.lighting && (
                    <div className="text-xs">
                      <span className="text-gray-500">라이팅: </span>
                      <span className="text-gray-800">{d.conceptSummary.lighting}</span>
                    </div>
                  )}
                </div>
              </PptSlide>
            )}

            {/* 촬영 주의사항 */}
            {d.shootNotice && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-red-800 mb-2">⚠️ 촬영 주의사항</h4>
                <p className="text-xs text-red-700 whitespace-pre-wrap">{d.shootNotice}</p>
              </div>
            )}

            {/* 누끼 가이드 */}
            {d.nukkiGuide && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-green-800 mb-2">📐 누끼 가이드</h4>
                <p className="text-xs text-green-700 whitespace-pre-wrap">{d.nukkiGuide}</p>
              </div>
            )}
          </>
        ) : (
          /* CUT PAGES TAB */
          <div className="space-y-4">
            {/* 컷 추가 버튼 (상단) */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{cuts.length}개 컷</span>
              <div className="flex items-center gap-2">
                {saveStatus !== "saved" && (
                  <span className={`text-[10px] px-2 py-0.5 rounded ${saveStatus === "saving" ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}`}>
                    {saveStatus === "saving" ? "저장 중..." : "미저장"}
                  </span>
                )}
                <button
                  onClick={() => handleCutAdd()}
                  className="text-[11px] px-3 py-1.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition active:scale-95"
                >
                  + 컷 추가
                </button>
              </div>
            </div>
            {cuts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400 mb-3">개별 컷 페이지 없음</p>
                <button
                  onClick={() => handleCutAdd()}
                  className="text-xs px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  첫 번째 컷 추가
                </button>
              </div>
            ) : (
              cuts.map((cut, i) => (
                <React.Fragment key={`cut-${cut.cutNum}-${i}`}>
                  <CutPage
                    cut={cut}
                    index={i}
                    projectId={projectId}
                    totalCuts={cuts.length}
                    onUpdate={(patch) => handleCutUpdate(i, patch)}
                    onDelete={() => handleCutDelete(i)}
                    onAddAfter={() => handleCutAdd(i)}
                    onMove={(dir) => handleCutMove(i, dir)}
                  />
                  {/* 컷 사이 추가 버튼 */}
                  <div className="flex items-center justify-center py-1 group">
                    <button
                      onClick={() => handleCutAdd(i)}
                      className="flex items-center gap-1 text-[10px] text-gray-300 hover:text-blue-500 transition-all group-hover:text-gray-400"
                    >
                      <span className="w-8 h-px bg-gray-200 group-hover:bg-blue-300 transition" />
                      <span className="whitespace-nowrap">+ 이 아래에 컷 추가</span>
                      <span className="w-8 h-px bg-gray-200 group-hover:bg-blue-300 transition" />
                    </button>
                  </div>
                </React.Fragment>
              ))
            )}
          </div>
        )}
      </div>

      {/* QC 리포트 오버레이 */}
      {showQc && (
        <div className="absolute inset-0 bg-gray-50 z-20 overflow-y-auto">
          <QCReport
            result={qcResult!}
            type="conti"
            loading={qcLoading}
            onClose={() => setShowQc(false)}
          />
        </div>
      )}
    </div>
  );
}

/* ============ Sub-components ============ */

function ContiHeader({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm">🎬</span>
        <span className="text-sm font-semibold text-gray-800">촬영콘티 PPT</span>
        <span className="text-xs text-gray-400">STEP {currentStep}</span>
      </div>
    </div>
  );
}

function PptSlide({ title, pageNum, children }: { title: string; pageNum: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-bold">{title}</span>
        <span className="text-[10px] text-gray-400">PAGE {pageNum}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CutBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: "bg-gray-800 text-white",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colorMap[color] || colorMap.gray}`}>
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
    : t.includes("누끼") || t.includes("nukki")
    ? "bg-green-100 text-green-700"
    : t.includes("ai")
    ? "bg-orange-100 text-orange-700"
    : "bg-gray-100 text-gray-700";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${cls} font-medium`}>{type}</span>;
}

function CutPage({ cut, index, projectId, totalCuts, onUpdate, onDelete, onAddAfter, onMove }: {
  cut: any; index: number; projectId: number; totalCuts: number;
  onUpdate: (patch: Record<string, any>) => void;
  onDelete: () => void;
  onAddAfter: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const bgColor = cut.background?.color || "#f5f5f5";
  const bgDesc = cut.background?.description || "";
  const imageKey = `cut-${cut.cutNum || index + 1}`;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<"none" | "generated" | "confirmed">("none");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [feedbackHistory, setFeedbackHistory] = useState<{ feedback: string; timestamp: string }[]>([]);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  // 저장된 이미지 로드
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/images?key=${imageKey}`)
      .then(r => r.json())
      .then(data => {
        if (data.image) {
          setGeneratedImage(data.image.imageData);
          setCurrentPrompt(data.image.prompt || "");
          setImageStatus(data.image.status === "confirmed" ? "confirmed" : "generated");
          setFeedbackHistory(data.image.feedbackHistory || []);
        }
      })
      .catch(() => {});
  }, [projectId, imageKey]);

  // 이미지 생성 (최초 또는 다시 생성)
  const handleGenerateImage = async () => {
    if (!cut.imagePrompt?.subject) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/nano-banana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePrompt: cut.imagePrompt, cutNum: cut.cutNum || index + 1 }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setCurrentPrompt(data.prompt || "");
        setImageStatus("generated");
        // 서버에 저장
        await fetch(`/api/projects/${projectId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageKey, imageData: data.imageUrl, prompt: data.prompt || "", feedbackHistory: [], status: "generated" }),
        });
      } else {
        setGenError(data.error || "이미지 생성 실패");
      }
    } catch (e: any) {
      setGenError(e.message || "네트워크 오류");
    } finally {
      setGenerating(false);
    }
  };

  // 피드백 반영 재생성
  const handleRevision = async () => {
    if (!feedbackInput.trim() || !currentPrompt) return;
    setGenerating(true);
    setGenError(null);
    const newFeedback = { feedback: feedbackInput.trim(), timestamp: new Date().toISOString() };
    try {
      const res = await fetch("/api/nano-banana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedbackInput.trim(), previousPrompt: currentPrompt, cutNum: cut.cutNum || index + 1 }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        const updatedHistory = [...feedbackHistory, newFeedback];
        setGeneratedImage(data.imageUrl);
        setCurrentPrompt(data.prompt || "");
        setImageStatus("generated");
        setFeedbackHistory(updatedHistory);
        setFeedbackInput("");
        setShowFeedback(false);
        // 서버에 저장
        await fetch(`/api/projects/${projectId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageKey, imageData: data.imageUrl, prompt: data.prompt || "", feedbackHistory: updatedHistory, status: "generated" }),
        });
      } else {
        setGenError(data.error || "재생성 실패");
      }
    } catch (e: any) {
      setGenError(e.message || "네트워크 오류");
    } finally {
      setGenerating(false);
    }
  };

  // 컨펌
  const handleConfirm = async () => {
    setImageStatus("confirmed");
    await fetch(`/api/projects/${projectId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", imageKey }),
    });
  };

  // 컨펌 해제
  const handleUnconfirm = async () => {
    setImageStatus("generated");
    await fetch(`/api/projects/${projectId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageKey, imageData: generatedImage, prompt: currentPrompt, feedbackHistory, status: "generated" }),
    });
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${imageStatus === "confirmed" ? "border-green-300 ring-1 ring-green-200" : "border-gray-200"}`}>
      {/* Cut header */}
      <div className="bg-gray-900 text-white px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">{cut.conceptNum || `CUT ${cut.cutNum || index + 1}`}</span>
          {editing ? (
            <select
              value={cut.type || "연출"}
              onChange={(e) => onUpdate({ type: e.target.value })}
              className="text-[10px] bg-gray-800 text-white rounded px-1.5 py-0.5 border border-gray-600"
            >
              {["연출", "얼터", "GIF", "AI연출", "AI영상", "누끼", "디테일"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            cut.type && <CutTypeBadge type={cut.type} />
          )}
        </div>
        <div className="flex items-center gap-1">
          {imageStatus === "confirmed" && (
            <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-medium mr-1">CONFIRMED</span>
          )}
          {cut.sectionMapping && !editing && (
            <span className="text-[10px] text-orange-300 mr-1">→ {cut.sectionMapping}</span>
          )}
          {/* 순서 이동 */}
          <button onClick={() => onMove("up")} disabled={index === 0} className="text-gray-400 hover:text-white disabled:opacity-30 p-0.5" title="위로">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
          </button>
          <button onClick={() => onMove("down")} disabled={index === totalCuts - 1} className="text-gray-400 hover:text-white disabled:opacity-30 p-0.5" title="아래로">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {/* 편집 토글 */}
          <button
            onClick={() => setEditing(!editing)}
            className={`text-[10px] px-1.5 py-0.5 rounded ${editing ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}
          >
            {editing ? "완료" : "편집"}
          </button>
          {/* 삭제 */}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">삭제</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-gray-400 hover:text-white">취소</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-gray-500 hover:text-red-400 p-0.5" title="삭제">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {editing ? (
          /* ===== 편집 모드 ===== */
          <div className="space-y-3">
            {/* 섹션 매핑 */}
            <div>
              <label className="text-[10px] text-gray-500 font-semibold">섹션 매핑</label>
              <input
                type="text"
                value={cut.sectionMapping || ""}
                onChange={(e) => onUpdate({ sectionMapping: e.target.value })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="히어로 섹션 / 성분 섹션 등"
              />
            </div>
            {/* 배경 */}
            <div className="flex gap-2">
              <div className="w-20">
                <label className="text-[10px] text-gray-500 font-semibold">배경색</label>
                <input
                  type="color"
                  value={cut.background?.color || "#F5F5F5"}
                  onChange={(e) => onUpdate({ background: { ...cut.background, color: e.target.value } })}
                  className="w-full h-8 rounded border border-gray-200 mt-0.5 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 font-semibold">배경 설명</label>
                <input
                  type="text"
                  value={cut.background?.description || ""}
                  onChange={(e) => onUpdate({ background: { ...cut.background, description: e.target.value } })}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
            {/* 구도 */}
            <div>
              <label className="text-[10px] text-gray-500 font-semibold">구도 / COMPOSITION</label>
              <textarea
                value={cut.composition || ""}
                onChange={(e) => onUpdate({ composition: e.target.value })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="[구도]45도, 가로이미지&#10;메인 제품을 중앙에 배치..."
              />
            </div>
            {/* 소품 */}
            <div>
              <label className="text-[10px] text-gray-500 font-semibold">소품 (쉼표로 구분)</label>
              <input
                type="text"
                value={(cut.props || []).join(", ")}
                onChange={(e) => onUpdate({ props: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="소품1, 소품2, 소품3"
              />
            </div>
            {/* 무드/라이팅 */}
            <div>
              <label className="text-[10px] text-gray-500 font-semibold">무드 / 라이팅</label>
              <input
                type="text"
                value={cut.moodLighting || ""}
                onChange={(e) => onUpdate({ moodLighting: e.target.value })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="자연광 + 소프트박스, 화사한 톤"
              />
            </div>
            {/* 레퍼런스 노트 */}
            <div>
              <label className="text-[10px] text-gray-500 font-semibold">레퍼런스 참고</label>
              <input
                type="text"
                value={cut.referenceNote || ""}
                onChange={(e) => onUpdate({ referenceNote: e.target.value })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            {/* 참고사항 */}
            <div>
              <label className="text-[10px] text-gray-500 font-semibold">참고사항</label>
              <input
                type="text"
                value={cut.note || ""}
                onChange={(e) => onUpdate({ note: e.target.value })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        ) : (
          /* ===== 보기 모드 ===== */
          <>
            {/* Background color preview + composition */}
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-lg border border-gray-200 flex items-center justify-center"
                  style={{ backgroundColor: bgColor }}
                >
                  <span className="text-[8px] font-mono text-gray-600 bg-white/80 px-1 rounded">{bgColor !== "#f5f5f5" ? bgColor : ""}</span>
                </div>
                {bgDesc && <p className="text-[10px] text-gray-500 mt-1 text-center max-w-[64px] break-words">{bgDesc}</p>}
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-[10px] text-gray-500 font-semibold mb-1">구도 / COMPOSITION</p>
                <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">{cut.composition || "구도 미지정"}</p>
              </div>
            </div>

            {/* Props */}
            {cut.props && cut.props.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 font-semibold mb-1">소품 / PROPS</p>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(cut.props) ? cut.props : [cut.props]).map((p: string, j: number) => (
                    <span key={j} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Mood / Lighting */}
            {cut.moodLighting && (
              <div>
                <p className="text-[10px] text-gray-500 font-semibold mb-1">무드 / 라이팅</p>
                <p className="text-xs text-gray-700">{cut.moodLighting}</p>
              </div>
            )}

            {/* Reference note */}
            {cut.referenceNote && (
              <div className="bg-orange-50 rounded-lg p-2 border border-orange-100">
                <p className="text-[10px] text-orange-600 font-semibold mb-0.5">레퍼런스 참고</p>
                <p className="text-xs text-orange-800">{cut.referenceNote}</p>
              </div>
            )}

            {/* Note */}
            {cut.note && (
              <div className="text-xs text-gray-500 italic border-t border-gray-100 pt-2">
                {cut.note}
              </div>
            )}
          </>
        )}

        {/* Nano Banana AI Image Generation */}
        {cut.imagePrompt?.subject && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-yellow-600 font-semibold">AI REFERENCE IMAGE</p>
              {!generatedImage && (
                <button
                  onClick={handleGenerateImage}
                  disabled={generating}
                  className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${
                    generating ? "bg-yellow-100 text-yellow-500 cursor-wait" : "bg-yellow-400 text-yellow-900 hover:bg-yellow-500 active:scale-95"
                  }`}
                >
                  {generating ? (
                    <span className="flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      생성 중...
                    </span>
                  ) : "이미지 생성"}
                </button>
              )}
            </div>

            {/* Prompt Details */}
            <details className="group">
              <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                프롬프트 상세 보기
              </summary>
              <div className="mt-1.5 bg-gray-50 rounded-lg p-2 text-[10px] text-gray-600 space-y-1 border border-gray-100">
                <p><span className="font-semibold text-gray-700">Subject:</span> {cut.imagePrompt.subject}</p>
                {cut.imagePrompt.scene && <p><span className="font-semibold text-gray-700">Scene:</span> {cut.imagePrompt.scene}</p>}
                {cut.imagePrompt.camera && (
                  <p><span className="font-semibold text-gray-700">Camera:</span> {[cut.imagePrompt.camera.angle, cut.imagePrompt.camera.lens, cut.imagePrompt.camera.dof].filter(Boolean).join(", ")}</p>
                )}
                {cut.imagePrompt.lighting && <p><span className="font-semibold text-gray-700">Lighting:</span> {cut.imagePrompt.lighting}</p>}
                {cut.imagePrompt.mood && <p><span className="font-semibold text-gray-700">Mood:</span> {cut.imagePrompt.mood}</p>}
                {cut.imagePrompt.style && <p><span className="font-semibold text-gray-700">Style:</span> {cut.imagePrompt.style}</p>}
                {cut.imagePrompt.colorPalette?.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-semibold text-gray-700">Colors:</span>
                    {cut.imagePrompt.colorPalette.map((c: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-0.5">
                        <span className="w-3 h-3 rounded-sm border border-gray-300 inline-block" style={{ backgroundColor: c }} />
                        <span className="font-mono">{c}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </details>

            {/* Generated Image */}
            {generatedImage && (
              <div className={`rounded-lg overflow-hidden border ${imageStatus === "confirmed" ? "border-green-300" : "border-yellow-200"}`}>
                <img
                  src={generatedImage}
                  alt={`Cut ${cut.cutNum || index + 1} AI Reference`}
                  className="w-full h-auto"
                />

                {/* Action Buttons */}
                <div className="px-3 py-2 bg-gray-50 space-y-2">
                  {imageStatus === "confirmed" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                        컨펌 완료
                      </span>
                      <button
                        onClick={handleUnconfirm}
                        className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                      >
                        컨펌 해제
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirm}
                          className="flex-1 text-[11px] px-3 py-1.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition active:scale-95"
                        >
                          컨펌
                        </button>
                        <button
                          onClick={() => setShowFeedback(!showFeedback)}
                          className="flex-1 text-[11px] px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition active:scale-95"
                        >
                          수정 요청
                        </button>
                        <button
                          onClick={handleGenerateImage}
                          disabled={generating}
                          className="text-[11px] px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50"
                        >
                          {generating ? "..." : "새로 생성"}
                        </button>
                      </div>

                      {/* Feedback Input */}
                      {showFeedback && (
                        <div className="space-y-2">
                          <textarea
                            value={feedbackInput}
                            onChange={(e) => setFeedbackInput(e.target.value)}
                            placeholder="수정사항을 입력하세요 (예: 배경을 좀 더 밝게, 제품 각도를 45도로 변경, 조명을 더 따뜻하게...)"
                            className="w-full text-xs border border-blue-200 rounded-lg p-2 h-16 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                          />
                          <button
                            onClick={handleRevision}
                            disabled={generating || !feedbackInput.trim()}
                            className={`w-full text-[11px] px-3 py-2 rounded-lg font-medium transition ${
                              generating || !feedbackInput.trim()
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98]"
                            }`}
                          >
                            {generating ? (
                              <span className="flex items-center justify-center gap-1">
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                수정사항 반영 중...
                              </span>
                            ) : "수정사항 반영하여 재생성"}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Feedback History */}
                  {feedbackHistory.length > 0 && (
                    <details className="group">
                      <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                        수정 이력 ({feedbackHistory.length}회)
                      </summary>
                      <div className="mt-1 space-y-1">
                        {feedbackHistory.map((fb, i) => (
                          <div key={i} className="text-[10px] bg-blue-50 rounded px-2 py-1 border border-blue-100">
                            <span className="text-blue-400 font-mono">{i + 1}차</span>{" "}
                            <span className="text-blue-700">{fb.feedback}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {genError && (
              <div className="bg-red-50 text-red-600 text-[10px] px-2 py-1.5 rounded-lg border border-red-100">
                {genError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
