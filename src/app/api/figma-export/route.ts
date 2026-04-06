import { NextRequest, NextResponse } from 'next/server';
import { addCommands, waitForResults, isPluginConnected } from '@/lib/figma-queue';

// ===================================================================
//  D:OPT STUDIO — Figma 내보내기 v7
//  실제 디옵트 기획안 폼: 2컬럼 (문구 | 디자인 구조/와이어프레임)
//  오른쪽 컬럼에 모바일 와이어프레임 자동 생성
// ===================================================================

const W = 900;
const W3 = 1300;   // 3컬럼 모드 (레퍼런스 포함)
const COL1 = 360;  // 문구 (카피 + 이미지 플레이스홀더)
const COL2 = 540;  // 디자인 구조 (와이어프레임)
const COL3 = 400;  // 레퍼런스 디자인 (이미지)
const BORDER = '#CCCCCC';
const BORDER_W = 1;

// 모바일 와이어프레임 사이즈
const PHONE_W = 280;
const PHONE_PAD = 16;
const PHONE_INNER = PHONE_W - PHONE_PAD * 2; // 248

// ── 컬러 ──
const C = {
  white: '#FFFFFF',
  bg: '#F5F5F5',
  phoneBg: '#FAFAFA',
  black: '#1A1A1A',
  dark: '#333333',
  body: '#444444',
  gray: '#888888',
  lightGray: '#BBBBBB',
  veryLightGray: '#E0E0E0',
  border: BORDER,
  sectionTitle: '#CC0000',
  aeRed: '#CC0000',
  headerBg: '#E8E8E8',
  // 와이어프레임 컬러
  wfGray: '#D9D9D9',      // 이미지 영역
  wfDark: '#B0B0B0',      // 진한 영역
  wfLight: '#EEEEEE',     // 연한 영역
  wfText: '#999999',      // 와이어프레임 텍스트
  wfAccent: '#C0C0C0',    // 버튼/강조
  wfBar: '#D0D0D0',       // 상태바
};

const F = {
  title: 18,
  h1: 16,
  h2: 14,
  h3: 13,
  body: 12,
  sm: 11,
  xs: 10,
  wf: 9,   // 와이어프레임 내 텍스트
  wfSm: 7, // 와이어프레임 작은 텍스트
};

// ===================================================================
//  COMMAND BUILDERS
// ===================================================================

function safeStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.filter(Boolean).join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function txt(text: string, opts: any = {}): any {
  return {
    action: 'create_text',
    text: safeStr(text),
    font_size: opts.size || F.body,
    font_weight: opts.bold ? 'Bold' : 'Regular',
    color: opts.color || C.body,
    width: opts.width,
    text_align: opts.align,
    fill_width: opts.fillWidth !== false && !opts.width,
    line_height: opts.lineHeight,
    name: opts.name,
  };
}

function rect(w: number, h: number, fill: string, opts: any = {}): any {
  return {
    action: 'create_rectangle',
    width: w, height: h, fill,
    corner_radius: opts.radius,
    fill_width: opts.fillWidth,
    fixed_height: true,
    stroke_color: opts.stroke,
    stroke_weight: opts.strokeWeight,
    name: opts.name,
  };
}

function openAL(name: string, opts: any = {}): any {
  return {
    action: 'create_auto_layout',
    name,
    direction: opts.dir || 'VERTICAL',
    gap: opts.gap ?? 0,
    padding: opts.pad,
    padding_top: opts.padT ?? opts.padV,
    padding_bottom: opts.padB ?? opts.padV,
    padding_left: opts.padL ?? opts.padH,
    padding_right: opts.padR ?? opts.padH,
    width: opts.width,
    height: opts.height,
    fill: opts.fill,
    corner_radius: opts.radius,
    fill_width: opts.fillWidth,
    fixed_height: opts.fixedHeight,
    primary_sizing: opts.primarySizing || 'AUTO',
    counter_sizing: opts.counterSizing || 'FIXED',
    align: opts.align,
    counter_align: opts.counterAlign,
    clip: opts.clip,
    stroke_color: opts.stroke,
    stroke_weight: opts.strokeWeight,
  };
}

function close(): any {
  return { action: 'close_frame' };
}

// ===================================================================
//  모듈 블록 시스템 v9
//  AI가 섹션별로 블록을 자유롭게 조합 → 렌더러가 Figma 커맨드 생성
//  copyBlocks: 문구 컬럼용 블록 배열
//  wireframeBlocks: 와이어프레임 컬럼용 블록 배열
// ===================================================================

// ── 블록 타입 정의 ──

// 문구 컬럼 블록
interface CopyBlock {
  type: 'section-title' | 'heading' | 'text' | 'label' | 'copy-main' | 'copy-sub'
    | 'image-placeholder' | 'info-box' | 'list' | 'note' | 'ae-comment'
    | 'layout-tag' | 'visual-direction' | 'divider' | 'kv-pair' | 'promo-box';
  text?: string;
  items?: string[];
  label?: string;
  value?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  bold?: boolean;
  desc?: string;  // 이미지 설명 등
}

// 와이어프레임 블록
interface WireframeBlock {
  type: 'wf-heading' | 'wf-text' | 'wf-image' | 'wf-button' | 'wf-card-grid'
    | 'wf-table' | 'wf-bar-chart' | 'wf-icon-list' | 'wf-split' | 'wf-form-input'
    | 'wf-badge-row' | 'wf-stats' | 'wf-review-card' | 'wf-product-grid'
    | 'wf-timeline' | 'wf-progress-bar' | 'wf-logo' | 'wf-promo-badge'
    | 'wf-price' | 'wf-trust-badges' | 'wf-source' | 'wf-divider' | 'wf-spacer'
    | 'wf-tabs' | 'wf-accordion' | 'wf-video' | 'wf-before-after'
    | 'wf-quote' | 'wf-number-highlight' | 'wf-checklist' | 'wf-comparison-row';
  text?: string;
  items?: Array<{ label: string; value?: string; desc?: string; percent?: number }>;
  cols?: number;       // 카드/그리드 열 수
  rows?: Array<{ cells: string[] }>;  // 테이블 행
  headers?: string[];  // 테이블 헤더
  label?: string;
  value?: string;
  desc?: string;
  height?: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bold?: boolean;
  tabs?: string[];     // 탭 이름
  before?: string;     // before-after
  after?: string;
}

// ── 블록 렌더러: 문구 컬럼 ──

function sizeToF(size?: string): number {
  switch (size) {
    case 'xs': return F.xs;
    case 'sm': return F.sm;
    case 'lg': return F.h1;
    default: return F.body;
  }
}

