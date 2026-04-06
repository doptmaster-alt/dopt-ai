"use client";

import React from "react";
import type { WireframeBlock } from "./types";

// Wireframe palette
const WF = {
  gray: "#D9D9D9",
  dark: "#B0B0B0",
  light: "#EEEEEE",
  text: "#999999",
  accent: "#C0C0C0",
  bar: "#D0D0D0",
  bg: "#FAFAFA",
};

interface Props {
  block: WireframeBlock;
  brandName?: string;
}

function WfBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded ${className}`}>{children}</div>;
}

export default function WireframeBlockRenderer({ block, brandName }: Props) {
  switch (block.type) {
    case "wf-heading":
      return (
        <div
          className={`text-xs font-bold ${block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : ""}`}
          style={{ color: WF.text }}
        >
          {block.text || ""}
        </div>
      );

    case "wf-text":
      return (
        <div className={`text-[10px] leading-snug ${block.align === "center" ? "text-center" : ""}`} style={{ color: block.color || WF.text }}>
          {block.text || ""}
        </div>
      );

    case "wf-image":
      return (
        <div
          className="rounded flex flex-col items-center justify-center text-center"
          style={{ backgroundColor: WF.gray, height: block.height || 80, minHeight: 40 }}
        >
          <div className="text-[10px]" style={{ color: WF.text }}>{block.text || "[이미지]"}</div>
          {block.desc && <div className="text-[8px] mt-0.5" style={{ color: WF.dark }}>{block.desc}</div>}
        </div>
      );

    case "wf-button":
      return (
        <div className="flex justify-center">
          <div
            className="rounded-full px-4 py-1.5 text-[10px] font-bold text-center"
            style={{ backgroundColor: block.color || WF.dark, color: "#FFFFFF", minWidth: 100 }}
          >
            {block.text || "버튼"}
          </div>
        </div>
      );

    case "wf-card-grid": {
      const cols = block.cols || 2;
      return (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {(block.items || []).map((item, i) => (
            <div key={i} className="rounded p-1.5 flex flex-col items-center text-center" style={{ backgroundColor: WF.light }}>
              <div className="rounded mb-1" style={{ width: 28, height: 28, backgroundColor: WF.gray }} />
              <div className="text-[9px] font-bold" style={{ color: WF.text }}>{item.label}</div>
              {item.desc && <div className="text-[7px]" style={{ color: WF.dark }}>{item.desc}</div>}
            </div>
          ))}
        </div>
      );
    }

    case "wf-table":
      return (
        <div className="border rounded overflow-hidden text-[8px]" style={{ borderColor: WF.accent }}>
          {block.headers && (
            <div className="flex" style={{ backgroundColor: WF.dark }}>
              {block.headers.map((h, i) => (
                <div key={i} className="flex-1 px-1.5 py-1 font-bold text-white">{h}</div>
              ))}
            </div>
          )}
          {(block.rows || []).map((row, ri) => (
            <div key={ri} className="flex border-t" style={{ borderColor: WF.accent }}>
              {row.cells.map((cell, ci) => (
                <div key={ci} className="flex-1 px-1.5 py-1" style={{ color: WF.text }}>{cell}</div>
              ))}
            </div>
          ))}
        </div>
      );

    case "wf-bar-chart":
      return (
        <div className="space-y-1">
          {block.text && <div className="text-[9px] font-bold" style={{ color: WF.text }}>{block.text}</div>}
          {(block.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="text-[8px] w-12 shrink-0 text-right" style={{ color: WF.text }}>{item.label}</div>
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, backgroundColor: WF.light }}>
                <div className="h-full rounded-full" style={{ width: `${item.percent || 50}%`, backgroundColor: WF.dark }} />
              </div>
              {item.percent !== undefined && <div className="text-[7px] w-6" style={{ color: WF.text }}>{item.percent}%</div>}
            </div>
          ))}
        </div>
      );

    case "wf-icon-list": {
      if (block.items?.length) {
        return (
          <div className="space-y-1.5">
            {block.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="rounded-full flex items-center justify-center shrink-0 text-[7px] text-white font-bold"
                  style={{ width: 18, height: 18, backgroundColor: WF.dark }}>{i + 1}</div>
                <div>
                  <div className="text-[9px] font-bold" style={{ color: WF.text }}>{item.label}</div>
                  {item.desc && <div className="text-[7px]" style={{ color: WF.dark }}>{item.desc}</div>}
                </div>
              </div>
            ))}
          </div>
        );
      }
      // text fallback: 줄바꿈/| 구분
      const iconItems = block.text ? block.text.split(/\n|\|/).map((s: string) => s.trim()).filter(Boolean) : [];
      return (
        <div className="space-y-1.5">
          {iconItems.map((label: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <div className="rounded-full flex items-center justify-center shrink-0 text-[7px] text-white font-bold"
                style={{ width: 18, height: 18, backgroundColor: WF.dark }}>{i + 1}</div>
              <div className="text-[9px] font-bold" style={{ color: WF.text }}>{label}</div>
            </div>
          ))}
        </div>
      );
    }

    case "wf-split":
      return (
        <div className="flex gap-2">
          <div className="flex-1 text-[9px] space-y-0.5" style={{ color: WF.text }}>
            <div className="font-bold">{block.text || ""}</div>
            {block.desc && <div className="text-[8px]">{block.desc}</div>}
          </div>
          <div className="rounded flex items-center justify-center" style={{ width: 80, height: 60, backgroundColor: WF.gray }}>
            <span className="text-[7px]" style={{ color: WF.text }}>{block.label || "[이미지]"}</span>
          </div>
        </div>
      );

    case "wf-badge-row":
      return (
        <div className="flex flex-wrap gap-1 justify-center">
          {(block.items || []).map((item, i) => (
            <div key={i} className="rounded-full px-2 py-0.5 text-[7px]" style={{ backgroundColor: WF.light, color: WF.text }}>
              {item.label}
            </div>
          ))}
        </div>
      );

    case "wf-stats": {
      // items 배열 또는 text fallback
      if (block.items?.length) {
        return (
          <div className="grid grid-cols-2 gap-1">
            {block.items.map((item, i) => (
              <div key={i} className="rounded p-1.5 text-center" style={{ backgroundColor: WF.light }}>
                <div className="text-sm font-bold" style={{ color: WF.dark }}>{item.value || "0"}</div>
                <div className="text-[7px]" style={{ color: WF.text }}>{item.label}</div>
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="rounded p-2 text-center" style={{ backgroundColor: WF.light }}>
          <div className="text-[9px] font-bold" style={{ color: WF.dark }}>{block.text || "통계"}</div>
        </div>
      );
    }

    case "wf-review-card":
      return (
        <div className="space-y-1">
          {(block.items || []).map((item, i) => (
            <div key={i} className="rounded p-1.5" style={{ backgroundColor: WF.light }}>
              <div className="text-[8px]" style={{ color: WF.text }}>{item.label}</div>
              {item.desc && <div className="text-[7px] mt-0.5" style={{ color: WF.dark }}>- {item.desc}</div>}
              {item.value && <div className="text-[6px] mt-0.5" style={{ color: WF.accent }}>{item.value}</div>}
            </div>
          ))}
        </div>
      );

    case "wf-product-grid": {
      const cols = block.cols || 3;
      return (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {(block.items || []).map((item, i) => (
            <div key={i} className="rounded p-1 text-center" style={{ backgroundColor: WF.light }}>
              <div className="rounded mx-auto mb-1" style={{ width: 30, height: 30, backgroundColor: WF.gray }} />
              <div className="text-[7px] font-bold" style={{ color: WF.text }}>{item.label}</div>
              {item.desc && <div className="text-[6px]" style={{ color: WF.dark }}>{item.desc}</div>}
              {item.value && <div className="text-[7px] font-bold" style={{ color: WF.dark }}>{item.value}</div>}
            </div>
          ))}
        </div>
      );
    }

    case "wf-timeline":
      return (
        <div className="space-y-1 pl-3 border-l-2" style={{ borderColor: WF.dark }}>
          {(block.items || []).map((item, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[17px] top-0.5 rounded-full" style={{ width: 8, height: 8, backgroundColor: WF.dark }} />
              <div className="text-[8px] font-bold" style={{ color: WF.text }}>{item.label}</div>
              {item.desc && <div className="text-[7px]" style={{ color: WF.dark }}>{item.desc}</div>}
            </div>
          ))}
        </div>
      );

    case "wf-progress-bar":
      return (
        <div className="space-y-1">
          {(block.items || []).map((item, i) => (
            <div key={i}>
              <div className="flex justify-between text-[8px] mb-0.5" style={{ color: WF.text }}>
                <span>{item.label}</span>
                <span>{item.percent || 0}%</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: WF.light }}>
                <div className="h-full rounded-full" style={{ width: `${item.percent || 0}%`, backgroundColor: WF.dark }} />
              </div>
            </div>
          ))}
        </div>
      );

    case "wf-logo":
      return (
        <div className={`text-xs font-bold ${block.align === "center" ? "text-center" : ""}`} style={{ color: WF.dark }}>
          {block.text || brandName || "BRAND"}
        </div>
      );

    case "wf-promo-badge":
      return (
        <div className="rounded px-2 py-1 text-[9px] font-bold text-center" style={{ backgroundColor: "#FBBF24", color: "#92400E" }}>
          {block.text || ""}
        </div>
      );

    case "wf-price":
      return (
        <div className="text-center">
          {block.label && <div className="text-[8px] line-through" style={{ color: WF.accent }}>{block.label}</div>}
          <div className="text-sm font-bold" style={{ color: WF.dark }}>{block.text || ""}</div>
        </div>
      );

    case "wf-trust-badges":
      return (
        <div className="flex justify-center gap-2">
          {(block.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-0.5 text-[7px]" style={{ color: WF.text }}>
              <span>&#10003;</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      );

    case "wf-source":
      return <div className="text-[7px] italic" style={{ color: WF.accent }}>* {block.text || ""}</div>;

    case "wf-divider":
      return <hr className="my-1" style={{ borderColor: block.color || WF.accent }} />;

    case "wf-spacer":
      return <div style={{ height: block.height || 8 }} />;

    case "wf-tabs":
      return (
        <div className="flex border-b" style={{ borderColor: WF.accent }}>
          {(block.tabs || []).map((tab, i) => (
            <div key={i} className={`flex-1 text-center text-[8px] py-1 ${i === 0 ? "font-bold" : ""}`}
              style={{ color: WF.text, borderBottom: i === 0 ? `2px solid ${WF.dark}` : "none" }}>{tab}</div>
          ))}
        </div>
      );

    case "wf-accordion":
      return (
        <div className="space-y-0.5">
          {(block.items || []).map((item, i) => (
            <div key={i} className="rounded" style={{ backgroundColor: WF.light }}>
              <div className="flex justify-between items-center px-2 py-1">
                <span className="text-[8px] font-bold" style={{ color: WF.text }}>{item.label}</span>
                <span className="text-[8px]" style={{ color: WF.accent }}>&#9660;</span>
              </div>
              {i === 0 && item.desc && (
                <div className="px-2 pb-1 text-[7px]" style={{ color: WF.dark }}>{item.desc}</div>
              )}
            </div>
          ))}
        </div>
      );

    case "wf-video":
      return (
        <div className="rounded flex items-center justify-center" style={{ height: 80, backgroundColor: WF.gray }}>
          <div className="text-center">
            <div className="text-lg" style={{ color: WF.text }}>&#9654;</div>
            <div className="text-[7px]" style={{ color: WF.text }}>{block.text || "영상"}</div>
          </div>
        </div>
      );

    case "wf-before-after":
      return (
        <div className="flex gap-1">
          <div className="flex-1 rounded p-1 text-center" style={{ backgroundColor: WF.light }}>
            <div className="text-[7px] font-bold mb-0.5" style={{ color: WF.text }}>BEFORE</div>
            <div className="rounded mx-auto" style={{ width: 40, height: 40, backgroundColor: WF.gray }} />
            {block.before && <div className="text-[7px] mt-0.5" style={{ color: WF.text }}>{block.before}</div>}
          </div>
          <div className="flex-1 rounded p-1 text-center" style={{ backgroundColor: WF.light }}>
            <div className="text-[7px] font-bold mb-0.5" style={{ color: WF.text }}>AFTER</div>
            <div className="rounded mx-auto" style={{ width: 40, height: 40, backgroundColor: WF.gray }} />
            {block.after && <div className="text-[7px] mt-0.5" style={{ color: WF.text }}>{block.after}</div>}
          </div>
        </div>
      );

    case "wf-quote":
      return (
        <div className="border-l-2 pl-2 py-0.5" style={{ borderColor: WF.dark }}>
          <div className="text-[9px] italic" style={{ color: WF.text }}>"{block.text || ""}"</div>
          {block.desc && <div className="text-[7px] mt-0.5" style={{ color: WF.dark }}>- {block.desc}</div>}
        </div>
      );

    case "wf-number-highlight":
      return (
        <div className="flex justify-center gap-3">
          {(block.items || []).map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-base font-bold" style={{ color: WF.dark }}>{item.value || "0"}</div>
              <div className="text-[7px]" style={{ color: WF.text }}>{item.label}</div>
            </div>
          ))}
        </div>
      );

    case "wf-checklist": {
      // items 배열 또는 text(줄바꿈/| 구분) 둘 다 지원
      const checkItems = block.items?.length
        ? block.items.map((item) => item.label)
        : block.text
          ? block.text.split(/\n|\||•|✓|✔/).map((s: string) => s.trim()).filter(Boolean)
          : [];
      return (
        <div className="space-y-0.5">
          {checkItems.map((label: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5 text-[8px]" style={{ color: WF.text }}>
              <span style={{ color: "#22C55E" }}>&#10003;</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      );
    }

    case "wf-comparison-row":
      return (
        <div className="border rounded overflow-hidden text-[8px]" style={{ borderColor: WF.accent }}>
          <div className="flex" style={{ backgroundColor: WF.dark }}>
            <div className="flex-1 px-1.5 py-1 font-bold text-white">항목</div>
            <div className="flex-1 px-1.5 py-1 font-bold text-white">일반</div>
            <div className="flex-1 px-1.5 py-1 font-bold text-white">{brandName || "자사"}</div>
          </div>
          {(block.items || []).map((item, i) => (
            <div key={i} className="flex border-t" style={{ borderColor: WF.accent }}>
              <div className="flex-1 px-1.5 py-1" style={{ color: WF.text }}>{item.label}</div>
              <div className="flex-1 px-1.5 py-1" style={{ color: WF.text }}>{item.value || ""}</div>
              <div className="flex-1 px-1.5 py-1 font-bold" style={{ color: WF.dark }}>{item.desc || ""}</div>
            </div>
          ))}
        </div>
      );

    default:
      return (
        <div className="text-[8px] p-1 rounded border border-dashed" style={{ borderColor: WF.accent, color: WF.text }}>
          [{block.type}] {block.text || ""}
        </div>
      );
  }
}
