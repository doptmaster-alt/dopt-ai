"use client";

import React from "react";
import type { CopyBlock } from "./types";

interface Props {
  block: CopyBlock;
  index: number;
  onEdit?: (index: number, field: string, value: string) => void;
}

function EditableSpan({
  value,
  className,
  placeholder,
  onCommit,
}: {
  value: string;
  className?: string;
  placeholder?: string;
  onCommit?: (v: string) => void;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const composing = React.useRef(false);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`outline-none focus:ring-1 focus:ring-blue-300 rounded px-0.5 ${className || ""}`}
      data-placeholder={placeholder}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={() => { composing.current = false; }}
      onBlur={() => {
        if (onCommit && ref.current) {
          onCommit(ref.current.textContent || "");
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !composing.current) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
    >
      {value}
    </span>
  );
}

export default function CopyBlockRenderer({ block, index, onEdit }: Props) {
  const commit = (field: string) => (v: string) => onEdit?.(index, field, v);

  switch (block.type) {
    case "section-title":
      return (
        <div className="text-sm font-bold" style={{ color: "#CC0000" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} placeholder="섹션 타이틀" />
        </div>
      );

    case "heading": {
      const sizes: Record<string, string> = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" };
      const cls = sizes[block.size || "md"] || "text-base";
      return (
        <div className={`${cls} ${block.bold !== false ? "font-bold" : ""}`} style={{ color: block.color || "#1A1A1A" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
        </div>
      );
    }

    case "text":
      return (
        <div className={`text-xs leading-relaxed ${block.bold ? "font-bold" : ""}`} style={{ color: block.color || "#444444" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
        </div>
      );

    case "label":
      return (
        <div className="text-xs font-bold" style={{ color: "#2563EB" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
        </div>
      );

    case "copy-main":
      return (
        <div className="text-sm font-bold text-black">
          <EditableSpan value={block.text || ""} onCommit={commit("text")} placeholder="메인 카피" />
        </div>
      );

    case "copy-sub":
      return (
        <div className="text-xs" style={{ color: "#444444" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} placeholder="서브 카피" />
        </div>
      );

    case "image-placeholder":
      return (
        <div className="border border-dashed border-gray-300 rounded p-3 bg-gray-50 text-center">
          <div className="text-xs text-gray-400">{block.text || "[이미지 영역]"}</div>
          {block.desc && <div className="text-[10px] text-gray-300 mt-1">{block.desc}</div>}
        </div>
      );

    case "info-box":
      return (
        <div className="rounded p-2 border text-xs" style={{ backgroundColor: block.color || "#EFF6FF", borderColor: "#D1D5DB" }}>
          {block.label && <div className="font-bold text-[10px] mb-1" style={{ color: "#2563EB" }}>{block.label}</div>}
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
        </div>
      );

    case "list": {
      // items 배열 또는 text(줄바꿈/불릿 구분) 둘 다 지원
      const listItems = block.items?.length
        ? block.items
        : block.text
          ? block.text.split(/\n|•|·|✓|✔|☑|■/).map((s: string) => s.trim()).filter(Boolean)
          : [];
      return (
        <div className="text-xs space-y-0.5" style={{ color: "#444444" }}>
          {listItems.map((item: string, i: number) => (
            <div key={i} className="flex gap-1">
              <span className="text-gray-400 shrink-0">{i + 1}.</span>
              <span>{item}</span>
            </div>
          ))}
          {block.desc && <div className="text-[10px] text-gray-400 mt-1">{block.desc}</div>}
        </div>
      );
    }

    case "note":
      return (
        <div className="text-[10px] italic" style={{ color: block.color || "#888888" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
        </div>
      );

    case "ae-comment":
      return (
        <div className="text-xs font-bold" style={{ color: "#CC0000" }}>
          **AE
          <br />
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
        </div>
      );

    case "layout-tag":
      return (
        <div className="text-xs" style={{ color: "#2563EB" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
        </div>
      );

    case "visual-direction":
      return (
        <div className="text-xs italic" style={{ color: "#888888" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
        </div>
      );

    case "divider":
      return <hr className="border-gray-200 my-1" />;

    case "kv-pair":
      return (
        <div className="flex gap-2 text-xs">
          <span className="font-bold text-gray-600 shrink-0">{block.label}:</span>
          <EditableSpan value={block.value || ""} onCommit={commit("value")} className="text-gray-800" />
        </div>
      );

    case "promo-box":
      return (
        <div className="rounded p-2 text-xs font-bold text-center" style={{ backgroundColor: "#FEF3C7", border: "1px solid #F59E0B" }}>
          <EditableSpan value={block.text || ""} onCommit={commit("text")} />
          {block.desc && <div className="font-normal text-[10px] mt-0.5">{block.desc}</div>}
        </div>
      );

    default:
      return (
        <div className="text-xs text-gray-400 p-1 border border-dashed rounded">
          [{block.type}] {block.text || ""}
        </div>
      );
  }
}