function renderCopyBlock(block: CopyBlock): any[] {
  const cmds: any[] = [];
  switch (block.type) {
    case 'section-title':
      cmds.push(txt(block.text || '', { size: F.h2, bold: true, color: C.sectionTitle }));
      break;
    case 'heading':
      cmds.push(txt(block.text || '', { size: sizeToF(block.size || 'md'), bold: true, color: block.color || C.black }));
      break;
    case 'text':
      cmds.push(txt(block.text || '', { size: sizeToF(block.size || 'md'), color: block.color || C.dark, lineHeight: 18, bold: block.bold }));
      break;
    case 'label':
      cmds.push(txt(block.text || '', { size: F.xs, bold: true, color: block.color || '#2563EB' }));
      break;
    case 'copy-main':
      cmds.push(txt(block.text || '', { size: F.body, bold: true, color: C.black, lineHeight: 18 }));
      break;
    case 'copy-sub':
      cmds.push(txt(block.text || '', { size: F.body, color: C.dark, lineHeight: 18 }));
      break;
    case 'image-placeholder':
      cmds.push(
        openAL('Image PH', { fill: C.bg, padV: block.text ? 20 : 30, padH: 10, fillWidth: true, counterAlign: 'CENTER', align: 'CENTER', stroke: C.border, strokeWeight: 1, gap: 4 }),
          txt(block.text || '이미지 영역', { size: F.sm, color: C.lightGray, align: 'CENTER' }),
          block.desc ? txt(block.desc, { size: F.xs, color: C.lightGray, align: 'CENTER' }) : null,
        close(),
      );
      // null 제거
      return cmds.filter(Boolean);
    case 'info-box':
      cmds.push(
        openAL('Info Box', { fill: block.color || C.bg, padV: 8, padH: 10, fillWidth: true, stroke: C.border, strokeWeight: 1, radius: 4, gap: 2 }),
          block.label ? txt(block.label, { size: F.xs, bold: true, color: C.gray }) : null,
          txt(block.text || '', { size: F.sm, color: C.dark, lineHeight: 16 }),
        close(),
      );
      return cmds.filter(Boolean);
    case 'list':
      if (block.items?.length) {
        block.items.forEach((item, i) => {
          cmds.push(
            openAL(`List ${i+1}`, { fill: i % 2 === 0 ? C.bg : C.white, padV: 5, padH: 10, fillWidth: true, gap: 2, stroke: C.border, strokeWeight: 0.5 }),
              txt(`${i + 1}. ${item}`, { size: F.sm, color: C.dark }),
              block.desc ? txt(block.desc, { size: F.xs, color: C.gray }) : null,
            close(),
          );
        });
        // filter nulls from each push
        return cmds.filter(Boolean);
      }
      break;
    case 'note':
      cmds.push(txt(block.text || '', { size: F.sm, color: block.color || C.gray, lineHeight: 16 }));
      break;
    case 'ae-comment':
      cmds.push(txt('**AE 코멘트', { size: F.xs, bold: true, color: C.aeRed }));
      cmds.push(txt(block.text || '', { size: F.sm, color: C.aeRed, lineHeight: 16 }));
      break;
    case 'layout-tag':
      cmds.push(txt(`레이아웃: ${block.text || ''}`, { size: F.sm, color: '#2563EB' }));
      break;
    case 'visual-direction':
      cmds.push(txt('비주얼 디렉션:', { size: F.xs, bold: true, color: C.gray }));
      cmds.push(txt(block.text || '', { size: F.sm, color: C.body, lineHeight: 16 }));
      break;
    case 'divider':
      cmds.push(rect(COL1 - 28, 1, C.border, { fillWidth: true }));
      break;
    case 'kv-pair':
      cmds.push(
        openAL('KV', { dir: 'HORIZONTAL', gap: 8, padV: 2, fillWidth: true }),
          txt(block.label || '', { size: F.sm, bold: true, color: C.gray, width: 80, fillWidth: false }),
          txt(block.value || '—', { size: F.sm, color: C.dark }),
        close(),
      );
      break;
    case 'promo-box':
      cmds.push(
        openAL('Promo', { fill: '#FFF8E1', padV: 8, padH: 10, fillWidth: true, counterAlign: 'CENTER', stroke: '#FFB800', strokeWeight: 1, radius: 4, gap: 2 }),
          txt(block.text || '프로모션 정보', { size: F.sm, bold: true, color: '#E65100' }),
          block.desc ? txt(block.desc, { size: F.xs, color: '#E65100' }) : null,
        close(),
      );
      return cmds.filter(Boolean);
  }
  return cmds;
}

// ── 블록 렌더러: 와이어프레임 컬럼 (폰 프레임 내부) ──

