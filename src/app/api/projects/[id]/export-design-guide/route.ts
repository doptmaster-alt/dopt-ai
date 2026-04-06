import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStepData, getProject, getProjectImages } from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/projects/[id]/export-design-guide
 * 종합 디자인 가이드 SVG — 기획안 + 촬영콘티 + 디자인 가이드 + 레퍼런스 + 나노바나나
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const project = getProject(projectId);

  // ═══ 1. 기획안 로드 ═══
  let planData: any = null;
  for (const step of [4, 5]) {
    const sd = getStepData(projectId, step);
    if (sd?.form_data) {
      const parsed = JSON.parse(sd.form_data);
      const hasBlocks = parsed.sections?.some((s: any) => s.copyBlocks?.length > 0);
      if (!planData || hasBlocks) {
        planData = parsed;
        if (hasBlocks) break;
      }
    }
  }
  if (!planData?.sections?.length) {
    return NextResponse.json({ error: '기획안 데이터가 없습니다.' }, { status: 404 });
  }

  // ═══ 2. 촬영콘티 로드 ═══
  let contiData: any = null;
  for (const step of [8, 6]) {
    const sd = getStepData(projectId, step);
    if (sd?.form_data) {
      const parsed = JSON.parse(sd.form_data);
      if (parsed.cutPages?.length || parsed.cutSectionMapping?.length) {
        contiData = parsed;
        break;
      }
    }
  }

  // ═══ 3. 디자인 가이드 로드 ═══
  let designGuide: any = null;
  for (const step of [10, 8]) {
    const sd = getStepData(projectId, step);
    if (sd?.form_data) {
      const parsed = JSON.parse(sd.form_data);
      if (parsed.toneAndManner || parsed.typography) {
        designGuide = parsed;
        break;
      }
    }
  }

  // ═══ 4. 이미지 로드 (나노바나나 + 촬영콘티 이미지) ═══
  const sectionImages: Record<number, string> = {};
  const cutImages: Record<number, string> = {};
  try {
    const allImages = getProjectImages(projectId);
    for (const img of allImages) {
      const key = (img as any).image_key;
      const data = (img as any).image_data;
      if (!data) continue;
      const secMatch = key?.match(/section-(\d+)/);
      if (secMatch) sectionImages[parseInt(secMatch[1])] = data;
      const cutMatch = key?.match(/cut-(\d+)/);
      if (cutMatch) cutImages[parseInt(cutMatch[1])] = data;
    }
  } catch (e) {
    console.error('[Design Guide Export] Image load error:', e);
  }

  // ═══ 5. 레퍼런스 이미지 base64 변환 ═══
  for (const sec of planData.sections) {
    const num = sec.num || (planData.sections.indexOf(sec) + 1);
    if (sec.referenceImageUrl) {
      sec.refBase64 = await resolveImageToBase64(sec.referenceImageUrl);
    }
    if (sectionImages[num]) {
      sec.designBase64 = sectionImages[num];
    }
  }

  // ═══ 6. 섹션별 촬영콘티 매핑 ═══
  const sectionCutMap: Record<number, any[]> = {};
  if (contiData?.cutSectionMapping) {
    for (const mapping of contiData.cutSectionMapping) {
      const secNum = mapping.section;
      const cutNames = mapping.cuts || [];
      sectionCutMap[secNum] = [];
      for (const cutName of cutNames) {
        // 컷 이름에서 번호 추출 (예: "연출1" → 1)
        const numMatch = cutName.match(/(\d+)/);
        const cutNum = numMatch ? parseInt(numMatch[1]) : null;
        const cutPage = contiData.cutPages?.find((cp: any) => cp.cutNum === cutNum);
        sectionCutMap[secNum].push({
          name: cutName,
          cutNum,
          page: cutPage || null,
          image: cutNum ? cutImages[cutNum] || null : null,
        });
      }
    }
  }

  const brandName = planData.brandName || project?.client_name || project?.title || 'Brand';

  const svg = buildDesignGuideSvg(
    planData.sections,
    sectionCutMap,
    designGuide,
    brandName,
    project?.title || '프로젝트',
  );

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(project?.title || '디자인가이드')}_design_guide.svg"`,
    },
  });
}

// ═══════════════════════════════════════════
//  이미지 URL → base64
// ═══════════════════════════════════════════
async function resolveImageToBase64(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const uploadsMatch = url.match(/(?:localhost:\d+)?\/api\/uploads\/(.+)$/);
    if (uploadsMatch) {
      const filename = decodeURIComponent(uploadsMatch[1]);
      const filePath = path.join(process.cwd(), 'uploads', filename);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      }
    }
    if (url.startsWith('http')) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        return `data:${res.headers.get('content-type') || 'image/png'};base64,${buf.toString('base64')}`;
      }
    }
    return null;
  } catch { return null; }
}

