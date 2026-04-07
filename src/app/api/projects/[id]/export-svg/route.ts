import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStepData, getProject, getProjectImages } from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/projects/[id]/export-svg?step=3
 * 기획안/브리프를 Figma 호환 SVG 파일로 내보내기
 * 레퍼런스 이미지와 나노바나나 디자인 이미지를 base64로 임베딩
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const step = parseInt(req.nextUrl.searchParams.get('step') || '3');

  // 기획안 데이터 로드 (V2: step 3 우선, fallback to old step 4/5)
  let data: any = null;
  for (const tryStep of [3, 4, 5, step]) {
    const sd = getStepData(projectId, tryStep);
    if (sd?.form_data) {
      const parsed = JSON.parse(sd.form_data);
      const hasBlocks = parsed.sections?.some((s: any) => s.copyBlocks?.length > 0);
      if (!data || hasBlocks) {
        data = parsed;
        if (hasBlocks) break;
      }
    }
  }

  if (!data?.sections?.length) {
    return NextResponse.json({ error: '기획안 데이터가 없습니다.' }, { status: 404 });
  }

  const project = getProject(projectId);
  const brandName = data.brandName || project?.client_name || project?.title || 'Brand';

  // 나노바나나 생성 이미지 로드 (generated_images 테이블)
  let nanoBananaImages: Record<number, string> = {};
  try {
    const allImages = getProjectImages(projectId);
    for (const img of allImages) {
      // imageKey 형식: "section-1", "section-2" 등
      const match = (img as any).image_key?.match(/section-(\d+)/);
      if (match && (img as any).image_data) {
        nanoBananaImages[parseInt(match[1])] = (img as any).image_data;
      }
    }
    console.log(`[Export SVG] Found ${Object.keys(nanoBananaImages).length} nano-banana images`);
  } catch (e) {
    console.error('[Export SVG] Error loading nano-banana images:', e);
  }

  // 레퍼런스 이미지 base64 변환 + 나노바나나 이미지 매칭
  for (const sec of data.sections) {
    const sectionNum = sec.num || (data.sections.indexOf(sec) + 1);

    // 레퍼런스 이미지
    if (sec.referenceImageUrl) {
      sec.referenceImageBase64 = await resolveImageToBase64(sec.referenceImageUrl);
    }

    // 나노바나나 디자인 프리뷰 이미지
    if (nanoBananaImages[sectionNum]) {
      sec.designPreviewBase64 = nanoBananaImages[sectionNum];
    } else if (sec.designPreviewUrl) {
      if (sec.designPreviewUrl.startsWith('data:')) {
        sec.designPreviewBase64 = sec.designPreviewUrl;
      } else {
        sec.designPreviewBase64 = await resolveImageToBase64(sec.designPreviewUrl);
      }
    }
  }

  const hasRef = data.sections.some((s: any) => s.referenceImageBase64 || s.designPreviewBase64);

  const svg = generatePlanSvg(data.sections, brandName, hasRef, project?.title || '프로젝트');

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(project?.title || '기획안')}_plan.svg"`,
    },
  });
}

/**
 * 이미지 URL을 base64 data URI로 변환
 * - /api/uploads/xxx → uploads 폴더에서 직접 읽기
 * - http://localhost → 서버에서 직접 파일 읽기
 * - data:xxx → 그대로 반환
 */
async function resolveImageToBase64(url: string): Promise<string | null> {
  try {
    // 이미 data URL
    if (url.startsWith('data:')) return url;

    // /api/uploads/filename 형식
    const uploadsMatch = url.match(/\/api\/uploads\/(.+)$/);
    if (uploadsMatch) {
      const filename = decodeURIComponent(uploadsMatch[1]);
      const filePath = path.join(process.cwd(), 'uploads', filename);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        };
        const mime = mimeMap[ext] || 'image/png';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      }
    }

    // localhost URL → uploads 폴더에서 파일명 추출
    const localhostMatch = url.match(/localhost:\d+\/api\/uploads\/(.+)$/);
    if (localhostMatch) {
      const filename = decodeURIComponent(localhostMatch[1]);
      const filePath = path.join(process.cwd(), 'uploads', filename);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      }
    }

    // 외부 URL → fetch
    if (url.startsWith('http')) {
      const res = await fetch(url);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') || 'image/png';
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      }
    }

    return null;
  } catch (e) {
    console.error('[Export SVG] Image resolve error:', url, e);
    return null;
  }
}

// ===================================================================
//  SVG 기획안 생성기 — Figma Import 최적화
// ===================================================================

const COL1 = 360;
const COL2 = 480;
const COL3 = 380;
const GAP = 1;
const PHONE_W = 260;
const PHONE_PAD = 12;
const SECTION_PAD = 16;
const HEADER_H = 36;

const C = {
  white: '#FFFFFF',
  bg: '#F5F5F5',
  black: '#1A1A1A',
  dark: '#333333',
  body: '#444444',
  gray: '#888888',
  lightGray: '#BBBBBB',
  border: '#CCCCCC',
  sectionTitle: '#CC0000',
  headerBg: '#E8E8E8',
  wfGray: '#D9D9D9',
  wfDark: '#B0B0B0',
  wfLight: '#EEEEEE',
  wfText: '#999999',
  wfAccent: '#C0C0C0',
  blue: '#2563EB',
  promoBg: '#FEF3C7',
  promoText: '#92400E',
};