function renderWfBlock(block: WireframeBlock): any[] {
  const cmds: any[] = [];
  switch (block.type) {
    case 'wf-heading':
      cmds.push(
        openAL('WF Heading', { padV: 4, padH: 0, fillWidth: true }),
          txt(block.text || '', { size: block.bold !== false ? F.h3 : F.wf, bold: block.bold !== false, color: C.dark, align: block.align }),
        close(),
      );
      break;

    case 'wf-text':
      cmds.push(txt(block.text || '', { size: F.wf, color: block.color || C.gray, lineHeight: 13, align: block.align }));
      break;

    case 'wf-image': {
      const h = block.height || 80;
      cmds.push(
        openAL('WF Image', { fill: C.wfGray, padV: h / 3, padH: PHONE_PAD, fillWidth: true, counterAlign: 'CENTER', align: 'CENTER', gap: 4 }),
          txt(block.text || '[이미지 영역]', { size: F.wf, color: C.wfText, align: 'CENTER' }),
          block.desc ? txt(`→ ${block.desc}`, { size: F.wfSm, color: C.wfText, align: 'CENTER' }) : null,
        close(),
      );
      return cmds.filter(Boolean);
    }

    case 'wf-button':
      cmds.push(
        openAL('WF Btn', { padV: 4, fillWidth: true, counterAlign: 'CENTER', align: 'CENTER' }),
          openAL('Btn', { fill: block.color || C.wfDark, radius: 20, padV: 8, padH: 24, counterAlign: 'CENTER' }),
            txt(block.text || '버튼', { size: F.wf, bold: true, color: C.white, fillWidth: false }),
          close(),
        close(),
      );
      break;

    case 'wf-card-grid': {
      const cols = block.cols || 2;
      const items = block.items || [];
      const gap = 8;
      const cardW = (PHONE_INNER - gap * (cols - 1)) / cols;
      // 행 단위로 분할
      for (let r = 0; r < Math.ceil(items.length / cols); r++) {
        cmds.push(openAL(`Card Row ${r}`, { dir: 'HORIZONTAL', gap, fillWidth: true }));
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const item = items[idx];
          if (item) {
            cmds.push(
              openAL(`Card ${idx}`, { fill: C.wfLight, radius: 8, padV: 10, padH: 8, width: cardW, gap: 4, stroke: C.veryLightGray, strokeWeight: 0.5 }),
                rect(28, 28, C.wfGray, { radius: 6, name: `아이콘` }),
                txt(item.label, { size: F.wf, bold: true, color: C.dark }),
                item.desc ? txt(item.desc, { size: F.wfSm, color: C.gray, lineHeight: 10 }) : null,
              close(),
            );
          }
        }
        cmds.push(close());
      }
      return cmds.filter(Boolean);
    }

    case 'wf-table': {
      const headers = block.headers || [];
      const rows = block.rows || [];
      const colCount = headers.length || (rows[0]?.cells.length || 2);
      const colW = Math.floor(PHONE_INNER / colCount);
      if (headers.length > 0) {
        cmds.push(openAL('TH', { dir: 'HORIZONTAL', fill: C.wfDark, padV: 6, padH: 6, fillWidth: true }));
        headers.forEach(h => cmds.push(txt(h, { size: F.wfSm, bold: true, color: C.white, width: colW, fillWidth: false, align: 'CENTER' })));
        cmds.push(close());
      }
      rows.forEach((row, i) => {
        cmds.push(openAL(`TR${i}`, { dir: 'HORIZONTAL', fill: i % 2 === 0 ? C.wfLight : C.white, padV: 5, padH: 6, fillWidth: true, stroke: C.veryLightGray, strokeWeight: 0.5 }));
        row.cells.forEach(cell => cmds.push(txt(cell, { size: F.wfSm, color: C.dark, width: colW, fillWidth: false, align: 'CENTER' })));
        cmds.push(close());
      });
      break;
    }

    case 'wf-bar-chart': {
      const items = block.items || [];
      cmds.push(openAL('Bar Chart', { padV: 6, fillWidth: true, gap: 4 }));
      if (block.text) cmds.push(txt(block.text, { size: F.wf, bold: true, color: C.dark }));
      items.forEach(item => {
        const pct = Math.min(item.percent || 50, 100);
        cmds.push(
          openAL('Bar Row', { fillWidth: true, gap: 2 }),
            openAL('Bar Label', { dir: 'HORIZONTAL', fillWidth: true, counterAlign: 'CENTER' }),
              txt(item.label, { size: F.wfSm, color: C.dark }),
              txt(`${pct}%`, { size: F.wfSm, bold: true, color: C.dark, align: 'RIGHT' }),
            close(),
            openAL('Bar BG', { fill: C.wfLight, fillWidth: true, radius: 3 }),
              rect(PHONE_INNER * (pct / 100), 12, item.value === 'accent' ? C.wfAccent : C.wfDark, { radius: 3 }),
            close(),
          close(),
        );
      });
      cmds.push(close());
      break;
    }

    case 'wf-icon-list': {
      const items = block.items || [];
      cmds.push(openAL('Icon List', { padV: 4, fillWidth: true, gap: 6 }));
      items.forEach((item, i) => {
        cmds.push(
          openAL(`IL ${i}`, { dir: 'HORIZONTAL', gap: 8, fillWidth: true, counterAlign: 'CENTER' }),
            openAL(`IL Icon ${i}`, { fill: C.wfLight, width: 32, height: 32, radius: 16, counterAlign: 'CENTER', align: 'CENTER' }),
              txt(`${i + 1}`, { size: F.wf, bold: true, color: C.dark, fillWidth: false }),
            close(),
            openAL(`IL Text ${i}`, { gap: 2 }),
              txt(item.label, { size: F.wf, bold: true, color: C.dark }),
              item.desc ? txt(item.desc, { size: F.wfSm, color: C.gray }) : null,
            close(),
          close(),
        );
      });
      cmds.push(close());
      return cmds.filter(Boolean);
    }

    case 'wf-split': {
      const halfW = (PHONE_INNER - 8) / 2;
      cmds.push(
        openAL('Split', { dir: 'HORIZONTAL', fillWidth: true, gap: 8 }),
          openAL('Split Left', { width: halfW, gap: 6, padV: 8 }),
            txt(block.text || '텍스트 영역', { size: F.wf, color: C.dark, lineHeight: 12 }),
            block.desc ? txt(block.desc, { size: F.wfSm, color: C.gray, lineHeight: 10 }) : null,
          close(),
          openAL('Split Right', { fill: C.wfGray, width: halfW, padV: 24, counterAlign: 'CENTER', align: 'CENTER' }),
            txt(block.label || '[이미지]', { size: F.wf, color: C.wfText, align: 'CENTER' }),
          close(),
        close(),
      );
      return cmds.filter(Boolean);
    }

    case 'wf-form-input': {
      const items = block.items || [{ label: '입력 필드' }];
      cmds.push(openAL('Form', { padV: 4, fillWidth: true, gap: 6 }));
      items.forEach((item, i) => {
        cmds.push(
          openAL(`Input ${i}`, { fill: C.wfLight, padV: 8, padH: 10, fillWidth: true, radius: 6, stroke: C.veryLightGray, strokeWeight: 1 }),
            txt(item.label, { size: F.wf, color: C.lightGray }),
          close(),
        );
      });
      cmds.push(close());
      break;
    }

    case 'wf-badge-row': {
      const items = block.items || [];
      cmds.push(openAL('Badges', { dir: 'HORIZONTAL', fillWidth: true, gap: 6, counterAlign: 'CENTER', align: 'CENTER' }));
      items.forEach((item, i) => {
        cmds.push(
          openAL(`Badge ${i}`, { counterAlign: 'CENTER', align: 'CENTER', gap: 3 }),
            rect(40, 40, C.wfGray, { radius: 20, name: item.label }),
            txt(item.label, { size: F.wfSm, color: C.dark, align: 'CENTER' }),
          close(),
        );
      });
      cmds.push(close());
      break;
    }

    case 'wf-stats': {
      const items = block.items || [];
      const statW = items.length > 0 ? Math.floor(PHONE_INNER / items.length) : PHONE_INNER;
      cmds.push(
        openAL('Stats', { dir: 'HORIZONTAL', fill: C.wfLight, padV: 10, fillWidth: true, gap: 4, counterAlign: 'CENTER' }),
      );
      items.forEach(item => {
        cmds.push(
          openAL('Stat', { width: statW, counterAlign: 'CENTER', align: 'CENTER', gap: 2 }),
            txt(item.value || '00%', { size: F.h2, bold: true, color: C.dark, align: 'CENTER' }),
            txt(item.label, { size: F.wfSm, color: C.gray, align: 'CENTER' }),
          close(),
        );
      });
      cmds.push(close());
      break;
    }

    case 'wf-review-card': {
      const items = block.items || [{ label: '리뷰 텍스트', desc: '리뷰어' }];
      items.forEach((item, i) => {
        cmds.push(
          openAL(`Review ${i}`, { fill: C.wfLight, radius: 8, padV: 8, padH: 10, fillWidth: true, gap: 3, stroke: C.veryLightGray, strokeWeight: 0.5 }),
            openAL(`R Top ${i}`, { dir: 'HORIZONTAL', fillWidth: true, counterAlign: 'CENTER' }),
              txt('★★★★★', { size: F.wfSm, color: '#FFB800', fillWidth: false }),
              txt(item.value || '구매 인증', { size: F.wfSm, color: C.lightGray }),
            close(),
            txt(`"${item.label}"`, { size: F.wf, color: C.dark, lineHeight: 12 }),
            txt(`— ${item.desc || '구매자'}`, { size: F.wfSm, color: C.lightGray }),
          close(),
        );
      });
      break;
    }

    case 'wf-product-grid': {
      const items = block.items || [];
      const cols = block.cols || 3;
      const prodW = (PHONE_INNER - 8 * (cols - 1)) / cols;
      cmds.push(openAL('Prod Grid', { dir: 'HORIZONTAL', fillWidth: true, gap: 8, counterAlign: 'MIN' }));
      items.slice(0, cols).forEach((item, i) => {
        cmds.push(
          openAL(`Prod ${i}`, { width: prodW, counterAlign: 'CENTER', align: 'CENTER', gap: 3, padV: 6 }),
            rect(prodW - 8, prodW - 8, C.wfGray, { radius: 8, name: `${item.label} 패키지` }),
            txt(item.label, { size: F.wf, bold: true, color: C.dark, align: 'CENTER' }),
            item.desc ? txt(item.desc, { size: F.wfSm, color: C.gray, align: 'CENTER' }) : null,
            item.value ? txt(item.value, { size: F.wf, bold: true, color: C.dark, align: 'CENTER' }) : null,
          close(),
        );
      });
      cmds.push(close());
      return cmds.filter(Boolean);
    }

    case 'wf-timeline': {
      const items = block.items || [];
      cmds.push(openAL('Timeline', { padV: 4, fillWidth: true, gap: 6 }));
      items.forEach((item, i) => {
        cmds.push(
          openAL(`TL ${i}`, { dir: 'HORIZONTAL', gap: 8, fillWidth: true, counterAlign: 'CENTER' }),
            openAL(`TL Dot ${i}`, { fill: i === items.length - 1 ? C.wfAccent : C.wfDark, width: 10, height: 10, radius: 5 }),
            close(),
            openAL(`TL Content ${i}`, { gap: 1 }),
              txt(item.label, { size: F.wf, bold: true, color: C.dark }),
              item.desc ? txt(item.desc, { size: F.wfSm, color: C.gray }) : null,
            close(),
          close(),
        );
      });
      cmds.push(close());
      return cmds.filter(Boolean);
    }

    case 'wf-progress-bar': {
      const items = block.items || [];
      cmds.push(openAL('Progress Bars', { padV: 4, fillWidth: true, gap: 4 }));
      items.forEach(item => {
        const pct = Math.min(item.percent || 50, 100);
        cmds.push(
          openAL('PB Row', { dir: 'HORIZONTAL', fillWidth: true, gap: 4, counterAlign: 'CENTER' }),
            txt(item.label, { size: F.wfSm, color: C.gray, width: 60, fillWidth: false }),
            openAL('PB BG', { fill: C.veryLightGray, fillWidth: true, radius: 3 }),
              rect(PHONE_INNER * 0.6 * (pct / 100), 12, C.wfDark, { radius: 3 }),
            close(),
            txt(`${pct}%`, { size: F.wfSm, bold: true, color: C.dark, width: 28, fillWidth: false }),
          close(),
        );
      });
      cmds.push(close());
      break;
    }

    case 'wf-logo':
      cmds.push(
        openAL('Logo', { padV: 4, fillWidth: true, counterAlign: 'CENTER', align: block.align || 'center' as any }),
          rect(block.height || 60, 18, C.wfDark, { radius: 2, name: block.text || '로고' }),
        close(),
      );
      break;

    case 'wf-promo-badge':
      cmds.push(
        openAL('Promo', { fill: '#FFF3E0', padV: 6, padH: 12, fillWidth: true, counterAlign: 'CENTER', align: 'CENTER', radius: 8, stroke: '#FFB800', strokeWeight: 1 }),
          txt(block.text || '프로모션', { size: F.wf, bold: true, color: '#E65100', align: 'CENTER' }),
        close(),
      );
      break;

    case 'wf-price':
      cmds.push(
        openAL('Price', { padV: 4, fillWidth: true, counterAlign: 'CENTER', align: 'CENTER', gap: 2 }),
          openAL('Price Row', { dir: 'HORIZONTAL', gap: 6, counterAlign: 'CENTER' }),
            block.label ? txt(block.label, { size: F.wf, color: C.lightGray, fillWidth: false }) : null,
            block.label ? txt('→', { size: F.wf, color: C.gray, fillWidth: false }) : null,
            txt(block.text || '₩00,000', { size: F.h2, bold: true, color: C.dark, fillWidth: false }),
          close(),
        close(),
      );
      return cmds.filter(Boolean);

    case 'wf-trust-badges': {
      const items = block.items || [{ label: '무료배송' }, { label: '100%환불' }, { label: '당일발송' }];
      cmds.push(
        openAL('Trust', { dir: 'HORIZONTAL', padV: 6, fillWidth: true, gap: 10, counterAlign: 'CENTER', align: 'CENTER' }),
      );
      items.forEach(item => cmds.push(txt(item.label, { size: F.wfSm, color: C.gray, fillWidth: false })));
      cmds.push(close());
      break;
    }

    case 'wf-source':
      cmds.push(txt(block.text || '* 출처 표기', { size: F.wfSm, color: C.lightGray }));
      break;

    case 'wf-divider':
      cmds.push(rect(PHONE_INNER, 1, block.color || C.veryLightGray, { fillWidth: true }));
      break;

    case 'wf-spacer':
      cmds.push(rect(PHONE_INNER, block.height || 12, C.white, { fillWidth: true }));
      break;

    case 'wf-tabs': {
      const tabs = block.tabs || ['탭 1', '탭 2', '탭 3'];
      cmds.push(openAL('Tabs', { dir: 'HORIZONTAL', fill: C.wfLight, fillWidth: true, gap: 0 }));
      tabs.forEach((tab, i) => {
        cmds.push(
          openAL(`Tab ${i}`, { padV: 6, padH: 12, counterAlign: 'CENTER', fill: i === 0 ? C.white : C.wfLight, stroke: i === 0 ? C.wfDark : undefined, strokeWeight: i === 0 ? 1 : undefined }),
            txt(tab, { size: F.wf, bold: i === 0, color: i === 0 ? C.dark : C.gray, fillWidth: false }),
          close(),
        );
      });
      cmds.push(close());
      break;
    }

    case 'wf-accordion': {
      const items = block.items || [{ label: '항목 1' }, { label: '항목 2' }];
      items.forEach((item, i) => {
        cmds.push(
          openAL(`Acc ${i}`, { fill: i === 0 ? C.wfLight : C.white, padV: 8, padH: 10, fillWidth: true, gap: i === 0 ? 4 : 0, stroke: C.veryLightGray, strokeWeight: 0.5 }),
            openAL(`Acc Head ${i}`, { dir: 'HORIZONTAL', fillWidth: true, counterAlign: 'CENTER' }),
              txt(item.label, { size: F.wf, bold: true, color: C.dark }),
              txt(i === 0 ? '▲' : '▼', { size: F.wf, color: C.gray, align: 'RIGHT' }),
            close(),
            i === 0 && item.desc ? txt(item.desc, { size: F.wfSm, color: C.gray, lineHeight: 10 }) : null,
          close(),
        );
      });
      return cmds.filter(Boolean);
    }

    case 'wf-video':
      cmds.push(
        openAL('Video', { fill: C.wfGray, padV: 28, padH: PHONE_PAD, fillWidth: true, counterAlign: 'CENTER', align: 'CENTER', gap: 4 }),
          txt('▶', { size: F.h1, color: C.white, align: 'CENTER' }),
          txt(block.text || '[영상 영역]', { size: F.wfSm, color: C.wfText, align: 'CENTER' }),
        close(),
      );
      break;

    case 'wf-before-after': {
      const halfW = (PHONE_INNER - 8) / 2;
      cmds.push(
        openAL('BA', { dir: 'HORIZONTAL', fillWidth: true, gap: 8 }),
          openAL('Before', { fill: C.wfLight, width: halfW, padV: 20, counterAlign: 'CENTER', align: 'CENTER', gap: 3, radius: 8 }),
            txt('BEFORE', { size: F.wfSm, bold: true, color: C.gray, align: 'CENTER' }),
            txt(block.before || '[이전 이미지]', { size: F.wfSm, color: C.wfText, align: 'CENTER' }),
          close(),
          openAL('After', { fill: C.wfGray, width: halfW, padV: 20, counterAlign: 'CENTER', align: 'CENTER', gap: 3, radius: 8 }),
            txt('AFTER', { size: F.wfSm, bold: true, color: C.dark, align: 'CENTER' }),
            txt(block.after || '[이후 이미지]', { size: F.wfSm, color: C.wfText, align: 'CENTER' }),
          close(),
        close(),
      );
      break;
    }

    case 'wf-quote':
      cmds.push(
        openAL('Quote', { fill: C.wfLight, padV: 10, padH: 12, fillWidth: true, gap: 4, radius: 4 }),
          txt(`"${block.text || '인용 텍스트'}"`, { size: F.wf, color: C.dark, lineHeight: 13 }),
          block.desc ? txt(`— ${block.desc}`, { size: F.wfSm, color: C.gray }) : null,
        close(),
      );
      return cmds.filter(Boolean);

    case 'wf-number-highlight': {
      const items = block.items || [{ label: '수치', value: '00%' }];
      cmds.push(openAL('Numbers', { dir: 'HORIZONTAL', fillWidth: true, gap: 8, counterAlign: 'CENTER', align: 'CENTER' }));
      items.forEach(item => {
        cmds.push(
          openAL('Num', { counterAlign: 'CENTER', align: 'CENTER', gap: 2 }),
            txt(item.value || '00', { size: F.h1, bold: true, color: C.dark, align: 'CENTER' }),
            txt(item.label, { size: F.wfSm, color: C.gray, align: 'CENTER' }),
          close(),
        );
      });
      cmds.push(close());
      break;
    }

    case 'wf-checklist': {
      const items = block.items || [];
      items.forEach(item => {
        cmds.push(
          openAL('Check', { dir: 'HORIZONTAL', gap: 6, fillWidth: true, counterAlign: 'CENTER', padV: 2 }),
            txt('✓', { size: F.wf, bold: true, color: C.wfDark, fillWidth: false }),
            txt(item.label, { size: F.wf, color: C.dark }),
          close(),
        );
      });
      break;
    }

    case 'wf-comparison-row': {
      const items = block.items || [];
      items.forEach((item, i) => {
        cmds.push(
          openAL(`CR ${i}`, { dir: 'HORIZONTAL', fill: i % 2 === 0 ? C.wfLight : C.white, padV: 5, padH: 6, fillWidth: true, stroke: C.veryLightGray, strokeWeight: 0.5, counterAlign: 'CENTER' }),
            txt(item.label, { size: F.wfSm, color: C.dark, width: 60, fillWidth: false }),
            txt(item.value || '△', { size: F.wfSm, color: C.lightGray, width: 60, fillWidth: false, align: 'CENTER' }),
            txt(item.desc || '●', { size: F.wfSm, bold: true, color: C.dark, width: 60, fillWidth: false, align: 'CENTER' }),
          close(),
        );
      });
      break;
    }
  }
  return cmds;
}

