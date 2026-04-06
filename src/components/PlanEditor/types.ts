// ===== Block Types for the Planning Document Editor =====

export interface CopyBlock {
  type:
    | 'section-title' | 'heading' | 'text' | 'label'
    | 'copy-main' | 'copy-sub'
    | 'image-placeholder' | 'info-box' | 'list' | 'note'
    | 'ae-comment' | 'layout-tag' | 'visual-direction'
    | 'divider' | 'kv-pair' | 'promo-box';
  text?: string;
  desc?: string;
  label?: string;
  value?: string;
  items?: string[];
  size?: 'xs' | 'sm' | 'md' | 'lg';
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export interface WireframeBlock {
  type:
    | 'wf-heading' | 'wf-text' | 'wf-image' | 'wf-button'
    | 'wf-card-grid' | 'wf-table' | 'wf-bar-chart' | 'wf-icon-list'
    | 'wf-split' | 'wf-form-input' | 'wf-badge-row' | 'wf-stats'
    | 'wf-review-card' | 'wf-product-grid' | 'wf-timeline'
    | 'wf-progress-bar' | 'wf-logo' | 'wf-promo-badge' | 'wf-price'
    | 'wf-trust-badges' | 'wf-source' | 'wf-divider' | 'wf-spacer'
    | 'wf-tabs' | 'wf-accordion' | 'wf-video' | 'wf-before-after'
    | 'wf-quote' | 'wf-number-highlight' | 'wf-checklist' | 'wf-comparison-row';
  text?: string;
  desc?: string;
  label?: string;
  value?: string;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  height?: number;
  cols?: number;
  before?: string;
  after?: string;
  items?: { label: string; desc?: string; value?: string; percent?: number }[];
  headers?: string[];
  rows?: { cells: string[] }[];
  tabs?: string[];
}

export interface SectionData {
  num: number;
  name: string;
  mainCopy?: string;
  subCopy?: string;
  visualDirection?: string;
  layout?: string;
  reference?: string;
  aeCommentary?: string;
  description?: string;
  planningIntent?: string;
  productName?: string;
  copyBlocks?: CopyBlock[];
  wireframeBlocks?: WireframeBlock[];
  referenceImageUrl?: string;
  referenceNote?: string;
}

export interface ReferenceImage {
  id: string;
  url: string;
  note?: string;
  tab: 'design' | 'photo';
  sectionNum?: number;
}

export interface PlanData {
  sections: SectionData[];
  designTone?: string;
  colorScheme?: string;
  overallNote?: string;
  brandName?: string;
  productName?: string;
  referenceImages?: ReferenceImage[];
}

// ===== 디자인 패턴 라이브러리 타입 =====

export const SECTION_TYPES = [
  'hero',           // 히어로/메인 배너
  'ingredient',     // 성분/원료 소개
  'benefit',        // 효능/효과
  'how-to',         // 사용법/먹는법
  'review',         // 리뷰/후기
  'trust',          // 인증/신뢰
  'pricing',        // 가격/구매
  'faq',            // FAQ
  'cta',            // CTA/마무리
  'story',          // 브랜드 스토리
  'comparison',     // 비교/차별점
  'detail',         // 상세 정보
  'guarantee',      // 보증/안심
  'unboxing',       // 구성품/언박싱
] as const;

export type SectionType = typeof SECTION_TYPES[number];

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  'hero': '히어로/메인 배너',
  'ingredient': '성분/원료 소개',
  'benefit': '효능/효과',
  'how-to': '사용법/먹는법',
  'review': '리뷰/후기',
  'trust': '인증/신뢰',
  'pricing': '가격/구매',
  'faq': 'FAQ',
  'cta': 'CTA/마무리',
  'story': '브랜드 스토리',
  'comparison': '비교/차별점',
  'detail': '상세 정보',
  'guarantee': '보증/안심',
  'unboxing': '구성품/언박싱',
};

export interface DesignPattern {
  id: number;
  section_type: SectionType;
  pattern_name: string;
  description: string;
  industry: string;
  tone: string;
  thumbnail_url: string;
  wireframe_blocks: WireframeBlock[];
  copy_blocks: CopyBlock[];
  tags: string;
  source: 'seed' | 'learned' | 'manual' | 'reference';
  usage_count: number;
  score: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// Editor-specific colors (matching Figma export)
export const COLORS = {
  white: '#FFFFFF',
  bg: '#F5F5F5',
  phoneBg: '#FAFAFA',
  black: '#1A1A1A',
  dark: '#333333',
  body: '#444444',
  gray: '#888888',
  lightGray: '#BBBBBB',
  veryLightGray: '#E0E0E0',
  border: '#CCCCCC',
  sectionTitle: '#CC0000',
  aeRed: '#CC0000',
  headerBg: '#E8E8E8',
  wfGray: '#D9D9D9',
  wfDark: '#B0B0B0',
  wfLight: '#EEEEEE',
  wfText: '#999999',
  wfAccent: '#C0C0C0',
  wfBar: '#D0D0D0',
  labelBlue: '#2563EB',
  infoBoxBg: '#EFF6FF',
  promoYellow: '#FEF3C7',
  promoBorder: '#F59E0B',
};