// ═══════════════════════════════════════════
//  SVG 생성
// ═══════════════════════════════════════════
const COL1 = 340;   // 문구
const COL2 = 300;   // 디자인 구조 (와이어프레임)
const COL3 = 300;   // 촬영콘티
const COL4 = 320;   // 레퍼런스 & 디자인 프리뷰
const PHONE_W = 240;
const PHONE_PAD = 10;
const SEC_PAD = 14;
const HDR_H = 32;

const C: Record<string, string> = {
  white: '#FFFFFF', bg: '#F5F5F5', black: '#1A1A1A', dark: '#333333',
  body: '#444444', gray: '#888888', border: '#CCCCCC', red: '#CC0000',
  headerBg: '#E8E8E8', blue: '#2563EB',
  wfGray: '#D9D9D9', wfDark: '#B0B0B0', wfLight: '#EEEEEE', wfText: '#999999', wfAccent: '#C0C0C0',
  promoBg: '#FEF3C7', promoText: '#92400E',
};

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildDesignGuideSvg(
  sections: any[],
  sectionCutMap: Record<number, any[]>,
  designGuide: any,
  brandName: string,
  projectTitle: string,
): string {
  const totalW = COL1 + COL2 + COL3 + COL4 + 3;

  // 디자인 가이드 헤더 높이
  const guideHeaderH = designGuide ? 280 : 0;
  const titleH = 70;
  const colHeaderH = 28;

  // 각 섹션 높이 계산
  const sectionHeights: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const num = sec.num || i + 1;
    const copyH = estCopyH(sec);
    const wfH = estWfH(sec);
    const contiCuts = sectionCutMap[num] || [];
    const contiH = estContiH(contiCuts);
    const refH = estRefH(sec);
    sectionHeights.push(Math.max(copyH, wfH, contiH, refH) + HDR_H + SEC_PAD * 2);
  }

  const totalH = titleH + guideHeaderH + colHeaderH + sectionHeights.reduce((a, b) => a + b, 0) + 20;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