// ── 폰 프레임 (와이어프레임 컨테이너) ──

function phoneStart(brandName: string): any[] {
  return [
    openAL('Phone Frame', {
      width: PHONE_W, fill: C.white, radius: 16, padV: 0, padH: 0,
      gap: 0, clip: true, stroke: C.veryLightGray, strokeWeight: 1,
    }),
      openAL('Status Bar', { dir: 'HORIZONTAL', fill: C.wfBar, padV: 6, padH: PHONE_PAD, fillWidth: true, counterAlign: 'CENTER' }),
        txt('←', { size: F.wf, color: C.wfText, width: 20, fillWidth: false }),
        txt(brandName, { size: F.wf, bold: true, color: C.wfText, align: 'CENTER' }),
      close(),
  ];
}

function phoneEnd(): any[] {
  return [close()];
}

// ── 블록 배열을 폰 프레임으로 감싸서 렌더링 ──
function renderWireframeBlocks(brandName: string, blocks: WireframeBlock[]): any[] {
  const cmds: any[] = [];
  cmds.push(...phoneStart(brandName));
  cmds.push(openAL('WF Content', { padV: 8, padH: PHONE_PAD, fillWidth: true, gap: 6 }));
  for (const block of blocks) {
    cmds.push(...renderWfBlock(block));
  }
  cmds.push(close()); // WF Content
  cmds.push(...phoneEnd());
  return cmds;
}

