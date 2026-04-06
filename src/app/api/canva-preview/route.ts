import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/canva-preview
 *
 * 기획안 섹션 데이터를 받아 GenSpark AI Designer 최적화 프롬프트를 생성합니다.
 * 젠스파크에 바로 붙여넣을 수 있는 고도화된 프롬프트.
 */

const canvaResults = new Map<string, any[]>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'save-results') {
      canvaResults.set(`${body.projectId}`, body.results || []);
      return NextResponse.json({ success: true });
    }
    if (body.action === 'get-results') {
      return NextResponse.json({ results: canvaResults.get(`${body.projectId}`) || [] });
    }

    const { brandName, productName, designTone, colorScheme, overallNote, section, totalSections, batchIndex, batchSections } = body;

    if (!section) {
      return NextResponse.json({ error: 'section data required' }, { status: 400 });
    }

    const prompt = buildGenSparkPrompt({
      brandName, productName, designTone, colorScheme, overallNote,
      section, totalSections, batchIndex, batchSections,
    });

    return NextResponse.json({
      sectionNum: section.num,
      sectionName: section.name,
      canvaPrompt: prompt,
      designType: 'product-detail-page',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ results: [] });
  return NextResponse.json({ results: canvaResults.get(projectId) || [] });
}

/* ================================================================
 *  GenSpark AI Designer 최적화 프롬프트 빌더 v4
 *
 *  젠스파크 AI 특성:
 *  - 자연어 디자인 브리프 → 전문 디자인 목업 생성
 *  - Mixture-of-Agents: 복합 에이전트가 최적 모델 자동 선택
 *  - 브랜드 에코시스템 생성 가능 (일관된 비주얼 시스템)
 *  - 구체적 + 서술적 프롬프트일수록 퀄리티 상승
 *  - 네거티브 프롬프트 지원 (제외 요소 명시)
 *  - 종횡비/포맷 지정 가능
 * ================================================================ */

interface PromptInput {
  brandName: string;
  productName?: string;
  designTone?: string;
  colorScheme?: string;
  overallNote?: string;
  totalSections?: number;
  batchIndex?: number;
  batchSections?: string[];
  section: {
    num: number;
    name: string;
    mainCopy?: string;
    subCopy?: string;
    description?: string;
    planningIntent?: string;
    aeCommentary?: string;
    visualDirection?: string;
    layout?: string;
    referenceImageUrl?: string;
    referenceNote?: string;
    wireframeBlocks?: any[];
    copyBlocks?: any[];
  };
}