const F = {
  title: 16,
  h1: 14,
  h2: 13,
  body: 11,
  sm: 10,
  xs: 9,
  wf: 8,
  wfSm: 7,
};

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generatePlanSvg(sections: any[], brandName: string, hasRef: boolean, projectTitle: string): string {
  const totalW = hasRef ? COL1 + COL2 + COL3 + 2 : COL1 + COL2 + 1;

  // 각 섹션 높이를 사전 계산
  const sectionHeights: number[] = [];
  for (const sec of sections) {
    const copyH = estimateCopyHeight(sec);
    const wfH = estimateWfHeight(sec);
    const refH = hasRef ? estimateRefHeight(sec) : 0;
    sectionHeights.push(Math.max(copyH, wfH, refH) + HEADER_H + SECTION_PAD * 2);
  }

  // 타이틀 영역
  const titleH = 80;
  const colHeaderH = 32;
  const totalH = titleH + colHeaderH + sectionHeights.reduce((a, b) => a + b, 0) + 20;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
<defs>
  <style>
    text { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .title { font-size: ${F.title}px; font-weight: 700; fill: ${C.black}; }
    .subtitle { font-size: ${F.sm}px; fill: ${C.gray}; }
    .section-title { font-size: ${F.h2}px; font-weight: 700; fill: ${C.sectionTitle}; }
    .heading { font-size: ${F.h1}px; font-weight: 700; fill: ${C.black}; }
    .body-text { font-size: ${F.body}px; fill: ${C.body}; }
    .label { font-size: ${F.sm}px; font-weight: 700; fill: ${C.blue}; }
    .copy-main { font-size: ${F.body}px; font-weight: 700; fill: ${C.black}; }
    .copy-sub { font-size: ${F.body}px; fill: ${C.body}; }
    .ae-comment { font-size: ${F.sm}px; font-weight: 700; fill: ${C.sectionTitle}; }
    .visual-dir { font-size: ${F.sm}px; fill: ${C.gray}; font-style: italic; }
    .layout-tag { font-size: ${F.sm}px; fill: ${C.blue}; }
    .note { font-size: ${F.xs}px; fill: ${C.gray}; font-style: italic; }
    .col-header { font-size: ${F.sm}px; font-weight: 700; fill: ${C.dark}; }
    .wf-heading { font-size: ${F.wf + 1}px; font-weight: 700; fill: ${C.wfText}; }
    .wf-text { font-size: ${F.wf}px; fill: ${C.wfText}; }
    .wf-small { font-size: ${F.wfSm}px; fill: ${C.wfDark}; }
    .wf-label { font-size: ${F.wfSm}px; font-weight: 700; fill: ${C.wfText}; }
  </style>
</defs>
`;

  // 배경
  svg += `<rect width="${totalW}" height="${totalH}" fill="${C.white}"/>`;

  // === 타이틀 ===
  svg += `<g id="title">`;
  svg += `<rect x="0" y="0" width="${totalW}" height="${titleH}" fill="${C.bg}"/>`;
  svg += `<text x="24" y="32" class="title">${esc(projectTitle)} 기획안</text>`;
  svg += `<text x="24" y="52" class="subtitle">${esc(brandName)} · ${sections.length}섹션 · DIOPT AI</text>`;
  svg += `<text x="24" y="68" class="subtitle">${new Date().toLocaleDateString('ko-KR')}</text>`;
  svg += `</g>`;

  let y = titleH;

  // === 컬럼 헤더 ===
  svg += `<g id="col-headers">`;
  svg += `<rect x="0" y="${y}" width="${totalW}" height="${colHeaderH}" fill="${C.headerBg}"/>`;
  svg += `<line x1="0" y1="${y}" x2="${totalW}" y2="${y}" stroke="${C.border}" stroke-width="1"/>`;
  svg += `<text x="${COL1 / 2}" y="${y + 20}" text-anchor="middle" class="col-header">문구</text>`;
  svg += `<line x1="${COL1}" y1="${y}" x2="${COL1}" y2="${y + colHeaderH}" stroke="${C.border}" stroke-width="1"/>`;
  svg += `<text x="${COL1 + COL2 / 2}" y="${y + 20}" text-anchor="middle" class="col-header">디자인 구조</text>`;
  if (hasRef) {
    svg += `<line x1="${COL1 + COL2}" y1="${y}" x2="${COL1 + COL2}" y2="${y + colHeaderH}" stroke="${C.border}" stroke-width="1"/>`;
    svg += `<text x="${COL1 + COL2 + COL3 / 2}" y="${y + 20}" text-anchor="middle" class="col-header">레퍼런스 디자인</text>`;
  }
  svg += `<line x1="0" y1="${y + colHeaderH}" x2="${totalW}" y2="${y + colHeaderH}" stroke="${C.border}" stroke-width="1"/>`;
  svg += `</g>`;
  y += colHeaderH;

  // === 각 섹션 ===
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const secH = sectionHeights[i];
    const sectionNum = sec.num || i + 1;

    svg += `<g id="section-${sectionNum}">`;

    // 섹션 배경 & 테두리
    svg += `<rect x="0" y="${y}" width="${totalW}" height="${secH}" fill="${C.white}"/>`;
    svg += `<line x1="0" y1="${y + secH}" x2="${totalW}" y2="${y + secH}" stroke="${C.border}" stroke-width="1"/>`;

    // 섹션 헤더
    svg += `<rect x="0" y="${y}" width="${totalW}" height="${HEADER_H}" fill="${C.bg}"/>`;
    svg += `<text x="12" y="${y + 22}" class="section-title">섹션 ${sectionNum}  ${esc(sec.name || '')}</text>`;

    // 컬럼 구분선
    svg += `<line x1="${COL1}" y1="${y}" x2="${COL1}" y2="${y + secH}" stroke="${C.border}" stroke-width="1"/>`;
    if (hasRef) {
      svg += `<line x1="${COL1 + COL2}" y1="${y}" x2="${COL1 + COL2}" y2="${y + secH}" stroke="${C.border}" stroke-width="1"/>`;
    }

    const contentY = y + HEADER_H + SECTION_PAD;

    // COL1: 문구
    svg += renderCopyColumn(sec, 12, contentY, COL1 - 24);

    // COL2: 와이어프레임
    const wfX = COL1 + (COL2 - PHONE_W) / 2;
    svg += renderWireframeColumn(sec, wfX, contentY, brandName);

    // COL3: 레퍼런스 (있을 때)
    if (hasRef) {
      svg += renderReferenceColumn(sec, COL1 + COL2 + 12, contentY, COL3 - 24);
    }

    svg += `</g>`;
    y += secH;
  }

  svg += `</svg>`;
  return svg;
}

// ===== 문구 컬럼 렌더링 =====
function renderCopyColumn(sec: any, x: number, startY: number, maxW: number): string {
  let svg = '';
  let cy = startY;

  const copyBlocks = sec.copyBlocks?.length ? sec.copyBlocks : buildFallbackCopyBlocks(sec);

  for (const block of copyBlocks) {
    switch (block.type) {
      case 'section-title':
        svg += `<text x="${x}" y="${cy + 12}" class="section-title">${esc(block.text || '')}</text>`;
        cy += 22;
        break;
      case 'heading':
        svg += `<text x="${x}" y="${cy + 12}" class="heading">${esc(block.text || '')}</text>`;
        cy += 22;
        break;
      case 'label':
        svg += `<text x="${x}" y="${cy + 10}" class="label">${esc(block.text || '')}</text>`;
        cy += 18;
        break;
      case 'copy-main':
        svg += wrapText(block.text || '', x, cy, maxW, 'copy-main', F.body + 3);
        cy += Math.ceil(((block.text || '').length * F.body * 0.55) / maxW + 1) * (F.body + 3) + 4;
        break;
      case 'copy-sub':
        svg += wrapText(block.text || '', x, cy, maxW, 'copy-sub', F.body + 2);
        cy += Math.ceil(((block.text || '').length * F.body * 0.55) / maxW + 1) * (F.body + 2) + 4;
        break;
      case 'text':
        svg += wrapText(block.text || '', x, cy, maxW, 'body-text', F.body + 2);
        cy += Math.ceil(((block.text || '').length * F.body * 0.55) / maxW + 1) * (F.body + 2) + 4;
        break;
      case 'visual-direction':
        svg += `<text x="${x}" y="${cy + 10}" class="visual-dir">${esc(block.text || '')}</text>`;
        cy += 16;
        break;
      case 'layout-tag':
        svg += `<text x="${x}" y="${cy + 10}" class="layout-tag">${esc(block.text || '')}</text>`;
        cy += 16;
        break;
      case 'ae-comment':
        svg += `<text x="${x}" y="${cy + 10}" class="ae-comment">**AE</text>`;
        cy += 14;
        svg += wrapText(block.text || '', x, cy, maxW, 'ae-comment', F.sm + 2);
        cy += Math.ceil(((block.text || '').length * F.sm * 0.55) / maxW + 1) * (F.sm + 2) + 4;
        break;
      case 'note':
        svg += `<text x="${x}" y="${cy + 9}" class="note">${esc(block.text || '')}</text>`;
        cy += 14;
        break;
      case 'image-placeholder':
        svg += `<rect x="${x}" y="${cy}" width="${maxW}" height="40" rx="4" fill="${C.bg}" stroke="${C.border}" stroke-width="0.5" stroke-dasharray="4 2"/>`;
        svg += `<text x="${x + maxW / 2}" y="${cy + 24}" text-anchor="middle" class="note">${esc(block.text || '[이미지 영역]')}</text>`;
        cy += 48;
        break;
      case 'info-box':
        svg += `<rect x="${x}" y="${cy}" width="${maxW}" height="36" rx="4" fill="#EFF6FF" stroke="#D1D5DB" stroke-width="0.5"/>`;
        if (block.label) {
          svg += `<text x="${x + 8}" y="${cy + 14}" class="label" style="font-size:${F.xs}px">${esc(block.label)}</text>`;
          svg += `<text x="${x + 8}" y="${cy + 28}" class="body-text">${esc(block.text || '')}</text>`;
        } else {
          svg += `<text x="${x + 8}" y="${cy + 22}" class="body-text">${esc(block.text || '')}</text>`;
        }
        cy += 44;
        break;
      case 'list': {
        const items = block.items?.length ? block.items : (block.text || '').split(/\n|•/).map((s: string) => s.trim()).filter(Boolean);
        for (let li = 0; li < items.length; li++) {
          svg += `<text x="${x}" y="${cy + 10}" class="body-text"><tspan fill="${C.gray}">${li + 1}.</tspan> ${esc(items[li])}</text>`;
          cy += 16;
        }
        cy += 4;
        break;
      }
      case 'kv-pair':
        svg += `<text x="${x}" y="${cy + 10}" class="body-text"><tspan font-weight="700" fill="${C.dark}">${esc(block.label || '')}:</tspan> ${esc(block.value || '')}</text>`;
        cy += 16;
        break;
      case 'promo-box':
        svg += `<rect x="${x}" y="${cy}" width="${maxW}" height="30" rx="4" fill="${C.promoBg}" stroke="#F59E0B" stroke-width="0.5"/>`;
        svg += `<text x="${x + maxW / 2}" y="${cy + 19}" text-anchor="middle" font-weight="700" font-size="${F.sm}" fill="${C.promoText}">${esc(block.text || '')}</text>`;
        cy += 38;
        break;
      case 'divider':
        svg += `<line x1="${x}" y1="${cy + 4}" x2="${x + maxW}" y2="${cy + 4}" stroke="${C.border}" stroke-width="0.5"/>`;
        cy += 10;
        break;
      default:
        if (block.text) {
          svg += `<text x="${x}" y="${cy + 10}" class="body-text">${esc(block.text)}</text>`;
          cy += 16;
        }
    }
  }

  return svg;
}

// ===== 와이어프레임 컬럼 (모바일 프레임) =====
function renderWireframeColumn(sec: any, phoneX: number, startY: number, brandName: string): string {
  let svg = '';
  const innerX = phoneX + PHONE_PAD;
  const innerW = PHONE_W - PHONE_PAD * 2;

  // 폰 프레임
  svg += `<rect x="${phoneX}" y="${startY}" width="${PHONE_W}" height="20" rx="8" fill="${C.wfDark}"/>`;
  svg += `<text x="${phoneX + 12}" y="${startY + 13}" font-size="6" fill="#999">9:41</text>`;
  svg += `<text x="${phoneX + PHONE_W / 2}" y="${startY + 13}" text-anchor="middle" font-size="6" fill="#999">${esc(brandName)}</text>`;
  svg += `<text x="${phoneX + PHONE_W - 12}" y="${startY + 13}" text-anchor="end" font-size="6" fill="#999">🔋</text>`;

  let wy = startY + 24;

  const wfBlocks = sec.wireframeBlocks?.length ? sec.wireframeBlocks : buildFallbackWfBlocks(sec);

  for (const block of wfBlocks) {
    switch (block.type) {
      case 'wf-heading':
        svg += `<text x="${block.align === 'center' ? innerX + innerW / 2 : innerX}" y="${wy + 10}" ${block.align === 'center' ? 'text-anchor="middle"' : ''} class="wf-heading">${esc(block.text || '')}</text>`;
        wy += 18;
        break;
      case 'wf-text':
        svg += `<text x="${block.align === 'center' ? innerX + innerW / 2 : innerX}" y="${wy + 9}" ${block.align === 'center' ? 'text-anchor="middle"' : ''} class="wf-text">${esc((block.text || '').substring(0, 60))}</text>`;
        wy += 14;
        break;
      case 'wf-image': {
        const h = block.height || 70;
        svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="${h}" rx="3" fill="${C.wfGray}"/>`;
        svg += `<text x="${innerX + innerW / 2}" y="${wy + h / 2 + 3}" text-anchor="middle" class="wf-text">${esc(block.text || '[이미지]')}</text>`;
        if (block.desc) svg += `<text x="${innerX + innerW / 2}" y="${wy + h / 2 + 14}" text-anchor="middle" class="wf-small">${esc(block.desc)}</text>`;
        wy += h + 8;
        break;
      }
      case 'wf-button':
        svg += `<rect x="${innerX + innerW / 4}" y="${wy}" width="${innerW / 2}" height="22" rx="11" fill="${block.color || C.wfDark}"/>`;
        svg += `<text x="${innerX + innerW / 2}" y="${wy + 15}" text-anchor="middle" font-size="${F.wf}" font-weight="700" fill="${C.white}">${esc(block.text || '버튼')}</text>`;
        wy += 30;
        break;
      case 'wf-card-grid': {
        const cols = block.cols || 2;
        const items = block.items || [];
        const cardW = (innerW - (cols - 1) * 4) / cols;
        for (let r = 0; r < Math.ceil(items.length / cols); r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (idx >= items.length) break;
            const cx = innerX + c * (cardW + 4);
            svg += `<rect x="${cx}" y="${wy}" width="${cardW}" height="50" rx="3" fill="${C.wfLight}"/>`;
            svg += `<rect x="${cx + cardW / 2 - 12}" y="${wy + 6}" width="24" height="24" rx="3" fill="${C.wfGray}"/>`;
            svg += `<text x="${cx + cardW / 2}" y="${wy + 42}" text-anchor="middle" class="wf-label">${esc(items[idx].label || '')}</text>`;
          }
          wy += 56;
        }
        wy += 4;
        break;
      }
      case 'wf-table': {
        const headers = block.headers || [];
        const rows = block.rows || [];
        const colW = innerW / Math.max(headers.length, 1);
        // Header
        if (headers.length) {
          svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="16" fill="${C.wfDark}"/>`;
          headers.forEach((h: string, hi: number) => {
            svg += `<text x="${innerX + hi * colW + 4}" y="${wy + 11}" class="wf-small" fill="${C.white}" font-weight="700">${esc(h)}</text>`;
          });
          wy += 16;
        }
        for (const row of rows) {
          svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="14" fill="${C.white}" stroke="${C.wfAccent}" stroke-width="0.5"/>`;
          (row.cells || []).forEach((cell: string, ci: number) => {
            svg += `<text x="${innerX + ci * colW + 4}" y="${wy + 10}" class="wf-small">${esc(cell)}</text>`;
          });
          wy += 14;
        }
        wy += 6;
        break;
      }
      case 'wf-icon-list': {
        const items = block.items || [];
        for (let li = 0; li < items.length; li++) {
          svg += `<circle cx="${innerX + 8}" cy="${wy + 8}" r="8" fill="${C.wfDark}"/>`;
          svg += `<text x="${innerX + 8}" y="${wy + 11}" text-anchor="middle" font-size="6" fill="${C.white}" font-weight="700">${li + 1}</text>`;
          svg += `<text x="${innerX + 22}" y="${wy + 10}" class="wf-label">${esc(items[li].label || '')}</text>`;
          if (items[li].desc) svg += `<text x="${innerX + 22}" y="${wy + 20}" class="wf-small">${esc(items[li].desc)}</text>`;
          wy += items[li].desc ? 26 : 20;
        }
        wy += 4;
        break;
      }
      case 'wf-split':
        svg += `<text x="${innerX}" y="${wy + 10}" class="wf-label">${esc(block.text || '')}</text>`;
        if (block.desc) svg += `<text x="${innerX}" y="${wy + 22}" class="wf-small">${esc(block.desc)}</text>`;
        svg += `<rect x="${innerX + innerW - 70}" y="${wy}" width="70" height="50" rx="3" fill="${C.wfGray}"/>`;
        svg += `<text x="${innerX + innerW - 35}" y="${wy + 28}" text-anchor="middle" class="wf-small">${esc(block.label || '[이미지]')}</text>`;
        wy += 56;
        break;
      case 'wf-stats': {
        const items = block.items || [];
        const statW = (innerW - 4) / 2;
        for (let r = 0; r < Math.ceil(items.length / 2); r++) {
          for (let c = 0; c < 2; c++) {
            const idx = r * 2 + c;
            if (idx >= items.length) break;
            const sx = innerX + c * (statW + 4);
            svg += `<rect x="${sx}" y="${wy}" width="${statW}" height="36" rx="3" fill="${C.wfLight}"/>`;
            svg += `<text x="${sx + statW / 2}" y="${wy + 16}" text-anchor="middle" font-size="${F.body}" font-weight="700" fill="${C.wfDark}">${esc(items[idx].value || '0')}</text>`;
            svg += `<text x="${sx + statW / 2}" y="${wy + 28}" text-anchor="middle" class="wf-small">${esc(items[idx].label || '')}</text>`;
          }
          wy += 42;
        }
        wy += 4;
        break;
      }
      case 'wf-bar-chart': {
        if (block.text) { svg += `<text x="${innerX}" y="${wy + 9}" class="wf-label">${esc(block.text)}</text>`; wy += 14; }
        const items = block.items || [];
        for (const item of items) {
          svg += `<text x="${innerX + 40}" y="${wy + 8}" text-anchor="end" class="wf-small">${esc(item.label || '')}</text>`;
          const barW = (innerW - 55) * ((item.percent || 50) / 100);
          svg += `<rect x="${innerX + 44}" y="${wy}" width="${innerW - 55}" height="10" rx="5" fill="${C.wfLight}"/>`;
          svg += `<rect x="${innerX + 44}" y="${wy}" width="${barW}" height="10" rx="5" fill="${C.wfDark}"/>`;
          wy += 16;
        }
        wy += 4;
        break;
      }
      case 'wf-checklist': {
        const items = block.items?.length ? block.items.map((i: any) => i.label) : (block.text || '').split(/\n|\|/).map((s: string) => s.trim()).filter(Boolean);
        for (const item of items) {
          svg += `<text x="${innerX}" y="${wy + 9}" font-size="${F.wf}" fill="#22C55E">✓</text>`;
          svg += `<text x="${innerX + 14}" y="${wy + 9}" class="wf-text">${esc(item)}</text>`;
          wy += 14;
        }
        wy += 4;
        break;
      }
      case 'wf-comparison-row': {
        const items = block.items || [];
        const cw = innerW / 3;
        svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="14" fill="${C.wfDark}"/>`;
        svg += `<text x="${innerX + 4}" y="${wy + 10}" class="wf-small" fill="${C.white}" font-weight="700">항목</text>`;
        svg += `<text x="${innerX + cw + 4}" y="${wy + 10}" class="wf-small" fill="${C.white}" font-weight="700">일반</text>`;
        svg += `<text x="${innerX + cw * 2 + 4}" y="${wy + 10}" class="wf-small" fill="${C.white}" font-weight="700">${esc(brandName)}</text>`;
        wy += 14;
        for (const item of items) {
          svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="12" fill="${C.white}" stroke="${C.wfAccent}" stroke-width="0.3"/>`;
          svg += `<text x="${innerX + 4}" y="${wy + 9}" class="wf-small">${esc(item.label || '')}</text>`;
          svg += `<text x="${innerX + cw + 4}" y="${wy + 9}" class="wf-small">${esc(item.value || '')}</text>`;
          svg += `<text x="${innerX + cw * 2 + 4}" y="${wy + 9}" class="wf-small" font-weight="700">${esc(item.desc || '')}</text>`;
          wy += 12;
        }
        wy += 6;
        break;
      }
      case 'wf-review-card': {
        const items = block.items || [];
        for (const item of items) {
          svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="28" rx="3" fill="${C.wfLight}"/>`;
          svg += `<text x="${innerX + 6}" y="${wy + 12}" class="wf-text">${esc(item.label || '')}</text>`;
          if (item.desc) svg += `<text x="${innerX + 6}" y="${wy + 22}" class="wf-small">- ${esc(item.desc)}</text>`;
          wy += 32;
        }
        wy += 4;
        break;
      }
      case 'wf-badge-row': {
        let bx = innerX;
        for (const item of (block.items || [])) {
          const tw = Math.max(30, (item.label?.length || 3) * 6 + 12);
          svg += `<rect x="${bx}" y="${wy}" width="${tw}" height="16" rx="8" fill="${C.wfLight}"/>`;
          svg += `<text x="${bx + tw / 2}" y="${wy + 11}" text-anchor="middle" class="wf-small">${esc(item.label || '')}</text>`;
          bx += tw + 4;
        }
        wy += 22;
        break;
      }
      case 'wf-trust-badges': {
        let bx = innerX;
        for (const item of (block.items || [])) {
          svg += `<text x="${bx}" y="${wy + 9}" class="wf-small"><tspan fill="#22C55E">✓</tspan> ${esc(item.label || '')}</text>`;
          bx += (item.label?.length || 3) * 6 + 20;
        }
        wy += 16;
        break;
      }
      case 'wf-before-after':
        svg += `<rect x="${innerX}" y="${wy}" width="${innerW / 2 - 2}" height="50" rx="3" fill="${C.wfLight}"/>`;
        svg += `<text x="${innerX + innerW / 4}" y="${wy + 12}" text-anchor="middle" class="wf-small" font-weight="700">BEFORE</text>`;
        svg += `<rect x="${innerX + innerW / 2 + 2}" y="${wy}" width="${innerW / 2 - 2}" height="50" rx="3" fill="${C.wfLight}"/>`;
        svg += `<text x="${innerX + innerW * 3 / 4}" y="${wy + 12}" text-anchor="middle" class="wf-small" font-weight="700">AFTER</text>`;
        wy += 56;
        break;
      case 'wf-timeline': {
        const items = block.items || [];
        for (let ti = 0; ti < items.length; ti++) {
          svg += `<line x1="${innerX + 4}" y1="${wy}" x2="${innerX + 4}" y2="${wy + 20}" stroke="${C.wfDark}" stroke-width="2"/>`;
          svg += `<circle cx="${innerX + 4}" cy="${wy + 4}" r="3" fill="${C.wfDark}"/>`;
          svg += `<text x="${innerX + 14}" y="${wy + 8}" class="wf-label">${esc(items[ti].label || '')}</text>`;
          if (items[ti].desc) svg += `<text x="${innerX + 14}" y="${wy + 18}" class="wf-small">${esc(items[ti].desc)}</text>`;
          wy += items[ti].desc ? 24 : 18;
        }
        wy += 4;
        break;
      }
      case 'wf-number-highlight': {
        let nx = innerX;
        const items = block.items || [];
        const nw = innerW / Math.max(items.length, 1);
        for (const item of items) {
          svg += `<text x="${nx + nw / 2}" y="${wy + 14}" text-anchor="middle" font-size="${F.h1}" font-weight="700" fill="${C.wfDark}">${esc(item.value || '0')}</text>`;
          svg += `<text x="${nx + nw / 2}" y="${wy + 26}" text-anchor="middle" class="wf-small">${esc(item.label || '')}</text>`;
          nx += nw;
        }
        wy += 34;
        break;
      }
      case 'wf-promo-badge':
        svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="20" rx="4" fill="${C.promoBg}"/>`;
        svg += `<text x="${innerX + innerW / 2}" y="${wy + 14}" text-anchor="middle" font-size="${F.wf}" font-weight="700" fill="${C.promoText}">${esc(block.text || '')}</text>`;
        wy += 26;
        break;
      case 'wf-price':
        if (block.label) svg += `<text x="${innerX + innerW / 2}" y="${wy + 9}" text-anchor="middle" class="wf-small" style="text-decoration:line-through">${esc(block.label)}</text>`;
        svg += `<text x="${innerX + innerW / 2}" y="${wy + (block.label ? 24 : 14)}" text-anchor="middle" font-size="${F.h1}" font-weight="700" fill="${C.wfDark}">${esc(block.text || '')}</text>`;
        wy += block.label ? 32 : 20;
        break;
      case 'wf-divider':
        svg += `<line x1="${innerX}" y1="${wy + 4}" x2="${innerX + innerW}" y2="${wy + 4}" stroke="${C.wfAccent}" stroke-width="0.5"/>`;
        wy += 10;
        break;
      case 'wf-spacer':
        wy += block.height || 8;
        break;
      case 'wf-logo':
        svg += `<text x="${block.align === 'center' ? innerX + innerW / 2 : innerX}" y="${wy + 12}" ${block.align === 'center' ? 'text-anchor="middle"' : ''} font-size="${F.body}" font-weight="700" fill="${C.wfDark}">${esc(block.text || brandName)}</text>`;
        wy += 18;
        break;
      case 'wf-source':
        svg += `<text x="${innerX}" y="${wy + 8}" class="wf-small" font-style="italic">* ${esc(block.text || '')}</text>`;
        wy += 12;
        break;
      case 'wf-video':
        svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="60" rx="3" fill="${C.wfGray}"/>`;
        svg += `<text x="${innerX + innerW / 2}" y="${wy + 30}" text-anchor="middle" font-size="18" fill="${C.wfText}">▶</text>`;
        svg += `<text x="${innerX + innerW / 2}" y="${wy + 48}" text-anchor="middle" class="wf-small">${esc(block.text || '영상')}</text>`;
        wy += 66;
        break;
      case 'wf-quote':
        svg += `<line x1="${innerX}" y1="${wy}" x2="${innerX}" y2="${wy + 24}" stroke="${C.wfDark}" stroke-width="2"/>`;
        svg += `<text x="${innerX + 8}" y="${wy + 10}" class="wf-text" font-style="italic">"${esc(block.text || '')}"</text>`;
        if (block.desc) svg += `<text x="${innerX + 8}" y="${wy + 22}" class="wf-small">- ${esc(block.desc)}</text>`;
        wy += block.desc ? 30 : 18;
        break;
      case 'wf-product-grid': {
        const cols = block.cols || 3;
        const items = block.items || [];
        const pw = (innerW - (cols - 1) * 4) / cols;
        for (let r = 0; r < Math.ceil(items.length / cols); r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (idx >= items.length) break;
            const px = innerX + c * (pw + 4);
            svg += `<rect x="${px}" y="${wy}" width="${pw}" height="50" rx="3" fill="${C.wfLight}"/>`;
            svg += `<rect x="${px + pw / 2 - 10}" y="${wy + 4}" width="20" height="20" rx="2" fill="${C.wfGray}"/>`;
            svg += `<text x="${px + pw / 2}" y="${wy + 36}" text-anchor="middle" class="wf-small" font-weight="700">${esc(items[idx].label || '')}</text>`;
            if (items[idx].value) svg += `<text x="${px + pw / 2}" y="${wy + 45}" text-anchor="middle" class="wf-small">${esc(items[idx].value)}</text>`;
          }
          wy += 56;
        }
        wy += 4;
        break;
      }
      case 'wf-accordion': {
        for (let ai = 0; ai < (block.items || []).length; ai++) {
          const item = block.items[ai];
          svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="18" rx="2" fill="${C.wfLight}"/>`;
          svg += `<text x="${innerX + 6}" y="${wy + 12}" class="wf-label">${esc(item.label || '')}</text>`;
          svg += `<text x="${innerX + innerW - 10}" y="${wy + 12}" class="wf-small">▼</text>`;
          wy += 20;
        }
        wy += 4;
        break;
      }
      case 'wf-tabs': {
        const tabs = block.tabs || [];
        const tw = innerW / Math.max(tabs.length, 1);
        for (let ti = 0; ti < tabs.length; ti++) {
          svg += `<text x="${innerX + ti * tw + tw / 2}" y="${wy + 10}" text-anchor="middle" class="wf-text" ${ti === 0 ? 'font-weight="700"' : ''}>${esc(tabs[ti])}</text>`;
        }
        svg += `<line x1="${innerX}" y1="${wy + 14}" x2="${innerX + tw}" y2="${wy + 14}" stroke="${C.wfDark}" stroke-width="2"/>`;
        svg += `<line x1="${innerX}" y1="${wy + 14}" x2="${innerX + innerW}" y2="${wy + 14}" stroke="${C.wfAccent}" stroke-width="0.5"/>`;
        wy += 20;
        break;
      }
      case 'wf-progress-bar': {
        for (const item of (block.items || [])) {
          svg += `<text x="${innerX}" y="${wy + 8}" class="wf-small">${esc(item.label || '')}</text>`;
          svg += `<text x="${innerX + innerW}" y="${wy + 8}" text-anchor="end" class="wf-small">${item.percent || 0}%</text>`;
          wy += 12;
          svg += `<rect x="${innerX}" y="${wy}" width="${innerW}" height="6" rx="3" fill="${C.wfLight}"/>`;
          svg += `<rect x="${innerX}" y="${wy}" width="${innerW * (item.percent || 0) / 100}" height="6" rx="3" fill="${C.wfDark}"/>`;
          wy += 12;
        }
        wy += 4;
        break;
      }
      default:
        if (block.text) {
          svg += `<text x="${innerX}" y="${wy + 9}" class="wf-text">[${block.type}] ${esc(block.text.substring(0, 40))}</text>`;
          wy += 14;
        }
    }
  }

  // 폰 프레임 하단 (닫는 사각형)
  const phoneH = wy - startY + 8;
  svg += `<rect x="${phoneX}" y="${startY + 20}" width="${PHONE_W}" height="${phoneH - 20}" fill="none" stroke="${C.wfAccent}" stroke-width="1" rx="0 0 8 8"/>`;

  return svg;
}