// ── 문구 블록 배열 렌더링 ──
function renderCopyBlocks(blocks: CopyBlock[]): any[] {
  const cmds: any[] = [];
  for (const block of blocks) {
    cmds.push(...renderCopyBlock(block));
  }
  return cmds;
}

// ===================================================================
//  FALLBACK: AI가 블록 배열을 제공하지 않을 때 사용하는 자동 생성기
//  기존 템플릿 기반 — 블록 시스템이 우선, 이것은 하위호환용
// ===================================================================

function fallbackCopyBlocks(sectionNum: number, sectionName: string, sec: any): CopyBlock[] {
  const blocks: CopyBlock[] = [];
  blocks.push({ type: 'section-title', text: `섹션 ${sectionNum}  ${sectionName}` });
  if (sec.planningIntent || sec.description) blocks.push({ type: 'note', text: safeStr(sec.planningIntent || sec.description) });
  if (sec.mainCopy) { blocks.push({ type: 'label', text: '메인 카피' }); blocks.push({ type: 'copy-main', text: safeStr(sec.mainCopy) }); }
  if (sec.subCopy) { blocks.push({ type: 'label', text: '서브 카피' }); blocks.push({ type: 'copy-sub', text: safeStr(sec.subCopy) }); }
  if (sec.productName) blocks.push({ type: 'heading', text: safeStr(sec.productName), size: 'sm' });
  blocks.push({ type: 'image-placeholder', text: `이미지 영역`, desc: sec.visualDirection ? safeStr(sec.visualDirection).substring(0, 50) : undefined });
  if (sec.visualDirection) blocks.push({ type: 'visual-direction', text: safeStr(sec.visualDirection) });
  if (sec.layout) blocks.push({ type: 'layout-tag', text: safeStr(sec.layout) });
  if (sec.aeCommentary) blocks.push({ type: 'ae-comment', text: safeStr(sec.aeCommentary) });
  return blocks;
}

function fallbackWfBlocks(sectionName: string, sec: any): WireframeBlock[] {
  const blocks: WireframeBlock[] = [];
  blocks.push({ type: 'wf-heading', text: sectionName });
  if (sec.mainCopy) blocks.push({ type: 'wf-text', text: safeStr(sec.mainCopy) });
  blocks.push({ type: 'wf-image', text: '[메인 이미지/비주얼]', desc: sec.visualDirection ? safeStr(sec.visualDirection).substring(0, 35) : undefined });
  if (sec.subCopy) blocks.push({ type: 'wf-text', text: safeStr(sec.subCopy).substring(0, 80) });
  return blocks;
}

// ── 섹션 행 (블록 기반, 레퍼런스 3컬럼 지원) ──
function sectionRow2Col(
  sectionNum: number,
  sectionName: string,
  brandName: string,
  sec: any,
  hasAnyReference: boolean = false,
): any[] {
  const cmds: any[] = [];
  const refUrl = sec.referenceImageUrl;

  cmds.push(
    openAL(`섹션 ${sectionNum}`, {
      dir: 'HORIZONTAL',
      width: hasAnyReference ? W3 : undefined,
      fillWidth: !hasAnyReference,
      stroke: C.border, strokeWeight: BORDER_W,
    }),
  );

  // ── COL 1: 문구 ──
  cmds.push(
    openAL(`문구 ${sectionNum}`, {
      width: COL1, padV: 16, padH: 14, gap: 10,
      stroke: C.border, strokeWeight: BORDER_W,
    }),
  );

  const copyBlocks: CopyBlock[] = sec.copyBlocks?.length > 0
    ? sec.copyBlocks
    : fallbackCopyBlocks(sectionNum, sectionName, sec);
  cmds.push(...renderCopyBlocks(copyBlocks));

  cmds.push(close()); // COL 1

  // ── COL 2: 디자인 구조 (와이어프레임) ──
  cmds.push(
    openAL(`디자인구조 ${sectionNum}`, {
      width: COL2, padV: 16, padH: 20, gap: 8,
      stroke: C.border, strokeWeight: BORDER_W,
      counterAlign: 'CENTER', align: 'CENTER',
    }),
  );

  const wfBlocks: WireframeBlock[] = sec.wireframeBlocks?.length > 0
    ? sec.wireframeBlocks
    : fallbackWfBlocks(sectionName, sec);
  cmds.push(...renderWireframeBlocks(brandName, wfBlocks));

  cmds.push(close()); // COL 2

  // ── COL 3: 레퍼런스 디자인 (있을 때만) ──
  if (hasAnyReference) {
    cmds.push(
      openAL(`레퍼런스 ${sectionNum}`, {
        width: COL3, padV: 16, padH: 12, gap: 8,
        stroke: C.border, strokeWeight: BORDER_W,
        counterAlign: 'CENTER', align: 'CENTER',
      }),
    );

    if (refUrl) {
      // 레퍼런스 이미지 배치
      cmds.push(
        txt('레퍼런스', { size: F.xs, bold: true, color: C.gray, align: 'CENTER' }),
        {
          action: 'create_image',
          url: refUrl,
          name: `레퍼런스 섹션${sectionNum}`,
          width: COL3 - 24,
          height: Math.round((COL3 - 24) * 1.5), // 모바일 비율
        },
      );
      // 레퍼런스 메모
      if (sec.referenceNote) {
        cmds.push(txt(safeStr(sec.referenceNote), { size: F.xs, color: C.gray, lineHeight: 14 }));
      }
    } else {
      // 레퍼런스 없는 섹션은 빈 영역
      cmds.push(
        openAL('Empty Ref', { fill: C.bg, padV: 40, padH: 10, fillWidth: true, counterAlign: 'CENTER', align: 'CENTER' }),
          txt('—', { size: F.sm, color: C.lightGray, align: 'CENTER' }),
        close(),
      );
    }

    cmds.push(close()); // COL 3
  }

  cmds.push(close()); // Row

  return cmds;
}