<defs><style>
text{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.t16b{font-size:16px;font-weight:700;fill:${C.black}}
.t14b{font-size:14px;font-weight:700;fill:${C.black}}
.t13b{font-size:13px;font-weight:700;fill:${C.dark}}
.t12{font-size:12px;fill:${C.body}}
.t11{font-size:11px;fill:${C.body}}
.t10{font-size:10px;fill:${C.gray}}
.t10b{font-size:10px;font-weight:700;fill:${C.dark}}
.t9{font-size:9px;fill:${C.gray}}
.t8{font-size:8px;fill:${C.wfText}}
.t7{font-size:7px;fill:${C.wfDark}}
.sec-title{font-size:12px;font-weight:700;fill:${C.red}}
.ae{font-size:10px;font-weight:700;fill:${C.red}}
.blue{font-size:10px;font-weight:700;fill:${C.blue}}
.copy-m{font-size:11px;font-weight:700;fill:${C.black}}
.copy-s{font-size:11px;fill:${C.body}}
.vis{font-size:10px;fill:${C.gray};font-style:italic}
.note-i{font-size:9px;fill:${C.gray};font-style:italic}
.wf-h{font-size:9px;font-weight:700;fill:${C.wfText}}
.wf-t{font-size:8px;fill:${C.wfText}}
.conti-title{font-size:10px;font-weight:700;fill:${C.dark}}
.conti-type{font-size:9px;font-weight:700;fill:${C.blue}}
.conti-desc{font-size:8px;fill:${C.body}}
</style></defs>
`;

  svg += `<rect width="${totalW}" height="${totalH}" fill="${C.white}"/>`;

  // ═══ 타이틀 ═══
  svg += `<rect x="0" y="0" width="${totalW}" height="${titleH}" fill="#1E3A5F"/>`;
  svg += `<text x="24" y="30" class="t16b" fill="#FFFFFF">${esc(projectTitle)} — 종합 디자인 가이드</text>`;
  svg += `<text x="24" y="50" class="t10" fill="#FFFFFFBB">${esc(brandName)} · ${sections.length}섹션 · DIOPT AI · ${new Date().toLocaleDateString('ko-KR')}</text>`;
  let y = titleH;

  // ═══ 디자인 가이드 헤더 (톤앤매너, 컬러, 타이포) ═══
  if (designGuide) {
    svg += renderDesignGuideHeader(designGuide, y, totalW);
    y += guideHeaderH;
  }

  // ═══ 컬럼 헤더 ═══
  svg += `<rect x="0" y="${y}" width="${totalW}" height="${colHeaderH}" fill="${C.headerBg}"/>`;
  svg += `<line x1="0" y1="${y}" x2="${totalW}" y2="${y}" stroke="${C.border}"/>`;
  const colStarts = [0, COL1, COL1 + COL2, COL1 + COL2 + COL3];
  const colLabels = ['문구', '디자인 구조', '촬영콘티', '레퍼런스 / AI 디자인'];
  const colWidths = [COL1, COL2, COL3, COL4];
  for (let ci = 0; ci < 4; ci++) {
    svg += `<text x="${colStarts[ci] + colWidths[ci] / 2}" y="${y + 18}" text-anchor="middle" class="t10b">${colLabels[ci]}</text>`;
    if (ci > 0) svg += `<line x1="${colStarts[ci]}" y1="${y}" x2="${colStarts[ci]}" y2="${y + colHeaderH}" stroke="${C.border}"/>`;
  }
  svg += `<line x1="0" y1="${y + colHeaderH}" x2="${totalW}" y2="${y + colHeaderH}" stroke="${C.border}"/>`;
  y += colHeaderH;

  // ═══ 각 섹션 ═══
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const num = sec.num || i + 1;
    const secH = sectionHeights[i];
    const cuts = sectionCutMap[num] || [];

    svg += `<g id="section-${num}">`;
    svg += `<rect x="0" y="${y}" width="${totalW}" height="${secH}" fill="${C.white}"/>`;
    svg += `<line x1="0" y1="${y + secH}" x2="${totalW}" y2="${y + secH}" stroke="${C.border}"/>`;

    // 섹션 헤더
    svg += `<rect x="0" y="${y}" width="${totalW}" height="${HDR_H}" fill="${C.bg}"/>`;
    svg += `<text x="12" y="${y + 20}" class="sec-title">섹션 ${num}  ${esc(sec.name || '')}</text>`;

    // 컬럼 구분선
    for (let ci = 1; ci < 4; ci++) {
      svg += `<line x1="${colStarts[ci]}" y1="${y}" x2="${colStarts[ci]}" y2="${y + secH}" stroke="${C.border}"/>`;
    }

    const cy = y + HDR_H + SEC_PAD;

    // COL1: 문구
    svg += renderCopyCol(sec, 10, cy, COL1 - 20);

    // COL2: 와이어프레임
    const wfX = COL1 + (COL2 - PHONE_W) / 2;
    svg += renderWfCol(sec, wfX, cy, brandName);

    // COL3: 촬영콘티
    svg += renderContiCol(cuts, colStarts[2] + 10, cy, COL3 - 20);

    // COL4: 레퍼런스 + 디자인 프리뷰
    svg += renderRefCol(sec, colStarts[3] + 10, cy, COL4 - 20);

    svg += `</g>`;
    y += secH;
  }

  svg += `</svg>`;
  return svg;
}

// ═══════════════════════════════════════════
//  디자인 가이드 헤더
// ═══════════════════════════════════════════
function renderDesignGuideHeader(dg: any, startY: number, totalW: number): string {
  let s = '';
  const tm = dg.toneAndManner;
  const typo = dg.typography;
  let y = startY + 16;

  s += `<rect x="0" y="${startY}" width="${totalW}" height="280" fill="#FAFAFA"/>`;
  s += `<line x1="0" y1="${startY}" x2="${totalW}" y2="${startY}" stroke="${C.border}"/>`;

  // 톤앤매너
  s += `<text x="24" y="${y}" class="t14b">🎨 톤 & 매너</text>`;
  y += 20;
  if (tm?.mood) {
    s += `<text x="24" y="${y}" class="t11">${esc(tm.mood.substring(0, 120))}</text>`;
    y += 16;
  }

  // 컬러 팔레트
  y += 8;
  s += `<text x="24" y="${y}" class="t13b">컬러 팔레트</text>`;
  y += 18;
  if (tm?.mainColor) {
    s += `<rect x="24" y="${y}" width="40" height="40" rx="6" fill="${tm.mainColor}"/>`;
    s += `<text x="72" y="${y + 16}" class="t10b">${esc(tm.mainColorName || 'Main')}</text>`;
    s += `<text x="72" y="${y + 30}" class="t9">${tm.mainColor}</text>`;
  }
  let cx = 180;
  if (tm?.subColors) {
    for (const sc of tm.subColors) {
      s += `<rect x="${cx}" y="${y}" width="30" height="30" rx="4" fill="${sc.color}"/>`;
      s += `<text x="${cx + 36}" y="${y + 12}" class="t9" font-weight="700">${esc(sc.name || '')}</text>`;
      s += `<text x="${cx + 36}" y="${y + 24}" class="t9">${esc((sc.usage || '').substring(0, 25))}</text>`;
      cx += 200;
      if (cx > totalW - 200) { cx = 180; y += 36; }
    }
  }
  y += 44;

  // 타이포그래피
  s += `<text x="24" y="${y}" class="t13b">타이포그래피</text>`;
  y += 18;
  if (typo) {
    const fonts = [
      { label: '제목', font: typo.primaryFont, usage: typo.primaryFontUsage },
      { label: '본문', font: typo.secondaryFont, usage: typo.secondaryFontUsage },
      { label: '강조', font: typo.accentFont, usage: typo.accentFontUsage },
    ];
    for (const f of fonts) {
      if (!f.font) continue;
      s += `<text x="24" y="${y}" class="t10b">${esc(f.label)}: ${esc(f.font)}</text>`;
      s += `<text x="200" y="${y}" class="t9">${esc((f.usage || '').substring(0, 50))}</text>`;
      y += 14;
    }

    // 폰트 사이즈 표
    if (typo.fontSizes?.length) {
      y += 6;
      for (const fs of typo.fontSizes.slice(0, 6)) {
        s += `<text x="40" y="${y}" class="t9">${esc(fs.element || '')} — ${esc(fs.size || '')} ${esc(fs.weight || '')}</text>`;
        y += 12;
      }
    }
  }

  // 레이아웃 가이드
  if (dg.layoutGuide) {
    y += 8;
    s += `<text x="24" y="${y}" class="t13b">레이아웃</text>`;
    y += 16;
    const lg = dg.layoutGuide;
    s += `<text x="40" y="${y}" class="t9">최대폭: ${lg.maxWidth || '-'} · 섹션 간격: ${lg.sectionSpacing || '-'} · 그리드: ${(lg.gridSystem || '').substring(0, 30)}</text>`;
  }

  s += `<line x1="0" y1="${startY + 280}" x2="${totalW}" y2="${startY + 280}" stroke="${C.border}"/>`;
  return s;
}

// ═══════════════════════════════════════════
//  COL1: 문구
// ═══════════════════════════════════════════
function renderCopyCol(sec: any, x: number, startY: number, maxW: number): string {
  let s = '';
  let cy = startY;
  const blocks = sec.copyBlocks?.length ? sec.copyBlocks : fallbackCopy(sec);

  for (const b of blocks) {
    switch (b.type) {
      case 'section-title':
        s += `<text x="${x}" y="${cy + 11}" class="sec-title">${esc(b.text || '')}</text>`; cy += 18; break;
      case 'heading':
        s += `<text x="${x}" y="${cy + 12}" class="t14b">${esc(b.text || '')}</text>`; cy += 20; break;
      case 'label':
        s += `<text x="${x}" y="${cy + 10}" class="blue">${esc(b.text || '')}</text>`; cy += 16; break;
      case 'copy-main':
        s += wrp(b.text || '', x, cy, maxW, 'copy-m', 14); cy += wH(b.text, maxW, 14); break;
      case 'copy-sub':
        s += wrp(b.text || '', x, cy, maxW, 'copy-s', 13); cy += wH(b.text, maxW, 13); break;
      case 'text':
        s += wrp(b.text || '', x, cy, maxW, 't11', 13); cy += wH(b.text, maxW, 13); break;
      case 'visual-direction':
        s += `<text x="${x}" y="${cy + 10}" class="vis">${esc(b.text || '')}</text>`; cy += 14; break;
      case 'layout-tag':
        s += `<text x="${x}" y="${cy + 10}" class="blue" style="font-weight:400">${esc(b.text || '')}</text>`; cy += 14; break;
      case 'ae-comment':
        s += `<text x="${x}" y="${cy + 10}" class="ae">**AE</text>`; cy += 12;
        s += wrp(b.text || '', x, cy, maxW, 'ae', 12); cy += wH(b.text, maxW, 12); break;
      case 'note':
        s += `<text x="${x}" y="${cy + 9}" class="note-i">${esc(b.text || '')}</text>`; cy += 12; break;
      case 'image-placeholder':
        s += `<rect x="${x}" y="${cy}" width="${maxW}" height="32" rx="3" fill="${C.bg}" stroke="${C.border}" stroke-width="0.5" stroke-dasharray="3 2"/>`;
        s += `<text x="${x + maxW / 2}" y="${cy + 20}" text-anchor="middle" class="t9">${esc(b.text || '[이미지]')}</text>`;
        cy += 38; break;
      case 'info-box':
        s += `<rect x="${x}" y="${cy}" width="${maxW}" height="30" rx="3" fill="#EFF6FF" stroke="#D1D5DB" stroke-width="0.5"/>`;
        if (b.label) s += `<text x="${x + 6}" y="${cy + 12}" class="blue" style="font-size:9px">${esc(b.label)}</text>`;
        s += `<text x="${x + 6}" y="${cy + (b.label ? 24 : 18)}" class="t11">${esc((b.text || '').substring(0, 50))}</text>`;
        cy += 36; break;
      case 'list': {
        const items = b.items?.length ? b.items : (b.text || '').split(/\n|•/).filter(Boolean);
        for (let li = 0; li < items.length; li++) {
          s += `<text x="${x}" y="${cy + 10}" class="t11"><tspan fill="${C.gray}">${li + 1}.</tspan> ${esc(items[li].trim())}</text>`;
          cy += 14;
        }
        cy += 2; break;
      }
      case 'kv-pair':
        s += `<text x="${x}" y="${cy + 10}" class="t11"><tspan font-weight="700">${esc(b.label || '')}:</tspan> ${esc(b.value || '')}</text>`;
        cy += 14; break;
      case 'promo-box':
        s += `<rect x="${x}" y="${cy}" width="${maxW}" height="24" rx="3" fill="${C.promoBg}" stroke="#F59E0B" stroke-width="0.5"/>`;
        s += `<text x="${x + maxW / 2}" y="${cy + 16}" text-anchor="middle" class="t10b" fill="${C.promoText}">${esc(b.text || '')}</text>`;
        cy += 30; break;
      case 'divider':
        s += `<line x1="${x}" y1="${cy + 3}" x2="${x + maxW}" y2="${cy + 3}" stroke="${C.border}" stroke-width="0.5"/>`; cy += 8; break;
      default:
        if (b.text) { s += `<text x="${x}" y="${cy + 10}" class="t11">${esc(b.text.substring(0, 60))}</text>`; cy += 14; }
    }
  }
  return s;
}

// ═══════════════════════════════════════════
//  COL2: 와이어프레임
// ═══════════════════════════════════════════
function renderWfCol(sec: any, px: number, startY: number, brandName: string): string {
  let s = '';
  const ix = px + PHONE_PAD;
  const iw = PHONE_W - PHONE_PAD * 2;

  // 폰 상단바
  s += `<rect x="${px}" y="${startY}" width="${PHONE_W}" height="16" rx="6" fill="${C.wfDark}"/>`;
  s += `<text x="${px + 8}" y="${startY + 11}" font-size="5" fill="#999">9:41</text>`;
  s += `<text x="${px + PHONE_W / 2}" y="${startY + 11}" text-anchor="middle" font-size="5" fill="#999">${esc(brandName)}</text>`;

  let wy = startY + 20;
  const blocks = sec.wireframeBlocks?.length ? sec.wireframeBlocks : fallbackWf(sec);

  for (const b of blocks) {
    const t = b.type;
    if (t === 'wf-heading') {
      s += `<text x="${b.align === 'center' ? ix + iw / 2 : ix}" y="${wy + 9}" ${b.align === 'center' ? 'text-anchor="middle"' : ''} class="wf-h">${esc(b.text || '')}</text>`;
      wy += 14;
    } else if (t === 'wf-text') {
      s += `<text x="${b.align === 'center' ? ix + iw / 2 : ix}" y="${wy + 8}" ${b.align === 'center' ? 'text-anchor="middle"' : ''} class="wf-t">${esc((b.text || '').substring(0, 55))}</text>`;
      wy += 12;
    } else if (t === 'wf-image') {
      const h = b.height || 60;
      s += `<rect x="${ix}" y="${wy}" width="${iw}" height="${h}" rx="3" fill="${C.wfGray}"/>`;
      s += `<text x="${ix + iw / 2}" y="${wy + h / 2 + 3}" text-anchor="middle" class="wf-t">${esc(b.text || '[이미지]')}</text>`;
      wy += h + 6;
    } else if (t === 'wf-button') {
      s += `<rect x="${ix + iw / 4}" y="${wy}" width="${iw / 2}" height="18" rx="9" fill="${b.color || C.wfDark}"/>`;
      s += `<text x="${ix + iw / 2}" y="${wy + 12}" text-anchor="middle" font-size="7" font-weight="700" fill="#FFF">${esc(b.text || '버튼')}</text>`;
      wy += 24;
    } else if (t === 'wf-card-grid') {
      const cols = b.cols || 2;
      const cw = (iw - (cols - 1) * 3) / cols;
      for (let r = 0; r < Math.ceil((b.items?.length || 0) / cols); r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (idx >= (b.items?.length || 0)) break;
          const cx = ix + c * (cw + 3);
          s += `<rect x="${cx}" y="${wy}" width="${cw}" height="40" rx="2" fill="${C.wfLight}"/>`;
          s += `<rect x="${cx + cw / 2 - 8}" y="${wy + 4}" width="16" height="16" rx="2" fill="${C.wfGray}"/>`;
          s += `<text x="${cx + cw / 2}" y="${wy + 34}" text-anchor="middle" class="t7">${esc(b.items[idx].label || '')}</text>`;
        }
        wy += 44;
      }
      wy += 2;
    } else if (t === 'wf-table') {
      const hds = b.headers || [];
      const rows = b.rows || [];
      const tw = iw / Math.max(hds.length, 1);
      if (hds.length) {
        s += `<rect x="${ix}" y="${wy}" width="${iw}" height="12" fill="${C.wfDark}"/>`;
        hds.forEach((h: string, hi: number) => s += `<text x="${ix + hi * tw + 3}" y="${wy + 9}" class="t7" fill="#FFF" font-weight="700">${esc(h)}</text>`);
        wy += 12;
      }
      for (const row of rows) {
        s += `<rect x="${ix}" y="${wy}" width="${iw}" height="11" fill="${C.white}" stroke="${C.wfAccent}" stroke-width="0.3"/>`;
        (row.cells || []).forEach((c: string, ci: number) => s += `<text x="${ix + ci * tw + 3}" y="${wy + 8}" class="t7">${esc(c)}</text>`);
        wy += 11;
      }
      wy += 4;
    } else if (t === 'wf-icon-list') {
      for (let li = 0; li < (b.items?.length || 0); li++) {
        s += `<circle cx="${ix + 6}" cy="${wy + 6}" r="6" fill="${C.wfDark}"/>`;
        s += `<text x="${ix + 6}" y="${wy + 9}" text-anchor="middle" font-size="5" fill="#FFF" font-weight="700">${li + 1}</text>`;
        s += `<text x="${ix + 16}" y="${wy + 8}" class="t7" font-weight="700">${esc(b.items[li].label || '')}</text>`;
        if (b.items[li].desc) s += `<text x="${ix + 16}" y="${wy + 16}" class="t7">${esc(b.items[li].desc.substring(0, 35))}</text>`;
        wy += b.items[li].desc ? 20 : 16;
      }
      wy += 2;
    } else if (t === 'wf-stats') {
      const sw = (iw - 3) / 2;
      for (let r = 0; r < Math.ceil((b.items?.length || 0) / 2); r++) {
        for (let c = 0; c < 2; c++) {
          const idx = r * 2 + c;
          if (idx >= (b.items?.length || 0)) break;
          const sx = ix + c * (sw + 3);
          s += `<rect x="${sx}" y="${wy}" width="${sw}" height="28" rx="2" fill="${C.wfLight}"/>`;
          s += `<text x="${sx + sw / 2}" y="${wy + 12}" text-anchor="middle" font-size="10" font-weight="700" fill="${C.wfDark}">${esc(b.items[idx].value || '')}</text>`;
          s += `<text x="${sx + sw / 2}" y="${wy + 22}" text-anchor="middle" class="t7">${esc(b.items[idx].label || '')}</text>`;
        }
        wy += 32;
      }
      wy += 2;
    } else if (t === 'wf-checklist') {
      const items = b.items?.length ? b.items.map((i: any) => i.label) : (b.text || '').split(/\n|\|/).filter(Boolean);
      for (const it of items) {
        s += `<text x="${ix}" y="${wy + 8}" font-size="7" fill="#22C55E">✓</text>`;
        s += `<text x="${ix + 10}" y="${wy + 8}" class="wf-t">${esc(it.trim())}</text>`;
        wy += 12;
      }
      wy += 2;
    } else if (t === 'wf-comparison-row') {
      const cw = iw / 3;
      s += `<rect x="${ix}" y="${wy}" width="${iw}" height="12" fill="${C.wfDark}"/>`;
      ['항목', '일반', brandName].forEach((h, hi) => s += `<text x="${ix + hi * cw + 3}" y="${wy + 9}" class="t7" fill="#FFF" font-weight="700">${esc(h)}</text>`);
      wy += 12;
      for (const it of (b.items || [])) {
        s += `<rect x="${ix}" y="${wy}" width="${iw}" height="10" fill="${C.white}" stroke="${C.wfAccent}" stroke-width="0.2"/>`;
        [it.label, it.value, it.desc].forEach((v: string, vi: number) => s += `<text x="${ix + vi * cw + 3}" y="${wy + 8}" class="t7" ${vi === 2 ? 'font-weight="700"' : ''}>${esc(v || '')}</text>`);
        wy += 10;
      }
      wy += 4;
    } else if (t === 'wf-split') {
      s += `<text x="${ix}" y="${wy + 9}" class="t7" font-weight="700">${esc(b.text || '')}</text>`;
      if (b.desc) s += `<text x="${ix}" y="${wy + 18}" class="t7">${esc(b.desc)}</text>`;
      s += `<rect x="${ix + iw - 55}" y="${wy}" width="55" height="40" rx="2" fill="${C.wfGray}"/>`;
      s += `<text x="${ix + iw - 28}" y="${wy + 23}" text-anchor="middle" class="t7">${esc(b.label || '[이미지]')}</text>`;
      wy += 46;
    } else if (t === 'wf-divider') {
      s += `<line x1="${ix}" y1="${wy + 3}" x2="${ix + iw}" y2="${wy + 3}" stroke="${C.wfAccent}" stroke-width="0.5"/>`;
      wy += 8;
    } else if (t === 'wf-spacer') {
      wy += b.height || 6;
    } else {
      if (b.text) { s += `<text x="${ix}" y="${wy + 8}" class="wf-t">[${t}] ${esc(b.text.substring(0, 30))}</text>`; wy += 12; }
    }
  }

  // 폰 프레임 테두리
  const ph = wy - startY + 6;
  s += `<rect x="${px}" y="${startY + 16}" width="${PHONE_W}" height="${ph - 16}" fill="none" stroke="${C.wfAccent}" stroke-width="0.8"/>`;
  return s;
}

// ═══════════════════════════════════════════
//  COL3: 촬영콘티
// ═══════════════════════════════════════════
function renderContiCol(cuts: any[], x: number, startY: number, maxW: number): string {
  if (!cuts.length) {
    return `<text x="${x + maxW / 2}" y="${startY + 20}" text-anchor="middle" class="t9">—</text>`;
  }

  let s = '';
  let cy = startY;

  for (const cut of cuts) {
    // 컷 헤더
    s += `<text x="${x}" y="${cy + 10}" class="conti-type">${esc(cut.name || `컷 ${cut.cutNum || '?'}`)}</text>`;
    cy += 14;

    if (cut.page) {
      // 구도
      if (cut.page.composition) {
        const comp = cut.page.composition.replace(/\[구도\]\s*/g, '').substring(0, 80);
        s += wrp(comp, x, cy, maxW, 'conti-desc', 10);
        cy += wH(comp, maxW, 10, 5);
      }
      // 배경
      if (cut.page.background?.description) {
        s += `<text x="${x}" y="${cy + 8}" class="t7"><tspan font-weight="700">배경:</tspan> ${esc(cut.page.background.description.substring(0, 40))}</text>`;
        cy += 12;
      }
      // 소품
      if (cut.page.props?.length) {
        s += `<text x="${x}" y="${cy + 8}" class="t7"><tspan font-weight="700">소품:</tspan> ${esc(cut.page.props.slice(0, 3).join(', '))}</text>`;
        cy += 12;
      }
      // 조명
      if (cut.page.moodLighting) {
        s += `<text x="${x}" y="${cy + 8}" class="t7"><tspan font-weight="700">조명:</tspan> ${esc(cut.page.moodLighting.substring(0, 40))}</text>`;
        cy += 12;
      }
    }

    // 촬영콘티 이미지
    if (cut.image) {
      const imgH = Math.round(maxW * 0.7);
      s += `<image href="${cut.image}" x="${x}" y="${cy}" width="${maxW}" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
      cy += imgH + 4;
    }

    cy += 8;
  }

  return s;
}

