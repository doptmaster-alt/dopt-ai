"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

/**
 * 노션 스타일 마크다운 렌더러
 * AI가 생성한 브리프/기획안/시장조사를 노션처럼 깔끔하게 표시
 */
export default function NotionMarkdown({ content }: Props) {
  return (
    <div className="notion-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── 제목 ──
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-gray-900 mt-8 mb-4 pb-3 border-b-2 border-gray-200 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-gray-800 mt-7 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-blue-500 rounded-full inline-block flex-shrink-0" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-gray-700 mt-5 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-gray-600 mt-4 mb-2">
              {children}
            </h4>
          ),

          // ── 단락 ──
          p: ({ children }) => (
            <p className="text-sm text-gray-700 leading-relaxed mb-3 last:mb-0">
              {children}
            </p>
          ),

          // ── 강조 ──
          strong: ({ children }) => (
            <strong className="font-bold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-gray-600 not-italic bg-yellow-50 px-1 rounded">{children}</em>
          ),

          // ── 리스트 ──
          ul: ({ children }) => (
            <ul className="space-y-1.5 mb-4 ml-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-2 mb-4 ml-1 counter-reset-list">{children}</ol>
          ),
          li: ({ children, ...props }) => {
            // ol인지 ul인지 판별해서 다른 스타일 적용
            const isOrdered = (props as any).node?.parentNode?.tagName === "ol";
            if (isOrdered) {
              return (
                <li className="text-sm text-gray-700 leading-relaxed flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold mt-0.5">
                    {(props as any).index !== undefined ? (props as any).index + 1 : "·"}
                  </span>
                  <span className="flex-1">{children}</span>
                </li>
              );
            }
            return (
              <li className="text-sm text-gray-700 leading-relaxed flex gap-2.5 items-start">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2" />
                <span className="flex-1">{children}</span>
              </li>
            );
          },

          // ── 테이블 (핵심!) ──
          table: ({ children }) => (
            <div className="my-4 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-800 text-white">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-100">{children}</tbody>
          ),
          tr: ({ children, ...props }) => {
            const isHead = (props as any).node?.parentNode?.tagName === "thead";
            if (isHead) {
              return <tr>{children}</tr>;
            }
            return (
              <tr className="hover:bg-blue-50/50 transition-colors even:bg-gray-50/50">
                {children}
              </tr>
            );
          },
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left text-xs font-semibold tracking-wider uppercase">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-gray-700">{children}</td>
          ),

          // ── 코드 블록 ──
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="block bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono overflow-x-auto my-3">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3">{children}</pre>
          ),

          // ── 인용문 (AE Commentary 등) ──
          blockquote: ({ children }) => (
            <blockquote className="my-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl px-4 py-3 text-sm">
              <div className="text-xs font-bold text-amber-700 mb-1">💬 Commentary</div>
              <div className="text-amber-900">{children}</div>
            </blockquote>
          ),

          // ── 구분선 ──
          hr: () => (
            <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          ),

          // ── 링크 ──
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline decoration-blue-200 hover:decoration-blue-400 transition"
            >
              {children}
            </a>
          ),

          // ── 이미지 ──
          img: ({ src, alt }) => (
            <div className="my-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={src} alt={alt || ""} className="w-full" />
              {alt && <p className="text-xs text-gray-500 text-center py-2 bg-gray-50">{alt}</p>}
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
