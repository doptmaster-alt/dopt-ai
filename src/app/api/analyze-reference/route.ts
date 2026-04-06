import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

function extractJSON(text: string): any {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

function loadApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (match) {
      const key = match[1].trim();
      process.env.ANTHROPIC_API_KEY = key;
      return key;
    }
  } catch {}
  return '';
}

// ===== 블록 타입별 정확한 스펙 =====
const BLOCK_SPEC = `
## WireframeBlock 타입별 필수 스펙 (반드시 이 형식으로 생성)

### 단순 텍스트 블록
- wf-heading: { "type": "wf-heading", "text": "헤딩 텍스트", "bold": true, "align": "center" }
- wf-text: { "type": "wf-text", "text": "본문 텍스트", "align": "center" }
- wf-logo: { "type": "wf-logo", "text": "브랜드명", "align": "center" }
- wf-source: { "type": "wf-source", "text": "출처 텍스트" }

### 이미지/미디어
- wf-image: { "type": "wf-image", "text": "이미지 설명", "height": 150, "desc": "상세설명" }
- wf-video: { "type": "wf-video", "text": "영상 제목" }

### 버튼
- wf-button: { "type": "wf-button", "text": "버튼 텍스트", "color": "#333" }

### 리스트/체크 (반드시 items 배열 필수!)
- wf-checklist: { "type": "wf-checklist", "items": [{"label": "항목1"}, {"label": "항목2"}, {"label": "항목3"}] }
- wf-icon-list: { "type": "wf-icon-list", "items": [{"label": "제목", "desc": "설명"}, ...] }
- wf-badge-row: { "type": "wf-badge-row", "items": [{"label": "뱃지1"}, {"label": "뱃지2"}] }
- wf-trust-badges: { "type": "wf-trust-badges", "items": [{"label": "인증1"}, {"label": "인증2"}] }

### 수치/통계 (반드시 items 배열 필수!)
- wf-stats: { "type": "wf-stats", "items": [{"label": "항목명", "value": "수치"}, {"label": "항목명", "value": "수치"}] }
- wf-number-highlight: { "type": "wf-number-highlight", "items": [{"label": "설명", "value": "수치"}, ...] }
- wf-bar-chart: { "type": "wf-bar-chart", "text": "차트제목", "items": [{"label": "항목", "percent": 80}, ...] }
- wf-progress-bar: { "type": "wf-progress-bar", "items": [{"label": "항목", "percent": 90}, ...] }

### 카드/그리드 (반드시 items 배열 필수!)
- wf-card-grid: { "type": "wf-card-grid", "cols": 2, "items": [{"label": "제목", "desc": "설명"}, ...] }
- wf-product-grid: { "type": "wf-product-grid", "cols": 3, "items": [{"label": "상품명", "desc": "설명", "value": "가격"}, ...] }
- wf-review-card: { "type": "wf-review-card", "items": [{"label": "리뷰어", "desc": "리뷰내용", "value": "★★★★★"}, ...] }

### 테이블
- wf-table: { "type": "wf-table", "headers": ["항목", "내용"], "rows": [{"cells": ["값1", "값2"]}, ...] }
- wf-comparison-row: { "type": "wf-comparison-row", "items": [{"label": "항목", "value": "일반", "desc": "자사"}, ...] }

### 레이아웃/분할
- wf-split: { "type": "wf-split", "text": "왼쪽 텍스트", "desc": "추가설명", "label": "오른쪽 이미지 설명" }
- wf-before-after: { "type": "wf-before-after", "before": "이전 설명", "after": "이후 설명" }
- wf-tabs: { "type": "wf-tabs", "tabs": ["탭1", "탭2", "탭3"] }
- wf-accordion: { "type": "wf-accordion", "items": [{"label": "제목", "desc": "내용"}, ...] }
- wf-timeline: { "type": "wf-timeline", "items": [{"label": "단계", "desc": "설명"}, ...] }

### 가격/프로모션
- wf-price: { "type": "wf-price", "text": "29,900원", "label": "39,900원" }
- wf-promo-badge: { "type": "wf-promo-badge", "text": "한정 특가 30% OFF" }

### 인용
- wf-quote: { "type": "wf-quote", "text": "인용 내용", "desc": "출처/작성자" }

### 간격
- wf-divider: { "type": "wf-divider" }
- wf-spacer: { "type": "wf-spacer", "height": 16 }

## CopyBlock 타입별 스펙
- section-title: { "type": "section-title", "text": "섹션 제목", "size": "sm" }
- heading: { "type": "heading", "text": "제목", "size": "lg", "bold": true }
- copy-main: { "type": "copy-main", "text": "메인 카피", "size": "lg", "bold": true }
- copy-sub: { "type": "copy-sub", "text": "서브 카피", "size": "md" }
- text: { "type": "text", "text": "본문 텍스트" }
- label: { "type": "label", "text": "라벨 텍스트" }
- image-placeholder: { "type": "image-placeholder", "text": "이미지 설명" }
- info-box: { "type": "info-box", "text": "정보 박스 내용" }
- list: { "type": "list", "items": ["항목1", "항목2", "항목3"] }
- note: { "type": "note", "text": "참고 사항" }
- ae-comment: { "type": "ae-comment", "text": "AE 코멘터리" }
- layout-tag: { "type": "layout-tag", "text": "레이아웃 설명" }
- visual-direction: { "type": "visual-direction", "text": "비주얼 방향" }
- kv-pair: { "type": "kv-pair", "label": "키", "value": "값" }
- promo-box: { "type": "promo-box", "text": "프로모션 내용" }
- divider: { "type": "divider" }

## 중요 규칙
1. wf-checklist, wf-stats, wf-icon-list, wf-badge-row, wf-number-highlight 등은 반드시 "items" 배열을 사용하세요. text만 넣으면 렌더링되지 않습니다!
2. wf-table, wf-comparison-row는 반드시 headers/rows 또는 items 구조를 사용하세요.
3. CopyBlock의 "list" 타입은 반드시 "items" 배열(문자열 배열)을 사용하세요.
4. 레퍼런스 이미지의 구조를 최대한 세밀하게 반영하세요 (블록 수, 배치 순서, 칸 수 등).
`;