// ═══════════════════════════════════════════
//  COL4: 레퍼런스 + 디자인 프리뷰
// ═══════════════════════════════════════════
function renderRefCol(sec: any, x: number, startY: number, maxW: number): string {
  let s = '';
  let cy = startY;

  if (sec.refBase64) {
    s += `<text x="${x}" y="${cy + 9}" class="t10b">레퍼런스</text>`;
    cy += 14;
    const h = Math.round(maxW * 1.0);
    s += `<image href="${sec.refBase64}" x="${x}" y="${cy}" width="${maxW}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
    cy += h + 4;
    if (sec.referenceNote) {
      s += `<text x="${x}" y="${cy + 8}" class="note-i">${esc(sec.referenceNote.substring(0, 60))}</text>`;
      cy += 12;
    }
    cy += 6;
  }

  if (sec.designBase64) {
    s += `<text x="${x}" y="${cy + 9}" class="t10b">AI 디자인 프리뷰</text>`;
    cy += 14;
    const h = Math.round(maxW * 1.3);
    s += `<image href="${sec.designBase64}" x="${x}" y="${cy}" width="${maxW}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
    cy += h + 4;
  }

  if (!sec.refBase64 && !sec.designBase64) {
    s += `<rect x="${x}" y="${cy}" width="${maxW}" height="30" rx="3" fill="${C.bg}"/>`;
    s += `<text x="${x + maxW / 2}" y="${cy + 19}" text-anchor="middle" class="t9">—</text>`;
  }

  return s;
}

