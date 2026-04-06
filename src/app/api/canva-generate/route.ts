import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

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
  throw new Error('ANTHROPIC_API_KEY not found');
}

function getClient() {
  return new Anthropic({ apiKey: loadApiKey() });
}

/**
 * POST /api/canva-generate
 *
 * 기획안 섹션 데이터를 받아 Claude AI로 실제 디자인 HTML을 생성합니다.
 * Canva API 대신 Claude의 HTML/CSS 생성 능력을 활용합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandName, productName, designTone, colorScheme, section } = body;

    if (!section) {
      return NextResponse.json({ error: 'section data required' }, { status: 400 });
    }

    // 섹션의 카피 블록 텍스트 추출
    const copyTexts: string[] = [];
    if (section.mainCopy) copyTexts.push(`메인 헤드라인: "${section.mainCopy}"`);
    if (section.subCopy) copyTexts.push(`서브 헤드라인: "${section.subCopy}"`);

    if (section.copyBlocks?.length) {
      for (const block of section.copyBlocks) {
        if (['ae-comment', 'layout-tag', 'visual-direction', 'divider'].includes(block.type)) continue;
        if (block.text) {
          const typeLabel: Record<string, string> = {
            'section-title': '섹션 타이틀',
            'heading': '제목',
            'text': '본문',
            'copy-main': '메인 카피',
            'copy-sub': '서브 카피',
            'info-box': '정보 박스',
            'list': '리스트',
            'note': '참고',
            'kv-pair': '키-값',
            'promo-box': '프로모션',
            'label': '라벨',
          };
          copyTexts.push(`${typeLabel[block.type] || block.type}: "${block.text}"`);
        }
        if (block.type === 'list' && block.items?.length) {
          copyTexts.push(`리스트: ${block.items.join(', ')}`);
        }
        if (block.type === 'kv-pair' && block.label && block.value) {
          copyTexts.push(`${block.label}: ${block.value}`);
        }
      }
    }

    // 와이어프레임 블록 구조 설명
    const layoutParts: string[] = [];
    if (section.wireframeBlocks?.length) {
      for (const block of section.wireframeBlocks) {
        const typeDesc: Record<string, string> = {
          'wf-heading': '큰 제목',
          'wf-text': '본문 텍스트',
          'wf-image': '이미지 영역',
          'wf-button': 'CTA 버튼',
          'wf-card-grid': '카드 그리드',
          'wf-icon-list': '아이콘+텍스트 리스트',
          'wf-split': '2단 분할 레이아웃',
          'wf-badge-row': '뱃지 가로 배열',
          'wf-stats': '통계/숫자 강조',
          'wf-review-card': '리뷰 카드',
          'wf-product-grid': '제품 라인업 그리드',
          'wf-bar-chart': '바 차트',
          'wf-table': '테이블',
          'wf-number-highlight': '숫자 하이라이트',
          'wf-checklist': '체크리스트',
          'wf-comparison-row': '비교 행',
          'wf-before-after': '비포/애프터',
          'wf-quote': '인용문',
          'wf-trust-badges': '신뢰 뱃지',
          'wf-price': '가격 표시',
          'wf-promo-badge': '프로모션 뱃지',
          'wf-timeline': '타임라인/단계',
        };
        let desc = typeDesc[block.type] || block.type;
        if (block.text) desc += ` - "${block.text}"`;
        if (block.items?.length) {
          const itemTexts = block.items.slice(0, 4).map((it: any) =>
            typeof it === 'string' ? it : it.label || ''
          );
          desc += ` [${itemTexts.join(', ')}]`;
        }
        if (block.cols) desc += ` (${block.cols}열)`;
        layoutParts.push(desc);
      }
    }

    const systemPrompt = `You are a world-class Korean e-commerce product detail page (상세페이지) designer.
Generate a single self-contained HTML section design. This will be rendered in a 400px wide iframe as a design preview.

CRITICAL RULES:
1. Output ONLY valid HTML. No markdown, no explanation, no \`\`\` blocks.
2. ALL styles must be inline CSS or in a <style> tag within the HTML.
3. Use the EXACT Korean text provided. Do NOT change or translate any copy.
4. Design must be mobile-first (400px width), vertical scroll layout.
5. Use premium, modern Korean e-commerce aesthetic.
6. Include realistic placeholder shapes for images (gradient backgrounds with subtle icons).
7. Typography: clean sans-serif (system-ui, -apple-system, sans-serif).
8. Make it look like a REAL product detail page section, not a wireframe.
9. Colors, spacing, and visual hierarchy must be professional and polished.
10. The HTML must start with <!DOCTYPE html> and be completely self-contained.`;

    const userPrompt = `Design a product detail page section for:

Brand: ${brandName || '브랜드'}
${productName ? `Product: ${productName}` : ''}
${designTone ? `Tone & Manner: ${designTone}` : ''}
${colorScheme ? `Color Scheme: ${colorScheme}` : ''}

Section ${section.num}: "${section.name}"
${section.visualDirection ? `Visual Direction: ${section.visualDirection}` : ''}
${section.layout ? `Layout: ${section.layout}` : ''}

=== TEXT CONTENT (use exactly as written) ===
${copyTexts.join('\n')}

=== LAYOUT STRUCTURE (top to bottom) ===
${layoutParts.length ? layoutParts.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'Auto-layout based on content'}

Generate a beautiful, polished HTML design for this section. Make it look like a real Korean premium product detail page.`;

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    let html = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        html += block.text;
      }
    }

    // Clean up: remove markdown code fences if present
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    return NextResponse.json({
      sectionNum: section.num,
      sectionName: section.name,
      html,
      success: true,
    });
  } catch (err: any) {
    console.error('[canva-generate] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