// ===================================================================
//  아래는 더 이상 사용하지 않는 레거시 와이어프레임 함수들 (참고용)
//  새 시스템: AI → copyBlocks/wireframeBlocks → 렌더러 → Figma
// ===================================================================

// [레거시 삭제됨 — 블록 시스템으로 완전 대체]


// ===================================================================
//  공통 컴포넌트
// ===================================================================

function projectHeader(projectName: string): any[] {
  return [
    openAL('Project Header', {
      dir: 'HORIZONTAL', fill: C.white, padV: 10, padH: 12,
      fillWidth: true, stroke: C.border, strokeWeight: BORDER_W,
      counterAlign: 'CENTER',
    }),
      txt(projectName, { size: F.title, bold: true, color: C.black }),
    close(),
  ];
}

function columnHeaders2(hasReference: boolean = false): any[] {
  const cmds: any[] = [
    openAL('Column Headers', {
      dir: 'HORIZONTAL', fill: C.headerBg,
      width: hasReference ? W3 : W,
      stroke: C.border, strokeWeight: BORDER_W,
    }),
      openAL('Col Header 1', { width: COL1, padV: 10, padH: 12, align: 'CENTER', counterAlign: 'CENTER', stroke: C.border, strokeWeight: BORDER_W }),
        txt('문구', { size: F.h2, bold: true, color: C.dark, align: 'CENTER' }),
      close(),
      openAL('Col Header 2', { width: COL2, padV: 10, padH: 12, align: 'CENTER', counterAlign: 'CENTER', stroke: C.border, strokeWeight: BORDER_W }),
        txt('디자인 구조', { size: F.h2, bold: true, color: C.dark, align: 'CENTER' }),
      close(),
  ];
  if (hasReference) {
    cmds.push(
      openAL('Col Header 3', { width: COL3, padV: 10, padH: 12, align: 'CENTER', counterAlign: 'CENTER', stroke: C.border, strokeWeight: BORDER_W }),
        txt('레퍼런스 디자인', { size: F.h2, bold: true, color: C.dark, align: 'CENTER' }),
      close(),
    );
  }
  cmds.push(close());
  return cmds;
}

// 기본 문서 컴포넌트
function docHeader(brandName: string, docTitle: string): any[] {
  return [
    openAL('Header', {
      dir: 'HORIZONTAL', fill: C.headerBg, padV: 10, padH: 16,
      fillWidth: true, counterAlign: 'CENTER',
      stroke: C.border, strokeWeight: BORDER_W,
    }),
      txt(`${brandName} | ${docTitle}`, { size: F.h2, bold: true, color: C.dark }),
      txt('D:OPT', { size: F.h2, bold: true, color: C.dark, align: 'RIGHT', width: 60, fillWidth: false }),
    close(),
  ];
}

function simpleSectionTitle(num: number | string, title: string): any[] {
  return [
    rect(W, 1, C.border, { fillWidth: true }),
    openAL(`섹션 ${num}`, { dir: 'HORIZONTAL', gap: 8, padV: 10, padH: 16, fillWidth: true, counterAlign: 'CENTER' }),
      openAL('Badge', { fill: C.bg, padV: 4, padH: 10, counterAlign: 'CENTER' }),
        txt(`${num}`, { size: F.sm, bold: true, color: C.dark, fillWidth: false }),
      close(),
      txt(String(title), { size: F.h2, bold: true, color: C.black }),
    close(),
  ];
}

function kvRow(label: string, value: string): any[] {
  return [
    openAL('KV', { dir: 'HORIZONTAL', gap: 8, padV: 3, fillWidth: true }),
      txt(label, { size: F.sm, bold: true, color: C.gray, width: 90, fillWidth: false }),
      txt(value || '—', { size: F.sm, color: C.dark }),
    close(),
  ];
}

function infoCard(label: string, content: string): any[] {
  if (!content) return [];
  return [
    openAL('Info', { fill: C.bg, padV: 10, padH: 14, gap: 4, fillWidth: true, stroke: C.border, strokeWeight: 1 }),
      txt(label, { size: F.xs, bold: true, color: C.gray }),
      txt(content, { size: F.body, color: C.dark, lineHeight: 18 }),
    close(),
  ];
}

function tableHeader(cols: { text: string; width: number }[]): any[] {
  const cmds: any[] = [
    openAL('Table Header', { dir: 'HORIZONTAL', fill: C.headerBg, padV: 8, padH: 12, gap: 0, fillWidth: true, stroke: C.border, strokeWeight: 1 }),
  ];
  for (const col of cols) cmds.push(txt(col.text, { size: F.xs, bold: true, color: C.dark, width: col.width, fillWidth: false }));
  cmds.push(close());
  return cmds;
}

function tableRow(cols: { text: string; width: number; bold?: boolean; color?: string }[], even: boolean): any[] {
  const cmds: any[] = [
    openAL('Row', { dir: 'HORIZONTAL', fill: even ? C.bg : C.white, padV: 6, padH: 12, gap: 0, fillWidth: true, stroke: C.border, strokeWeight: 0.5 }),
  ];
  for (const col of cols) cmds.push(txt(col.text, { size: F.sm, bold: col.bold, color: col.color || C.body, width: col.width, fillWidth: false }));
  cmds.push(close());
  return cmds;
}

function docFooter(): any[] {
  return [
    rect(W, 1, C.border, { fillWidth: true }),
    openAL('Footer', { dir: 'HORIZONTAL', padV: 8, padH: 16, fillWidth: true, counterAlign: 'CENTER' }),
      txt('D:OPT STUDIO', { size: F.xs, bold: true, color: C.gray, width: 80, fillWidth: false }),
      txt(new Date().toLocaleDateString('ko-KR'), { size: F.xs, color: C.lightGray, align: 'RIGHT', width: 100, fillWidth: false }),
    close(),
  ];
}