// ═══════════════════════════════════════════
//  높이 추정
// ═══════════════════════════════════════════
function estCopyH(sec: any): number {
  const blocks = sec.copyBlocks?.length ? sec.copyBlocks : fallbackCopy(sec);
  let h = 0;
  for (const b of blocks) {
    switch (b.type) {
      case 'section-title': case 'heading': h += 20; break;
      case 'label': case 'visual-direction': case 'layout-tag': case 'note': h += 14; break;
      case 'copy-main': case 'copy-sub': case 'text': h += wH(b.text, COL1 - 20, 14); break;
      case 'ae-comment': h += 12 + wH(b.text, COL1 - 20, 12); break;
      case 'image-placeholder': h += 38; break;
      case 'info-box': h += 36; break;
      case 'promo-box': h += 30; break;
      case 'list': h += (b.items?.length || 1) * 14 + 2; break;
      case 'divider': h += 8; break;
      default: h += 14;
    }
  }
  return h;
}

function estWfH(sec: any): number {
  const blocks = sec.wireframeBlocks?.length ? sec.wireframeBlocks : fallbackWf(sec);
  let h = 24;
  for (const b of blocks) {
    const t = b.type;
    if (t === 'wf-heading') h += 14;
    else if (t === 'wf-text') h += 12;
    else if (t === 'wf-image') h += (b.height || 60) + 6;
    else if (t === 'wf-button') h += 24;
    else if (t === 'wf-card-grid') h += Math.ceil((b.items?.length || 1) / (b.cols || 2)) * 44 + 2;
    else if (t === 'wf-table') h += 12 + (b.rows?.length || 0) * 11 + 4;
    else if (t === 'wf-icon-list') h += (b.items?.length || 0) * 18 + 2;
    else if (t === 'wf-stats') h += Math.ceil((b.items?.length || 1) / 2) * 32 + 2;
    else if (t === 'wf-checklist') h += ((b.items?.length || 1)) * 12 + 2;
    else if (t === 'wf-comparison-row') h += 12 + (b.items?.length || 0) * 10 + 4;
    else if (t === 'wf-split') h += 46;
    else if (t === 'wf-divider') h += 8;
    else if (t === 'wf-spacer') h += b.height || 6;
    else h += 12;
  }
  return h;
}