const APPLY_PROMPT = `당신은 상세페이지 기획/디자인 최고 전문가입니다.

이 레퍼런스 이미지의 **디자인 구조**를 정밀 분석하고, 아래 기존 기획안의 내용을 이 구조에 맞게 완벽히 재구성해주세요.

## 분석 방법
1. 레퍼런스 이미지를 위에서 아래로 스캔하면서 각 요소(헤딩, 이미지, 텍스트, 리스트, 통계, 버튼 등)를 식별
2. 각 요소의 레이아웃 배치(중앙, 좌측, 그리드, 분할 등)를 파악
3. 요소 간의 시각적 흐름과 위계(hierarchy)를 분석
4. 이 구조에 우리 기획안의 실제 내용을 매핑

## 핵심 규칙
1. **기존 기획안의 카피/내용을 반드시 유지** — 레퍼런스의 텍스트는 사용하지 마세요
2. 레퍼런스의 **디자인 구조(레이아웃, 블록 배치, 시각적 흐름)**만 차용
3. wireframeBlocks의 text/items에는 **우리 기획안의 실제 내용**을 넣으세요
4. copyBlocks의 text/items에도 **우리 기획안의 실제 카피**를 넣으세요
5. items 배열이 필요한 블록 타입은 반드시 items를 사용하세요 (위 스펙 참고)
6. 레퍼런스에 체크리스트가 있으면 wf-checklist의 items로, 통계가 있으면 wf-stats의 items로 매핑

## 응답 형식 (반드시 JSON 하나만 출력, 마크다운 없이)
{
  "analysisNote": "레퍼런스 디자인 구조를 상세히 설명 (요소별 배치, 시각적 흐름 포함, 2-3문장)",
  "proposalSummary": "우리 기획안에 어떻게 적용할지 구체적으로 설명 (어떤 카피가 어디에 배치되는지, 2-3문장)",
  "changes": {
    "layout": "적용할 레이아웃 구조 상세 설명",
    "visualDirection": "적용할 비주얼 방향",
    "mainCopy": "우리 기획안의 메인 카피 (기존 유지 또는 구조에 맞게 소폭 수정)",
    "subCopy": "우리 기획안의 서브 카피",
    "wireframeBlocks": [...],
    "copyBlocks": [...]
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = loadApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { imageUrl, sectionName, sectionNum, sectionData, mode } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    let base64: string;
    let mediaType: string;

    if (imageUrl.startsWith('/api/uploads/')) {
      const filename = imageUrl.replace('/api/uploads/', '');
      const filePath = path.resolve(process.cwd(), 'uploads', filename);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Image file not found' }, { status: 404 });
      }
      const buffer = fs.readFileSync(filePath);
      base64 = buffer.toString('base64');
      const ext = path.extname(filename).toLowerCase();
      mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    } else {
      return NextResponse.json({ error: 'Only local uploads supported' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    // mode === 'apply': 기존 기획안 내용 + 레퍼런스 구조 → 적용 제안 생성
    if (mode === 'apply' && sectionData) {
      const sectionContext = `