// ===================================================================
//  STEP 0: 시장조사 리포트
// ===================================================================
function buildStep0(data: any, title: string): any[] {
  const cmds: any[] = [
    { action: 'create_page', name: `[시장조사] ${title}` },
    openAL(`[시장조사] ${title}`, { width: W, gap: 0, fill: C.white, counterSizing: 'FIXED', clip: true }),
  ];
  cmds.push(...docHeader(title, '시장조사 리포트'));
  cmds.push(openAL('Content', { padV: 16, padH: 16, gap: 16, fillWidth: true }));

  if (data.competitors?.length > 0 && data.competitors.some((c: any) => c.name)) {
    cmds.push(...simpleSectionTitle(1, '경쟁사 상세페이지 분석'));
    cmds.push(openAL('Competitors', { gap: 0, fillWidth: true }));
    cmds.push(...tableHeader([
      { text: 'No.', width: 36 }, { text: '브랜드', width: 130 },
      { text: '강점', width: 340 }, { text: '페이지 구조', width: 340 },
    ]));
    data.competitors.forEach((comp: any, i: number) => {
      if (!comp.name) return;
      cmds.push(...tableRow([
        { text: `${i + 1}`, width: 36 }, { text: safeStr(comp.name), width: 130, bold: true },
        { text: safeStr(comp.strengths), width: 340 }, { text: safeStr(comp.pageStructure), width: 340 },
      ], i % 2 === 0));
    });
    cmds.push(close());
  }
  if (data.trends || data.keywords) {
    cmds.push(...simpleSectionTitle(2, '트렌드 & 키워드'));
    if (data.trends) cmds.push(...infoCard('트렌드', safeStr(data.trends)));
    if (data.keywords) cmds.push(...infoCard('키워드', safeStr(data.keywords)));
  }
  if (data.targetInsight) { cmds.push(...simpleSectionTitle(3, '타겟 인사이트')); cmds.push(...infoCard('인사이트', safeStr(data.targetInsight))); }
  if (data.adRegulations) { cmds.push(...simpleSectionTitle(4, '광고심의')); cmds.push(...infoCard('주의사항', safeStr(data.adRegulations))); }
  if (data.researchSummary) { cmds.push(...simpleSectionTitle(5, '종합 정리')); cmds.push(...infoCard('요약', safeStr(data.researchSummary))); }

  cmds.push(close());
  cmds.push(...docFooter());
  cmds.push(close());
  return cmds;
}


// ===================================================================
//  STEP 1: 브리프
// ===================================================================
function buildStep1(data: any, title: string): any[] {
  const cmds: any[] = [
    { action: 'create_page', name: `[브리프] ${title}` },
    openAL(`[브리프] ${title}`, { width: W, gap: 0, fill: C.white, counterSizing: 'FIXED', clip: true }),
  ];
  const brandName = safeStr(data.productName) || title;
  cmds.push(...docHeader(brandName, '브리프'));
  cmds.push(openAL('Content', { padV: 16, padH: 16, gap: 16, fillWidth: true }));

  cmds.push(...simpleSectionTitle(1, '제품 개요'));
  cmds.push(openAL('Info', { fill: C.bg, padV: 12, padH: 14, gap: 4, fillWidth: true, stroke: C.border, strokeWeight: 1 }));
  [{ l: '제품명', v: data.productName }, { l: '슬로건', v: data.slogan }, { l: '타겟', v: data.mainTarget }, { l: '매스 타겟', v: data.massTarget }]
    .filter(f => f.v).forEach(f => cmds.push(...kvRow(f.l, safeStr(f.v))));
  cmds.push(close());

  if (data.uspTable?.length > 0) {
    cmds.push(...simpleSectionTitle(2, 'USP 분석'));
    cmds.push(openAL('USP', { gap: 0, fillWidth: true }));
    cmds.push(...tableHeader([{ text: 'No.', width: 30 }, { text: '항목', width: 100 }, { text: '상세', width: 260 }, { text: '경쟁사', width: 160 }, { text: '표현', width: 296 }]));
    data.uspTable.forEach((u: any, i: number) => { if (!u.item) return; cmds.push(...tableRow([{ text: `${i+1}`, width: 30 }, { text: safeStr(u.item), width: 100, bold: true }, { text: safeStr(u.detail), width: 260 }, { text: safeStr(u.vsCompetitor), width: 160 }, { text: safeStr(u.direction), width: 296 }], i%2===0)); });
    cmds.push(close());
  }

  if (data.tocSections?.length > 0) {
    cmds.push(...simpleSectionTitle(3, '목차'));
    data.tocSections.forEach((s: any, i: number) => { if (!s.name) return; cmds.push(openAL(`TOC${i+1}`, { dir:'HORIZONTAL', fill: i%2===0?C.bg:C.white, padV:6, padH:14, gap:8, fillWidth:true }), txt(`${i+1}.`, { size:F.sm, bold:true, color:C.dark, width:20, fillWidth:false }), txt(safeStr(s.name), { size:F.sm, color:C.dark }), close()); });
  }

  if (data.aeCommentary) { cmds.push(...simpleSectionTitle(5, "AE's Commentary")); cmds.push(txt(safeStr(data.aeCommentary), { size:F.body, color:C.sectionTitle, lineHeight:18 })); }

  cmds.push(close());
  cmds.push(...docFooter());
  cmds.push(close());
  return cmds;
}


// ===================================================================
//  STEP 5: 기획안 — 2컬럼 (문구 | 디자인 구조 와이어프레임)
// ===================================================================
function buildStep5(data: any, title: string): any[] {
  if (!data) data = {};
  const brandName = safeStr(data.brandName || data.productName) || title;
  const designTone = safeStr(data.designTone);
  const projectLabel = `[${brandName}] ${designTone || ''} 기획 초안`.trim();

  // 레퍼런스 이미지가 하나라도 있으면 3컬럼 모드
  const hasRef = data.sections?.some((s: any) => s.referenceImageUrl) || false;
  const frameWidth = hasRef ? W3 : W;

  const cmds: any[] = [
    { action: 'create_page', name: `[기획안] ${title}` },
    openAL(`[기획안] ${title}`, { width: frameWidth, gap: 0, fill: C.white, counterSizing: 'FIXED', clip: true }),
  ];

  // 프로젝트 헤더
  cmds.push(...projectHeader(projectLabel));

  // 컬럼 헤더 (2컬럼 또는 3컬럼)
  cmds.push(...columnHeaders2(hasRef));

  // 기획 총평
  if (data.overallNote) {
    cmds.push(
      openAL('Overall', { fill: C.bg, padV: 10, padH: 14, fillWidth: true, stroke: C.border, strokeWeight: BORDER_W }),
        txt(safeStr(data.overallNote), { size: F.sm, color: C.body, lineHeight: 16 }),
      close(),
    );
  }

  // 섹션별 행 (문구 + 와이어프레임 + 레퍼런스)
  if (data.sections?.length > 0) {
    for (let i = 0; i < data.sections.length; i++) {
      const sec = data.sections[i];
      if (!sec.name) continue;

      cmds.push(...sectionRow2Col(
        i + 1,
        safeStr(sec.name),
        brandName,
        {
          mainCopy: sec.mainCopy,
          subCopy: sec.subCopy,
          visualDirection: sec.visualDirection,
          layout: sec.layout,
          aeCommentary: sec.aeCommentary,
          description: sec.description,
          planningIntent: sec.planningIntent || sec.intent,
          productName: sec.productName,
          // 블록 시스템: AI가 제공한 블록 배열 전달
          copyBlocks: sec.copyBlocks,
          wireframeBlocks: sec.wireframeBlocks,
          // 레퍼런스 이미지
          referenceImageUrl: sec.referenceImageUrl,
          referenceNote: sec.referenceNote,
        },
        hasRef,
      ));
    }
  }

  cmds.push(...docFooter());
  cmds.push(close());
  return cmds;
}


