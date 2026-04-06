import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/nano-banana
 *
 * Nano Banana 2 (Gemini Image) — 디자인 미리보기 + 촬영콘티 레퍼런스 이미지 생성
 * 고도화된 구조적 프롬프트로 AI가 최대한 정확하게 이해하고 세밀하게 표현
 */

function loadGeminiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
    if (match) {
      const key = match[1].trim();
      process.env.GEMINI_API_KEY = key;
      return key;
    }
  } catch {}
  throw new Error('GEMINI_API_KEY not found');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 촬영콘티 컷별 이미지 프롬프트 (고도화)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ImagePrompt {
  subject: string;
  scene?: string;
  foreground?: string;
  background?: string;
  lighting?: string;
  camera?: { angle?: string; lens?: string; dof?: string };
  style?: string;
  colorPalette?: string[];
  mood?: string;
  negativePrompt?: string;
  aspectRatio?: string;
  quality?: string;
}

function buildNanaBananaPrompt(imagePrompt: ImagePrompt): string {
  const sections: string[] = [];

  // ── 1. 역할 지정 + 핵심 목적 ──
  sections.push(
    `You are a world-class commercial product photographer and art director.`,
    `Generate a single photorealistic studio photograph for a Korean e-commerce product detail page (상세페이지).`,
    ``
  );

  // ── 2. 핵심 피사체 (가장 중요) ──
  sections.push(`## PRIMARY SUBJECT`);
  sections.push(`${imagePrompt.subject}`);
  sections.push(``);

  // ── 3. 씬/컨텍스트 ──
  if (imagePrompt.scene) {
    sections.push(`## SCENE / CONTEXT`);
    sections.push(`${imagePrompt.scene}`);
    sections.push(``);
  }

  // ── 4. 카메라 세팅 (구체적 기술 용어) ──
  sections.push(`## CAMERA SETTINGS`);
  const camParts: string[] = [];
  if (imagePrompt.camera?.angle) camParts.push(`Angle: ${imagePrompt.camera.angle}`);
  if (imagePrompt.camera?.lens) camParts.push(`Lens: ${imagePrompt.camera.lens}`);
  if (imagePrompt.camera?.dof) camParts.push(`Depth of Field: ${imagePrompt.camera.dof}`);
  if (camParts.length > 0) {
    sections.push(camParts.join(' | '));
  } else {
    sections.push(`Angle: 45-degree elevated | Lens: 85mm portrait | Depth of Field: shallow, f/2.8`);
  }
  sections.push(``);

  // ── 5. 전경/배경 레이어 분리 ──
  if (imagePrompt.foreground || imagePrompt.background) {
    sections.push(`## SPATIAL LAYERS`);
    if (imagePrompt.foreground) sections.push(`- Foreground: ${imagePrompt.foreground}`);
    if (imagePrompt.background) sections.push(`- Background: ${imagePrompt.background}`);
    sections.push(``);
  }

  // ── 6. 조명 시스템 ──
  sections.push(`## LIGHTING SETUP`);
  if (imagePrompt.lighting) {
    sections.push(`${imagePrompt.lighting}`);
  } else {
    sections.push(`Three-point studio lighting: key light (soft box, 45° camera-left), fill light (reflector, camera-right), rim light (backlight for edge separation). Clean, even illumination with soft shadows.`);
  }
  sections.push(``);

  // ── 7. 컬러 팔레트 ──
  if (imagePrompt.colorPalette?.length) {
    sections.push(`## COLOR PALETTE`);
    sections.push(`Dominant colors in the image: ${imagePrompt.colorPalette.join(', ')}`);
    sections.push(`Ensure these colors appear naturally in props, backgrounds, or product packaging.`);
    sections.push(``);
  }

  // ── 8. 무드/감성 ──
  if (imagePrompt.mood) {
    sections.push(`## MOOD & EMOTION`);
    sections.push(`${imagePrompt.mood}`);
    sections.push(`The viewer should feel this emotion immediately upon seeing the image.`);
    sections.push(``);
  }

  // ── 9. 비주얼 스타일 ──
  sections.push(`## VISUAL STYLE`);
  if (imagePrompt.style) {
    sections.push(`${imagePrompt.style}`);
  } else {
    sections.push(`Premium Korean e-commerce product photography. Clean, modern, aspirational.`);
  }
  sections.push(``);

  // ── 10. 품질 요구사항 ──
  sections.push(`## TECHNICAL QUALITY`);
  if (imagePrompt.quality) {
    sections.push(imagePrompt.quality);
  } else {
    sections.push(`- Resolution: Ultra-high, 4K equivalent sharpness`);
    sections.push(`- Focus: Tack-sharp on the product, natural bokeh on background`);
    sections.push(`- Color grading: Balanced, true-to-life colors with slight warmth`);
    sections.push(`- Post-processing: Professional retouching level, no over-saturation`);
    sections.push(`- Style reference: Behance/Pinterest top commercial product photography`);
  }
  sections.push(``);

  // ── 11. 네거티브 (제외 사항) ──
  sections.push(`## MUST AVOID`);
  const negatives = [
    'text overlays or watermarks',
    'blurry or out-of-focus product',
    'cluttered or messy composition',
    'unrealistic CGI look',
    'low-quality stock photo feel',
    'cartoon or illustration style',
  ];
  if (imagePrompt.negativePrompt) {
    negatives.push(imagePrompt.negativePrompt);
  }
  sections.push(negatives.map(n => `- No ${n}`).join('\n'));

  return sections.join('\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 디자인 섹션 미리보기 — 원본 섹션 데이터에서 직접 프롬프트 생성
// (GenSpark 프롬프트 파싱 X → 원본 카피/와이어프레임 데이터 직접 사용)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 구조 레이블/메타 텍스트 감지 (이미지에 절대 렌더링하면 안 되는 텍스트)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function isStructuralText(text: string): boolean {
  if (!text || !text.trim()) return true;
  const t = text.trim();
  // "섹션 1", "섹션1", "Section 1", "SECTION 1" 등
  if (/^섹션\s*\d/i.test(t)) return true;
  if (/^section\s*\d/i.test(t)) return true;
  // "섹션 1 브랜드 인트로", "섹션 2 현장 안전성 문제 제기" — 섹션+숫자로 시작하는 모든 것
  if (/섹션\s*\d+/i.test(t) && t.length < 50) return true;
  // "메인 카피", "서브 카피", "Heading", "Body Text" 등 디자인 주석
  if (/^(메인|서브)\s*(카피|헤드|타이틀)/i.test(t)) return true;
  if (/^\d+pt\s/i.test(t)) return true;
  if (/^(HEADLINE|BODY TEXT|BRAND LOGO|CTA|HERO)/i.test(t)) return true;
  // "브랜드 인트로", "현장 안전성 문제 제기" — 단독 섹션 이름 패턴
  if (/^(브랜드\s*인트로|제품\s*소개|문제\s*제기|해결책|효과|후기|가격|CTA|마무리)/i.test(t)) return true;
  // px, Bold, font 등 스타일 용어 포함
  if (/\d+px\s*(Bold|Regular|Light|Semi)/i.test(t)) return true;
  // 와이어프레임 주석 패턴
  if (/^(헤드라인|바디텍스트|로고|이미지|버튼)\s*(영역|존|zone)/i.test(t)) return true;
  return false;
}

interface SectionInput {
  num?: number;
  name?: string;
  mainCopy?: string;
  subCopy?: string;
  description?: string;
  planningIntent?: string;
  visualDirection?: string;
  layout?: string;
  wireframeBlocks?: any[];
  copyBlocks?: any[];
}

interface BrandInput {
  brandName?: string;
  productName?: string;
  designTone?: string;
  colorScheme?: string;
}

function buildDesignFromSectionData(section: SectionInput, brand: BrandInput): string {
  const p: string[] = [];
  const productLabel = brand.productName && brand.productName !== brand.brandName
    ? `${brand.brandName} ${brand.productName}`
    : (brand.brandName || '제품');

  // ── 1. 핵심 지시 (AI 역할 + 생성할 것) ──
  p.push(`Generate a premium Korean e-commerce product detail page design mockup image.`);
  p.push(`This is a FINISHED DESIGN — not a wireframe, not a sketch, not a layout diagram.`);
  p.push(`It must look like a real product page screenshot from a high-end Korean online store.`);
  p.push(``);

  // ── 2. 브랜드/제품 ──
  p.push(`Brand: ${productLabel}`);
  if (section.name) p.push(`Section purpose (DO NOT render this text in the image): ${section.name}`);
  p.push(`Format: Vertical mobile infographic, 9:16 ratio`);
  p.push(``);

  // ── 3. 실제 표시할 텍스트 (카피) — 이것만 이미지에 넣어야 함 ──
  p.push(`=== TEXT TO DISPLAY IN THE DESIGN (Korean, use exactly as written) ===`);
  p.push(``);

  // mainCopy/subCopy 또는 copyBlocks에서 실제 카피만 추출
  const displayTexts: { role: string; text: string }[] = [];

  if (section.mainCopy) {
    displayTexts.push({ role: 'Main headline (largest text)', text: section.mainCopy });
  }
  if (section.subCopy) {
    displayTexts.push({ role: 'Sub headline', text: section.subCopy });
  }

  // copyBlocks에서 실제 콘텐츠만 추출 (구조 레이블/메타 타입 완전 제외)
  if (section.copyBlocks?.length) {
    // 이미지에 절대 포함하면 안 되는 타입들
    const skipTypes = [
      'ae-comment', 'layout-tag', 'visual-direction', 'divider',
      'section-title',  // "섹션 1  브랜드 인트로" 같은 구조 레이블
      'label',          // "메인 카피 (28pt Bold)" 같은 스타일 주석
      'image-placeholder', // 이미지 위치 지정용 메타
    ];

    for (const block of section.copyBlocks) {
      if (skipTypes.includes(block.type)) continue;

      if (block.type === 'copy-main' || block.type === 'heading') {
        if (block.text && block.text !== section.mainCopy && !isStructuralText(block.text)) {
          displayTexts.push({ role: 'Heading', text: block.text });
        }
      } else if (block.type === 'copy-sub' || block.type === 'text' || block.type === 'note') {
        if (block.text && block.text !== section.subCopy && !isStructuralText(block.text)) {
          displayTexts.push({ role: 'Body text', text: block.text });
        }
      } else if (block.type === 'kv-pair') {
        if (block.label && block.value) {
          displayTexts.push({ role: 'Data point', text: `${block.label}: ${block.value}` });
        }
      } else if (block.type === 'list' && block.items?.length) {
        displayTexts.push({ role: 'Feature list', text: block.items.join(' / ') });
      } else if (block.type === 'promo-box' || block.type === 'info-box') {
        if (block.text && !isStructuralText(block.text)) {
          displayTexts.push({ role: 'Highlight box', text: block.text });
        }
      }
    }
  }

  if (displayTexts.length > 0) {
    displayTexts.forEach(dt => {
      p.push(`[${dt.role}] "${dt.text}"`);
    });
  } else {
    p.push(`(Use appropriate Korean text for a ${section.name || 'product'} section)`);
  }
  p.push(``);
  p.push(`CRITICAL: Only the Korean text listed above should appear in the design.`);
  p.push(`Do NOT add "섹션 1", "섹션 2", "Section 1", or any section number labels.`);
  p.push(`Do NOT add "브랜드 인트로", "현장 안전성 문제 제기" or any section name labels.`);
  p.push(`Do NOT add "HEADLINE ZONE", "BODY TEXT", font sizes, or any design annotation.`);
  p.push(`Do NOT include any English text unless it appears in the copy above.`);
  p.push(`The section name and number are for YOUR reference only — never render them in the image.`);
  p.push(``);

  // ── 4. 디자인 톤앤매너 ──
  p.push(`=== VISUAL STYLE ===`);
  if (brand.designTone) {
    p.push(`Design tone: "${brand.designTone}"`);
  }
  if (section.visualDirection) {
    p.push(`Visual direction: ${section.visualDirection}`);
  }
  p.push(`Style: Premium, clean, modern Korean e-commerce. Behance/Dribbble award quality.`);
  p.push(``);

  // ── 5. 컬러 ──
  if (brand.colorScheme) {
    const hexColors = brand.colorScheme.match(/#[0-9A-Fa-f]{6}/g) || [];
    if (hexColors.length > 0) {
      p.push(`=== COLORS ===`);
      p.push(`Use these brand colors: ${[...new Set(hexColors)].slice(0, 5).join(', ')}`);
      p.push(`Background: clean white (#FFFFFF or #FAFAFA)`);
      p.push(``);
    }
  }

  // ── 6. 레이아웃 구조 (구조만, 주석/레이블 없이) ──
  if (section.wireframeBlocks?.length) {
    p.push(`=== LAYOUT (arrange elements top to bottom) ===`);
    const skipTypes = ['wf-divider', 'wf-spacer'];
    let idx = 0;
    for (const block of section.wireframeBlocks) {
      if (skipTypes.includes(block.type)) continue;
      // 구조 레이블 디버그 로그
      if (block.text && isStructuralText(block.text)) {
        console.log(`[Nano Banana] Filtered structural text from wireframe: "${block.text}" (type: ${block.type})`);
      }
      idx++;
      const desc = describeLayoutElement(block, idx);
      if (desc) p.push(desc);
    }
    p.push(``);
  }

  // ── 7. 기획 의도 ──
  if (section.planningIntent || section.description) {
    p.push(`=== DESIGN CONTEXT ===`);
    if (section.planningIntent) p.push(`Purpose: ${section.planningIntent}`);
    if (section.description) p.push(`Goal: ${section.description}`);
    p.push(``);
  }

  // ── 8. 금지 사항 (매우 중요) ──
  p.push(`=== MUST NOT INCLUDE ===`);
  p.push(`- Any design annotations, labels, or wireframe markers (NO "HEADLINE ZONE", "BODY TEXT", "BRAND LOGO", etc.)`);
  p.push(`- Font size specs, padding numbers, or any technical measurements`);
  p.push(`- Section numbers like "섹션 1" or structural identifiers`);
  p.push(`- English placeholder text, lorem ipsum, or "sample" text`);
  p.push(`- Wireframe lines, dotted borders, or layout grids`);
  p.push(`- Watermarks or stock photo badges`);
  p.push(`- Any text not explicitly listed in the TEXT section above`);

  return p.join('\n');
}

// 와이어프레임 블록 → 자연어 레이아웃 설명 (구조 레이블 완전 제거, 디자인 요소만)
function describeLayoutElement(block: any, num: number): string {
  switch (block.type) {
    case 'wf-heading': {
      // 구조 레이블("섹션 1 브랜드 인트로" 등)이면 텍스트 제외
      const hasValidText = block.text && !isStructuralText(block.text);
      return `${num}. Large bold headline${hasValidText ? ` saying "${block.text}"` : ' (use the main headline from the TEXT section above)'}`;
    }
    case 'wf-text': {
      const hasValidText = block.text && !isStructuralText(block.text);
      return `${num}. Body paragraph${hasValidText ? ` saying "${block.text}"` : ''}`;
    }
    case 'wf-image':
      return `${num}. Product photo area${block.text && !isStructuralText(block.text) ? ` (${block.text})` : ''}, full-width, premium studio quality`;
    case 'wf-split':
      return `${num}. Two-column layout: image on one side, text on the other`;
    case 'wf-card-grid': {
      const items = block.items?.slice(0, 4).map((it: any) => typeof it === 'string' ? it : it.label || '').filter((s: string) => s && !isStructuralText(s));
      return `${num}. Grid of ${block.cols || 2} cards${items?.length ? `: ${items.join(', ')}` : ''}`;
    }
    case 'wf-icon-list': {
      const items = block.items?.slice(0, 4).map((it: any) => typeof it === 'string' ? it : it.label || '').filter((s: string) => s && !isStructuralText(s));
      return `${num}. Feature list with icons${items?.length ? `: ${items.join(', ')}` : ''}`;
    }
    case 'wf-stats':
    case 'wf-number-highlight': {
      const items = block.items?.slice(0, 4).map((it: any) => {
        if (typeof it === 'string') return it;
        return it.value ? `${it.value} ${it.label || ''}` : it.label || '';
      }).filter(Boolean);
      return `${num}. Big statistics numbers${items?.length ? `: ${items.join(', ')}` : ''}`;
    }
    case 'wf-button':
      return `${num}. CTA button${block.text && !isStructuralText(block.text) ? ` labeled "${block.text}"` : ''}`;
    case 'wf-badge-row': {
      const items = block.items?.slice(0, 6).map((it: any) => typeof it === 'string' ? it : it.label || '').filter((s: string) => s && !isStructuralText(s));
      return `${num}. Row of small badges${items?.length ? `: ${items.join(', ')}` : ''}`;
    }
    case 'wf-review-card':
    case 'wf-quote':
      return `${num}. Customer testimonial/review card${block.text && !isStructuralText(block.text) ? ` with quote "${block.text}"` : ''}`;
    case 'wf-table':
      return `${num}. Clean data table${block.headers?.length ? ` with columns: ${block.headers.join(', ')}` : ''}`;
    case 'wf-timeline': {
      const items = block.items?.slice(0, 4).map((it: any) => typeof it === 'string' ? it : it.label || '').filter(Boolean);
      return `${num}. Step-by-step process${items?.length ? `: ${items.join(' → ')}` : ''}`;
    }
    case 'wf-product-grid': {
      const items = block.items?.slice(0, 4).map((it: any) => typeof it === 'string' ? it : it.label || '').filter(Boolean);
      return `${num}. Product lineup grid${items?.length ? `: ${items.join(', ')}` : ''}`;
    }
    case 'wf-before-after':
      return `${num}. Before/After comparison${block.before ? `: "${block.before}" vs "${block.after}"` : ''}`;
    case 'wf-checklist': {
      const items = block.items?.slice(0, 4).map((it: any) => typeof it === 'string' ? it : it.label || '').filter(Boolean);
      return `${num}. Checklist with checkmarks${items?.length ? `: ${items.join(', ')}` : ''}`;
    }
    case 'wf-comparison-row':
      return `${num}. Comparison chart (our product vs competitors)`;
    case 'wf-trust-badges':
      return `${num}. Trust/certification badges row`;
    case 'wf-price':
      return `${num}. Price display${block.text ? ` (${block.text})` : ''}`;
    case 'wf-promo-badge':
      return `${num}. Promotional badge/sticker${block.text ? ` "${block.text}"` : ''}`;
    case 'wf-logo':
      return `${num}. Brand logo (small, clean)`;
    case 'wf-bar-chart':
      return `${num}. Chart/data visualization${block.text ? ` titled "${block.text}"` : ''}`;
    case 'wf-progress-bar':
      return `${num}. Progress bar${block.text ? ` for "${block.text}"` : ''}`;
    default:
      return (block.text && !isStructuralText(block.text)) ? `${num}. Content element: "${block.text}"` : '';
  }
}

// Legacy fallback: GenSpark 프롬프트만 있을 때
function buildDesignPreviewPromptFallback(genSparkPrompt: string): string {
  // 프롬프트가 너무 길면 핵심만 추출
  const condensed = genSparkPrompt
    .replace(/\n{2,}/g, '\n')
    .slice(0, 1500);

  return `Generate a premium Korean e-commerce product detail page design mockup image.
This must look like a REAL finished product page — NOT a wireframe or layout diagram.

Design brief:
${condensed}

CRITICAL RULES:
- This is a FINISHED DESIGN mockup, not a wireframe
- Do NOT include any English design annotations (no "HEADLINE ZONE", "BODY TEXT", "BRAND LOGO")
- Do NOT include font size specs, padding numbers, or technical measurements
- Do NOT include section numbers or structural identifiers
- Only show actual Korean content text that customers would see
- Premium, clean, modern Korean design aesthetic
- Behance/Dribbble award quality`;
}

// 피드백을 반영하여 프롬프트 수정 (구조적)
function applyFeedbackToPrompt(originalPrompt: string, feedback: string): string {
  return `${originalPrompt}

## REVISION REQUEST (CRITICAL — apply ALL changes below)

User Feedback:
"${feedback}"

Instructions:
1. Keep ALL existing design elements, layout, colors, and text UNCHANGED
2. Apply ONLY the specific changes described in the feedback above
3. The revision should look like the same design with targeted improvements
4. Maintain the same quality level and overall composition
5. Generate the REVISED version now`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imagePrompt, cutNum, directPrompt, sectionData, brandInfo, sectionNum, feedback, previousPrompt } = body;

    // feedback + previousPrompt: 수정사항 반영 재생성
    // sectionData: 원본 섹션 데이터 기반 디자인 미리보기 (최우선)
    // directPrompt: 레거시 GenSpark 프롬프트 기반 (fallback)
    // imagePrompt: 촬영콘티 컷별 이미지 생성용
    if (!imagePrompt?.subject && !directPrompt && !sectionData && !feedback) {
      return NextResponse.json({ error: 'imagePrompt, sectionData, directPrompt, or feedback required' }, { status: 400 });
    }

    const apiKey = loadGeminiKey();
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-image-preview',
      generationConfig: {
        // @ts-ignore — image generation config
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // 프롬프트 결정: 피드백 재생성 > sectionData > directPrompt > imagePrompt
    let prompt: string;
    if (feedback && previousPrompt) {
      prompt = applyFeedbackToPrompt(previousPrompt, feedback);
    } else if (sectionData) {
      // 원본 섹션 데이터에서 직접 깨끗한 프롬프트 생성
      prompt = buildDesignFromSectionData(sectionData, brandInfo || {});
    } else if (directPrompt) {
      prompt = buildDesignPreviewPromptFallback(directPrompt);
    } else {
      prompt = buildNanaBananaPrompt(imagePrompt);
    }

    const label = feedback ? 'Revision' : (sectionData || directPrompt) ? `Section ${sectionNum || '?'}` : `Cut ${cutNum || '?'}`;
    console.log(`[Nano Banana] ${label} — Generating image...`);
    console.log(`[Nano Banana] Prompt length: ${prompt.length} chars`);

    const result = await model.generateContent(prompt);
    const response = result.response;

    // 응답에서 이미지 파트 추출
    let imageBase64 = '';
    let imageMimeType = '';
    let textResponse = '';

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          imageMimeType = part.inlineData.mimeType || 'image/png';
        }
        if (part.text) {
          textResponse = part.text;
        }
      }
    }

    if (!imageBase64) {
      return NextResponse.json({
        success: false,
        error: 'No image generated',
        textResponse,
        prompt,
      }, { status: 422 });
    }

    // base64 이미지를 data URL로 반환
    const dataUrl = `data:${imageMimeType};base64,${imageBase64}`;

    return NextResponse.json({
      success: true,
      cutNum,
      imageUrl: dataUrl,
      mimeType: imageMimeType,
      prompt,
      textResponse,
    });

  } catch (err: any) {
    console.error('[Nano Banana] Error:', err.message);
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