## 기존 기획안 섹션 정보 (이 내용을 반드시 블록에 사용)
- 섹션: ${sectionNum}. ${sectionName}
- 메인카피: ${sectionData.mainCopy || '(없음)'}
- 서브카피: ${sectionData.subCopy || '(없음)'}
- 비주얼방향: ${sectionData.visualDirection || '(없음)'}
- 레이아웃: ${sectionData.layout || '(없음)'}
- AE코멘터리: ${sectionData.aeCommentary || '(없음)'}
- 기획의도: ${sectionData.planningIntent || '(없음)'}
- 제품명: ${sectionData.productName || '(없음)'}
- 설명: ${sectionData.description || '(없음)'}
${sectionData.copyBlocks ? `- 기존 카피블록(text 내용 참고): ${JSON.stringify(sectionData.copyBlocks.map((b: any) => ({ type: b.type, text: b.text, items: b.items })).slice(0, 10))}` : ''}`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
            { type: 'text', text: BLOCK_SPEC + '\n\n' + APPLY_PROMPT + sectionContext }
          ]
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const result = extractJSON(text);

      if (!result) {
        return NextResponse.json({ error: 'Failed to parse analysis', raw: text.substring(0, 500) }, { status: 500 });
      }

      return NextResponse.json({ ...result, mode: 'apply' });
    }

    // 기본 모드: 구조 분석만
    const contextPrompt = sectionName
      ? `\n\n현재 섹션: 섹션 ${sectionNum} - "${sectionName}"\n이 섹션의 목적에 맞게 블록을 생성하세요.`
      : '';

    const structurePrompt = `
이 레퍼런스 이미지의 디자인 구조를 분석하여 와이어프레임 블록과 카피 블록을 생성하세요.
구조적 역할만 text에 표시하세요 (예: "메인 헤딩 영역").

## 응답 형식 (반드시 JSON 하나만)
{
  "analysisNote": "디자인 구조 요약 (2-3문장)",
  "layout": "레이아웃 설명",
  "visualDirection": "비주얼 방향",
  "wireframeBlocks": [...],
  "copyBlocks": [...]
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
          { type: 'text', text: BLOCK_SPEC + '\n\n' + structurePrompt + contextPrompt }
        ]
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const analysis = extractJSON(text);

    if (!analysis) {
      return NextResponse.json({ error: 'Failed to parse analysis', raw: text.substring(0, 500) }, { status: 500 });
    }

    return NextResponse.json({ ...analysis, mode: 'analyze' });

  } catch (err: any) {
    console.error('[analyze-reference] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
