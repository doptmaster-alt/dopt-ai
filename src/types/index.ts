export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'planner';
  createdAt: string;
}

export interface Project {
  id: number;
  userId: number;
  title: string;
  clientName: string;
  productName: string;
  industry: string;
  currentStep: number;
  status: 'active' | 'completed' | 'archived';
  // 계약 조건 (프로젝트 시작 전 설정)
  sectionCount: number;       // 계약 섹션 수량
  shootingCutCount: number;   // 계약 촬영 컷수
  budget: string;             // 예산/단가
  useModels: boolean;         // 모델(인물) 사용 여부
  pipelineVersion: number;    // 1 = 구버전, 2 = 신버전
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  projectId: number;
  role: 'user' | 'assistant';
  content: string;
  step: number;
  createdAt: string;
}

// ===== 프로젝트 설정 (계약 조건) =====

export interface ProjectSettings {
  sectionCount: number;
  shootingCutCount: number;
  budget: string;
  useModels: boolean;
}

// ===== Step Form Data Types =====

export interface StepFormData {
  [key: string]: any;
}

// ──────────────────────────────────────────
// 새 파이프라인 V2 (12단계)
// ──────────────────────────────────────────

// STEP 0: 작업의뢰서 첨부 (생략 가능)
export interface StepWorkOrderData extends StepFormData {
  hasWorkOrder: boolean;
  files: { name: string; path: string; uploadedAt: string }[];
  summary: string;           // AI가 작업의뢰서를 분석한 요약
  skipped: boolean;          // 작업의뢰서 없이 건너뛴 경우
}

// STEP 1: 시장조사 & 분석
export interface StepResearchData extends StepFormData {
  competitors: { name: string; url: string; strengths: string; weaknesses: string; pageStructure: string; sectionCount: number }[];
  marketTrends: string;
  targetAnalysis: string;
  keywords: string[];
  adRegulations: string;
  categoryInsight: string;    // 카테고리 전체 분석
  pricingAnalysis: string;    // 가격/포지셔닝 분석
  socialSentiment: string;    // 소셜 반응/리뷰 분석
  researchSummary: string;
  searchQueries: string[];    // 수행한 검색 쿼리 목록
}

// STEP 2: 브리프 작성
export interface StepBriefData extends StepFormData {
  productName: string;
  slogan: string;
  mainTarget: string;
  massTarget: string;
  totalSections: number;
  uspTable: { item: string; detail: string; vsCompetitor: string; adCheck: string; direction: string }[];
  tocSections: { num: number; name: string; detail: string }[];
  clientPreference: string;
  designRef: string;
  photoRef: string;
  aiModelPersona: string;
  useModels: boolean;         // 모델 사용 여부 (계약 조건에서 가져옴)
  contractSections: number;   // 계약 섹션 수
  contractCuts: number;       // 계약 촬영 컷수
  suggestedSections: number;  // AI 추천 섹션 수 (단가 상향 제안 시)
  suggestedCuts: number;      // AI 추천 촬영 컷수
  upsellReason: string;       // 섹션/컷수 증가 제안 이유
  aeCommentary: string;
}

// STEP 3: 브리프 확정
export interface StepBriefConfirmData extends StepFormData {
  isConfirmed: boolean;
  confirmedAt: string;
  confirmedBy: number;        // user id
  briefSnapshot: string;      // 확정 시점의 브리프 JSON 스냅샷
  pdfPath: string;            // 생성된 PDF 파일 경로
  revisionNote: string;       // 확정 전 마지막 수정 메모
}

// STEP 4: 기획안 작성
export interface StepPlanData extends StepFormData {
  sections: {
    num: number;
    name: string;
    mainCopy: string;
    subCopy: string;
    description: string;
    planningIntent: string;
    visualDirection: string;
    layout: string;
    wireframeBlocks: any[];
    copyBlocks: any[];
    reference: string;
    aeCommentary: string;
  }[];
  designTone: string;
  colorScheme: string;
  overallNote: string;
  useModels: boolean;
}