function estContiH(cuts: any[]): number {
  if (!cuts.length) return 30;
  let h = 0;
  for (const cut of cuts) {
    h += 14; // name
    if (cut.page) {
      if (cut.page.composition) h += wH(cut.page.composition.substring(0, 80), COL3 - 20, 10, 5);
      if (cut.page.background?.description) h += 12;
      if (cut.page.props?.length) h += 12;
      if (cut.page.moodLighting) h += 12;
    }
    if (cut.image) h += Math.round((COL3 - 20) * 0.7) + 4;
    h += 8;
  }
  return h;
}

function estRefH(sec: any): number {
  let h = 0;
  if (sec.refBase64) h += 14 + Math.round((COL4 - 20) * 1.0) + 4 + (sec.referenceNote ? 12 : 0) + 6;
  if (sec.designBase64) h += 14 + Math.round((COL4 - 20) * 1.3) + 4;
  return h || 30;
}

// ═══════════════════════════════════════════
//  유틸
// ═══════════════════════════════════════════
function fallbackCopy(sec: any): any[] {
  const b: any[] = [{ type: 'section-title', text: '섹션 타이틀 (16pt Bold)' }];
  if (sec.mainCopy) b.push({ type: 'copy-main', text: sec.mainCopy });
  if (sec.subCopy) b.push({ type: 'copy-sub', text: sec.subCopy });
  if (sec.visualDirection) b.push({ type: 'visual-direction', text: `비주얼: ${sec.visualDirection}` });
  if (sec.layout) b.push({ type: 'layout-tag', text: `레이아웃: ${sec.layout}` });
  if (sec.aeCommentary) b.push({ type: 'ae-comment', text: sec.aeCommentary });
  return b;
}