// ===== 레퍼런스 컬럼 =====
function renderReferenceColumn(sec: any, x: number, startY: number, maxW: number): string {
  let svg = '';
  let cy = startY;

  // 레퍼런스 이미지 (base64 임베딩)
  const refBase64 = sec.referenceImageBase64;
  if (refBase64) {
    svg += `<text x="${x}" y="${cy + 10}" class="wf-label">레퍼런스</text>`;
    cy += 16;
    const imgH = Math.round(maxW * 1.2);
    svg += `<image href="${refBase64}" x="${x}" y="${cy}" width="${maxW}" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
    cy += imgH + 4;
    if (sec.referenceNote) {
      svg += `<text x="${x}" y="${cy + 10}" class="note">${esc(sec.referenceNote.substring(0, 80))}</text>`;
      cy += 16;
    }
    cy += 8;
  }

  // 나노바나나 디자인 프리뷰 이미지 (base64 임베딩)
  const designBase64 = sec.designPreviewBase64;
  if (designBase64) {
    svg += `<text x="${x}" y="${cy + 10}" class="wf-label">디자인 프리뷰</text>`;
    cy += 16;
    const imgH = Math.round(maxW * 1.5);
    svg += `<image href="${designBase64}" x="${x}" y="${cy}" width="${maxW}" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
    cy += imgH + 4;
  }

  // 이미지가 하나도 없으면 빈 영역
  if (!refBase64 && !designBase64) {
    svg += `<rect x="${x}" y="${startY}" width="${maxW}" height="40" rx="4" fill="${C.bg}"/>`;
    svg += `<text x="${x + maxW / 2}" y="${startY + 24}" text-anchor="middle" class="note">—</text>`;
  }

  return svg;
}