// STEP 5: 기획안 확정
export interface StepPlanConfirmData extends StepFormData {
  isConfirmed: boolean;
  confirmedAt: string;
  confirmedBy: number;
  planSnapshot: string;       // 확정 시점의 기획안 JSON 스냅샷
  pdfPath: string;
  revisionNote: string;
}

// STEP 6: 촬영콘티 가이드 작성
export interface StepContiGuideData extends StepFormData {
  projectTitle: string;
  shootDate: string;
  location: string;
  team: string;
  totalCuts: number;
  styledCuts: number;
  gifCuts: number;
  nukkiCuts: number;
  useModels: boolean;
  conceptSummary: { background: string; keyColor: string; lighting: string; mood: string };
  shootNotice: string;
  propList: { item: string; qty: string; note: string }[];
  cutPages: {
    cutNum: number;
    sectionMapping: number;   // 이 컷이 매핑되는 섹션 번호
    shotType: string;
    concept: string;
    composition: string;
    props: string;
    lighting: string;
    modelDirection: string;   // 모델 연출 방향 (모델 사용 시)
    note: string;
  }[];
  cutDetails: { cutNum: number; type: string; concept: string; composition: string; props: string; note: string }[];
  nukkiGuide: string;
}

// STEP 7: 촬영콘티 확정본 업로드
export interface StepContiUploadData extends StepFormData {
  isUploaded: boolean;
  files: { name: string; path: string; uploadedAt: string }[];
  uploaderNote: string;       // 스타일리스트 메모
}

// STEP 8: 디자인 가이드 작성
export interface StepDesignGuideData extends StepFormData {
  toneAndManner: { mainColor: string; subColors: string; mood: string; style: string };
  typography: { headingFont: string; bodyFont: string; sizes: string; weights: string };
  layoutGuide: { sectionNum: number; layoutType: string; description: string }[];
  cutSectionMapping: { cutNum: number; sectionNum: number; usage: string }[];
  designDirection: string;
  additionalNotes: string;
}

// STEP 9: 상세페이지 디자인 확정본 업로드
export interface StepDesignUploadData extends StepFormData {
  isUploaded: boolean;
  files: { name: string; path: string; uploadedAt: string }[];
  designerNote: string;
}

// STEP 10: 프로젝트 마무리 (최종 PDF 업로드)
export interface StepWrapUpData extends StepFormData {
  briefPdf: { name: string; path: string; uploadedAt: string } | null;
  planPdf: { name: string; path: string; uploadedAt: string } | null;
  designPdf: { name: string; path: string; uploadedAt: string } | null;
  isComplete: boolean;
}

// STEP 11: AI 총평 & 리포팅
export interface StepReviewData extends StepFormData {
  reviewContent: string;       // AI 총평 내용
  strengths: string[];         // 잘한 점
  improvements: string[];      // 개선 필요 사항
  recommendations: string[];   // 다음 프로젝트 추천
  emailSentAt: string;         // 이메일 발송 시간
  gdriveUrl: string;           // Google Drive 포트폴리오 URL
  learningsExtracted: boolean; // 학습 데이터 추출 완료 여부
}

// ──────────────────────────────────────────
// 구 파이프라인 V1 타입 (하위 호환성)
// ──────────────────────────────────────────

export interface Step0Data extends StepFormData {
  competitors: { name: string; url: string; strengths: string; pageStructure: string }[];
  trends: string;
  keywords: string;
  targetInsight: string;
  adRegulations: string;
  similarProjects: string;
  researchSummary: string;
}

export interface Step1Data extends StepFormData {
  productName: string;
  slogan: string;
  mainTarget: string;
  massTarget: string;
  totalSections: number;
  uspTable: { item: string; detail: string; vsCompetitor: string; adCheck: string; direction: string }[];
  tocSections: { num: number; name: string; detail: string }[];
  clientPreference: string;
  designRef: string;
  photoRef: string;
  aiModelPersona: string;
  aeCommentary: string;
}

export interface Step2Data extends StepFormData {
  revisions: { section: string; before: string; after: string; reason: string }[];
  finalBrief: string;
  aeNotes: string;
}

export interface Step3Data extends StepFormData {
  deliveryDate: string;
  deliveryMethod: string;
  clientQuestions: string;
  attachments: string;
  deliveryNote: string;
}