function fallbackWf(sec: any): any[] {
  return [
    { type: 'wf-heading', text: sec.mainCopy || sec.name || '섹션', align: 'center' },
    { type: 'wf-text', text: sec.subCopy || '설명', align: 'center' },
    { type: 'wf-image', text: '[이미지]', height: 60 },
  ];
}

function wrp(text: string, x: number, y: number, maxW: number, cls: string, lineH: number): string {
  const cw = cls.includes('ae') || cls.includes('note') || cls.includes('conti') ? 5 : 6;
  const cpl = Math.floor(maxW / cw);
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    if (raw.length <= cpl) { lines.push(raw); continue; }
    let rem = raw;
    while (rem.length > cpl) {
      let brk = rem.lastIndexOf(' ', cpl);
      if (brk <= 0) brk = cpl;
      lines.push(rem.substring(0, brk));
      rem = rem.substring(brk).trimStart();
    }
    if (rem) lines.push(rem);
  }
  return lines.map((l, i) => `<text x="${x}" y="${y + i * lineH + lineH * 0.7}" class="${cls}">${esc(l)}</text>`).join('');
}

function wH(text: string | undefined, maxW: number, lineH: number, cw = 6): number {
  if (!text) return lineH;
  const cpl = Math.floor(maxW / cw);
  let lines = 0;
  for (const raw of text.split('\n')) {
    lines += Math.max(1, Math.ceil(raw.length / cpl));
  }
  return lines * lineH + 4;
}