function buildGenSparkPrompt(input: PromptInput): string {
  const { brandName, productName, designTone, colorScheme, overallNote, section, totalSections, batchIndex, batchSections } = input;
  const p: string[] = [];
  const product = productName && productName !== brandName ? `${brandName} ${productName}` : brandName;
  const isFirstSection = (batchIndex ?? 0) === 0;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. 핵심 요청 (GenSpark는 첫 문장이 가장 중요)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  p.push(`Design a premium Korean e-commerce product detail page (상세페이지) section — a vertical mobile-first infographic layout for "${product}".`);
  p.push('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. 세트 일관성 (3섹션이 하나의 브랜드처럼)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (batchSections?.length) {
    p.push(`[DESIGN SET — ${batchSections.length} COHESIVE SECTIONS]`);
    p.push(`This is Section ${(batchIndex ?? 0) + 1} of ${batchSections.length}: "${section.name}"`);
    p.push(`Full set: ${batchSections.map((n, i) => `(${i + 1}) ${n}`).join(' → ')}`);
    p.push('');
    p.push(`BRAND CONSISTENCY (mandatory across all ${batchSections.length} sections):`);
    p.push(`• Identical font family — one premium sans-serif throughout (Pretendard, Noto Sans KR, or similar modern Korean font)`);
    p.push(`• Identical color system — same primary, secondary, accent HEX values`);
    p.push(`• Identical background — same base color/texture across all sections`);
    p.push(`• Identical spacing rhythm — same padding (24-32px sides), same gaps between elements`);
    p.push(`• Identical graphic style — if flat icons in Section 1, flat icons everywhere`);
    p.push(`• Identical heading hierarchy — same weight/size/color for H1, H2, body, captions`);
    if (!isFirstSection) {
      p.push(`• This section should feel like a natural scroll-down continuation of the previous section`);
    }
    p.push('');
  } else {
    p.push(`Section ${section.num}${totalSections ? ` of ${totalSections}` : ''}: "${section.name}"`);
    p.push('');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 브랜드 디자인 시스템
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  p.push(`[BRAND DESIGN SYSTEM]`);
  p.push('');

  // 톤앤매너
  p.push(`Mood & Atmosphere:`);
  if (designTone) {
    p.push(`"${designTone}" — This defines the entire visual personality.`);
  }
  p.push(`Think: premium Korean 상세페이지 meets luxury editorial. Clean, confident, trustworthy.`);
  if (section.visualDirection) {
    p.push(`This section specifically: ${section.visualDirection}`);
  }
  p.push('');

  // 컬러 시스템 (HEX 추출 + 용도 지정)
  p.push(`Color Palette:`);
  if (colorScheme) {
    const hexMatches = colorScheme.match(/#[0-9A-Fa-f]{6}/g);
    if (hexMatches?.length) {
      const roles = ['Primary (headlines, CTA, key accents)', 'Secondary (sub-elements, section backgrounds, borders)', 'Accent (stat numbers, badges, highlights)', 'Supporting', 'Supporting'];
      hexMatches.forEach((hex, i) => {
        p.push(`• ${hex} — ${roles[i] || 'Additional'}`);
      });
    }
    const nonHex = colorScheme.replace(/#[0-9A-Fa-f]{6}/g, '').trim();
    if (nonHex) p.push(`• Color note: ${nonHex}`);
  }
  p.push(`• Background base: Clean white (#FFFFFF) or off-white (#FAFAFA)`);
  p.push(`• Text: Dark (#1A1A1A) for headlines, Medium (#444444) for body, Light (#888888) for captions`);
  p.push('');

  // 타이포 시스템
  p.push(`Typography Hierarchy:`);
  p.push(`• H1 (Main headline): Bold 700, 28-36px equivalent, primary color or #1A1A1A`);
  p.push(`• H2 (Sub headline): Semi-bold 600, 20-24px, #333333`);
  p.push(`• Body: Regular 400, 14-16px, #444444, line-height 1.7`);
  p.push(`• Caption/Label: Light 300, 11-13px, #888888, uppercase or small-caps for labels`);
  p.push(`• Stat numbers: Extra-bold 800, 40-56px, accent or primary color`);
  p.push(`• All Korean text must be crisp and highly legible.`);
  p.push('');

  // 레이아웃 시스템
  p.push(`Layout Rules:`);
  p.push(`• Format: Vertical infographic, 9:16 aspect ratio (mobile product detail page)`);
  p.push(`• Side padding: 24-32px consistent`);
  p.push(`• Section gap: 48-64px between major blocks`);
  p.push(`• Element gap: 16-24px between related items`);
  p.push(`• Center-align headlines, left-align body text`);
  p.push(`• Generous white space — let the design breathe`);
  if (overallNote) {
    p.push(`• Note: ${overallNote}`);
  }
  if (section.referenceNote) {
    p.push(`• Reference style: ${section.referenceNote}`);
  }
  p.push('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 텍스트 콘텐츠 (정확한 한국어 문구)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  p.push(`[TEXT CONTENT — use exactly as written, in Korean]`);
  p.push('');

  if (section.mainCopy) {
    p.push(`★ MAIN HEADLINE (largest, most impactful text on the page):`);
    p.push(`"${section.mainCopy}"`);
    p.push('');
  }

  if (section.subCopy) {
    p.push(`★ SUB HEADLINE (second-level, supporting the main message):`);
    p.push(`"${section.subCopy}"`);
    p.push('');
  }

  // copyBlocks를 의미 그룹으로 분류
  if (section.copyBlocks?.length) {
    const visible = section.copyBlocks.filter(
      (b: any) => !['ae-comment', 'layout-tag', 'visual-direction', 'divider'].includes(b.type)
    );

    const headings = visible.filter((b: any) => ['section-title', 'heading', 'copy-main'].includes(b.type));
    const bodies = visible.filter((b: any) => ['text', 'copy-sub', 'note'].includes(b.type));
    const kvPairs = visible.filter((b: any) => ['kv-pair', 'label'].includes(b.type));
    const lists = visible.filter((b: any) => b.type === 'list');
    const promos = visible.filter((b: any) => ['promo-box', 'info-box'].includes(b.type));

    if (headings.length) {
      p.push(`Section Headings:`);
      headings.forEach((b: any) => {
        if (b.text) p.push(`• "${b.text}"${b.desc ? ` — ${b.desc}` : ''}`);
      });
      p.push('');
    }

    if (bodies.length) {
      p.push(`Body Text / Descriptions:`);
      bodies.forEach((b: any) => {
        if (b.text) p.push(`• "${b.text}"`);
      });
      p.push('');
    }

    if (kvPairs.length) {
      p.push(`Key Data Points (display as prominent stats or info pairs):`);
      kvPairs.forEach((b: any) => {
        if (b.label && b.value) {
          p.push(`• ${b.label}: ${b.value}`);
        } else if (b.text) {
          p.push(`• "${b.text}"`);
        }
      });
      p.push('');
    }

    if (lists.length) {
      lists.forEach((b: any) => {
        if (b.items?.length) {
          p.push(`Feature List (display with icons or checkmarks):`);
          b.items.forEach((item: string) => p.push(`• ${item}`));
          p.push('');
        }
      });
    }

    if (promos.length) {
      p.push(`Highlight / Promotional Elements:`);
      promos.forEach((b: any) => {
        if (b.text) p.push(`• "${b.text}"${b.desc ? ` — ${b.desc}` : ''}`);
      });
      p.push('');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. 레이아웃 구조 (디자인 요소별 서술)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (section.wireframeBlocks?.length) {
    p.push(`[LAYOUT STRUCTURE — arrange top to bottom]`);
    if (section.layout) {
      p.push(`Layout style: ${section.layout}`);
    }
    p.push('');

    for (let i = 0; i < section.wireframeBlocks.length; i++) {
      const desc = describeDesignElement(section.wireframeBlocks[i], i + 1);
      if (desc) {
        p.push(desc);
        p.push('');
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. 디자인 맥락 (기획 의도)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (section.planningIntent || section.description) {
    p.push(`[DESIGN CONTEXT]`);
    if (section.planningIntent) p.push(`• Purpose: ${section.planningIntent}`);
    if (section.description) p.push(`• Goal: ${section.description}`);
    p.push('');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. 품질 지시 + 네거티브 프롬프트
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  p.push(`[QUALITY REQUIREMENTS]`);
  p.push(`• Professional, publication-ready quality. This will be shown to real clients.`);
  p.push(`• Use ONLY the Korean text provided above — do not add, translate, or modify any text.`);
  p.push(`• Product photography or lifestyle imagery should feel authentic and premium.`);
  p.push(`• Strong visual hierarchy — the eye should flow naturally from headline → visual → details.`);
  p.push(`• High contrast between text and background for perfect readability.`);
  p.push(`• Modern, minimalist Korean design aesthetic — not busy, not cluttered.`);
  p.push('');

  p.push(`[EXCLUSIONS — do NOT include]`);
  p.push(`• No placeholder text, lorem ipsum, or "sample" text`);
  p.push(`• No English text unless it appears in the provided copy`);
  p.push(`• No watermarks or stock photo badges`);
  p.push(`• No overly decorative fonts or handwriting fonts`);
  p.push(`• No busy patterns or textures that reduce text readability`);
  p.push(`• No low-resolution or pixelated imagery`);
  p.push(`• No generic clip-art or cartoon-style illustrations (unless brand tone requires it)`);

  return p.join('\n');
}

/* ━━━━ 와이어프레임 블록을 GenSpark 디자인 요소 서술로 변환 ━━━━ */
function describeDesignElement(block: any, num: number): string {
  const lines: string[] = [];

  switch (block.type) {
    case 'wf-heading':
      lines.push(`${num}. HEADLINE ZONE`);
      if (block.text) lines.push(`   Text: "${block.text}"`);
      lines.push(`   → Large, bold, commanding. This is the visual anchor of this area.`);
      break;

    case 'wf-text':
      lines.push(`${num}. BODY TEXT`);
      if (block.text) lines.push(`   Text: "${block.text}"`);
      lines.push(`   → Clean paragraph with comfortable reading line-height. Left-aligned.`);
      break;

    case 'wf-image':
      lines.push(`${num}. HERO IMAGE / PRODUCT VISUAL`);
      if (block.text) lines.push(`   Description: ${block.text}`);
      lines.push(`   → Premium product photography area.${block.height ? ` ~${block.height}px tall.` : ' Full-width, prominent.'} Clean, studio-quality feel.`);
      break;

    case 'wf-split':
      lines.push(`${num}. SPLIT LAYOUT (Two Columns)`);
      if (block.text) lines.push(`   Content: "${block.text}"`);
      lines.push(`   → Left: product image or visual. Right: text content. Balanced 50/50 split with clear gutter.`);
      break;

    case 'wf-card-grid': {
      const cols = block.cols || 2;
      lines.push(`${num}. CARD GRID (${cols} columns)`);
      if (block.items?.length) {
        lines.push(`   Cards:`);
        block.items.slice(0, 8).forEach((item: any, i: number) => {
          const label = typeof item === 'string' ? item : item.label || '';
          const desc = typeof item === 'object' ? item.desc || '' : '';
          lines.push(`   • Card ${i + 1}: "${label}"${desc ? ` — ${desc}` : ''}`);
        });
      }
      lines.push(`   → Each card: icon/illustration on top, bold title, small description. Rounded corners (8-12px), subtle shadow or border.`);
      break;
    }

    case 'wf-icon-list':
      lines.push(`${num}. FEATURE LIST (Icons + Text)`);
      if (block.items?.length) {
        block.items.slice(0, 6).forEach((item: any) => {
          const label = typeof item === 'string' ? item : item.label || '';
          const desc = typeof item === 'object' ? item.desc || '' : '';
          lines.push(`   • "${label}"${desc ? `: ${desc}` : ''}`);
        });
      }
      lines.push(`   → Vertical list. Each row: small icon (left) + title + description (right). Clean spacing between rows.`);
      break;

    case 'wf-stats':
    case 'wf-number-highlight':
      lines.push(`${num}. KEY STATISTICS / BIG NUMBERS`);
      if (block.items?.length) {
        block.items.slice(0, 4).forEach((item: any) => {
          const label = typeof item === 'string' ? item : item.label || '';
          const value = typeof item === 'object' ? item.value || '' : '';
          lines.push(`   • ${value ? `${value} — ` : ''}${label}`);
        });
      }
      if (block.text) lines.push(`   Title: "${block.text}"`);
      lines.push(`   → Numbers displayed EXTRA LARGE (40-56px) in accent color. Small label below each. Arrange in a horizontal row with dividers.`);
      break;

    case 'wf-button':
      lines.push(`${num}. CTA BUTTON`);
      if (block.text) lines.push(`   Label: "${block.text}"`);
      lines.push(`   → Rounded pill button, primary brand color, white text, centered. Add subtle shadow for depth.`);
      break;

    case 'wf-badge-row':
      lines.push(`${num}. BADGE ROW`);
      if (block.items?.length) {
        const labels = block.items.slice(0, 6).map((item: any) => typeof item === 'string' ? item : item.label || '');
        lines.push(`   Badges: ${labels.join(' | ')}`);
      }
      lines.push(`   → Small circular or rounded-rect badges in a horizontal line. Subtle background, thin border.`);
      break;

    case 'wf-review-card':
    case 'wf-quote':
      lines.push(`${num}. TESTIMONIAL / REVIEW CARD`);
      if (block.text) lines.push(`   Quote: "${block.text}"`);
      lines.push(`   → Large quote marks, review text, star rating, reviewer name. Soft background card, rounded corners.`);
      break;

    case 'wf-table':
      lines.push(`${num}. DATA TABLE`);
      if (block.headers?.length) lines.push(`   Columns: ${block.headers.join(' | ')}`);
      if (block.rows?.length) lines.push(`   ${block.rows.length} rows of data`);
      lines.push(`   → Clean table with alternating row colors. Bold header row. Easy to scan vertically.`);
      break;

    case 'wf-bar-chart':
      lines.push(`${num}. CHART / DATA VIZ`);
      if (block.text) lines.push(`   Title: "${block.text}"`);
      lines.push(`   → Horizontal or vertical bar chart with brand colors. Clear labels and values.`);
      break;

    case 'wf-timeline':
      lines.push(`${num}. STEP-BY-STEP PROCESS`);
      if (block.items?.length) {
        block.items.slice(0, 6).forEach((item: any, i: number) => {
          const label = typeof item === 'string' ? item : item.label || '';
          lines.push(`   Step ${i + 1}: "${label}"`);
        });
      }
      lines.push(`   → Numbered steps with connecting line/dots. Each step: circle number + title + brief desc. Vertical or zigzag layout.`);
      break;

    case 'wf-product-grid': {
      const cols = block.cols || 3;
      lines.push(`${num}. PRODUCT LINEUP (${cols}-column grid)`);
      if (block.items?.length) {
        block.items.slice(0, 6).forEach((item: any) => {
          const label = typeof item === 'string' ? item : item.label || '';
          lines.push(`   • "${label}"`);
        });
      }
      lines.push(`   → Product image centered in each cell, name below. Clean grid, consistent card sizing.`);
      break;
    }

    case 'wf-before-after':
      lines.push(`${num}. BEFORE & AFTER`);
      if (block.before) lines.push(`   Before: "${block.before}"`);
      if (block.after) lines.push(`   After: "${block.after}"`);
      lines.push(`   → Side-by-side split with clear "Before" / "After" labels. Dramatic contrast between the two sides.`);
      break;

    case 'wf-checklist':
      lines.push(`${num}. CHECKLIST`);
      if (block.items?.length) {
        block.items.slice(0, 8).forEach((item: any) => {
          const label = typeof item === 'string' ? item : item.label || '';
          lines.push(`   ✓ "${label}"`);
        });
      }
      lines.push(`   → Green checkmark icons aligned left, text on right. Clean vertical list with consistent spacing.`);
      break;

    case 'wf-comparison-row':
      lines.push(`${num}. COMPARISON (Ours vs Competitors)`);
      if (block.text) lines.push(`   Title: "${block.text}"`);
      lines.push(`   → Two columns: "Ours" highlighted in primary color (positive), "Others" in gray (negative). Clear visual winner.`);
      break;

    case 'wf-trust-badges':
      lines.push(`${num}. TRUST / CERTIFICATION BADGES`);
      lines.push(`   → Row of official certification icons. Monochrome or brand-colored. Professional, credible look.`);
      break;

    case 'wf-price':
      lines.push(`${num}. PRICING`);
      if (block.text) lines.push(`   Info: "${block.text}"`);
      lines.push(`   → Large current price in primary color. Strikethrough original price if discounted. Savings callout in accent color.`);
      break;

    case 'wf-promo-badge':
      lines.push(`${num}. PROMO BADGE / STICKER`);
      if (block.text) lines.push(`   Text: "${block.text}"`);
      lines.push(`   → Eye-catching badge, slight rotation, accent color background with white text. "Limited" feel.`);
      break;

    case 'wf-logo':
      lines.push(`${num}. BRAND LOGO`);
      lines.push(`   → Clean logo placement with generous breathing room. Centered or top-aligned.`);
      break;

    case 'wf-progress-bar':
      lines.push(`${num}. PROGRESS BAR`);
      if (block.text) lines.push(`   Label: "${block.text}"`);
      lines.push(`   → Horizontal bar with percentage fill in primary/accent color. Label + value above.`);
      break;

    case 'wf-divider':
    case 'wf-spacer':
      return '';

    default:
      if (block.text) {
        lines.push(`${num}. CONTENT ELEMENT`);
        lines.push(`   Content: "${block.text}"`);
        lines.push(`   → Display cleanly with appropriate styling.`);
      }
      break;
  }

  return lines.join('\n');
}