export interface Step4Data extends StepFormData {
  feedbackItems: { section: string; feedback: string; action: string; adCheckConflict: boolean }[];
  feedbackSummary: string;
  revisedBrief: string;
}

export interface Step5Data extends StepFormData {
  sections: {
    num: number;
    name: string;
    mainCopy: string;
    subCopy: string;
    visualDirection: string;
    layout: string;
    reference: string;
    aeCommentary: string;
  }[];
  designTone: string;
  colorScheme: string;
  overallNote: string;
}

export interface Step6Data extends StepFormData {
  revisions: { sectionNum: number; field: string; before: string; after: string; alternatives: string[] }[];
  finalPlan: string;
}

export interface Step7Data extends StepFormData {
  version: string;
  clientFeedback: string;
  changes: { section: string; change: string }[];
  finalStatus: 'draft' | 'review' | 'revision' | 'confirmed';
  confirmedDate: string;
}

export interface Step8Data extends StepFormData {
  projectTitle: string;
  shootDate: string;
  location: string;
  team: string;
  totalCuts: number;
  styledCuts: number;
  gifCuts: number;
  nukkiCuts: number;
  conceptSummary: { background: string; keyColor: string; lighting: string; mood: string };
  shootNotice: string;
  propList: { item: string; qty: string; note: string }[];
  cutDetails: { cutNum: number; type: string; concept: string; composition: string; props: string; note: string }[];
  nukkiGuide: string;
}

export interface Step9Data extends StepFormData {
  revisions: { cutNum: number; field: string; before: string; after: string }[];
  addedCuts: { cutNum: number; type: string; concept: string }[];
  removedCuts: number[];
  revisedConti: string;
}

export interface Step10Data extends StepFormData {
  version: string;
  clientFeedback: string;
  changes: { cut: string; change: string }[];
  finalStatus: 'draft' | 'review' | 'revision' | 'confirmed';
  confirmedDate: string;
}

export interface Step11Data extends StepFormData {
  toneAndManner: { mainColor: string; subColors: string; mood: string; style: string };
  typography: { headingFont: string; bodyFont: string; sizes: string; weights: string };
  layoutGuide: { sectionNum: number; layoutType: string; description: string }[];
  cutSectionMapping: { cutNum: number; sectionNum: number; usage: string }[];
  additionalNotes: string;
}

// ──────────────────────────────────────────
// 단계 상태 & 정의
// ──────────────────────────────────────────

export const STEP_STATUS_LABELS: Record<string, string> = {
  empty: '미시작',
  draft: '작성중',
  review: '검토중',
  revision: '수정중',
  confirmed: '확정',
  locked: '잠금',
  uploaded: '업로드 완료',
  completed: '완료',
  delivered: '전달완료',
  skipped: '건너뜀',
};

// 단계 유형
export type StepType = 'upload' | 'ai-work' | 'confirmation';

export interface StepDefinition {
  id: number;
  name: string;
  short: string;
  type: StepType;
  skippable?: boolean;  // 건너뛸 수 있는 단계
  lockable?: boolean;   // 확정/잠금 가능한 단계
  icon: string;         // 이모지 아이콘
  description: string;  // 단계 설명
}