// ===================================================================
//  STEP 8: 촬영콘티
// ===================================================================
function buildStep8(data: any, title: string): any[] {
  const cmds: any[] = [
    { action: 'create_page', name: `[촬영콘티] ${title}` },
    openAL(`[촬영콘티] ${title}`, { width: W, gap: 0, fill: C.white, counterSizing: 'FIXED', clip: true }),
  ];
  cmds.push(...docHeader(title, '촬영콘티'));
  cmds.push(openAL('Content', { padV: 16, padH: 16, gap: 16, fillWidth: true }));

  cmds.push(...simpleSectionTitle(1, '촬영 기본 정보'));
  cmds.push(openAL('Info', { fill: C.bg, padV: 12, padH: 14, gap: 4, fillWidth: true, stroke: C.border, strokeWeight: 1 }));
  [{ l:'촬영일', v:data.shootDate }, { l:'장소', v:data.location }, { l:'팀', v:data.team },
   { l:'총 컷', v: data.totalCuts ? `${data.totalCuts}컷` : undefined }].filter(f=>f.v).forEach(f => cmds.push(...kvRow(f.l, safeStr(f.v))));
  cmds.push(close());

  const concept = data.conceptSummary || {};
  if (concept.background || concept.keyColor) {
    cmds.push(...simpleSectionTitle(2, '콘셉트'));
    cmds.push(openAL('Concept', { fill: C.bg, padV: 12, padH: 14, gap: 4, fillWidth: true, stroke: C.border, strokeWeight: 1 }));
    if (concept.background) cmds.push(...kvRow('배경', safeStr(concept.background)));
    if (concept.keyColor) cmds.push(...kvRow('키컬러', safeStr(concept.keyColor)));
    if (concept.lighting) cmds.push(...kvRow('조명', safeStr(concept.lighting)));
    if (concept.mood) cmds.push(...kvRow('무드', safeStr(concept.mood)));
    cmds.push(close());
  }

  if (data.cutDetails?.length > 0) {
    cmds.push(...simpleSectionTitle(3, '촬영 컷 상세'));
    cmds.push(openAL('Cuts', { gap: 0, fillWidth: true }));
    cmds.push(...tableHeader([{ text:'No.', width:36 }, { text:'유형', width:60 }, { text:'콘셉트', width:220 }, { text:'구도', width:220 }, { text:'비고', width:310 }]));
    data.cutDetails.forEach((c: any, i: number) => {
      if (!c.concept && !c.composition) return;
      cmds.push(...tableRow([{ text:`${i+1}`, width:36 }, { text:safeStr(c.type)||'연출', width:60, bold:true }, { text:safeStr(c.concept), width:220 }, { text:safeStr(c.composition), width:220 }, { text:[safeStr(c.props),safeStr(c.note)].filter(Boolean).join(' / '), width:310 }], i%2===0));
    });
    cmds.push(close());
  }

  cmds.push(close());
  cmds.push(...docFooter());
  cmds.push(close());
  return cmds;
}


// ===================================================================
//  STEP 11: 디자인 가이드
// ===================================================================
function buildStep11(data: any, title: string): any[] {
  const cmds: any[] = [
    { action: 'create_page', name: `[디자인가이드] ${title}` },
    openAL(`[디자인가이드] ${title}`, { width: W, gap: 0, fill: C.white, counterSizing: 'FIXED', clip: true }),
  ];
  cmds.push(...docHeader(title, '디자인 가이드'));
  cmds.push(openAL('Content', { padV: 16, padH: 16, gap: 16, fillWidth: true }));

  const tone = data.toneAndManner || {};
  cmds.push(...simpleSectionTitle('A', '톤앤매너'));
  cmds.push(openAL('Tone', { fill: C.bg, padV: 12, padH: 14, gap: 4, fillWidth: true, stroke: C.border, strokeWeight: 1 }));
  if (tone.mainColor) cmds.push(...kvRow('메인 컬러', safeStr(tone.mainColor)));
  if (tone.subColors) cmds.push(...kvRow('서브 컬러', safeStr(tone.subColors)));
  if (tone.mood) cmds.push(...kvRow('무드', safeStr(tone.mood)));
  if (tone.style) cmds.push(...kvRow('스타일', safeStr(tone.style)));
  cmds.push(close());

  const typo = data.typography || {};
  if (typo.headingFont || typo.bodyFont) {
    cmds.push(...simpleSectionTitle('B', '타이포그래피'));
    cmds.push(openAL('Typo', { fill: C.bg, padV: 12, padH: 14, gap: 4, fillWidth: true, stroke: C.border, strokeWeight: 1 }));
    if (typo.headingFont) cmds.push(...kvRow('헤딩', safeStr(typo.headingFont)));
    if (typo.bodyFont) cmds.push(...kvRow('본문', safeStr(typo.bodyFont)));
    cmds.push(close());
  }

  if (data.layoutGuide?.length > 0) {
    cmds.push(...simpleSectionTitle('C', '레이아웃'));
    cmds.push(openAL('Layout', { gap: 0, fillWidth: true }));
    cmds.push(...tableHeader([{ text:'섹션', width:60 }, { text:'레이아웃', width:200 }, { text:'설명', width:586 }]));
    data.layoutGuide.forEach((l: any, i: number) => { if (!l.layoutType) return; cmds.push(...tableRow([{ text:`${l.sectionNum||i+1}`, width:60 }, { text:safeStr(l.layoutType), width:200, bold:true }, { text:safeStr(l.description), width:586 }], i%2===0)); });
    cmds.push(close());
  }

  if (data.cutSectionMapping?.length > 0) {
    cmds.push(...simpleSectionTitle('D', '매핑표'));
    cmds.push(openAL('Map', { gap: 0, fillWidth: true }));
    cmds.push(...tableHeader([{ text:'컷#', width:60 }, { text:'섹션#', width:80 }, { text:'용도', width:706 }]));
    data.cutSectionMapping.forEach((m: any, i: number) => cmds.push(...tableRow([{ text:`${m.cutNum||'—'}`, width:60 }, { text:`${m.sectionNum||'—'}`, width:80 }, { text:safeStr(m.usage), width:706 }], i%2===0)));
    cmds.push(close());
  }

  cmds.push(close());
  cmds.push(...docFooter());
  cmds.push(close());
  return cmds;
}


// ===================================================================
//  빌드 함수 (export_to_figma 도구에서도 사용)
// ===================================================================
export function buildFigmaExport(step: number, formData: any, projectTitle: string): any[] {
  const t = projectTitle || '프로젝트';
  if (!formData) formData = {};

  switch (step) {
    case 0: return buildStep0(formData, t);
    case 1: return buildStep1(formData, t);
    case 5: return buildStep5(formData, t);
    case 8: return buildStep8(formData, t);
    case 11: return buildStep11(formData, t);
    default:
      return [
        { action: 'create_page', name: `[STEP ${step}] ${t}` },
        openAL(`[STEP ${step}] ${t}`, { width: W, gap: 16, padV: 20, padH: 16, fill: C.white, counterSizing: 'FIXED' }),
          txt(`STEP ${step} 산출물`, { size: F.title, bold: true }),
          txt(JSON.stringify(formData, null, 2).substring(0, 3000), { size: F.sm, color: C.gray }),
        close(),
      ];
  }
}

// ===================================================================
//  POST Handler
// ===================================================================
export async function POST(req: NextRequest) {
  const { step, formData, projectTitle } = await req.json();

  console.log('[Figma Export] step:', step, 'projectTitle:', projectTitle);
  console.log('[Figma Export] formData keys:', Object.keys(formData || {}));
  console.log('[Figma Export] sections:', formData?.sections?.length, 'items');

  if (!isPluginConnected()) {
    return NextResponse.json(
      { error: 'Figma 플러그인이 연결되어 있지 않습니다.' },
      { status: 400 },
    );
  }

  const commands = buildFigmaExport(step, formData, projectTitle);
  console.log('[Figma Export] Total commands:', commands.length);

  try {
    addCommands(commands);
    const results = await waitForResults();
    const ok = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;
    return NextResponse.json({ success: true, message: `Figma 작성 완료! (${ok}개 생성${fail > 0 ? `, ${fail}개 실패` : ''})`, results });
  } catch (e: any) {
    return NextResponse.json({ error: `Figma 오류: ${e.message}` }, { status: 500 });
  }
}
