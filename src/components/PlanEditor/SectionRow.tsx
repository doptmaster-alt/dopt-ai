"use client";

import React, { useState } from "react";
import type { SectionData, CopyBlock, WireframeBlock } from "./types";
import CopyBlockRenderer from "./CopyBlockRenderer";
import WireframeBlockRenderer from "./WireframeBlockRenderer";

interface Props {
  section: SectionData;
  index: number;
  hasAnyReference: boolean;
  brandName: string;
  onUpdate?: (index: number, patch: Partial<SectionData>) => void;
  onOpenPatternSelector?: (sectionNum: number, sectionName: string) => void;
}

// 섹션 데이터에 copyBlocks가 없을 때 기본 블록 생성
function fallbackCopyBlocks(sec: SectionData): CopyBlock[] {
  const blocks: CopyBlock[] = [];
  blocks.push({ type: "section-title", text: `섹션 타이틀 (16pt Bold)` });
  if (sec.mainCopy) blocks.push({ type: "copy-main", text: sec.mainCopy });
  if (sec.subCopy) blocks.push({ type: "copy-sub", text: sec.subCopy });
  if (sec.visualDirection) blocks.push({ type: "visual-direction", text: `비주얼: ${sec.visualDirection}` });
  if (sec.layout) blocks.push({ type: "layout-tag", text: `레이아웃: ${sec.layout}` });
  if (sec.aeCommentary) blocks.push({ type: "ae-comment", text: sec.aeCommentary });
  return blocks;
}

function fallbackWfBlocks(sec: SectionData): WireframeBlock[] {
  return [
    { type: "wf-heading", text: sec.mainCopy || sec.name || "섹션", bold: true, align: "center" },
    { type: "wf-text", text: sec.subCopy || "설명 텍스트", align: "center" },
    { type: "wf-image", text: "[이미지 영역]", height: 80 },
  ];
}

const SectionRow = React.memo(function SectionRow({ section, index, hasAnyReference, brandName, onUpdate, onOpenPatternSelector }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const copyBlocks = section.copyBlocks?.length ? section.copyBlocks : fallbackCopyBlocks(section);
  const wfBlocks = section.wireframeBlocks?.length ? section.wireframeBlocks : fallbackWfBlocks(section);

  const handleCopyEdit = (blockIdx: number, field: string, value: string) => {
    if (!onUpdate) return;
    const updated = [...(section.copyBlocks || fallbackCopyBlocks(section))];
    updated[blockIdx] = { ...updated[blockIdx], [field]: value };
    onUpdate(index, { copyBlocks: updated });
  };

  return (
    <div className="border-b" style={{ borderColor: "#CCCCCC" }}>
      {/* Section header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none hover:bg-gray-50"
        style={{ backgroundColor: "#F5F5F5" }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-[10px] text-gray-400">{collapsed ? "▶" : "▼"}</span>
        <span className="text-xs font-bold" style={{ color: "#CC0000" }}>
          섹션 {section.num || index + 1}
        </span>
        <span className="text-xs text-gray-600 truncate">{section.name || ""}</span>
        {onOpenPatternSelector && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPatternSelector(section.num || index + 1, section.name || `섹션 ${index + 1}`);
            }}
            className="ml-auto mr-1 px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition font-medium shrink-0"
            title="디자인 패턴 선택"
          >
            🎨 패턴
          </button>
        )}
      </div>

      {!collapsed && (
        <div className={`flex ${hasAnyReference ? "" : ""}`} style={{ minHeight: 120 }}>
          {/* COL 1: 문구 */}
          <div
            className="p-3 space-y-1.5 border-r overflow-hidden"
            style={{ width: hasAnyReference ? "28%" : "40%", borderColor: "#CCCCCC" }}
          >
            {copyBlocks.map((block, i) => (
              <CopyBlockRenderer key={i} block={block} index={i} onEdit={handleCopyEdit} />
            ))}
          </div>

          {/* COL 2: 와이어프레임 */}
          <div
            className="p-2 flex justify-center border-r overflow-hidden"
            style={{
              width: hasAnyReference ? "42%" : "60%",
              borderColor: "#CCCCCC",
              backgroundColor: "#FAFAFA",
            }}
          >
            {/* Mobile phone frame */}
            <div
              className="rounded-lg border overflow-hidden w-full max-w-[280px]"
              style={{ backgroundColor: "#FFFFFF", borderColor: "#E0E0E0" }}
            >
              {/* Status bar */}
              <div className="flex justify-between items-center px-2 py-0.5" style={{ backgroundColor: "#D0D0D0" }}>
                <span className="text-[6px]" style={{ color: "#999" }}>9:41</span>
                <span className="text-[6px]" style={{ color: "#999" }}>재비표우의 {brandName}</span>
                <span className="text-[6px]" style={{ color: "#999" }}>&#128267;</span>
              </div>
              <div className="p-3 space-y-2">
                {wfBlocks.map((block, i) => (
                  <WireframeBlockRenderer key={i} block={block} brandName={brandName} />
                ))}
              </div>
            </div>
          </div>

          {/* COL 3: 레퍼런스 (있을 때만) */}
          {hasAnyReference && (
            <div
              className="p-2 flex flex-col items-center overflow-hidden"
              style={{ width: "30%" }}
            >
              {section.referenceImageUrl ? (
                <>
                  <div className="text-[10px] font-bold text-gray-400 mb-1 text-center">레퍼런스</div>
                  <img
                    src={section.referenceImageUrl}
                    alt={`섹션 ${section.num || index + 1} 레퍼런스`}
                    className="rounded border border-gray-200 w-full object-contain"
                    style={{ maxHeight: 300 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {section.referenceNote && (
                    <div className="text-[9px] text-gray-400 mt-1 text-center leading-tight">
                      {section.referenceNote}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center w-full rounded" style={{ backgroundColor: "#F5F5F5" }}>
                  <span className="text-xs text-gray-300">&mdash;</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default SectionRow;