// ===== 높이 추정 =====
function estimateCopyHeight(sec: any): number {
  const blocks = sec.copyBlocks?.length ? sec.copyBlocks : buildFallbackCopyBlocks(sec);
  let h = 0;
  for (const b of blocks) {
    switch (b.type) {
      case 'section-title': case 'heading': h += 22; break;
      case 'label': case 'visual-direction': case 'layout-tag': case 'note': h += 16; break;
      case 'copy-main': case 'copy-sub': case 'text': h += 20 + Math.ceil(((b.text || '').length * 6) / 320) * 14; break;
      case 'ae-comment': h += 14 + 20 + Math.ceil(((b.text || '').length * 5) / 320) * 12; break;
      case 'image-placeholder': h += 48; break;
      case 'info-box': h += 44; break;
      case 'promo-box': h += 38; break;
      case 'list': h += (b.items?.length || 1) * 16 + 4; break;
      case 'divider': h += 10; break;
      default: h += 16;
    }
  }
  return h;
}

function estimateWfHeight(sec: any): number {
  const blocks = sec.wireframeBlocks?.length ? sec.wireframeBlocks : buildFallbackWfBlocks(sec);
  let h = 30; // phone status bar + padding
  for (const b of blocks) {
    switch (b.type) {
      case 'wf-heading': h += 18; break;
      case 'wf-text': h += 14; break;
      case 'wf-image': h += (b.height || 70) + 8; break;
      case 'wf-button': h += 30; break;
      case 'wf-card-grid': h += Math.ceil((b.items?.length || 1) / (b.cols || 2)) * 56 + 4; break;
      case 'wf-table': h += 16 + (b.rows?.length || 0) * 14 + 6; break;
      case 'wf-icon-list': h += (b.items?.length || 0) * 22 + 4; break;
      case 'wf-split': h += 56; break;
      case 'wf-stats': h += Math.ceil((b.items?.length || 1) / 2) * 42 + 4; break;
      case 'wf-bar-chart': h += (b.text ? 14 : 0) + (b.items?.length || 0) * 16 + 4; break;
      case 'wf-checklist': h += ((b.items?.length || (b.text || '').split(/\n/).length) || 1) * 14 + 4; break;
      case 'wf-comparison-row': h += 14 + (b.items?.length || 0) * 12 + 6; break;
      case 'wf-review-card': h += (b.items?.length || 0) * 32 + 4; break;
      case 'wf-badge-row': h += 22; break;
      case 'wf-before-after': h += 56; break;
      case 'wf-timeline': h += (b.items?.length || 0) * 22 + 4; break;
      case 'wf-number-highlight': h += 34; break;
      case 'wf-product-grid': h += Math.ceil((b.items?.length || 1) / (b.cols || 3)) * 56 + 4; break;
      case 'wf-accordion': h += (b.items?.length || 0) * 20 + 4; break;
      case 'wf-video': h += 66; break;
      case 'wf-divider': h += 10; break;
      case 'wf-spacer': h += b.height || 8; break;
      default: h += 14;
    }
  }
  return h;
}