// ===== 새 파이프라인 V2 (10단계, 0-indexed) =====
// 브리프 확정 / 기획안 확정 단계 제거 — 각 패널에서 직접 컨펌
export const STEPS: readonly StepDefinition[] = [
  {
    id: 0,
    name: '작업의뢰서 첨부',
    short: 'STEP 1',
    type: 'upload',
    skippable: true,
    icon: '📎',
    description: '클라이언트의 작업의뢰서를 업로드합니다. 없으면 건너뛸 수 있습니다.',
  },
  {
    id: 1,
    name: '시장조사 & 분석',
    short: 'STEP 2',
    type: 'ai-work',
    icon: '🔍',
    description: 'AI가 시장, 경쟁사, 트렌드를 심층 조사하고 분석합니다.',
  },
  {
    id: 2,
    name: '브리프 작성',
    short: 'STEP 3',
    type: 'ai-work',
    icon: '📝',
    description: '시장조사 결과를 바탕으로 브리프를 작성합니다. 편집 및 QC 후 확정합니다.',
  },
  {
    id: 3,
    name: '기획안 작성',
    short: 'STEP 4',
    type: 'ai-work',
    icon: '📋',
    description: '확정된 브리프를 기반으로 기획안을 작성합니다. 편집 및 QC 후 확정합니다.',
  },
  {
    id: 4,
    name: '촬영콘티 가이드 작성',
    short: 'STEP 5',
    type: 'ai-work',
    icon: '🎬',
    description: '확정된 기획안을 기반으로 촬영콘티 가이드를 작성합니다.',
  },
  {
    id: 5,
    name: '촬영콘티 확정본 업로드',
    short: 'STEP 6',
    type: 'upload',
    icon: '📤',
    description: '스타일리스트가 작성한 촬영콘티 확정본을 업로드합니다.',
  },
  {
    id: 6,
    name: '디자인 가이드 작성',
    short: 'STEP 7',
    type: 'ai-work',
    icon: '🎨',
    description: 'AI가 디자인 톤앤매너, 타이포그래피, 레이아웃 가이드를 작성합니다.',
  },
  {
    id: 7,
    name: '디자인 확정본 업로드',
    short: 'STEP 8',
    type: 'upload',
    icon: '📤',
    description: '완성된 상세페이지 디자인 확정본을 업로드합니다.',
  },
  {
    id: 8,
    name: '프로젝트 마무리',
    short: 'STEP 9',
    type: 'upload',
    icon: '📦',
    description: '브리프, 기획안, 디자인 최종본을 PDF로 업로드하여 프로젝트를 정리합니다.',
  },
  {
    id: 9,
    name: 'AI 총평 & 리포팅',
    short: 'STEP 10',
    type: 'ai-work',
    icon: '📊',
    description: 'AI가 프로젝트 총평을 작성하고, 이메일 발송 및 포트폴리오를 관리합니다.',
  },
] as const;

// ===== 구 파이프라인 V1 (하위 호환성) =====
export const STEPS_V1 = [
  { id: 0, name: '시장조사 & 분석', short: 'STEP 0' },
  { id: 1, name: '브리프 초안 생성', short: 'STEP 1' },
  { id: 2, name: '브리프 다듬기', short: 'STEP 2' },
  { id: 3, name: '클라이언트 전달', short: 'STEP 3' },
  { id: 4, name: '피드백 반영', short: 'STEP 4' },
  { id: 5, name: '기획안 초안 생성', short: 'STEP 5' },
  { id: 6, name: '기획안 다듬기', short: 'STEP 6' },
  { id: 7, name: '기획안 컨펌', short: 'STEP 7' },
  { id: 8, name: '촬영콘티 생성', short: 'STEP 8' },
  { id: 9, name: '콘티 수정', short: 'STEP 9' },
  { id: 10, name: '콘티 컨펌', short: 'STEP 10' },
  { id: 11, name: '디자인 가이드', short: 'STEP 11' },
] as const;

// 파이프라인 버전에 따른 STEPS 반환
export function getStepsForVersion(version: number): readonly StepDefinition[] | readonly { id: number; name: string; short: string }[] {
  return version >= 2 ? STEPS : STEPS_V1;
}

// 확정 데이터 인터페이스
export interface ConfirmedData {
  id: number;
  projectId: number;
  step: number;
  dataType: 'brief' | 'plan';
  confirmedData: string;      // JSON 스냅샷
  pdfPath: string;
  confirmedAt: string;
  confirmedBy: number;
}

// 프로젝트 파일 인터페이스
export interface ProjectFile {
  id: number;
  projectId: number;
  step: number;
  fileType: 'work_order' | 'conti_confirmed' | 'design_confirmed' | 'brief_pdf' | 'plan_pdf' | 'design_pdf' | 'final_report';
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

// AI 총평 인터페이스
export interface AiReview {
  id: number;
  projectId: number;
  reviewContent: string;
  reportPdfPath: string;
  emailSentAt: string | null;
  gdriveUrl: string | null;
  createdAt: string;
}