function estimateRefHeight(sec: any): number {
  let h = 0;
  if (sec.referenceImageBase64) {
    h += Math.round(356 * 1.2) + 30 + (sec.referenceNote ? 16 : 0);
  }
  if (sec.designPreviewBase64) {
    h += Math.round(356 * 1.5) + 24;
  }
  return h || 40;
}

// ===== Fallback 블록 생성 =====
function buildFallbackCopyBlocks(sec: any): any[] {
  const blocks: any[] = [];
  blocks.push({ type: 'section-title', text: `섹션 타이틀 (16pt Bold)` });
  if (sec.mainCopy) blocks.push({ type: 'copy-main', text: sec.mainCopy });
  if (sec.subCopy) blocks.push({ type: 'copy-sub', text: sec.subCopy });
  if (sec.visualDirection) blocks.push({ type: 'visual-direction', text: `비주얼: ${sec.visualDirection}` });
  if (sec.layout) blocks.push({ type: 'layout-tag', text: `레이아웃: ${sec.layout}` });
  if (sec.aeCommentary) blocks.push({ type: 'ae-comment', text: sec.aeCommentary });
  return blocks;
}

function buildFallbackWfBlocks(sec: any): any[] {
  return [
    { type: 'wf-heading', text: sec.mainCopy || sec.name || '섹션', bold: true, align: 'center' },
    { type: 'wf-text', text: sec.subCopy || '설명 텍스트', align: 'center' },
    { type: 'wf-image', text: '[이미지 영역]', height: 70 },
  ];
}

// ===== 텍스트 줄바꿈 헬퍼 =====
function wrapText(text: string, x: number, y: number, maxW: number, className: string, lineH: number): string {
  const charW = className.includes('ae-comment') || className.includes('note') ? 5 : 6;
  const charsPerLine = Math.floor(maxW / charW);
  const lines: string[] = [];

  // 줄바꿈 처리
  for (const rawLine of text.split('\n')) {
    if (rawLine.length <= charsPerLine) {
      lines.push(rawLine);
    } else {
      let remaining = rawLine;
      while (remaining.length > charsPerLine) {
        let breakAt = remaining.lastIndexOf(' ', charsPerLine);
        if (breakAt <= 0) breakAt = charsPerLine;
        lines.push(remaining.substring(0, breakAt));
        remaining = remaining.substring(breakAt).trimStart();
      }
      if (remaining) lines.push(remaining);
    }
  }

  let svg = '';
  for (let i = 0; i < lines.length; i++) {
    svg += `<text x="${x}" y="${y + i * lineH + lineH * 0.7}" class="${className}">${esc(lines[i])}</text>`;
  }
  return svg;
}
